const crypto = require("crypto");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const Razorpay = require("razorpay");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT) || 3000;

const coursePrices = Object.freeze({
  dsa: 2499,
  system: 2999,
  lld: 1999,
  career: 1499,
  bundle: 5999,
  architecture: 1799
});

const hasRazorpayConfig = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);
const razorpay = hasRazorpayConfig
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })
  : null;

const hasSupabaseConfig = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseAdmin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "20kb" }));

// Resolves the authenticated Supabase user from the request's bearer token.
async function getUserFromRequest(request) {
  if (!supabaseAdmin) return null;
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function requireUser(request, response) {
  const user = await getUserFromRequest(request);
  if (!user) {
    response.status(401).json({ error: "Please sign in to continue." });
    return null;
  }
  return user;
}

app.get("/api/config", (request, response) => {
  response.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    authEnabled: hasSupabaseConfig,
    paymentsEnabled: hasRazorpayConfig
  });
});

app.post("/api/payments/order", async (request, response) => {
  try {
    if (!razorpay) {
      return response.status(503).json({
        error: "Payment provider is not configured. Add Razorpay credentials to .env."
      });
    }
    const user = await requireUser(request, response);
    if (!user) return undefined;

    const courseIds = Array.isArray(request.body.courseIds)
      ? [...new Set(request.body.courseIds)]
      : [];
    if (!courseIds.length || courseIds.some(id => !coursePrices[id])) {
      return response.status(400).json({ error: "The cart contains an invalid course." });
    }

    const amountInPaise = courseIds.reduce(
      (total, id) => total + coursePrices[id] * 100,
      0
    );
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `blas_${Date.now()}`,
      notes: { courseIds: courseIds.join(","), userId: user.id }
    });

    return response.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      email: user.email
    });
  } catch (error) {
    console.error("Unable to create Razorpay order:", error.message);
    return response.status(502).json({ error: "Unable to start checkout. Please try again." });
  }
});

app.post("/api/payments/verify", async (request, response) => {
  if (!hasRazorpayConfig) {
    return response.status(503).json({ error: "Payment provider is not configured." });
  }
  const user = await requireUser(request, response);
  if (!user) return undefined;

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, courseIds } = request.body;
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return response.status(400).json({ error: "Incomplete payment verification data." });
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  const receivedSignature = Buffer.from(razorpaySignature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  const isValid =
    receivedSignature.length === expectedSignatureBuffer.length &&
    crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer);

  if (!isValid) {
    return response.status(400).json({ error: "Payment signature verification failed." });
  }

  const purchasedIds = Array.isArray(courseIds)
    ? [...new Set(courseIds)].filter(id => coursePrices[id])
    : [];
  if (purchasedIds.length && supabaseAdmin) {
    const rows = purchasedIds.map(id => ({
      user_id: user.id,
      course_id: id,
      amount: coursePrices[id],
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId
    }));
    const { error } = await supabaseAdmin
      .from("purchases")
      .upsert(rows, { onConflict: "user_id,course_id" });
    if (error) {
      console.error("Unable to record purchase:", error.message);
      return response.status(500).json({ error: "Payment succeeded but access could not be saved. Contact support." });
    }
  }

  return response.json({ verified: true, paymentId: razorpayPaymentId, courseIds: purchasedIds });
});

app.get("/api/me/courses", async (request, response) => {
  const user = await requireUser(request, response);
  if (!user) return undefined;
  if (!supabaseAdmin) return response.json({ courseIds: [] });

  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("course_id")
    .eq("user_id", user.id);
  if (error) {
    console.error("Unable to load purchases:", error.message);
    return response.status(500).json({ error: "Unable to load your courses." });
  }
  return response.json({ courseIds: data.map(row => row.course_id) });
});

// Course content is gated: only buyers of the matching course (or the bundle) may load these folders.
const gatedSections = [
  { prefix: "/dsalgo", courses: ["dsa", "bundle"] },
  { prefix: "/system-design", courses: ["system", "bundle"] },
  { prefix: "/lld", courses: ["lld", "bundle"] }
];

function readCookie(request, name) {
  const header = request.headers.cookie || "";
  const entry = header.split(";").map(part => part.trim()).find(part => part.startsWith(name + "="));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

app.use(async (request, response, next) => {
  const section = gatedSections.find(
    s => request.path === s.prefix || request.path.startsWith(s.prefix + "/")
  );
  if (!section || !supabaseAdmin) return next();
  const deny = () => response.redirect(302, "/?unlock=" + section.prefix.slice(1));
  const token = readCookie(request, "sb-access-token");
  if (!token) return deny();
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return deny();
    const { data: rows } = await supabaseAdmin
      .from("purchases")
      .select("course_id")
      .eq("user_id", data.user.id);
    const owned = (rows || []).map(row => row.course_id);
    if (!section.courses.some(course => owned.includes(course))) return deny();
    return next();
  } catch (err) {
    console.error("Content gate error:", err.message);
    return deny();
  }
});

app.use(express.static(path.join(__dirname)));
app.get("*", (request, response) => response.sendFile(path.join(__dirname, "index.html")));

app.listen(port, () => {
  console.log(`BuildLikeASenior is running at http://localhost:${port}`);
  if (!hasRazorpayConfig) {
    console.warn("Razorpay is disabled until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.");
  }
  if (!hasSupabaseConfig) {
    console.warn("Supabase auth is disabled until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  }
});