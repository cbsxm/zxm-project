import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5178);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const safePath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const target = resolve(join(root, safePath));

  if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(target)] || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`English Study preview: http://127.0.0.1:${port}`);
});
