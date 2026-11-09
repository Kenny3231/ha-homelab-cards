// Concatène toutes les cartes dans un seul fichier : HACS n'enregistre qu'une ressource par dépôt.
// Chaque carte est isolée dans sa propre portée { } pour éviter les collisions de const.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "src/cards";
const files = readdirSync(root).sort().flatMap((cat) =>
  readdirSync(join(root, cat)).filter((f) => f.endsWith(".js")).sort().map((f) => join(root, cat, f)));

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const out = [`/*! ha-homelab-cards v${version} — https://github.com/Kenny3231/ha-homelab-cards — MIT */`];
for (const f of files) out.push(`\n/* ---- ${f.replaceAll("\\", "/")} ---- */\n{\n${readFileSync(f, "utf8")}\n}`);

mkdirSync("dist", { recursive: true });
writeFileSync("dist/ha-homelab-cards.js", out.join("\n"));
console.log(`${files.length} cartes -> dist/ha-homelab-cards.js (${Math.round(statSync("dist/ha-homelab-cards.js").size / 1024)} Ko)`);
