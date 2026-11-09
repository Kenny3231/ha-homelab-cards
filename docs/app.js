const REPO = "https://github.com/Kenny3231/ha-homelab-cards";
const I18N = {
  fr: {
    skip: "Aller au contenu",
    nav_install: "Installation", nav_cards: "Cartes", nav_editor: "Éditeur", nav_req: "Intégrations",
    h1: "Votre homelab, <em>en un coup d'œil</em> dans Home Assistant",
    lead: "Des cartes Lovelace soignées pour UniFi, Proxmox, Synology, Transmission, DNS Technitium et Android TV. Une seule installation via HACS, vous choisissez les cartes. Zéro dépendance, éditeur visuel intégré.",
    cta_gh: "Voir sur GitHub", cta_install: "Installer",
    facts: (n, c) => [`<b>${n}</b> cartes`, `<b>${c}</b> catégories`, "Éditeur visuel", "Zéro dépendance"],
    h_install: "Installation avec HACS",
    install_lead: "Une seule intégration, cinq étapes, deux minutes. HACS se charge du téléchargement et des mises à jour.",
    steps: [
      "Dans HACS, ouvrez le menu <b>⋮</b> puis <b>Dépôts personnalisés</b>.",
      "Ajoutez l'adresse du dépôt avec le type <b>Intégration</b>.",
      "Cherchez <b>Homelab Cards</b>, cliquez sur <b>Télécharger</b> puis redémarrez Home Assistant.",
      "<b>Paramètres</b> → <b>Appareils et services</b> → <b>Ajouter une intégration</b> → <b>Homelab Cards</b>, puis cochez les cartes voulues.",
      "Rechargez le navigateur (<code>Ctrl+Shift+R</code>), puis <b>Ajouter une carte</b> sur un tableau de bord.",
    ],
    copy: "Copier", copied: "Copié",
    quick_h: "Raccourci My Home Assistant",
    quick_p: "Ouvre directement le dépôt dans le HACS de votre instance, sans copier-coller.",
    quick_btn: "Ouvrir dans HACS",
    no_yaml: "L'intégration charge elle-même les cartes cochées : aucune ressource à déclarer, même avec un tableau de bord en mode YAML.",
    pick_h: "Choisissez vos cartes",
    pick_p: "À l'ajout de l'intégration, un écran présente les cartes regroupées par catégorie (Réseau, Virtualisation, Stockage…), avec des noms lisibles dans la langue de Home Assistant. Tout est coché par défaut : décochez ce dont vous n'avez pas besoin, seules les cartes cochées sont chargées.",
    pick_perks: [
      ["Chargement automatique", "Chaque carte cochée est servie comme un fichier séparé et chargée par Home Assistant."],
      ["Modifiable à tout moment", "Paramètres → Appareils et services → Homelab Cards → Configurer, puis rechargez le navigateur."],
    ],
    pick_alt: "Écran de choix des cartes de Homelab Cards dans Home Assistant : cases à cocher regroupées par catégorie",
    h_cards: "Les cartes",
    cards_lead: "Chaque carte lit les entités d'une intégration Home Assistant. Filtrez par catégorie, cliquez sur une capture pour l'agrandir.",
    all: "Toutes", shown: (n) => `${n} carte${n > 1 ? "s" : ""} affichée${n > 1 ? "s" : ""}`,
    requires: "Nécessite", core_s: "Native", hacs_s: "HACS",
    zoom: "Agrandir la capture de", no_shot: "Capture à venir",
    h_editor: "Éditeur visuel",
    editor_lead: "Chaque carte embarque son propre éditeur dans l'interface de Home Assistant : plus besoin d'écrire du YAML à la main.",
    perks: [
      ["Sélecteurs d'entités", "Choisissez vos capteurs dans des listes, filtrées par intégration."],
      ["Aperçu en direct", "Le rendu se met à jour à chaque modification."],
      ["YAML toujours possible", "L'éditeur de code reste disponible pour les réglages avancés."],
    ],
    editor_win: "Éditeur", card_win: "Résultat",
    editor_cap: (n) => `Éditeur visuel de <b>${n}</b> : entités, sections et couleurs se règlent depuis l'interface.`,
    h_req: "Intégrations nécessaires",
    req_lead: "Installez d'abord l'intégration correspondant à votre matériel. Les natives sont incluses dans Home Assistant ; les autres s'ajoutent via HACS.",
    core_h: "Natives", core_p: "Incluses dans Home Assistant : Paramètres → Appareils et services → Ajouter une intégration.",
    hacs_h: "À installer via HACS", hacs_p: "Intégrations personnalisées, à ajouter depuis HACS avant la carte.",
    n_cards: (n) => `${n} carte${n > 1 ? "s" : ""}`,
    h_soon: "Bientôt", soon: "De nouvelles cartes arrivent dans les prochaines versions.",
    soon_portainer: "Conteneurs, piles et état des endpoints Portainer.",
    idea_h: "Une idée de carte ?", idea_p: "Proposez-la dans les issues GitHub.",
    foot: "Projet communautaire pour Home Assistant", foot_aff: "non affilié à Nabu Casa",
    close: "Fermer",
  },
  en: {
    skip: "Skip to content",
    nav_install: "Install", nav_cards: "Cards", nav_editor: "Editor", nav_req: "Integrations",
    h1: "Your homelab, <em>at a glance</em> in Home Assistant",
    lead: "Polished Lovelace cards for UniFi, Proxmox, Synology, Transmission, Technitium DNS and Android TV. One install through HACS, you pick the cards. Zero dependency, built-in visual editor.",
    cta_gh: "View on GitHub", cta_install: "Install",
    facts: (n, c) => [`<b>${n}</b> cards`, `<b>${c}</b> categories`, "Visual editor", "Zero dependency"],
    h_install: "Install with HACS",
    install_lead: "One integration, five steps, two minutes. HACS handles the download and future updates.",
    steps: [
      "In HACS, open the <b>⋮</b> menu, then <b>Custom repositories</b>.",
      "Add the repository URL with the <b>Integration</b> type.",
      "Search for <b>Homelab Cards</b>, click <b>Download</b>, then restart Home Assistant.",
      "<b>Settings</b> → <b>Devices &amp; services</b> → <b>Add integration</b> → <b>Homelab Cards</b>, then tick the cards you want.",
      "Reload your browser (<code>Ctrl+Shift+R</code>), then <b>Add card</b> on a dashboard.",
    ],
    copy: "Copy", copied: "Copied",
    quick_h: "My Home Assistant shortcut",
    quick_p: "Opens the repository straight in your instance's HACS, no copy-paste needed.",
    quick_btn: "Open in HACS",
    no_yaml: "The integration loads the ticked cards itself: no resource to declare, even with a YAML-mode dashboard.",
    pick_h: "Pick your cards",
    pick_p: "When you add the integration, a screen shows the cards grouped by category (Network, Virtualization, Storage…), with readable names in your Home Assistant language. Everything is ticked by default: untick what you don't need, only ticked cards get loaded.",
    pick_perks: [
      ["Loaded automatically", "Each ticked card is served as its own file and loaded by Home Assistant."],
      ["Change it anytime", "Settings → Devices & services → Homelab Cards → Configure, then reload your browser."],
    ],
    pick_alt: "Homelab Cards card picker in Home Assistant: checkboxes grouped by category",
    h_cards: "The cards",
    cards_lead: "Each card reads entities from a Home Assistant integration. Filter by category, click a screenshot to enlarge it.",
    all: "All", shown: (n) => `${n} card${n > 1 ? "s" : ""} shown`,
    requires: "Requires", core_s: "Built-in", hacs_s: "HACS",
    zoom: "Enlarge screenshot of", no_shot: "Screenshot coming soon",
    h_editor: "Visual editor",
    editor_lead: "Every card ships its own editor inside the Home Assistant UI: no more hand-written YAML.",
    perks: [
      ["Entity pickers", "Pick your sensors from lists, filtered by integration."],
      ["Live preview", "The card re-renders on every change."],
      ["YAML still there", "The code editor stays available for advanced settings."],
    ],
    editor_win: "Editor", card_win: "Result",
    editor_cap: (n) => `<b>${n}</b> visual editor: entities, sections and colors are set from the UI.`,
    h_req: "Required integrations",
    req_lead: "Install the integration matching your hardware first. Built-in ones ship with Home Assistant; the others are added through HACS.",
    core_h: "Built-in", core_p: "Ship with Home Assistant: Settings → Devices & services → Add integration.",
    hacs_h: "Install through HACS", hacs_p: "Custom integrations, to add from HACS before the card.",
    n_cards: (n) => `${n} card${n > 1 ? "s" : ""}`,
    h_soon: "Coming soon", soon: "More cards are planned for upcoming releases.",
    soon_portainer: "Containers, stacks and endpoint status from Portainer.",
    idea_h: "Got a card idea?", idea_p: "Suggest it in the GitHub issues.",
    foot: "Community project for Home Assistant", foot_aff: "not affiliated with Nabu Casa",
    close: "Close",
  },
};
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const icon = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const short = (c) => c.type.replace("custom:", "");
const nm = (c) => c.name?.[lang] || short(c);
let data, lang, filter = "all", tab = 0;

function render() {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((e) => (e.innerHTML = t[e.dataset.i18n]));
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
  $("#lb-close").setAttribute("aria-label", t.close);
  const cats = Object.entries(data.categories);
  $("#facts").innerHTML = t.facts(data.cards.length, cats.length).map((f) => `<li>${icon("check")}<span>${f}</span></li>`).join("");

  $("#steps").innerHTML = t.steps.map((s, i) => `<li>${s}${i === 1 ? `<div class="copy"><code id="repo-url">${REPO}</code><button type="button" data-copy>${icon("copy")}<span>${t.copy}</span></button></div>` : ""}</li>`).join("");

  $("#pick-perks").innerHTML = t.pick_perks.map(([h, p]) => `<li>${icon("check")}<span><b>${h}</b>${p}</span></li>`).join("");
  $("#pick-img").alt = t.pick_alt;
  $("#pick-shot").dataset.cap = t.pick_h;
  $("#filters").setAttribute("aria-label", t.h_cards);
  $("#filters").innerHTML = [["all", t.all, data.cards.length], ...cats.map(([id, n]) => [id, n[lang], data.cards.filter((c) => c.category === id).length])]
    .map(([id, name, n]) => `<button type="button" data-filter="${id}" aria-pressed="${id === filter}">${id === "all" ? "" : icon(id)}${esc(name)}<span class="n">${n}</span></button>`).join("");

  $("#catalog").innerHTML = data.cards.map((c) => {
    const i = data.integrations[c.integration];
    return `<article class="tile" id="card-${c.id}" data-cat="${c.category}">
      <button type="button" class="shot" data-zoom="img/${c.id}.png" data-cap="${esc(nm(c))}" aria-label="${t.zoom} ${esc(nm(c))}">
        <img src="img/${c.id}.png" alt="${esc(nm(c))}" loading="lazy" data-cat="${c.category}"><span class="zoom">${icon("zoom")}</span></button>
      <div class="tile-body">
        <div class="tile-head"><div><h3>${esc(nm(c))}</h3><div class="cat">${icon(c.category)}${esc(data.categories[c.category][lang])}</div></div>
          <span class="kind ${i.kind}">${i.kind === "core" ? t.core_s : t.hacs_s}</span></div>
        <p class="desc">${esc(c.desc[lang])}</p>
        ${c.note ? `<div class="note" role="note">${icon("warn")}<span>${esc(c.note[lang])}</span></div>` : ""}
        <div class="tile-foot"><span>${t.requires}</span><a class="chip" href="${i.url}">${esc(i.name)}${icon("ext")}</a><code>type: ${esc(c.type)}</code></div>
      </div></article>`;
  }).join("");
  applyFilter(false);

  $("#perks").innerHTML = t.perks.map(([h, p]) => `<li>${icon("check")}<span><b>${h}</b>${p}</span></li>`).join("");
  const eds = data.cards.filter((c) => c.editor);
  $("#editor-tabs").setAttribute("aria-label", t.h_editor);
  $("#editor-tabs").innerHTML = eds.map((c, k) => `<button type="button" role="tab" id="tab-${c.id}" aria-controls="panel-${c.id}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${icon(c.category)}${esc(nm(c))}</button>`).join("");
  $("#editor-panels").innerHTML = eds.map((c, k) => `<div class="panel" role="tabpanel" id="panel-${c.id}" aria-labelledby="tab-${c.id}" ${k === tab ? "" : "hidden"}>
      <figure class="window"><div class="chrome"><i></i><i></i><i></i><span>${t.editor_win}</span></div>
        <button type="button" data-zoom="img/${c.id}-editor.png" data-cap="${esc(nm(c))} — ${t.editor_win}" aria-label="${t.zoom} ${esc(nm(c))} (${t.editor_win})"><img src="img/${c.id}-editor.png" alt="${t.editor_win} ${esc(nm(c))}" loading="lazy"></button>
        <figcaption>${t.editor_cap(esc(nm(c)))}</figcaption></figure>
      <figure class="window"><div class="chrome"><i></i><i></i><i></i><span>${t.card_win}</span></div>
        <button type="button" data-zoom="img/${c.id}.png" data-cap="${esc(nm(c))}" aria-label="${t.zoom} ${esc(nm(c))}"><img src="img/${c.id}.png" alt="${esc(nm(c))}" loading="lazy"></button></figure>
    </div>`).join("");

  $("#reqs").innerHTML = ["core", "hacs"].map((k) => `<div class="req-col"><header><span class="kind ${k}">${t[k + "_s"]}</span><div><h3>${t[k + "_h"]}</h3><p>${t[k + "_p"]}</p></div></header><ul>
    ${Object.entries(data.integrations).filter(([, i]) => i.kind === k).map(([id, i]) => {
      const cs = data.cards.filter((c) => c.integration === id);
      return `<li><div class="req-name"><a href="${i.url}">${esc(i.name)}${icon("ext")}</a><span class="n">${t.n_cards(cs.length)}</span></div>
        <div class="req-cards">${cs.map((c) => `<a href="#card-${c.id}">${esc(nm(c))}</a>`).join("")}</div></li>`;
    }).join("")}</ul></div>`).join("");
}

function applyFilter(announce = true) {
  let n = 0;
  document.querySelectorAll(".tile").forEach((el) => { el.hidden = filter !== "all" && el.dataset.cat !== filter; if (!el.hidden) n++; });
  document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.filter === filter));
  if (announce) $("#filter-status").textContent = I18N[lang].shown(n);
}

function selectTab(k, focus) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tab = (k + tabs.length) % tabs.length;
  tabs.forEach((b, j) => { b.setAttribute("aria-selected", j === tab); b.tabIndex = j === tab ? 0 : -1; });
  document.querySelectorAll('[role="tabpanel"]').forEach((p, j) => (p.hidden = j !== tab));
  if (focus) tabs[tab].focus();
}

function revealCard(hash) {
  const el = hash.startsWith("#card-") && document.querySelector(hash);
  if (el && el.hidden) { filter = "all"; applyFilter(); el.scrollIntoView(); }
}

function setLang(l) { lang = l; try { localStorage.setItem("lang", l); } catch {} render(); }

const lb = $("#lightbox");
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zoom]");
  if (z) { $("#lb-img").src = z.dataset.zoom; $("#lb-img").alt = z.dataset.cap; $("#lb-cap").textContent = z.dataset.cap; lb.showModal(); return; }
  const f = e.target.closest("[data-filter]");
  if (f) { filter = f.dataset.filter; applyFilter(); return; }
  const tb = e.target.closest('[role="tab"]');
  if (tb) { selectTab([...tb.parentNode.children].indexOf(tb)); return; }
  const cp = e.target.closest("[data-copy]");
  if (cp) {
    const done = () => { cp.classList.add("ok"); cp.lastChild.textContent = I18N[lang].copied; setTimeout(() => { cp.classList.remove("ok"); cp.lastChild.textContent = I18N[lang].copy; }, 1800); };
    navigator.clipboard?.writeText(REPO).then(done, () => getSelection().selectAllChildren($("#repo-url"))) ?? getSelection().selectAllChildren($("#repo-url"));
    return;
  }
  const a = e.target.closest('a[href^="#card-"]');
  if (a) revealCard(a.getAttribute("href"));
});
document.addEventListener("keydown", (e) => {
  if (!e.target.matches('[role="tab"]')) return;
  const d = { ArrowRight: 1, ArrowLeft: -1, Home: -tab, End: 99 }[e.key];
  if (d === undefined) return;
  e.preventDefault();
  selectTab(e.key === "End" ? -1 : tab + d, true);
});
lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
$("#lb-close").addEventListener("click", () => lb.close());
// Missing screenshot: swap the broken image for a category placeholder instead of leaving a hole.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG" || img.id === "lb-img") return;
  const shot = img.closest(".shot");
  if (!shot) { img.hidden = true; return; }
  shot.outerHTML = `<div class="ph"><span class="badge">${icon(img.dataset.cat)}</span><span>${I18N[lang].no_shot}</span></div>`;
}, true);
window.addEventListener("hashchange", () => revealCard(location.hash));

document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => data && setLang(b.dataset.lang)));
fetch("cards.json", { cache: "no-cache" }).then((r) => r.json()).then((d) => {
  data = d;
  let saved; try { saved = localStorage.getItem("lang"); } catch {}
  setLang(saved || ((navigator.language || "fr").startsWith("fr") ? "fr" : "en"));
  revealCard(location.hash);
});
