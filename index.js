import express from "express";

const app = express();

// Trust Koyeb/Cloud load balancers (Crucial for correct IP forwarding)
app.set('trust proxy', 1);

app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: "*/*", limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// Upstreams
const BYBIT_MAINNET = "https://api.bybit.com";
const BYBIT_TESTNET = "https://api-demo-testnet.bybit.com";

// Health check
app.get("/health", (req, res) => res.json({ ok: true, timestamp: Date.now(), region: process.env.KOYEB_REGION || "unknown" }));

// Root info
app.get("/", (req, res) => res.json({
  service: "Bybit Proxy",
  status: "Running",
  endpoints: {
    mainnet: "/mainnet/*",
    testnet: "/testnet/*",
    health: "/health"
  }
}));

/**
 * Universal proxy handler
 */
async function proxyToBybit(req, res, baseUrl, prefix) {
  try {
    const path = req.originalUrl.replace(new RegExp(`^/${prefix}`), "");
    const url = `${baseUrl}${path}`;
    const method = req.method.toUpperCase();

    // Build headers
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
    };

    // Copy Bybit auth headers
    const headerMap = {
      "x-bapi-api-key": "X-BAPI-API-KEY",
      "x-bapi-timestamp": "X-BAPI-TIMESTAMP",
      "x-bapi-sign": "X-BAPI-SIGN",
      "x-bapi-recv-window": "X-BAPI-RECV-WINDOW",
      "referer": "Referer"
    };

    for (const [lower, proper] of Object.entries(headerMap)) {
      if (req.headers[lower]) headers[proper] = req.headers[lower];
    }

    // Copy standard headers
    ["content-type", "accept"].forEach(h => {
      if (req.headers[h]) headers[h] = req.headers[h];
    });

    // Default content-type for POST
    if (!headers["content-type"] && method !== "GET") {
      headers["Content-Type"] = "application/json";
    }

    // Build request
    const opts = { method, headers };

    if (method !== "GET" && method !== "HEAD" && req.body) {
      opts.body = typeof req.body === "object" ? JSON.stringify(req.body) : req.body;
    }

    // Forward to Bybit
    const response = await fetch(url, opts);
    const text = await response.text();

    // Send response
    const contentType = text.trim().startsWith("{") ? "application/json" : "text/html";
    res.status(response.status).set("Content-Type", contentType).send(text);

  } catch (e) {
    console.error(`[${prefix}] Error:`, e?.message);
    res.status(500).json({ error: e?.message || String(e) });
  }
}

// Routes
app.all("/mainnet/*", (req, res) => proxyToBybit(req, res, BYBIT_MAINNET, "mainnet"));
app.all("/testnet/*", (req, res) => proxyToBybit(req, res, BYBIT_TESTNET, "testnet"));

// Start
app.listen(PORT, () => console.log(`✓ Bybit proxy running on port ${PORT}`));
