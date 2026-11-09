// Génère README.md (EN) et README.fr.md (FR) depuis custom_components/homelab_cards/cards.json — source unique avec le site.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
const CATALOG = "custom_components/homelab_cards/cards.json"; // source unique : intégration + site + README
const { categories, integrations, cards } = JSON.parse(readFileSync(CATALOG, "utf8"));
copyFileSync(CATALOG, "docs/cards.json"); // le site (GitHub Pages) ne sert que docs/
const REPO = "Kenny3231/ha-homelab-cards";
const T = {
  en: {
    file: "README.md", other: ["Français", "README.fr.md"],
    tag: "Lovelace cards for Home Assistant homelabs: UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV and more. Zero dependency, visual editor included, one HACS install, pick the cards you want.",
    install: "Installation (HACS)",
    steps: [
      `In HACS, open the menu (⋮) → **Custom repositories**.`,
      `Add \`https://github.com/${REPO}\` with type **Integration**.`,
      `Search for **Homelab Cards**, click **Download**, then **restart Home Assistant**.`,
      `Settings → Devices & services → **Add integration** → **Homelab Cards**, tick the cards you want.`,
      `Reload your browser (Ctrl+Shift+R). Edit a dashboard → **Add card** → search the card name (e.g. “UniFi Gateway”).`,
    ],
    pick: "The setup screen groups the cards by category (Network, Virtualization, Storage, Media, Home) with readable names. Everything is ticked by default; change the selection later in *Settings → Devices & services → Homelab Cards → Configure*, then reload the browser.",
    yaml: "**No resource to declare**: the integration loads the cards by itself, including with YAML-mode dashboards. Change the selection later in the integration options.",
    manual: "Manual install: copy `custom_components/homelab_cards` to `/config/custom_components/` and restart.",
    cards: "Cards", integ: "Required integrations", needs: "Requires", core: "built-in", hacs: "HACS custom integration",
    legend: "“HACS” integrations must be installed first; “built-in” ones ship with Home Assistant.",
    ex: "Example", contrib: "Contributing", contribTxt: "Issues and pull requests are welcome. Cards live in `custom_components/homelab_cards/cards/<category>/` (picked up automatically); run `npm run check` then `npm run docs` for the READMEs.",
    site: "Website", lic: "License",
  },
  fr: {
    file: "README.fr.md", other: ["English", "README.md"],
    tag: "Cartes Lovelace pour homelab Home Assistant : UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV et plus. Zéro dépendance, éditeur visuel inclus, une seule installation HACS, vous choisissez les cartes.",
    install: "Installation (HACS)",
    steps: [
      `Dans HACS, ouvrez le menu (⋮) → **Dépôts personnalisés**.`,
      `Ajoutez \`https://github.com/${REPO}\` avec le type **Intégration**.`,
      `Cherchez **Homelab Cards**, cliquez sur **Télécharger**, puis **redémarrez Home Assistant**.`,
      `Paramètres → Appareils et services → **Ajouter une intégration** → **Homelab Cards**, cochez les cartes voulues.`,
      `Rechargez le navigateur (Ctrl+Shift+R). Modifiez un tableau de bord → **Ajouter une carte** → cherchez le nom de la carte (ex. « UniFi Gateway »).`,
    ],
    pick: "L'écran de configuration regroupe les cartes par catégorie (Réseau, Virtualisation, Stockage, Média, Maison) avec des noms lisibles. Tout est coché par défaut ; changez la sélection plus tard dans *Paramètres → Appareils et services → Homelab Cards → Configurer*, puis rechargez le navigateur.",
    yaml: "**Aucune ressource à déclarer** : l'intégration charge les cartes toute seule, même avec des tableaux de bord en mode YAML. Modifiez la sélection plus tard dans les options de l'intégration.",
    manual: "Installation manuelle : copiez `custom_components/homelab_cards` dans `/config/custom_components/` puis redémarrez.",
    cards: "Cartes", integ: "Intégrations requises", needs: "Nécessite", core: "native", hacs: "intégration personnalisée HACS",
    legend: "Les intégrations « HACS » sont à installer au préalable ; les « natives » sont fournies avec Home Assistant.",
    ex: "Exemple", contrib: "Contribuer", contribTxt: "Issues et pull requests bienvenues. Les cartes sont dans `custom_components/homelab_cards/cards/<catégorie>/` (prises en compte automatiquement) ; `npm run check` puis `npm run docs` pour les README.",
    site: "Site", lic: "Licence",
  },
};
for (const l of ["en", "fr"]) {
  const t = T[l]; const L = [];
  L.push(`# Homelab Cards for Home Assistant\n\n[${t.other[0]}](${t.other[1]}) · [${t.site}](https://kenny3231.github.io/ha-homelab-cards/) · [![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)\n\n${t.tag}\n`);
  const shots = cards.filter((c) => existsSync(`docs/img/${c.id}.png`));
  L.push(`<p align="center">${shots.slice(0, 6).map((c) => `<img src="docs/img/${c.id}.png" width="240" alt="${c.name[l]}">`).join(" ")}</p>
`);
  L.push(`## ${t.install}\n\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${t.pick}

<p align=\"center\"><img src=\"docs/img/config-flow.png\" width=\"380\" alt=\"Homelab Cards\"></p>

${t.yaml}

${t.manual}\n`);
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
