const I18N = {
  fr: {
    nav_install: "Installation", nav_cards: "Cartes", nav_req: "Prérequis",
    h1: "Des cartes Lovelace pensées pour votre homelab",
    lead: "UniFi, Proxmox, Synology, Transmission, DNS Technitium, Android TV… Zéro dépendance, éditeur visuel inclus, installation en un clic via HACS.",
    cta_gh: "Voir sur GitHub", cta_install: "Installer",
    h_install: "Installation avec HACS",
    steps: [
      "Dans HACS, menu ⋮ → <b>Dépôts personnalisés</b>.",
      "Ajoutez <code>https://github.com/Kenny3231/ha-homelab-cards</code> avec le type <b>Tableau de bord</b>.",
      "Cherchez <b>Homelab Cards</b> et cliquez sur <b>Télécharger</b>.",
      "Rechargez le navigateur (<code>Ctrl+Shift+R</code>).",
      "Modifiez un tableau de bord → <b>Ajouter une carte</b> → choisissez une carte Homelab.",
    ],
    no_yaml: "HACS déclare la ressource automatiquement : rien à écrire dans configuration.yaml.",
    h_cards: "Les cartes", requires: "Nécessite", details: "Exemple de configuration",
    h_req: "Intégrations nécessaires", req_lead: "Chaque carte lit les entités d'une intégration Home Assistant. Installez d'abord celle qui vous concerne.",
    th_integ: "Intégration", th_kind: "Type", th_cards: "Cartes concernées",
    core: "Native (incluse dans Home Assistant)", hacs: "Personnalisée (à installer via HACS)",
    h_soon: "Bientôt", soon: "De nouvelles cartes arrivent dans les prochaines versions (Portainer, etc.).",
    foot: "Projet communautaire pour Home Assistant",
  },
  en: {
    nav_install: "Install", nav_cards: "Cards", nav_req: "Requirements",
    h1: "Lovelace cards built for your homelab",
    lead: "UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV… Zero dependency, visual editor included, one-click install through HACS.",
    cta_gh: "View on GitHub", cta_install: "Install",
    h_install: "Install with HACS",
    steps: [
      "In HACS, menu ⋮ → <b>Custom repositories</b>.",
      "Add <code>https://github.com/Kenny3231/ha-homelab-cards</code> with type <b>Dashboard</b>.",
      "Search for <b>Homelab Cards</b> and click <b>Download</b>.",
      "Reload your browser (<code>Ctrl+Shift+R</code>).",
      "Edit a dashboard → <b>Add card</b> → pick a Homelab card.",
    ],
    no_yaml: "HACS registers the resource for you: nothing to add to configuration.yaml.",
    h_cards: "The cards", requires: "Requires", details: "Configuration example",
    h_req: "Required integrations", req_lead: "Each card reads entities from a Home Assistant integration. Install the one you need first.",
    th_integ: "Integration", th_kind: "Type", th_cards: "Cards",
    core: "Built-in (ships with Home Assistant)", hacs: "Custom (install through HACS)",
    h_soon: "Coming soon", soon: "More cards are planned for upcoming releases (Portainer, etc.).",
    foot: "Community project for Home Assistant",
  },
};
const $ = (s) => document.querySelector(s);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let data, lang;
function render() {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t[e.dataset.i18n]));
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  $("#steps").innerHTML = t.steps.map((s) => `<li>${s}</li>`).join("");
  const chip = (i) => `<a class="chip" href="${i.url}">${esc(i.name)}</a>`;
  $("#catalog").innerHTML = Object.entries(data.categories).map(([cid, name]) => `
    <h3>${esc(name[lang])}</h3><div class="grid">${data.cards.filter((c) => c.category === cid).map((c) => {
      const i = data.integrations[c.integration];
      return `<article class="card"><img src="img/${c.id}.png" alt="${esc(c.type)}" loading="lazy" onerror="this.remove()">
        <div class="body"><h4>${esc(c.type.replace("custom:", ""))}</h4><p>${esc(c.desc[lang])}</p>
        ${c.note ? `<div class="note">${esc(c.note[lang])}</div>` : ""}
        <div class="chips"><span class="req">${t.requires}</span>${chip(i)}</div>
        <details><summary>${t.details}</summary><pre><code>type: ${esc(c.type)}</code></pre></details></div></article>`;
    }).join("")}</div>`).join("");
  $("#reqs").innerHTML = Object.entries(data.integrations).map(([id, i]) =>
    `<tr><td><a href="${i.url}">${esc(i.name)}</a></td><td>${t[i.kind]}</td><td>${data.cards.filter((c) => c.integration === id).map((c) => `<code>${esc(c.type.replace("custom:", ""))}</code>`).join(" ")}</td></tr>`).join("");
}
function setLang(l) { lang = l; try { localStorage.setItem("lang", l); } catch {} render(); }
fetch("cards.json").then((r) => r.json()).then((d) => {
  data = d;
  let saved; try { saved = localStorage.getItem("lang"); } catch {}
  setLang(saved || ((navigator.language || "fr").startsWith("fr") ? "fr" : "en"));
});
document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => data && setLang(b.dataset.lang)));
