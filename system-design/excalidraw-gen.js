/**
 * Excalidraw Diagram Generator for System Design
 * ------------------------------------------------
 * Usage:
 *   node excalidraw-gen.js            → generates all example diagrams
 *   node excalidraw-gen.js youtube    → generates youtube.excalidraw
 *
 * Opens the .excalidraw file in VS Code or paste into excalidraw.com
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─── Helpers ───────────────────────────────────────────────────────────────────

const uid = () => crypto.randomBytes(10).toString("hex");

const COLORS = {
  teal: "#00d4aa",
  blue: "#5b8dee",
  gold: "#f5c842",
  rose: "#ff6b9d",
  navy: "#0d1b35",
  white: "#ffffff",
  black: "#1e1e1e",
  gray: "#868e96",
  red: "#e03131",
  green: "#2f9e44",
  orange: "#f08c00",
  violet: "#7048e8",
};

const FILL = { solid: "solid", hachure: "hachure", cross: "cross-hatch" };

// ─── Base Element Factory ──────────────────────────────────────────────────────

function baseElement(type, x, y, w, h, opts = {}) {
  return {
    id: uid(),
    type,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: opts.strokeColor || COLORS.black,
    backgroundColor: opts.bgColor || "transparent",
    fillStyle: opts.fillStyle || FILL.solid,
    strokeWidth: opts.strokeWidth || 2,
    roughness: opts.roughness ?? 1,
    opacity: opts.opacity || 100,
    groupIds: opts.groupIds || [],
    roundness: opts.roundness || { type: 3 },
    seed: Math.floor(Math.random() * 2e9),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2e9),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

// ─── Shape Builders ────────────────────────────────────────────────────────────

function rect(x, y, w, h, opts = {}) {
  return baseElement("rectangle", x, y, w, h, opts);
}

function ellipse(x, y, w, h, opts = {}) {
  return { ...baseElement("ellipse", x, y, w, h, opts), roundness: null };
}

function diamond(x, y, w, h, opts = {}) {
  return baseElement("diamond", x, y, w, h, opts);
}

function text(x, y, content, opts = {}) {
  const fontSize = opts.fontSize || 16;
  const lines = content.split("\n");
  const w = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
  const h = lines.length * fontSize * 1.35;
  return {
    ...baseElement("text", x, y, w, h, opts),
    text: content,
    fontSize,
    fontFamily: opts.fontFamily || 1, // 1=Virgil, 2=Helvetica, 3=Cascadia
    textAlign: opts.textAlign || "center",
    verticalAlign: opts.verticalAlign || "middle",
    baseline: fontSize,
    containerId: opts.containerId || null,
    originalText: content,
    roundness: null,
  };
}

function arrow(x, y, points, opts = {}) {
  // Excalidraw arrows must start at the local origin [0,0]; callers often pass
  // only the displacement(s), so normalize by prepending [0,0] when missing.
  const pts = points[0][0] === 0 && points[0][1] === 0 ? points : [[0, 0], ...points];
  const endX = pts[pts.length - 1][0];
  const endY = pts[pts.length - 1][1];
  return {
    ...baseElement("arrow", x, y, Math.abs(endX), Math.abs(endY), opts),
    points: pts,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: opts.startArrowhead || null,
    endArrowhead: opts.endArrowhead || "arrow",
    roundness: { type: 2 },
  };
}

function line(x, y, points, opts = {}) {
  const pts = points[0][0] === 0 && points[0][1] === 0 ? points : [[0, 0], ...points];
  const endX = pts[pts.length - 1][0];
  const endY = pts[pts.length - 1][1];
  return {
    ...baseElement("line", x, y, Math.abs(endX), Math.abs(endY), opts),
    points: pts,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    roundness: { type: 2 },
  };
}

// ─── System Design Components ──────────────────────────────────────────────────

function server(x, y, label, opts = {}) {
  const w = opts.w || 120;
  const h = opts.h || 60;
  const r = rect(x, y, w, h, { bgColor: opts.color || "#a5d8ff", ...opts });
  const t = text(x + w / 2 - (label.length * 9.6) / 2, y + h / 2 - 10, label, {
    fontSize: 16,
    containerId: r.id,
  });
  r.boundElements = [{ id: t.id, type: "text" }];
  return [r, t];
}

function database(x, y, label, opts = {}) {
  const w = opts.w || 100;
  const h = opts.h || 70;
  const e = ellipse(x, y, w, h, { bgColor: opts.color || "#b2f2bb", ...opts });
  const t = text(x + w / 2 - (label.length * 9.6) / 2, y + h / 2 - 10, label, {
    fontSize: 14,
    containerId: e.id,
  });
  e.boundElements = [{ id: t.id, type: "text" }];
  return [e, t];
}

function cache(x, y, label, opts = {}) {
  return server(x, y, label, { color: "#ffec99", ...opts });
}

function queue(x, y, label, opts = {}) {
  const w = opts.w || 140;
  const h = opts.h || 50;
  const r = rect(x, y, w, h, {
    bgColor: opts.color || "#d0bfff",
    roundness: { type: 3 },
    ...opts,
  });
  const t = text(x + w / 2 - (label.length * 9.6) / 2, y + h / 2 - 10, label, {
    fontSize: 14,
    containerId: r.id,
  });
  r.boundElements = [{ id: t.id, type: "text" }];
  return [r, t];
}

function loadBalancer(x, y, label, opts = {}) {
  const w = opts.w || 100;
  const h = opts.h || 80;
  const d = diamond(x, y, w, h, { bgColor: opts.color || "#ffc9c9", ...opts });
  const t = text(x + w / 2 - (label.length * 9.6) / 2, y + h / 2 - 10, label || "LB", {
    fontSize: 14,
    containerId: d.id,
  });
  d.boundElements = [{ id: t.id, type: "text" }];
  return [d, t];
}

function client(x, y, label, opts = {}) {
  return server(x, y, label || "Client", { color: "#e3fafc", ...opts });
}

function cdn(x, y, label, opts = {}) {
  return server(x, y, label || "CDN", { color: "#fff3bf", w: 80, ...opts });
}

function labelText(x, y, content, opts = {}) {
  return text(x, y, content, { fontSize: opts.fontSize || 12, strokeColor: COLORS.gray, ...opts });
}

// ─── Diagram Builder ───────────────────────────────────────────────────────────

function buildDiagram(elements, opts = {}) {
  return {
    type: "excalidraw",
    version: 2,
    source: "excalidraw-gen.js",
    elements: elements.flat(),
    appState: {
      gridSize: null,
      viewBackgroundColor: opts.bg || "#ffffff",
    },
    files: {},
  };
}

function saveDiagram(name, diagram) {
  const outPath = path.join(__dirname, `${name}.excalidraw`);
  fs.writeFileSync(outPath, JSON.stringify(diagram, null, 2));
  console.log(`✓ ${outPath}`);
  const svgPath = path.join(__dirname, `${name}.svg`);
  fs.writeFileSync(svgPath, toSVG(diagram));
  console.log(`✓ ${svgPath}`);
}

// ─── SVG Renderer (clean, embeddable) ───────────────────────────────────────────

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fontStack(fam) {
  if (fam === 3) return "'Cascadia Code','JetBrains Mono',monospace";
  return "'Segoe UI','Inter',system-ui,sans-serif";
}

function toSVG(diagram) {
  const els = diagram.elements.filter((e) => !e.isDeleted);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of els) {
    if (e.type === "arrow" || e.type === "line") {
      for (const p of e.points || []) {
        minX = Math.min(minX, e.x + p[0]); minY = Math.min(minY, e.y + p[1]);
        maxX = Math.max(maxX, e.x + p[0]); maxY = Math.max(maxY, e.y + p[1]);
      }
    } else {
      minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
      maxX = Math.max(maxX, e.x + (e.width || 0)); maxY = Math.max(maxY, e.y + (e.height || 0));
    }
  }
  const pad = 24;
  const W = Math.ceil(maxX - minX + pad * 2);
  const H = Math.ceil(maxY - minY + pad * 2);
  const ox = -minX + pad, oy = -minY + pad;
  const order = { rectangle: 1, ellipse: 1, diamond: 1, line: 2, arrow: 3, text: 4 };
  const sorted = [...els].sort((a, b) => (order[a.type] || 5) - (order[b.type] || 5));
  const byId = {};
  for (const e of els) byId[e.id] = e;

  let body = "";
  for (const e of sorted) {
    const stroke = e.strokeColor || "#1e1e1e";
    const sw = e.strokeWidth || 1.5;
    if (e.type === "rectangle") {
      const fill = e.backgroundColor === "transparent" || !e.backgroundColor ? "none" : e.backgroundColor;
      body += `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>\n`;
    } else if (e.type === "ellipse") {
      const fill = e.backgroundColor === "transparent" || !e.backgroundColor ? "none" : e.backgroundColor;
      body += `<ellipse cx="${e.x + e.width / 2}" cy="${e.y + e.height / 2}" rx="${e.width / 2}" ry="${e.height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>\n`;
    } else if (e.type === "diamond") {
      const fill = e.backgroundColor === "transparent" || !e.backgroundColor ? "none" : e.backgroundColor;
      const cx = e.x + e.width / 2, cy = e.y + e.height / 2;
      const pts = `${cx},${e.y} ${e.x + e.width},${cy} ${cx},${e.y + e.height} ${e.x},${cy}`;
      body += `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>\n`;
    } else if (e.type === "arrow" || e.type === "line") {
      const pts = (e.points || []).map((p) => `${e.x + p[0]},${e.y + p[1]}`).join(" ");
      const marker = e.type === "arrow" ? ` marker-end="url(#arrow)"` : "";
      body += `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${(e.strokeWidth || 2)}"${marker}/>\n`;
    } else if (e.type === "text") {
      const fam = fontStack(e.fontFamily);
      const fs = e.fontSize || 14;
      const lines = String(e.text).split("\n");
      const lh = fs * 1.28;
      if (e.containerId && byId[e.containerId]) {
        const c = byId[e.containerId];
        const cx = c.x + c.width / 2;
        const cy = c.y + c.height / 2;
        const startY = cy - ((lines.length - 1) * lh) / 2;
        let tspans = "";
        lines.forEach((ln, i) => {
          tspans += `<tspan x="${cx}" y="${startY + i * lh + fs * 0.35}">${escXml(ln)}</tspan>`;
        });
        body += `<text font-family="${fam}" font-size="${fs}" fill="${stroke}" text-anchor="middle">${tspans}</text>\n`;
      } else {
        let tspans = "";
        lines.forEach((ln, i) => {
          tspans += `<tspan x="${e.x}" y="${e.y + fs + i * lh}">${escXml(ln)}</tspan>`;
        });
        body += `<text font-family="${fam}" font-size="${fs}" fill="${stroke}" text-anchor="start">${tspans}</text>\n`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-weight="600">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#495057"/>
  </marker>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
<g transform="translate(${ox},${oy})">
${body}</g>
</svg>
`;
}

// ─── Example Diagrams ──────────────────────────────────────────────────────────

function genYoutube() {
  const els = [
    labelText(300, 10, "Design YouTube — High Level Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(50, 150, "Mobile/Web"),
    ...arrow(175, 180, [[60, 0]]),
    ...cdn(250, 145, "CDN"),
    ...arrow(335, 175, [[60, 0]]),
    ...loadBalancer(410, 140, "LB"),

    ...arrow(465, 225, [[0, 60]]),
    ...server(405, 300, "API Gateway", { w: 130 }),

    // Upload path
    ...arrow(405, 335, [[-100, 0], [-100, 80]]),
    ...server(220, 390, "Upload Svc", { color: "#d0bfff" }),
    ...arrow(280, 455, [[0, 50]]),
    ...queue(210, 510, "Transcode Queue"),
    ...arrow(280, 565, [[0, 50]]),
    ...server(220, 620, "Transcoder", { color: "#ffc9c9" }),
    ...arrow(280, 685, [[0, 40]]),
    ...database(240, 730, "Object\nStorage"),

    // Read path
    ...arrow(540, 335, [[100, 0], [100, 80]]),
    ...server(580, 390, "Video Svc", { color: "#a5d8ff" }),
    ...arrow(640, 455, [[0, 50]]),
    ...database(600, 510, "Metadata\nDB"),

    // Recommendation
    ...arrow(540, 335, [[200, 0], [200, 120]]),
    ...server(700, 420, "Rec Engine", { color: "#ffec99" }),

    // Labels
    labelText(130, 395, "resumable upload"),
    labelText(520, 395, "HLS/DASH stream"),
    labelText(680, 400, "ML ranking"),
  ];

  return buildDiagram(els);
}

function genGoogleDocs() {
  const els = [
    labelText(250, 10, "Design Google Docs — CRDT Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(50, 120, "Editor A"),
    ...client(50, 250, "Editor B"),

    ...arrow(175, 150, [[80, 0]]),
    ...arrow(175, 280, [[80, 30]]),

    ...server(270, 170, "Collab Service\n(WebSocket)", { w: 160, h: 70, color: "#a5d8ff" }),

    ...arrow(435, 205, [[80, 0]]),
    ...server(530, 180, "CRDT Engine", { w: 130, h: 60, color: "#d0bfff" }),

    ...arrow(595, 245, [[0, 60]]),
    ...queue(530, 310, "Kafka Op Log", { w: 130 }),

    ...arrow(595, 365, [[0, 50]]),
    ...database(555, 420, "S3\nSnapshots"),

    ...arrow(435, 225, [[80, 100]]),
    ...cache(530, 320, "Redis Cache"),

    labelText(130, 130, "WebSocket"),
    labelText(440, 160, "merge ops"),
    labelText(480, 430, "periodic\nsnapshot"),
  ];

  return buildDiagram(els);
}

function genTypeahead() {
  const els = [
    labelText(220, 10, "Typeahead Suggestions — Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(50, 150, "Browser"),
    ...arrow(175, 180, [[60, 0]]),
    ...cdn(250, 145, "CDN\n(hot prefixes)"),

    ...arrow(335, 175, [[60, 0]]),
    ...loadBalancer(410, 140, "LB"),
    ...arrow(465, 225, [[0, 50]]),

    ...server(400, 290, "Trie Service", { w: 140, color: "#a5d8ff" }),
    ...arrow(545, 315, [[60, 0]]),
    ...cache(620, 290, "Redis\nTop-K Cache", { w: 120 }),

    ...arrow(470, 355, [[0, 50]]),
    ...database(430, 410, "Trie\nStorage"),

    // Offline pipeline
    ...arrow(470, 480, [[0, 50]]),
    ...server(400, 540, "Aggregator\n(Lambda)", { w: 150, color: "#ffec99" }),
    ...arrow(400, 575, [[-100, 0]]),
    ...queue(200, 540, "Search Logs\n(Kafka)"),

    labelText(260, 120, "cache hit → instant"),
    labelText(550, 275, "pre-computed"),
    labelText(260, 560, "batch + real-time"),
  ];

  return buildDiagram(els);
}

function genLogMessages() {
  const els = [
    labelText(200, 10, "Log Messages in Order — Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...server(50, 100, "Pod 1\n+ Sidecar", { color: "#e3fafc" }),
    ...server(50, 200, "Pod 2\n+ Sidecar", { color: "#e3fafc" }),
    ...server(50, 300, "Pod 3\n+ Sidecar", { color: "#e3fafc" }),

    ...arrow(175, 130, [[80, 50]]),
    ...arrow(175, 230, [[80, 0]]),
    ...arrow(175, 330, [[80, -50]]),

    ...queue(270, 200, "Kafka\n(partitioned by pod)", { w: 200 }),

    ...arrow(475, 225, [[60, 0]]),
    ...server(550, 200, "Consumer\n(per-partition)", { w: 150, color: "#d0bfff" }),

    ...arrow(625, 265, [[0, 60]]),
    ...server(570, 330, "Merge (HLC)", { w: 130, color: "#ffec99" }),

    ...arrow(635, 395, [[0, 50]]),
    ...database(590, 450, "Hot\nStore"),
    ...arrow(590, 455, [[-120, 50]]),
    ...database(430, 510, "Warm/Cold\n(S3)"),

    labelText(60, 80, "5k pods × 200 msg/s"),
    labelText(290, 175, "partition key = pod_id"),
    labelText(555, 310, "Hybrid Logical Clock"),
    labelText(430, 440, "tiered storage"),
  ];

  return buildDiagram(els);
}

function genWiseShare() {
  const els = [
    labelText(200, 10, "Wise Share Purchase — Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(50, 150, "5M Users"),
    ...arrow(175, 180, [[60, 0]]),
    ...loadBalancer(250, 140, "LB"),
    ...arrow(305, 225, [[0, 50]]),

    ...server(250, 290, "Order Service", { w: 140, color: "#a5d8ff" }),

    // Saga
    ...arrow(395, 315, [[60, 0]]),
    ...server(470, 290, "Saga\nOrchestrator", { w: 140, h: 60, color: "#d0bfff" }),

    ...arrow(540, 355, [[0, 50]]),
    ...server(480, 410, "Balance Svc\n(Bulkhead)", { w: 140, h: 60, color: "#ffc9c9" }),

    ...arrow(540, 475, [[0, 40]]),
    ...database(500, 520, "Balance\nDB"),

    // Sharded inventory
    ...arrow(320, 355, [[0, 60]]),
    ...server(250, 420, "Inventory Svc\n(Sharded)", { w: 150, h: 60, color: "#ffec99" }),

    ...arrow(325, 485, [[0, 40]]),
    ...database(285, 530, "Shard 1..N"),

    // Idempotency
    ...arrow(250, 315, [[-80, 0]]),
    ...cache(80, 290, "Idempotency\nKeys (Redis)", { w: 140 }),

    labelText(55, 130, "10M shares @ £10"),
    labelText(475, 270, "compensating txns"),
    labelText(250, 400, "sharded counters"),
    labelText(55, 275, "dedup requests"),
  ];

  return buildDiagram(els);
}

function genPeopleYouMayKnow() {
  const els = [
    labelText(200, 10, "People You May Know — Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(50, 150, "User App"),
    ...arrow(175, 180, [[60, 0]]),
    ...server(250, 150, "API Gateway", { w: 130, color: "#e3fafc" }),
    ...arrow(385, 180, [[60, 0]]),

    // Candidate Generation
    ...server(460, 120, "Candidate\nGenerator", { w: 140, h: 70, color: "#a5d8ff" }),
    ...arrow(530, 195, [[0, 60]]),
    ...database(490, 260, "Social\nGraph DB"),

    // Ranking
    ...arrow(605, 155, [[60, 0]]),
    ...server(680, 130, "ML Ranker", { w: 120, h: 60, color: "#ffec99" }),
    ...arrow(740, 195, [[0, 60]]),
    ...server(680, 260, "Feature Store", { w: 130, color: "#d0bfff" }),

    // Policy filter
    ...arrow(740, 125, [[0, -50]]),
    ...server(680, 40, "Privacy\nFilter", { w: 120, h: 50, color: "#ffc9c9" }),

    // Output
    ...arrow(805, 160, [[60, 0]]),
    ...server(880, 140, "Top-N\nResults", { w: 100, h: 50, color: "#b2f2bb" }),

    labelText(460, 100, "graph traversal"),
    labelText(680, 110, "scoring"),
    labelText(680, 20, "block/mute/policy"),
    labelText(490, 340, "mutuals, overlap"),
  ];

  return buildDiagram(els);
}

function genChatServer() {
  const els = [
    labelText(360, 6, "Design a Chat System — High Level Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    // ─── Path labels ───
    labelText(40, 70, "■ REAL-TIME PATH  (WebSocket — persistent, bidirectional)", { fontSize: 13, strokeColor: COLORS.green }),
    labelText(40, 470, "■ CONTROL PATH  (HTTP REST — login, groups, history)", { fontSize: 13, strokeColor: COLORS.blue }),

    // ─── Clients ───
    ...client(40, 130, "Phone A"),
    ...client(40, 220, "Laptop A"),
    ...client(40, 330, "Phone B"),

    // ─── REAL-TIME PATH: Client → LB → WS Gateway tier ───
    arrow(165, 160, [[60, 30]]),
    arrow(165, 250, [[60, -20]]),
    ...loadBalancer(245, 165, "LB (L4)\nleast-conn", { w: 110, h: 90 }),

    arrow(360, 195, [[55, -70]]),
    arrow(360, 210, [[55, 0]]),
    arrow(360, 225, [[55, 70]]),
    ...server(420, 95, "WS-GW 01\nfd=47 -> Bob", { w: 150, h: 60, color: "#a5d8ff" }),
    ...server(420, 180, "WS-GW 17\n~50K conns", { w: 150, h: 60, color: "#a5d8ff" }),
    ...server(420, 265, "WS-GW 150\n(stateful)", { w: 150, h: 60, color: "#a5d8ff" }),

    // Gateway → Chat Service (internal gRPC)
    arrow(575, 210, [[70, 0]]),
    ...server(650, 175, "Chat Service\n(stateless)", { w: 150, h: 70, color: "#b2f2bb" }),

    // Chat Service → Cassandra (persist)
    arrow(800, 185, [[70, -60]]),
    ...database(875, 95, "Cassandra\npart=channel_id", { w: 150, h: 80, color: "#b2f2bb" }),

    // Chat Service → Kafka (enqueue)
    arrow(800, 215, [[70, 30]]),
    ...queue(875, 220, "Kafka\nmsg.delivery.{shard}", { w: 180, h: 55 }),

    // Kafka → Delivery Workers (consume)
    arrow(965, 275, [[0, 55]]),
    ...server(870, 335, "Delivery Workers\n(consume Kafka)", { w: 190, h: 60, color: "#d0bfff" }),

    // Chat Service → Redis (session lookup)
    arrow(700, 245, [[-10, 75]]),
    ...cache(560, 325, "Redis\nuser:bob -> {gw-17, conn47}", { w: 230, h: 60 }),

    // Delivery Worker → Redis (lookup where is recipient) + back to Gateway (push)
    arrow(870, 365, [[-80, 0], [-80, -30]]),
    arrow(870, 350, [[-300, -135]], { strokeColor: COLORS.gray }),

    // Delivery Worker → Push Notification (offline)
    arrow(1065, 365, [[70, 0]]),
    ...server(1135, 335, "Push Notif\nAPNs / FCM", { w: 140, h: 60, color: "#ffc9c9" }),

    // Snowflake ID gen (used by chat svc)
    arrow(725, 175, [[0, -55]]),
    ...server(660, 50, "Snowflake ID Gen\ntime-sortable", { w: 170, h: 55, color: "#ffec99" }),

    // ─── CONTROL PATH: Client → API Gateway → micro-services ───
    arrow(110, 360, [[120, 165]]),
    ...server(230, 520, "API Gateway (L7)\nauth - JWT - rate-limit - TLS", { w: 230, h: 70, color: "#fff3bf" }),

    arrow(465, 530, [[55, -40]]),
    arrow(465, 545, [[55, 30]]),
    arrow(465, 560, [[55, 100]]),
    ...server(520, 470, "User Svc\n/api/users/*", { w: 150, h: 55, color: "#a5d8ff" }),
    ...server(520, 555, "Group Svc\n/api/groups/*", { w: 150, h: 55, color: "#a5d8ff" }),
    ...server(520, 640, "History Svc\n/api/messages/history", { w: 180, h: 55, color: "#a5d8ff" }),

    // ─── Service Discovery (how gateways find pods) ───
    ...server(770, 555, "Service Discovery\n(Consul / K8s / Eureka)\nresolves pod IPs", { w: 210, h: 80, color: "#dee2e6" }),
    arrow(495, 250, [[300, 300]], { strokeColor: COLORS.gray }),
    arrow(710, 575, [[55, 0]]),

    // Presence service
    ...server(875, 460, "Presence Svc\nheartbeat + TTL 60s", { w: 190, h: 55, color: "#99e9f2" }),
    arrow(675, 360, [[195, 110]], { strokeColor: COLORS.gray }),

    // ─── Edge labels ───
    labelText(70, 175, "WebSocket\nupgrade"),
    labelText(585, 190, "internal gRPC"),
    labelText(800, 130, "persist"),
    labelText(805, 250, "enqueue"),
    labelText(600, 415, "session lookup"),
    labelText(560, 430, "push (online)"),
    labelText(140, 430, "HTTPS REST"),
    labelText(560, 600, "register / resolve"),
    labelText(1075, 320, "offline"),
  ];

  return buildDiagram(els);
}

// ─── Kafka Internals ──────────────────────────────────────────────────────────

function genKafka() {
  const els = [
    labelText(330, 6, "Apache Kafka — Components & Data Flow", { fontSize: 20, strokeColor: COLORS.black }),

    // Producers
    ...server(40, 120, "Producer A\n(Chat Svc)", { w: 130, h: 60, color: "#a5d8ff" }),
    ...server(40, 230, "Producer B\n(Order Svc)", { w: 130, h: 60, color: "#a5d8ff" }),
    arrow(175, 150, [[120, 30]]),
    arrow(175, 260, [[120, -30]]),
    labelText(180, 110, "produce(key, msg)\nkey -> partition"),

    // Kafka cluster boundary
    ...server(300, 70, " ", { w: 470, h: 320, color: "transparent" }),
    labelText(315, 78, "KAFKA CLUSTER  (3 brokers, replication factor = 3)"),

    // Topic with partitions (leaders)
    ...queue(320, 120, "Topic: messages   P0  [m0 m1 m2 ..]  (leader B1)", { w: 430, h: 45 }),
    ...queue(320, 180, "                  P1  [m0 m1 m2 ..]  (leader B2)", { w: 430, h: 45 }),
    ...queue(320, 240, "                  P2  [m0 m1 m2 ..]  (leader B3)", { w: 430, h: 45 }),
    labelText(320, 300, "offset = position in partition (0,1,2..) -> enables replay"),
    labelText(320, 330, "followers replicate leaders (ISR) -> fault tolerance"),

    // Consumer group
    arrow(755, 145, [[90, 60]]),
    arrow(755, 205, [[90, 5]]),
    arrow(755, 260, [[90, -50]]),
    ...server(850, 130, "Consumer 1\n<- P0", { w: 140, h: 50, color: "#99e9f2" }),
    ...server(850, 195, "Consumer 2\n<- P1", { w: 140, h: 50, color: "#99e9f2" }),
    ...server(850, 260, "Consumer 3\n<- P2", { w: 140, h: 50, color: "#99e9f2" }),
    labelText(850, 100, "Consumer Group 'delivery-workers'\n1 partition -> exactly 1 consumer"),

    // Coordination
    ...server(320, 410, "KRaft / ZooKeeper  —  metadata, leader election, ISR tracking", { w: 470, h: 50, color: "#dee2e6" }),
  ];

  return buildDiagram(els);
}

// ─── API Gateway ──────────────────────────────────────────────────────────────

function genApiGateway() {
  const els = [
    labelText(330, 6, "API Gateway — Production Architecture", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(60, 180, "Clients\n(web / mobile)", { w: 140, h: 60 }),
    arrow(205, 210, [[60, 0]]),
    ...cdn(280, 175, "CDN / Edge\n(DDoS, TLS)", { w: 130, h: 60 }),
    arrow(415, 205, [[55, 0]]),
    ...loadBalancer(475, 165, "Global LB\n(L4)", { w: 110, h: 95 }),

    arrow(590, 190, [[60, -40]]),
    arrow(590, 210, [[60, 30]]),
    ...server(655, 110, "API Gateway 1\nauth-JWT-rate-route-log", { w: 220, h: 60, color: "#fff3bf" }),
    ...server(655, 220, "API Gateway 2\nauth-JWT-rate-route-log", { w: 220, h: 60, color: "#fff3bf" }),

    arrow(880, 140, [[70, 30]]),
    arrow(880, 250, [[70, -30]]),
    ...server(955, 90, "User Svc", { w: 130, h: 50, color: "#a5d8ff" }),
    ...server(955, 165, "Order Svc", { w: 130, h: 50, color: "#a5d8ff" }),
    ...server(955, 240, "Payment Svc", { w: 130, h: 50, color: "#a5d8ff" }),

    // shared infra
    ...cache(620, 340, "Redis\n(rate-limit counters, token blocklist)", { w: 290, h: 55 }),
    ...database(640, 430, "Postgres\n(API keys, route cfg, audit)", { w: 250, h: 70, color: "#b2f2bb" }),
    arrow(765, 285, [[0, 50]]),
    arrow(765, 400, [[0, 25]]),
    labelText(60, 120, "every request:\n1 TLS  2 authN  3 rate-limit\n4 route  5 observe"),
  ];

  return buildDiagram(els);
}

// ─── Message Queues ─────────────────────────────────────────────────────────────

function genMessageQueues() {
  const els = [
    labelText(300, 6, "Message Queues — Patterns & Delivery", { fontSize: 20, strokeColor: COLORS.black }),

    // Point-to-point
    labelText(40, 70, "■ POINT-TO-POINT (work queue)  — one message -> one consumer", { fontSize: 13, strokeColor: COLORS.blue }),
    ...server(40, 110, "Producer", { w: 120, h: 50, color: "#a5d8ff" }),
    arrow(165, 135, [[70, 0]]),
    ...queue(245, 110, "Queue\n(FIFO)", { w: 150, h: 50 }),
    arrow(400, 125, [[60, -25]]),
    arrow(400, 135, [[60, 20]]),
    ...server(465, 85, "Worker 1", { w: 120, h: 45, color: "#99e9f2" }),
    ...server(465, 150, "Worker 2", { w: 120, h: 45, color: "#99e9f2" }),
    ...server(620, 110, "Dead Letter\nQueue (DLQ)", { w: 140, h: 55, color: "#ffc9c9" }),
    arrow(590, 130, [[30, 5]]),
    labelText(600, 175, "after N failed\nack retries"),

    // Pub/Sub
    labelText(40, 260, "■ PUBLISH / SUBSCRIBE  — one message -> all subscribers", { fontSize: 13, strokeColor: COLORS.green }),
    ...server(40, 300, "Publisher", { w: 120, h: 50, color: "#a5d8ff" }),
    arrow(165, 325, [[70, 0]]),
    ...queue(245, 300, "Topic\n(broker)", { w: 150, h: 50 }),
    arrow(400, 315, [[60, -30]]),
    arrow(400, 325, [[60, 0]]),
    arrow(400, 335, [[60, 35]]),
    ...server(465, 270, "Sub A\n(email)", { w: 120, h: 45, color: "#99e9f2" }),
    ...server(465, 325, "Sub B\n(analytics)", { w: 120, h: 45, color: "#99e9f2" }),
    ...server(465, 385, "Sub C\n(audit)", { w: 120, h: 45, color: "#99e9f2" }),

    labelText(40, 460, "Delivery guarantees: at-most-once | at-least-once (+ idempotency) | exactly-once"),
    labelText(40, 490, "ack/nack drives redelivery; visibility timeout hides in-flight msgs"),
  ];

  return buildDiagram(els);
}

// ─── Proxy: Forward vs Reverse ──────────────────────────────────────────────────

function genProxy() {
  const els = [
    labelText(250, 6, "Proxy = an Intermediary that Forwards Requests", { fontSize: 20, strokeColor: COLORS.black }),

    // ── FORWARD PROXY ──
    labelText(40, 60, "■ FORWARD PROXY  —  sits in front of CLIENTS, acts on behalf of the client", { fontSize: 14, strokeColor: COLORS.blue }),
    ...client(40, 100, "Client", { w: 120, h: 55 }),
    arrow(165, 127, [[70, 0]]),
    ...server(255, 100, "Forward\nProxy", { w: 130, h: 55, color: "#d0bfff" }),
    arrow(390, 127, [[70, 0]]),
    ...server(465, 100, "Internet", { w: 120, h: 55, color: "#dee2e6" }),
    arrow(590, 127, [[70, 0]]),
    ...server(665, 100, "Server", { w: 120, h: 55, color: "#a5d8ff" }),
    labelText(235, 165, "hides CLIENT identity · caching · content filtering · bypass geo-blocks\nexamples: corporate proxy, VPN, Squid", { fontSize: 12 }),

    // ── REVERSE PROXY ──
    labelText(40, 250, "■ REVERSE PROXY  —  sits in front of SERVERS, acts on behalf of the server", { fontSize: 14, strokeColor: COLORS.green }),
    ...client(40, 300, "Client", { w: 120, h: 55 }),
    arrow(165, 327, [[70, 0]]),
    ...server(255, 300, "Internet", { w: 120, h: 55, color: "#dee2e6" }),
    arrow(390, 327, [[55, 0]]),
    ...loadBalancer(450, 285, "Reverse\nProxy", { w: 130, h: 90, color: "#ffc9c9" }),
    arrow(585, 305, [[70, -35]]),
    arrow(585, 330, [[70, 0]]),
    arrow(585, 355, [[70, 35]]),
    ...server(665, 250, "Server A", { w: 120, h: 50, color: "#a5d8ff" }),
    ...server(665, 315, "Server B", { w: 120, h: 50, color: "#a5d8ff" }),
    ...server(665, 380, "Server C", { w: 120, h: 50, color: "#a5d8ff" }),
    labelText(235, 445, "hides SERVER topology · load balancing · TLS termination · caching · DDoS shield\nexamples: Nginx, HAProxy, Cloudflare, AWS ALB  —  an API Gateway is a reverse proxy + brains", { fontSize: 12 }),
  ];
  return buildDiagram(els);
}

// ─── API Gateway: With vs Without ────────────────────────────────────────────────

function genGatewayConcept() {
  const els = [
    labelText(230, 6, "Why an API Gateway? — Cross-cutting Concerns in One Place", { fontSize: 20, strokeColor: COLORS.black }),

    // ── WITHOUT ──
    labelText(40, 55, "■ WITHOUT GATEWAY  —  every service re-implements auth + rate-limit + logging", { fontSize: 14, strokeColor: COLORS.red }),
    ...client(40, 95, "Mobile", { w: 110, h: 50 }),
    ...client(40, 175, "Web", { w: 110, h: 50 }),
    arrow(155, 110, [[260, -5]]),
    arrow(155, 125, [[260, 70]]),
    arrow(155, 135, [[260, 145]]),
    arrow(155, 195, [[260, -85]]),
    arrow(155, 200, [[260, -5]]),
    arrow(155, 210, [[260, 70]]),
    ...server(425, 80, "User Svc\n(auth+limit)", { w: 150, h: 55, color: "#a5d8ff" }),
    ...server(425, 150, "Order Svc\n(auth+limit)", { w: 150, h: 55, color: "#a5d8ff" }),
    ...server(425, 220, "Payment Svc\n(auth+limit)", { w: 150, h: 55, color: "#a5d8ff" }),
    labelText(600, 150, "N×M wiring,\nduplicated logic"),

    // ── WITH ──
    labelText(40, 320, "■ WITH GATEWAY  —  concerns handled ONCE; services stay simple", { fontSize: 14, strokeColor: COLORS.green }),
    ...client(40, 360, "Mobile", { w: 110, h: 50 }),
    ...client(40, 440, "Web", { w: 110, h: 50 }),
    arrow(155, 380, [[105, 40]]),
    arrow(155, 460, [[105, -35]]),
    ...server(265, 380, "API Gateway\nauth · rate-limit · route · log · TLS", { w: 210, h: 90, color: "#fff3bf" }),
    arrow(480, 400, [[70, -25]]),
    arrow(480, 425, [[70, 35]]),
    arrow(480, 415, [[70, 100]]),
    ...server(555, 350, "User Svc", { w: 130, h: 50, color: "#b2f2bb" }),
    ...server(555, 420, "Order Svc", { w: 130, h: 50, color: "#b2f2bb" }),
    ...server(555, 490, "Payment Svc", { w: 130, h: 50, color: "#b2f2bb" }),
    labelText(700, 400, "single entry point;\nservices = pure\nbusiness logic"),
  ];
  return buildDiagram(els);
}

// ─── OAuth 2.0 Authorization Code Flow (sequence) ───────────────────────────────

function genOauthFlow() {
  const els = [];
  const userX = 120, appX = 440, authX = 770;
  const top = 90, bottom = 560;

  els.push(labelText(180, 6, "OAuth 2.0 — Authorization Code Flow", { fontSize: 20, strokeColor: COLORS.black }));

  // actor boxes
  els.push(...server(userX - 70, 40, "User\n(Browser)", { w: 140, h: 50, color: "#e3fafc" }));
  els.push(...server(appX - 75, 40, "Your App\n(Client)", { w: 150, h: 50, color: "#fff3bf" }));
  els.push(...server(authX - 85, 40, "Auth Server\n(Google / Okta)", { w: 170, h: 50, color: "#d0bfff" }));

  // lifelines
  els.push(line(userX, top, [[0, bottom - top]], { strokeColor: COLORS.gray, strokeWidth: 1 }));
  els.push(line(appX, top, [[0, bottom - top]], { strokeColor: COLORS.gray, strokeWidth: 1 }));
  els.push(line(authX, top, [[0, bottom - top]], { strokeColor: COLORS.gray, strokeWidth: 1 }));

  const msg = (y, fromX, toX, txt) => {
    els.push(arrow(fromX, y, [[toX - fromX, 0]]));
    const lx = Math.min(fromX, toX);
    els.push(labelText(lx + 6, y - 20, txt, { fontSize: 12, textAlign: "left" }));
  };

  msg(140, userX, appX, "1. Click \"Login with Google\"");
  msg(195, userX, authX, "2. 302 redirect → /authorize?client_id&scope");
  msg(255, userX, authX, "3. User logs in + consents");
  msg(315, authX, appX, "4. redirect back: /callback?code=AUTH_CODE");
  msg(375, appX, authX, "5. POST /token { code, client_secret }");
  msg(435, authX, appX, "6. { access_token, id_token, refresh_token }");
  msg(495, appX, userX, "7. set session / return JWT");

  return buildDiagram(els);
}

// ─── Backend for Frontend (BFF) ─────────────────────────────────────────────────

function genBff() {
  const els = [
    labelText(240, 6, "Backend for Frontend (BFF) — One Gateway per Client Type", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(40, 80, "Mobile App", { w: 130, h: 55 }),
    ...client(40, 210, "Web App", { w: 130, h: 55 }),
    ...client(40, 340, "Partner API", { w: 130, h: 55 }),

    arrow(175, 107, [[80, 0]]),
    arrow(175, 237, [[80, 0]]),
    arrow(175, 367, [[80, 0]]),

    ...server(260, 75, "Mobile BFF\n(minimal JSON,\n1 call = 3 APIs)", { w: 170, h: 70, color: "#fff3bf" }),
    ...server(260, 205, "Web BFF\n(rich JSON,\nmore fields)", { w: 170, h: 70, color: "#fff3bf" }),
    ...server(260, 335, "Partner GW\n(diff auth +\nrate limits)", { w: 170, h: 70, color: "#fff3bf" }),

    // shared services
    ...server(560, 70, "User Svc", { w: 130, h: 50, color: "#a5d8ff" }),
    ...server(560, 145, "Order Svc", { w: 130, h: 50, color: "#a5d8ff" }),
    ...server(560, 250, "Catalog Svc", { w: 130, h: 50, color: "#a5d8ff" }),
    ...server(560, 350, "Payment Svc", { w: 130, h: 50, color: "#a5d8ff" }),

    // fan-out (gray, aggregation)
    arrow(435, 100, [[120, -5]], { strokeColor: COLORS.gray }),
    arrow(435, 115, [[120, 55]], { strokeColor: COLORS.gray }),
    arrow(435, 240, [[120, 35]], { strokeColor: COLORS.gray }),
    arrow(435, 240, [[120, -65]], { strokeColor: COLORS.gray }),
    arrow(435, 370, [[120, 5]], { strokeColor: COLORS.gray }),
    arrow(435, 360, [[120, -190]], { strokeColor: COLORS.gray }),

    labelText(440, 440, "Each BFF aggregates + reshapes data from the SAME shared microservices", { fontSize: 12 }),
  ];
  return buildDiagram(els);
}

// ─── Service Mesh (Envoy sidecar) ───────────────────────────────────────────────

function genServiceMesh() {
  const els = [
    labelText(220, 6, "Service Mesh — Sidecar Proxies for East-West Traffic", { fontSize: 20, strokeColor: COLORS.black }),

    // Pod A
    ...server(40, 70, " ", { w: 320, h: 130, color: "transparent" }),
    labelText(55, 78, "POD A"),
    ...server(60, 110, "Service A", { w: 120, h: 60, color: "#a5d8ff" }),
    ...server(220, 110, "Envoy\nsidecar", { w: 120, h: 60, color: "#ff6b9d" }),
    arrow(180, 140, [[40, 0]]),

    // Pod B
    ...server(580, 70, " ", { w: 320, h: 130, color: "transparent" }),
    labelText(595, 78, "POD B"),
    ...server(600, 110, "Envoy\nsidecar", { w: 120, h: 60, color: "#ff6b9d" }),
    ...server(760, 110, "Service B", { w: 120, h: 60, color: "#a5d8ff" }),
    arrow(720, 140, [[40, 0]]),

    // Envoy A -> Envoy B (mTLS over network)
    arrow(340, 140, [[260, 0]]),
    labelText(380, 105, "mTLS · retries · timeout"),

    // Control plane
    ...server(310, 300, "Control Plane  (Istio / Linkerd)\nmTLS cert rotation · traffic policy · metrics & traces", { w: 340, h: 70, color: "#dee2e6" }),
    arrow(280, 175, [[140, 120]], { strokeColor: COLORS.gray }),
    arrow(660, 175, [[-140, 120]], { strokeColor: COLORS.gray }),
    labelText(40, 240, "Gateway = NORTH-SOUTH (client → cluster).  Mesh = EAST-WEST (service ↔ service).", { fontSize: 12, strokeColor: COLORS.violet }),
  ];
  return buildDiagram(els);
}

// ─── TLS Handshake (sequence) ───────────────────────────────────────────────────

function genTlsHandshake() {
  const els = [];
  const clientX = 180, gwX = 760;
  const top = 110, bottom = 600;

  els.push(labelText(170, 6, "TLS 1.3 Handshake — Establishing the Session Key", { fontSize: 20, strokeColor: COLORS.black }));

  els.push(...server(clientX - 90, 45, "Client\n(Ankit's phone)", { w: 180, h: 50, color: "#e3fafc" }));
  els.push(...server(gwX - 100, 45, "Gateway\n(cert + private key)", { w: 200, h: 50, color: "#fff3bf" }));

  els.push(line(clientX, top, [[0, bottom - top]], { strokeColor: COLORS.gray, strokeWidth: 1 }));
  els.push(line(gwX, top, [[0, bottom - top]], { strokeColor: COLORS.gray, strokeWidth: 1 }));

  const msg = (y, fromX, toX, txt, color) => {
    els.push(arrow(fromX, y, [[toX - fromX, 0]], color ? { strokeColor: color } : {}));
    els.push(labelText(Math.min(fromX, toX) + 6, y - 22, txt, { fontSize: 12, textAlign: "left" }));
  };
  const note = (y, x, txt, color) => els.push(labelText(x, y, txt, { fontSize: 12, textAlign: "left", strokeColor: color || COLORS.violet }));

  msg(150, clientX, gwX, "1. ClientHello: TLS 1.3, ciphers, my key-share (ephemeral pub)");
  msg(215, gwX, clientX, "2. ServerHello: chosen cipher, my key-share + CERTIFICATE", COLORS.blue);
  note(250, clientX + 10, "3. Client verifies cert: CA-signed? right host? not expired?");
  note(300, clientX + 10, "4. ECDHE: combine (my priv + your pub) → SAME shared secret");
  note(330, clientX + 10, "   (the secret itself never travels on the wire)");
  note(380, clientX + 10, "5. Both derive symmetric SESSION KEY from the shared secret");
  els.push(line(clientX, 420, [[gwX - clientX, 0]], { strokeColor: COLORS.green, strokeWidth: 2 }));
  els.push(labelText(clientX + 120, 398, "===== encrypted channel (AES-GCM) =====", { fontSize: 12, strokeColor: COLORS.green, textAlign: "left" }));
  msg(470, clientX, gwX, "6. GET /messages  (encrypted with session key)", COLORS.green);
  note(505, gwX - 320, "Gateway decrypts with session key → reads plain HTTP", COLORS.green);
  note(560, clientX + 10, "Forward secrecy: session key is ephemeral, discarded after use →", COLORS.rose);
  note(585, clientX + 10, "leaking the private key later can't decrypt old recorded traffic", COLORS.rose);

  return buildDiagram(els);
}

// ─── mTLS Re-encryption in a Chat Service ───────────────────────────────────────

function genMtlsChat() {
  const els = [
    labelText(190, 6, "Re-encryption (mTLS) in a Chat Service — Zero Trust", { fontSize: 20, strokeColor: COLORS.black }),

    ...client(40, 150, "Ankit\n(phone)", { w: 130, h: 60 }),
    // public leg
    arrow(175, 180, [[90, 0]]),
    labelText(170, 130, "(1) HTTPS\npublic TLS"),
    ...server(270, 140, "API Gateway\nterminates public TLS\nreads JWT, routes", { w: 200, h: 90, color: "#fff3bf" }),

    // internal leg (re-encrypt)
    arrow(475, 185, [[95, 0]], { strokeColor: COLORS.rose }),
    labelText(470, 120, "(2) NEW mTLS\nre-encrypted\nboth show certs"),
    ...server(575, 140, "Chat Service\ndecrypts again\nstore + enqueue", { w: 190, h: 90, color: "#b2f2bb" }),

    // downstream persistence
    arrow(670, 235, [[0, 55]]),
    ...database(610, 300, "Cassandra\nmessages", { w: 150, h: 70, color: "#b2f2bb" }),
    arrow(770, 185, [[80, 60]], { strokeColor: COLORS.rose }),
    ...queue(855, 220, "Kafka\ndelivery", { w: 150, h: 55 }),

    labelText(40, 300, "Why re-encrypt for chat?", { fontSize: 14, strokeColor: COLORS.violet }),
    labelText(40, 330, "• Messages are PRIVATE user content — unreadable even to internal sniffers\n• mTLS = service IDENTITY (a rogue pod can't impersonate chat-service)\n• In a service mesh, Envoy sidecars do this mTLS automatically", { fontSize: 12 }),
  ];
  return buildDiagram(els);
}

// ─── JWT Request Pipeline (vertical) ────────────────────────────────────────────

function genJwtFlow() {
  const els = [];
  els.push(labelText(150, 6, "Request Flow with JWT Auth — GET /images/123", { fontSize: 20, strokeColor: COLORS.black }));

  const cx = 360, w = 360, h = 46, gap = 16;
  const steps = [
    ["1. TLS Termination", "decrypt HTTPS → read plain HTTP + headers", "#ffd8a8"],
    ["2. WAF / IP Check", "block SQLi / XSS / bad IPs  → else pass", "#ffc9c9"],
    ["3. Rate Limit", "INCR rate:ankit:<min> in Redis → 429 if over", "#ffec99"],
    ["4. Authentication (JWT)", "verify signature w/ JWKS public key + check exp/iss/aud", "#a5d8ff"],
    ["5. Authorization (RBAC)", "role 'editor' grants 'image:read'? → else 403", "#a5d8ff"],
    ["6. Transform", "strip Authorization; add X-User-Id: ankit, X-Request-Id", "#d0bfff"],
    ["7. Route + Load Balance", "/images/* → discovery (100 pods) → pow2 → pod 10.0.0.42", "#b2f2bb"],
    ["8. Circuit Breaker", "service OPEN? → 503 fast-fail, else continue", "#ffc9c9"],
    ["9. Proxy Upstream", "mTLS re-encrypt (or plain HTTP in trusted VPC)", "#b2f2bb"],
  ];
  let y = 60;
  const boxIds = [];
  steps.forEach(([t, sub], i) => {
    const [a, b] = [t, sub];
    const color = steps[i][2];
    const box = server(cx - w / 2, y, a, { w, h, color });
    els.push(...box);
    els.push(labelText(cx + w / 2 + 12, y + 10, b, { fontSize: 11, textAlign: "left" }));
    if (i > 0) els.push(arrow(cx, y - gap, [[0, gap]]));
    y += h + gap;
  });
  // final upstream
  els.push(arrow(cx, y - gap, [[0, gap]]));
  els.push(...server(cx - w / 2, y, "image-service pod 10.0.0.42", { w, h, color: "#99e9f2" }));
  els.push(labelText(cx + w / 2 + 12, y + 6, "fine-grained authz:\n'does ankit own image 123?' (own DB)", { fontSize: 11, textAlign: "left" }));

  // JWT verify callout box on the left
  els.push(labelText(40, 250, "JWT verify =\nPURE CRYPTO\n(no DB call):\nverify(sig,\n pub key) +\n exp/iss/aud\n→ stateless,\n scales to\n millions", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }));

  return buildDiagram(els);
}

// ─── JWT Auth System for Microservices (full architecture) ──────────────────────

function genJwtAuthSystem() {
  const els = [
    labelText(360, 6, "JWT Auth for Microservices — Hybrid Validation + Revocation", { fontSize: 20, strokeColor: COLORS.black }),

    // ── Login path: Client → Auth Service (top) ──
    ...server(60, 60, "Auth Service\nsigns JWT (private key)\nissues access + refresh", { w: 240, h: 75, color: "#d0bfff" }),
    // Auth Svc → refresh token DB
    arrow(110, 135, [[0, 55]]),
    ...database(60, 200, "Refresh Token DB\n(hashed, revocable)", { w: 170, h: 75, color: "#b2f2bb" }),
    // Auth Svc → JWKS
    arrow(305, 95, [[100, 0]]),
    labelText(310, 70, "publish\npub keys"),
    ...server(410, 60, "JWKS endpoint\n/.well-known/jwks.json\n(public keys by kid)", { w: 220, h: 75, color: "#ffec99" }),

    // ── Request path: Client → L4 LB → Gateways ──
    ...client(40, 360, "Client\n(web / mobile)", { w: 140, h: 60 }),
    arrow(130, 360, [[40, -150]], { strokeColor: COLORS.gray }),
    labelText(60, 300, "login (once)", { strokeColor: COLORS.gray }),
    arrow(185, 390, [[60, 0]]),
    labelText(180, 345, "HTTPS\n+ JWT"),
    ...loadBalancer(255, 350, "L4 LB", { w: 90, h: 80 }),
    arrow(350, 390, [[70, -60]]),
    arrow(350, 390, [[70, 70]]),

    // Gateways (replicated) with in-mem bloom filter
    ...server(430, 290, "API Gateway 1\nverify sig (kid→JWKS)\n+ Bloom filter (in-mem)", { w: 230, h: 80, color: "#fff3bf" }),
    ...server(430, 410, "API Gateway 2\nverify sig + Bloom\n(replicated)", { w: 230, h: 80, color: "#fff3bf" }),

    // Gateways fetch JWKS (cached)
    arrow(540, 290, [[0, -155]], { strokeColor: COLORS.gray }),
    labelText(545, 200, "cache\npub key", { strokeColor: COLORS.gray }),

    // Gateway → Microservices (trust headers)
    arrow(660, 320, [[110, -40]]),
    labelText(665, 250, "X-User-Id\n(trusted hdr)"),
    ...server(770, 250, "User Svc", { w: 150, h: 45, color: "#a5d8ff" }),
    ...server(770, 310, "Order Svc", { w: 150, h: 45, color: "#a5d8ff" }),
    ...server(770, 370, "Payment Svc\n(high-value)", { w: 150, h: 50, color: "#a5d8ff" }),

    // Gateway → Redis denylist (only on Bloom "maybe")
    arrow(545, 490, [[20, 60]]),
    labelText(420, 520, "only on\nBloom 'maybe'"),
    ...cache(540, 560, "Redis Denylist (HA cluster)\nrevoked:{jti}=1  TTL=remaining\nuser:{id}:min_iat (revoke-all)", { w: 330, h: 80 }),

    // High-value path → introspection (Auth Service authoritative)
    arrow(770, 395, [[-30, 0], [-30, 165], [-720, 165], [-720, -290]], { strokeColor: COLORS.rose }),
    labelText(40, 545, "high-value path → POST /introspect (authoritative check at Auth Svc)", { strokeColor: COLORS.rose, fontSize: 12, textAlign: "left" }),

    // ── DETECTION SOURCES (many independent producers) ──
    labelText(1170, 28, "DETECTION SOURCES (producers)", { fontSize: 13, strokeColor: COLORS.red, textAlign: "left" }),
    ...server(1175, 55, "Fraud / Anomaly Svc\n(impossible travel, rate)", { w: 175, h: 48, color: "#ffc9c9" }),
    ...server(1175, 113, "SIEM / Threat Intel\n(leaked creds, alerts)", { w: 175, h: 48, color: "#ffc9c9" }),
    ...server(1175, 171, "Admin / SOC\n(manual ban)", { w: 175, h: 48, color: "#ffc9c9" }),
    // each detector → Revocation Service
    arrow(1175, 79, [[-40, 35]], { strokeColor: COLORS.red }),
    arrow(1175, 137, [[-40, 5]], { strokeColor: COLORS.red }),
    arrow(1175, 195, [[-40, -25]], { strokeColor: COLORS.red }),
    // Auth Svc is ALSO a producer — route through the clear band below the JWKS row
    arrow(300, 122, [[0, 43], [685, 43], [685, 8]], { strokeColor: COLORS.rose }),
    labelText(430, 148, "Auth Svc is also a producer: RT-reuse / logout / pwd change", { fontSize: 11, strokeColor: COLORS.rose, textAlign: "left" }),

    // ── Revocation Service (owns the denylist policy + audit) ──
    ...server(985, 90, "Revocation Service\nowns /revoke API\n+ policy + AUDIT", { w: 165, h: 80, color: "#ffa8a8" }),
    // Revocation Service → Queue (it is the single authorized producer to the queue)
    arrow(1067, 170, [[0, 40]]),
    labelText(1075, 175, "publish\n{jti, reason}", { fontSize: 11, strokeColor: COLORS.red, textAlign: "left" }),
    ...queue(985, 210, "Revocation Queue\n(Kafka / pub-sub)", { w: 200, h: 55 }),
    // Queue → Workers (consumers)
    arrow(1085, 265, [[0, 40]]),
    ...server(985, 305, "Revocation Workers\n(CONSUMERS)\nwrite Redis + push Bloom", { w: 200, h: 80, color: "#ffc9c9" }),
    labelText(985, 392, "CONSUMER updates denylist\n+ each gateway's Bloom filter", { fontSize: 11, strokeColor: COLORS.red, textAlign: "left" }),
    // Workers → Redis denylist
    arrow(985, 360, [[-360, 215]], { strokeColor: COLORS.red }),
    // Workers → gateways (bloom push)
    arrow(985, 330, [[-320, 110]], { strokeColor: COLORS.red }),

    // legend
    labelText(40, 660, "Detection (fraud/SIEM/admin/Auth-Svc) is SEPARATE from revocation: detectors only report; the Revocation Service owns the denylist + audit.", { fontSize: 12, strokeColor: COLORS.green }),
    labelText(40, 683, "Happy path (99.9%): verify signature + Bloom 'not revoked' → ALLOW (no Redis).  Bloom 'maybe' → confirm in Redis.  Short TTL bounds worst case.", { fontSize: 12, strokeColor: COLORS.green }),
    labelText(40, 706, "Expiry (exp claim) is stateless & self-evicting — denylist only holds tokens killed EARLY, with TTL = remaining life.", { fontSize: 12, strokeColor: COLORS.green }),
  ];
  return buildDiagram(els);
}

// ─── Certificate Chain of Trust (vertical) ──────────────────────────────────────

function genCertChain() {
  const els = [];
  const cx = 430;
  els.push(labelText(150, 6, "Certificate Chain of Trust — Verify Up to a Root You Already Trust", { fontSize: 19, strokeColor: COLORS.black }));

  // Root CA
  els.push(...server(cx - 170, 60, "ROOT CA  —  DigiCert Global Root\nself-signed · private key offline in HSM", { w: 340, h: 64, color: "#fff3bf" }));
  els.push(labelText(cx + 190, 66, "PRE-INSTALLED in your\ndevice's trust store\n(~150 roots ship with\nthe OS / browser)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.gold }));

  // signs ↓
  els.push(arrow(cx, 124, [[0, 48]]));
  els.push(labelText(cx + 10, 138, "signs", { fontSize: 12, textAlign: "left" }));

  // Intermediate CA
  els.push(...server(cx - 170, 172, "INTERMEDIATE CA  —  DigiCert TLS RSA CA\nsigns day-to-day site certificates", { w: 340, h: 64, color: "#ffec99" }));

  // signs ↓
  els.push(arrow(cx, 236, [[0, 48]]));
  els.push(labelText(cx + 10, 250, "signs", { fontSize: 12, textAlign: "left" }));

  // Leaf cert
  els.push(...server(cx - 170, 284, "LEAF CERT  —  bank.com\npublic key · domain · expiry", { w: 340, h: 64, color: "#b2f2bb" }));
  els.push(labelText(cx + 190, 296, "What the SERVER\npresents during\nthe handshake", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }));

  // verification arrows climbing UP on the left
  els.push(arrow(cx - 210, 316, [[0, -84]], { strokeColor: COLORS.green }));
  els.push(arrow(cx - 210, 204, [[0, -84]], { strokeColor: COLORS.green }));
  els.push(labelText(cx - 360, 230, "verify each\nsignature with\nthe ISSUER's\npublic key one\nlevel UP", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }));

  // bottom summary
  els.push(labelText(cx - 360, 372, "Server sends LEAF + INTERMEDIATE(s).  Device already has the ROOT.  The browser climbs the chain", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(labelText(cx - 360, 394, "until it lands on a trusted root — then the whole chain is trusted. Missing intermediate = 'unable to verify'.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }));

  return buildDiagram(els);
}

// ─── How Information Travels (horizontal journey) ───────────────────────────────

function genInfoTravel() {
  const els = [];
  els.push(labelText(120, 6, "How Information Travels — From Your Phone to a Server Across the Planet", { fontSize: 18, strokeColor: COLORS.black }));

  const y = 120;
  els.push(...server(30, y, "Your Phone\ndata → bits", { w: 120, h: 64, color: "#e3fafc" }));
  els.push(arrow(150, y + 32, [[78, 0]], { strokeColor: COLORS.rose }));
  els.push(labelText(150, y - 22, "radio\n(air)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.rose }));

  els.push(...server(228, y, "WiFi / Cell\nTower", { w: 120, h: 64, color: "#a5d8ff" }));
  els.push(arrow(348, y + 32, [[66, 0]] ));
  els.push(labelText(350, y - 14, "fiber", { fontSize: 11, textAlign: "left" }));

  els.push(...server(414, y, "ISP\nbackbone", { w: 110, h: 64, color: "#a5d8ff" }));
  els.push(arrow(524, y + 32, [[64, 0]], { strokeColor: COLORS.green }));
  els.push(labelText(524, y - 22, "light in\nglass", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }));

  els.push(...server(588, y, "Undersea\nFiber Cable", { w: 124, h: 64, color: "#99e9f2" }));
  els.push(arrow(712, y + 32, [[64, 0]], { strokeColor: COLORS.green }));

  els.push(...server(776, y, "Data Center\n/ Server", { w: 124, h: 64, color: "#b2f2bb" }));

  els.push(labelText(30, 220, "Radio is only the FIRST / LAST hop (short range, shared spectrum). ~99% of intercontinental traffic = light through glass fiber on the ocean floor.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(labelText(30, 252, "~550+ submarine cables · roughly garden-hose thick · repeaters every ~80 km re-amplify the light · most faults from ship anchors & fishing trawlers.", { fontSize: 12, textAlign: "left" }));
  els.push(labelText(30, 284, "Light in fiber ≈ 200,000 km/s → ~70–80 ms London↔NY round trip. Geography is a hard latency floor — which is why CDNs cache copies near users.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.blue }));

  return buildDiagram(els);
}

// ─── Optical Fiber — Total Internal Reflection ──────────────────────────────────

function genOpticalFiber() {
  const els = [];
  els.push(labelText(150, 6, "Optical Fiber — Total Internal Reflection Traps the Light", { fontSize: 18, strokeColor: COLORS.black }));

  // cladding (outer) + core (inner)
  els.push(rect(60, 70, 780, 180, { bgColor: "#dee2e6" }));
  els.push(rect(60, 120, 780, 80, { bgColor: "#a5d8ff" }));

  // zig-zag light path bouncing inside the core
  const zig = [];
  for (let i = 0; i < 13; i++) { zig.push([i * 60, i % 2 === 0 ? 0 : 60]); }
  els.push(line(70, 130, zig, { strokeColor: COLORS.green, strokeWidth: 3 }));
  els.push(labelText(8, 150, "laser\npulses\n(1 = on)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }));

  // labels
  els.push(labelText(72, 82, "CLADDING — lower refractive index (acts as a glass mirror)", { fontSize: 12, textAlign: "left", strokeColor: COLORS.gray }));
  els.push(labelText(72, 206, "CORE — higher refractive index, carries the light", { fontSize: 12, textAlign: "left", strokeColor: COLORS.blue }));

  els.push(labelText(60, 272, "At each boundary light hits beyond the CRITICAL ANGLE → 100% reflects back in (Total Internal Reflection). It zig-zags down the core for kilometres, even around gentle bends.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.green }));
  els.push(labelText(60, 304, "Steeper rays travel a longer path → arrive late → modal dispersion (blurred pulse). Single-mode fiber (~9µm core) allows ~one straight path → used for the backbone & undersea cables.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }));

  return buildDiagram(els);
}

// ─── Diffie-Hellman — Paint Mixing Analogy ──────────────────────────────────────

function genDhPaint() {
  const els = [];
  els.push(labelText(120, 6, "Diffie-Hellman Key Exchange — The Paint-Mixing Analogy", { fontSize: 18, strokeColor: COLORS.black }));

  const clientX = 150, serverX = 760;
  els.push(...server(clientX - 90, 44, "CLIENT", { w: 180, h: 40, color: "#e3fafc" }));
  els.push(...server(serverX - 90, 44, "SERVER", { w: 180, h: 40, color: "#fff3bf" }));
  els.push(labelText(390, 50, "EAVESDROPPER\nsees everything\nin the middle", { fontSize: 12, textAlign: "left", strokeColor: COLORS.red }));

  // Row 1 — public base
  els.push(labelText(40, 120, "1. Agree on a PUBLIC base color (everyone sees it):", { fontSize: 13, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(...server(390, 110, "YELLOW", { w: 120, h: 38, color: "#ffec99" }));

  // Row 2 — private secrets
  els.push(labelText(40, 178, "2. Each picks a SECRET color — never shared:", { fontSize: 13, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(...server(clientX - 70, 200, "+ RED\n(secret a)", { w: 150, h: 48, color: "#ffc9c9" }));
  els.push(...server(serverX - 80, 200, "+ BLUE\n(secret b)", { w: 160, h: 48, color: "#a5d8ff" }));

  // Row 3 — mix and SEND across (these travel publicly)
  els.push(labelText(40, 278, "3. Mix secret into yellow and SEND the mix across the wire:", { fontSize: 13, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(...server(clientX - 75, 300, "yellow+red\n= ORANGE", { w: 160, h: 48, color: "#ffd8a8" }));
  els.push(...server(serverX - 80, 300, "yellow+blue\n= GREEN", { w: 160, h: 48, color: "#b2f2bb" }));
  // arrows crossing (public values)
  els.push(arrow(245, 318, [[430, 0]], { strokeColor: COLORS.gray }));
  els.push(labelText(300, 326, "ORANGE travels →", { fontSize: 11, textAlign: "left", strokeColor: COLORS.gray }));
  els.push(arrow(675, 340, [[-430, 0]], { strokeColor: COLORS.gray }));
  els.push(labelText(300, 344, "← GREEN travels", { fontSize: 11, textAlign: "left", strokeColor: COLORS.gray }));

  // Row 4 — add own secret to what was received
  els.push(labelText(40, 392, "4. Add your OWN secret to the color you RECEIVED:", { fontSize: 13, textAlign: "left", strokeColor: COLORS.violet }));
  els.push(...server(clientX - 95, 414, "GREEN + RED\n= BROWN", { w: 200, h: 48, color: "#bd8c61", strokeColor: "#5c3a16" }));
  els.push(...server(serverX - 105, 414, "ORANGE + BLUE\n= BROWN", { w: 210, h: 48, color: "#bd8c61", strokeColor: "#5c3a16" }));

  // shared secret
  els.push(arrow(clientX + 5, 462, [[170, 60]], { strokeColor: COLORS.green }));
  els.push(arrow(serverX - 5, 462, [[-170, 60]], { strokeColor: COLORS.green }));
  els.push(...server(370, 530, "SHARED SECRET = BROWN\n(both sides, identical)", { w: 260, h: 50, color: "#69db7c" }));

  els.push(labelText(40, 600, "The eavesdropper saw YELLOW, ORANGE, GREEN — but to get BROWN they'd have to UN-MIX a color back into red or blue.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.red }));
  els.push(labelText(40, 622, "Mixing paint is easy; separating it is practically impossible. In real DH that 'un-mixing' = the discrete-log problem (infeasible).", { fontSize: 12, textAlign: "left", strokeColor: COLORS.red }));
  els.push(labelText(40, 644, "The secrets (RED / BLUE) never leave their machines — only the MIXES travel. Yet both independently arrive at the SAME key.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.green }));

  return buildDiagram(els);
}

// ─── Price Search Service — Cache-first Aggregator ──────────────────────────────

function genPriceSearch() {
  const els = [
    labelText(280, 6, "Price Search Service — Cache-first Vendor Aggregator", { fontSize: 20, strokeColor: COLORS.black }),

    // Read path (top row)
    ...client(40, 120, "UI / Client", { w: 130, h: 60 }),
    arrow(175, 150, [[70, 0]]),
    labelText(180, 95, "GET\n/search/product/1", { fontSize: 11 }),
    ...server(250, 110, "API Gateway\nEdge Cache", { w: 150, h: 80, color: "#fff3bf" }),
    arrow(405, 150, [[70, 0]]),
    ...server(480, 110, "Search Service\n(read path)", { w: 160, h: 80, color: "#a5d8ff" }),

    // Search -> Redis (cache lookup)
    arrow(560, 195, [[0, 55]]),
    labelText(565, 210, "get price:1", { fontSize: 11, textAlign: "left" }),
    ...cache(480, 255, "Redis (hot)\nprice:{id}:{vendor}\nTTL = 1 hour", { w: 200, h: 80 }),

    // cache hit returns
    arrow(640, 150, [[120, 0]], { strokeColor: COLORS.green }),
    labelText(770, 120, "hit (fresh):\nreturn instantly", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }),

    // miss/stale -> enqueue refresh
    arrow(640, 175, [[150, 90]], { strokeColor: COLORS.rose }),
    labelText(660, 215, "miss/stale:\npublish refresh\n(serve stale,\nno blocking)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.rose }),
    ...queue(800, 270, "Refresh Queue\n(Kafka, per-vendor)", { w: 220, h: 60 }),

    // queue -> worker pool
    arrow(905, 330, [[0, 55]]),
    ...server(790, 390, "Vendor Worker Pool\nbounded concurrency\nsingle-flight + breaker\nretry (backoff+jitter)", { w: 250, h: 100, color: "#ffc9c9" }),

    // workers -> vendors
    arrow(790, 420, [[-90, 0]]),
    ...server(560, 400, "Vendor A", { w: 120, h: 42, color: "#d0bfff" }),
    ...server(560, 450, "Vendor B", { w: 120, h: 42, color: "#d0bfff" }),
    ...server(560, 500, "Vendor C ... 100+", { w: 160, h: 42, color: "#d0bfff" }),
    arrow(790, 440, [[-105, 30]]),
    arrow(790, 460, [[-65, 60]]),
    labelText(690, 380, "$ paid call\n(only on miss)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.red }),

    // workers write back to redis + db
    arrow(870, 490, [[-280, -150]], { strokeColor: COLORS.green }),
    labelText(600, 320, "write fresh → Redis(1h)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.green }),
    arrow(915, 490, [[0, 60]], { strokeColor: COLORS.green }),
    ...database(840, 560, "Price DB\nresults JSONB\n(durable)", { w: 200, h: 80, color: "#b2f2bb" }),

    // legend
    labelText(40, 600, "Read path NEVER blocks on vendors. Fresh cache = 0 paid calls. Single-flight collapses a stampede into one refresh per vendor.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
    labelText(40, 624, "On miss/stale: serve cached (flagged stale) + async fan-out. Per-vendor breaker + bulkhead isolate slow/failing vendors → partial results.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
  ];
  return buildDiagram(els);
}

function genGoogleDrive() {
  const els = [
    labelText(300, 6, "Design Google Drive — Upload · Download · Sync · Notify", { fontSize: 20, strokeColor: COLORS.black }),

    // Clients (two devices)
    ...client(40, 110, "Device A\n(Web)", { w: 120, h: 60 }),
    ...client(40, 210, "Device B\n(Mobile)", { w: 120, h: 60 }),

    // client A -> LB
    arrow(165, 140, [[75, 0]]),
    labelText(170, 90, "chunk upload\n/files (HTTPS)", { fontSize: 11 }),

    // Load balancer
    ...loadBalancer(250, 110, "LB", { w: 90, h: 80 }),
    arrow(345, 150, [[70, 0]]),

    // API servers (block + metadata split)
    ...server(420, 95, "Block Servers\nsplit→hash→encrypt\ndedup + delta", { w: 190, h: 90, color: "#a5d8ff" }),
    ...server(420, 215, "Metadata Service\nfile tree, versions\nACL / sharing", { w: 190, h: 90, color: "#bac8ff" }),

    // block servers -> object storage
    arrow(615, 140, [[120, 0]]),
    labelText(620, 110, "PUT blocks\n(content-addressed)", { fontSize: 11, textAlign: "left" }),
    ...database(745, 95, "Object Storage\n(S3, AES-256)\n11-nines durable", { w: 210, h: 95, color: "#b2f2bb" }),

    // metadata -> metadata db
    arrow(615, 260, [[130, 0]]),
    ...database(745, 220, "Metadata DB\n(SQL, sharded)", { w: 200, h: 85, color: "#d8f5a2" }),

    // metadata -> notification (Kafka)
    arrow(515, 305, [[0, 60]]),
    labelText(520, 320, "publish change event", { fontSize: 11, textAlign: "left" }),
    ...queue(360, 375, "Notification Queue\n(Kafka)", { w: 230, h: 56 }),

    // queue -> notification service
    arrow(475, 431, [[0, 50]]),
    ...server(360, 495, "Sync / Notification Service\nWebSocket + long poll\nfan-out to other devices", { w: 280, h: 90, color: "#ffd8a8" }),

    // notification -> Device B (sync down)
    arrow(360, 540, [[-200, -260]], { strokeColor: COLORS.teal }),
    labelText(120, 320, "push: file changed →\nDevice B pulls delta", { fontSize: 11, textAlign: "left", strokeColor: COLORS.teal }),

    // offline backup queue
    arrow(850, 190, [[0, 30]], { strokeColor: COLORS.gray }),
    ...queue(720, 330, "Offline Backup Queue\n(cold replicas, GC)", { w: 250, h: 56 }),
    arrow(850, 305, [[0, 25]], { strokeColor: COLORS.gray }),

    // legend
    labelText(40, 640, "Upload = split into blocks → hash → dedup (skip blocks already stored) → encrypt → PUT to object store; metadata records the manifest + version.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
    labelText(40, 664, "Sync = on commit, Metadata Service emits an event → Kafka → Notification Service pushes to online devices over WebSocket; offline devices pull on reconnect.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
    labelText(40, 688, "Delta sync = only changed blocks travel the wire → minimal bandwidth. Strongly-consistent metadata; eventually-consistent blocks.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
  ];
  return buildDiagram(els);
}

function genPaymentGateway() {
  const els = [
    labelText(300, 6, "Design Razorpay — Payment Gateway (Auth → Capture → Settle)", { fontSize: 20, strokeColor: COLORS.black }),

    // Merchant + buyer
    ...client(40, 120, "Buyer\n(checkout)", { w: 120, h: 60 }),
    arrow(165, 150, [[60, 0]]),
    ...server(230, 110, "Merchant\nBackend", { w: 130, h: 80, color: "#a5d8ff" }),

    // -> API gateway
    arrow(365, 150, [[70, 0]]),
    labelText(370, 95, "POST /orders\n(idempotency-key)", { fontSize: 11 }),
    ...server(440, 110, "API Gateway\nauthN · rate-limit\nidempotency", { w: 170, h: 80, color: "#fff3bf" }),

    // -> Payment Service (orchestrator)
    arrow(525, 190, [[0, 50]]),
    ...server(420, 250, "Payment Service\n(orchestrator / state machine)\ncreated→authorized→captured→settled", { w: 320, h: 95, color: "#bac8ff" }),

    // Payment Service -> Ledger DB (double entry)
    arrow(470, 345, [[-90, 55]], { strokeColor: COLORS.green }),
    ...database(300, 410, "Ledger DB\ndouble-entry\n(ACID, sharded)", { w: 200, h: 90, color: "#b2f2bb" }),

    // Payment Service -> Tokenization / Vault
    arrow(580, 345, [[0, 55]]),
    ...server(470, 410, "Token Vault\n(PCI-DSS, HSM)\ncard → token", { w: 220, h: 90, color: "#ffd8a8" }),

    // Payment Service -> Risk / Fraud
    arrow(700, 290, [[120, 0]], { strokeColor: COLORS.rose }),
    ...server(830, 250, "Risk / Fraud\nrules + ML score", { w: 180, h: 90, color: "#ffc9c9" }),

    // Payment Service -> Acquiring / Bank Connectors
    arrow(740, 280, [[150, -90]]),
    labelText(760, 200, "authorize / capture", { fontSize: 11, textAlign: "left" }),
    ...server(890, 110, "Bank / Network\nConnectors\nVisa·MC·UPI·Netbank", { w: 210, h: 90, color: "#d0bfff" }),

    // async settlement via queue
    arrow(580, 500, [[0, 50]]),
    ...queue(430, 560, "Settlement Queue (Kafka)\nasync payout to merchant", { w: 320, h: 56 }),
    arrow(590, 616, [[0, 45]]),
    ...server(440, 675, "Settlement / Payout Worker\nT+2 reconcile → merchant bank", { w: 300, h: 70, color: "#a5d8ff" }),

    // webhook back to merchant
    arrow(420, 295, [[-185, -140]], { strokeColor: COLORS.teal }),
    labelText(150, 250, "webhook:\npayment.captured\n(signed, retried)", { fontSize: 11, textAlign: "left", strokeColor: COLORS.teal }),

    // legend
    labelText(40, 770, "Idempotency-key dedupes retried charge requests → never double-charge. Orchestrator is a state machine; every transition is journaled in the ledger.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
    labelText(40, 794, "Raw PAN never touches app DBs — it is tokenized in a PCI-DSS vault. Auth is sync; capture+settlement are async (Kafka) and reconciled T+1/T+2.", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
    labelText(40, 818, "Webhooks are signed + retried with backoff; merchants verify the signature and treat delivery as at-least-once (idempotent handlers).", { fontSize: 12, textAlign: "left", strokeColor: COLORS.violet }),
  ];
  return buildDiagram(els);
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

const DIAGRAMS = {
  youtube: genYoutube,
  "price-search": genPriceSearch,
  "google-drive": genGoogleDrive,
  "payment-gateway": genPaymentGateway,
  "google-docs": genGoogleDocs,
  typeahead: genTypeahead,
  "log-messages": genLogMessages,
  "wise-share": genWiseShare,
  "people-you-may-know": genPeopleYouMayKnow,
  "chat-server": genChatServer,
  kafka: genKafka,
  "api-gateway": genApiGateway,
  "message-queues": genMessageQueues,
  proxy: genProxy,
  "gateway-concept": genGatewayConcept,
  "oauth-flow": genOauthFlow,
  bff: genBff,
  "service-mesh": genServiceMesh,
  "tls-handshake": genTlsHandshake,
  "mtls-chat": genMtlsChat,
  "jwt-flow": genJwtFlow,
  "jwt-auth-system": genJwtAuthSystem,
  "cert-chain": genCertChain,
  "info-travel": genInfoTravel,
  "optical-fiber": genOpticalFiber,
  "dh-paint": genDhPaint,
};

const arg = process.argv[2];

if (arg && DIAGRAMS[arg]) {
  saveDiagram(arg, DIAGRAMS[arg]());
} else if (arg === "--help" || arg === "-h") {
  console.log("Usage: node excalidraw-gen.js [diagram-name]");
  console.log("Available:", Object.keys(DIAGRAMS).join(", "));
} else {
  // Generate all
  for (const [name, fn] of Object.entries(DIAGRAMS)) {
    saveDiagram(name, fn());
  }
}
