// Vérifie la syntaxe de chaque carte JS et la cohérence version manifest / package.json.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const root = "custom_components/homelab_cards";
let n = 0;
for (const cat of readdirSync(join(root, "cards")))
  for (const f of readdirSync(join(root, "cards", cat)).filter((x) => x.endsWith(".js"))) {
    execFileSync(process.execPath, ["--check", join(root, "cards", cat, f)]); n++;
  }
const cat = JSON.parse(readFileSync(join(root, "cards.json"), "utf8")).cards.map((c) => c.file).sort();
const files = readdirSync(join(root, "cards")).flatMap((d) => readdirSync(join(root, "cards", d)).filter((x) => x.endsWith(".js")).map((x) => `${d}/${x}`)).sort();
if (JSON.stringify(cat) !== JSON.stringify(files)) throw new Error(`cards.json et cards/ divergent:
${cat}
${files}`);
const a = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).version;
const b = JSON.parse(readFileSync("package.json", "utf8")).version;
if (a !== b) throw new Error(`version manifest ${a} != package.json ${b}`);
console.log(`${n} cartes OK, version ${a}`);
