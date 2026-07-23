import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : 4176);
const root = resolve(process.cwd(), "dist");
const apiTarget = process.env.PREVIEW_API_TARGET ?? "http://127.0.0.1:7072";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

function safeFile(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/u, "") || "/";
  const relative = clean === "/" ? "index.html" : clean.replace(/^\/+|\/+$/gu, "");
  const candidates = extname(relative)
    ? [resolve(root, relative)]
    : [resolve(root, relative, "index.html")];
  return candidates.find((candidate) => candidate.startsWith(`${root}${sep}`) && existsSync(candidate) && statSync(candidate).isFile());
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
  if (pathname.startsWith("/api/")) {
    try {
      const upstream = await fetch(`${apiTarget}${request.url ?? pathname}`, { method: request.method });
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": upstream.headers.get("cache-control") ?? "no-store"
      });
      response.end(body);
    } catch {
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Local preview API is unavailable" }));
    }
    return;
  }
  const file = safeFile(pathname) ?? (/^\/stocks\/(?:tw|us)\/[^/]+$/u.test(pathname) ? resolve(root, "stocks", "_dynamic", "index.html") : undefined);
  if (!file) {
    const notFoundFile = resolve(root, "404", "index.html");
    response.writeHead(404, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache, must-revalidate"
    });
    if (existsSync(notFoundFile)) createReadStream(notFoundFile).pipe(response);
    else response.end("Not found");
    return;
  }
  const isAsset = pathname.startsWith("/assets/");
  response.writeHead(200, {
    "content-type": contentTypes.get(extname(file)) ?? "application/octet-stream",
    "cache-control": isAsset ? "public, max-age=31536000, immutable" : "no-cache, must-revalidate"
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static production preview listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
