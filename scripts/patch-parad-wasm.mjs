import { readFileSync, writeFileSync } from "node:fs";

const enginePath = "node_modules/parad/dist/engine.js";
const source = readFileSync(enginePath, "utf8");
const current = "sqlPromise = initSqlJs();";
const replacement = "sqlPromise = initSqlJs({ locateFile: () => path.join(process.cwd(), \"server/assets/sql-wasm.wasm\") });";

if (source.includes(replacement)) process.exit(0);
if (!source.includes(current)) throw new Error("Unsupported parad engine: sql.js initialization pattern not found.");
writeFileSync(enginePath, source.replace(current, replacement));
console.log("Patched parad sql.js WASM loader to use server/assets/sql-wasm.wasm");
