import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const budget = 45 * 1024 * 1024;
let total = 0;
let files = 0;

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else { total += stat.size; files += 1; }
  }
}

walk(root);
if (total > budget) throw new Error(`Static package is ${(total / 1024 / 1024).toFixed(1)} MB; budget is 45 MB.`);

const index = readFileSync(join(root, "index.html"), "utf8");
if (/manifest\.webmanifest|serviceWorker/i.test(index)) throw new Error("PWA registration leaked into the static build.");

console.log(`Static validation passed: ${files} files, ${(total / 1024 / 1024).toFixed(1)} MB.`);
