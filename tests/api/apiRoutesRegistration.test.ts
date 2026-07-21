import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Azure Functions API entrypoint", () => {
  it("imports every API module that registers an HTTP function", async () => {
    const apiDirectory = path.resolve("src/api");
    const entrypoint = await readFile(path.resolve("src/functions/apiRoutes.ts"), "utf8");
    const apiFiles = (await readdir(apiDirectory)).filter((file) => file.endsWith(".ts"));
    const routeModules: string[] = [];

    for (const file of apiFiles) {
      const source = await readFile(path.join(apiDirectory, file), "utf8");
      if (source.includes("app.http(")) routeModules.push(file.replace(/\.ts$/u, ""));
    }

    const missingImports = routeModules
      .filter((moduleName) => !entrypoint.includes(`import "../api/${moduleName}.js";`))
      .sort();

    expect(missingImports).toEqual([]);
  });
});
