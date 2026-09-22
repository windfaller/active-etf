import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const destination = process.argv[2];
if (!destination) throw Error("Usage: node scripts/package-member-mcp.mjs <new-output-directory>");
const target = resolve(destination);
if (existsSync(target)) throw Error("Use a fresh package directory to avoid stale artifacts");
mkdirSync(target, {recursive: true});
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.main = "dist-api/src/mcp/standalone.js";
pkg.scripts = {}; delete pkg.devDependencies;
pkg.engines = {node: ">=24"};
writeFileSync(resolve(target, "package.json"), JSON.stringify(pkg, null, 2));
cpSync("package-lock.json", resolve(target, "package-lock.json"));
cpSync("dist-api/src", resolve(target, "dist-api/src"), {recursive: true});
const host = JSON.parse(readFileSync("host.json", "utf8"));
host.extensions = {http: {routePrefix: ""}};
host.functionTimeout = "00:01:00";
writeFileSync(resolve(target, "host.json"), JSON.stringify(host, null, 2));
for (const path of ["assets", "favicon.svg", "app-version.json", ...["en","zh-TW","zh-CN","ja","ko"].flatMap(l=>[`${l}/mcp/index.html`,`${l}/mcp/connect/index.html`])]) {
  if (existsSync("dist/"+path)) cpSync("dist/"+path, resolve(target,"public-agent",path), {recursive:true});
}
console.log("Standalone HTTP entry packaged; market timers and Skill pages are not registered or served.");
