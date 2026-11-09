// Génère README.md (EN) et README.fr.md (FR) depuis docs/cards.json — source unique avec le site.
import { readFileSync, writeFileSync } from "node:fs";
const { categories, integrations, cards } = JSON.parse(readFileSync("docs/cards.json", "utf8"));
const REPO = "Kenny3231/ha-homelab-cards";
const T = {
  en: {
    file: "README.md", other: ["Français", "README.fr.md"],
    tag: "Lovelace cards for Home Assistant homelabs: UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV and more. Zero dependency, visual editor included, one HACS install.",
    install: "Installation (HACS)",
    steps: [
      "In HACS, open the menu (⋮) → **Custom repositories**.",
      `Add \`https://github.com/${REPO}\` with type **Dashboard** (a.k.a. *Lovelace*).`,
      "Search for **Homelab Cards**, click **Download**.",
      "Reload your browser (Ctrl+Shift+R). HACS registers the resource itself: **nothing to add in `configuration.yaml`**.",
      "Edit a dashboard → **Add card** → search the card name (e.g. “UniFi Gateway”).",
    ],
    manual: "Manual install: copy `dist/ha-homelab-cards.js` to `/config/www/` and add the resource `/local/ha-homelab-cards.js` (type *JavaScript module*).",
    cards: "Cards", integ: "Required integrations", needs: "Requires", core: "built-in", hacs: "HACS custom integration",
    legend: "“HACS” integrations must be installed first; “built-in” ones ship with Home Assistant.",
    ex: "Example", contrib: "Contributing", contribTxt: "Issues and pull requests are welcome. Cards live in `src/cards/<category>/`; run `npm run build` to regenerate `dist/` and `npm run docs` for the READMEs.",
    site: "Website", lic: "License",
  },
  fr: {
    file: "README.fr.md", other: ["English", "README.md"],
    tag: "Cartes Lovelace pour homelab Home Assistant : UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV et plus. Zéro dépendance, éditeur visuel inclus, une seule installation HACS.",
    install: "Installation (HACS)",
    steps: [
      "Dans HACS, ouvrez le menu (⋮) → **Dépôts personnalisés**.",
      `Ajoutez \`https://github.com/${REPO}\` avec le type **Tableau de bord** (*Lovelace*).`,
      "Cherchez **Homelab Cards** puis cliquez sur **Télécharger**.",
      "Rechargez le navigateur (Ctrl+Shift+R). HACS déclare la ressource lui-même : **rien à ajouter dans `configuration.yaml`**.",
      "Modifiez un tableau de bord → **Ajouter une carte** → cherchez le nom de la carte (ex. « UniFi Gateway »).",
    ],
    manual: "Installation manuelle : copiez `dist/ha-homelab-cards.js` dans `/config/www/` et ajoutez la ressource `/local/ha-homelab-cards.js` (type *Module JavaScript*).",
    cards: "Cartes", integ: "Intégrations requises", needs: "Nécessite", core: "native", hacs: "intégration personnalisée HACS",
    legend: "Les intégrations « HACS » sont à installer au préalable ; les « natives » sont fournies avec Home Assistant.",
    ex: "Exemple", contrib: "Contribuer", contribTxt: "Issues et pull requests bienvenues. Les cartes sont dans `src/cards/<catégorie>/` ; `npm run build` régénère `dist/`, `npm run docs` les README.",
    site: "Site", lic: "Licence",
  },
};
for (const l of ["en", "fr"]) {
  const t = T[l]; const L = [];
  L.push(`# Homelab Cards for Home Assistant\n\n[${t.other[0]}](${t.other[1]}) · [${t.site}](https://kenny3231.github.io/ha-homelab-cards/) · [![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)\n\n${t.tag}\n`);
  L.push(`## ${t.install}\n\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${t.manual}\n`);
  L.push(`## ${t.integ}\n\n| | |\n|---|---|\n${Object.values(integrations).map((i) => `| [${i.name}](${i.url}) | ${t[i.kind]} |`).join("\n")}\n\n${t.legend}\n`);
  L.push(`## ${t.cards}\n`);
  for (const [cid, cname] of Object.entries(categories)) {
    L.push(`### ${cname[l]}\n\n| Card | ${t.needs} | |\n|---|---|---|`);
    for (const c of cards.filter((x) => x.category === cid)) {
      const i = integrations[c.integration];
      L.push(`| \`${c.type}\` | [${i.name}](${i.url}) | ${c.desc[l]}${c.note ? ` ⚠️ ${c.note[l]}` : ""} |`);
    }
    L.push("");
  }
  L.push(`## ${t.ex}\n\n\`\`\`yaml\ntype: custom:unifi-gateway-card\ntitle: Gateway\n\`\`\`\n\n${l === "fr" ? "Chaque carte possède un éditeur visuel : utilisez-le pour choisir vos entités." : "Every card has a visual editor: use it to pick your entities."}\n`);
  L.push(`## ${t.contrib}\n\n${t.contribTxt}\n\n## ${t.lic}\n\nMIT`);
  writeFileSync(t.file, L.join("\n") + "\n");
}
console.log("README.md + README.fr.md");
