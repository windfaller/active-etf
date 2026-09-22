import express from "express";
import { createAgentHandler, type AgentOptions } from "./handler.js";
/** Local HTTP adapter only. Cloud execution uses the native Functions adapter. */
export function createAgentApp(options: AgentOptions & { webRoot?: string }) {
  const app = express(),
    handler = createAgentHandler(options);
  app.disable("x-powered-by");
  app.use(async (req, res, next) => {
    if (
      options.webRoot &&
      /^\/(?:assets|skills|en|zh-TW|zh-CN|ja|ko|favicon)/.test(req.path)
    ) {
      next();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32768) {
        res.status(413).json({ error: "request_too_large" });
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
    const request = new Request(options.origin + req.originalUrl, {
      method: req.method,
      headers,
      ...(["GET", "HEAD"].includes(req.method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await handler(request, req.ip ?? "local");
    res.status(response.status);
    response.headers.forEach((v, k) => {
      if (k !== "set-cookie") res.setHeader(k, v);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  if (options.webRoot) app.use(express.static(options.webRoot));
  return app;
}
