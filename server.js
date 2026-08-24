const crypto = require("crypto");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const Razorpay = require("razorpay");
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

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "20kb" }));

app.post("/api/payments/order", async (request, response) => {
  try {
    if (!razorpay) {
      return response.status(503).json({
        error: "Payment provider is not configured. Add Razorpay credentials to .env."
      });
    }

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
      notes: { courseIds: courseIds.join(",") }
    });

    return response.status(201).json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("Unable to create Razorpay order:", error.message);
    return response.status(502).json({ error: "Unable to start checkout. Please try again." });
  }
});

app.post("/api/payments/verify", (request, response) => {
  if (!hasRazorpayConfig) {
    return response.status(503).json({ error: "Payment provider is not configured." });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = request.body;
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

  return response.json({ verified: true, paymentId: razorpayPaymentId });
});

app.use(express.static(path.join(__dirname)));
app.get("*", (request, response) => response.sendFile(path.join(__dirname, "index.html")));

app.listen(port, () => {
  console.log(`BuildLikeASenior is running at http://localhost:${port}`);
  if (!hasRazorpayConfig) {
    console.warn("Razorpay is disabled until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set.");
  }
});