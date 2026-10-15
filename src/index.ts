import express from "express";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.js";
import { settings } from "./config.js";

const app = express();
app.use(express.json());

const sessions = new Map<
  string,
  { transport: SSEServerTransport; server: ReturnType<typeof createMcpServer> }
>();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();
  sessions.set(transport.sessionId, { transport, server });

  res.on("close", async () => {
    sessions.delete(transport.sessionId);
    await server.close().catch(() => undefined);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = String(req.query.sessionId ?? "");
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(400).json({ error: "Unknown or missing sessionId" });
    return;
  }
  await session.transport.handlePostMessage(req, res, req.body);
});

const httpServer = app.listen(settings.port, settings.host, () => {
  console.error(
    `Starting enbek.kz MCP server on ${settings.host}:${settings.port}`,
  );
  console.error(`SSE endpoint: http://${settings.host}:${settings.port}/sse`);
});

const shutdown = async () => {
  console.error("Shutting down...");
  httpServer.close();
  for (const { server } of sessions.values()) {
    await server.close().catch(() => undefined);
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
