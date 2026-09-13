// SPDX-License-Identifier: GPL-3.0-only
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export function startFixtureServer(port: number) {
  const server = http.createServer((req, res) => {
    if (req.url === "/ads/banner.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end("// should never be served if DNR blocked it");
      return;
    }
    if (req.url === "/" || req.url === "/blocked-request.html") {
      readFile(path.join(dir, "fixtures/blocked-request.html"))
        .then((buf) => {
          res.writeHead(200, { "content-type": "text/html" });
          res.end(buf);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
      return;
    }
    if (req.url === "/popup-hijack.html") {
      readFile(path.join(dir, "fixtures/popup-hijack.html"))
        .then((buf) => {
          res.writeHead(200, { "content-type": "text/html" });
          res.end(buf);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise<http.Server>((resolve) => {
    server.listen(port, () => resolve(server));
  });
}
