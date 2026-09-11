import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { WebSocketServer } from "ws";
import { URL } from "node:url";

import { tokenRouter } from "./routes/token.js";
import { callRouter } from "./routes/call.js";
import { twilioRouter } from "./routes/twilio.js";
import { contactsRouter } from "./routes/contacts.js";
import { jobsRouter } from "./routes/jobs.js";
import { templatesRouter } from "./routes/templates.js";
import { transcriptionRouter } from "./routes/transcription.js";
import { registerConnection } from "./services/liveHub.js";
import { logger } from "./services/logger.js";
import { startTunnelIfConfigured, stopTunnel } from "./services/tunnel.js";
import { syncWebhooks } from "./services/syncWebhooks.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/public-base", (_req, res) =>
  res.json({ url: process.env.PUBLIC_BASE_URL || null }),
);

app.use("/api", tokenRouter);
app.use("/api", callRouter);
app.use("/api", contactsRouter);
app.use("/api", jobsRouter);
app.use("/api", templatesRouter);
app.use("/api", transcriptionRouter);
app.use(twilioRouter);

// Frontend (Vite) が build 済みなら dist を静的配信して、SPA fallback で
// ngrok 経由でも UI にアクセスできるようにする。
// dev では frontend/dist が無ければ何もしない (Vite の 5173 経由で開く前提)。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "..", "..", "frontend", "dist");
const indexHtml = path.join(distPath, "index.html");
if (fs.existsSync(indexHtml)) {
  app.use(express.static(distPath, { index: false }));
  app.get("*", (req, res, next) => {
    // API / webhook / WS 系のパスは frontend にフォールバックさせない
    if (
      req.path.startsWith("/api/") ||
      req.path.startsWith("/twilio/") ||
      req.path === "/health" ||
      req.path === "/ws/live"
    ) {
      return next();
    }
    // ファイル拡張子が有りそうなら 404 で正しい
    if (path.extname(req.path)) return next();
    res.sendFile(indexHtml);
  });
  logger.info({ distPath }, "serving frontend dist");
} else {
  logger.info({ distPath }, "frontend dist not built — serving API only");
}

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "", "http://localhost");
  if (url.pathname !== "/ws/live") {
    socket.destroy();
    return;
  }
  const agentId = url.searchParams.get("agentId");
  if (!agentId) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    registerConnection(agentId, ws);
    ws.send(
      JSON.stringify({
        type: "call-status",
        payload: { state: "idle" },
      }),
    );
  });
});

const port = Number(process.env.PORT || 4000);

async function main() {
  await new Promise<void>((resolve) => {
    server.listen(port, () => resolve());
  });
  logger.info(
    {
      port,
      hasCiConfig: !!process.env.TWILIO_INTELLIGENCE_CONFIG_ID,
      hasMemoryStore: !!process.env.TWILIO_MEMORY_STORE_ID,
      hasConversationConfig: !!process.env.TWILIO_CONVERSATION_CONFIG_ID,
    },
    "backend listening",
  );

  const tunnel = await startTunnelIfConfigured(port);
  if (tunnel) {
    process.env.PUBLIC_BASE_URL = tunnel.url;
    logger.info(
      { url: tunnel.url, ngrok: tunnel.ngrok },
      "public base url ready — syncing Twilio webhooks",
    );
    const result = await syncWebhooks(tunnel.url);
    logger.info(result, "webhook sync result");
  }
}

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  await stopTunnel();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((e) => {
  logger.error({ err: (e as Error).message }, "startup failed");
  process.exit(1);
});
