/**
 * Battery Inventory Card — batteries grouped by battery type (CR2032, AA, 2xAAA…)
 * Version 1.0.0
 *
 * Loaded automatically by the Homelab Cards integration.
 * Works without configuration: every battery entity found in hass.states
 * (device_class "battery", or a "%"/word state on an id containing "batter")
 * is listed in one group. Users then create their own types and file entities in them.
 * Detection never relies on entity names or on the UI language.
 */

const BI_VERSION = "1.0.0";

/* ---------- i18n ---------- */
const BI_I18N = {
  en: {
    def_group: "Batteries", unassigned: "Unassigned", type_hash: "Type #{0}",
    dev: { one: "{0} device", other: "{0} devices" }, off_n: "{0} offline",
    rebuy: "to buy {0}", stock_ok: "stock ok", offline: "offline", low: "low", ok: "ok",
    t_crit: { one: "battery to replace", other: "batteries to replace" },
    t_warn: "still fine", t_ok: "fleet all green",
    s_other: { one: "{0} other below {1}", other: "{0} others below {1}" },
    s_below: { one: "{0} battery below {1}", other: "{0} batteries below {1}" },
    s_none_other: "no other battery below {1}", s_none: "no battery below {1}",
    p_buy: "To buy {0}× {1}", p_nothing: "Nothing to buy", p_fleet: "Fleet {0}/{1} green", p_off: "{0} offline",
    e_none: "No battery found. Battery entities appear here automatically; sort them into types from the card editor.",
    e_group: "No device in this type yet.", e_type: "Type “{0}” not found.",
    /* editor */
    s_general: "General", s_types: "Battery types", s_unassigned: "Unassigned", s_advanced: "Advanced",
    expand_all: "Expand all", collapse_all: "Collapse all",
    title: "Title", warn: "Warning threshold (%)", crit: "Critical threshold (%)", sort: "Sort",
    o_level: "Lowest level first", o_name: "Name", columns: "Columns (0 = auto)",
    show_summary: "Show the summary", only_type: "Show only", o_all: "Everything", o_summary: "The summary only",
    name: "Name", cells: "Batteries per device", icon: "Icon", entity: "Entity",
    warn_t: "Warning threshold (%) — optional", crit_t: "Critical threshold (%) — optional",
    add_type: "Add a type", add_entity: "Add an entity", move_to: "Move to…", put_in: "File in…",
    up: "Move up", down: "Move down", del: "Delete", suggest: "Quick pick",
    no_ents: "No entity in this type.", no_types: "Create a type first to file these entities.",
    all_sorted: "Every detected battery is filed in a type.",
    word_map: "Text state → % (word_map)", auto_unassigned: "Show an “Unassigned” group with detected batteries",
    hint_types: "One type per battery model. “Batteries per device” counts what to buy (2 for 2xAA).",
    hint_unassigned: "Battery entities detected but not filed in any type yet.",
    desc: "Battery fleet grouped by battery type, with thresholds and a shopping summary.",
  },
  fr: {
    def_group: "Batteries", unassigned: "Non classées", type_hash: "Type n°{0}",
    dev: { one: "{0} appareil", other: "{0} appareils" }, off_n: "{0} hors ligne",
    rebuy: "racheter {0}", stock_ok: "stock ok", offline: "hors ligne", low: "faible", ok: "ok",
    t_crit: { one: "pile à remplacer", other: "piles à remplacer" },
    t_warn: "tout tient encore", t_ok: "parc au vert",
    s_other: { one: "{0} autre sous les {1}", other: "{0} autres sous les {1}" },
    s_below: { one: "{0} pile sous les {1}", other: "{0} piles sous les {1}" },
    s_none_other: "aucune autre pile sous les {1}", s_none: "aucune pile sous les {1}",
    p_buy: "À racheter {0}× {1}", p_nothing: "Rien à racheter", p_fleet: "Parc {0}/{1} au vert", p_off: "{0} hors ligne",
    e_none: "Aucune batterie détectée. Les entités batterie apparaissent ici automatiquement ; rangez-les par type depuis l'éditeur de la carte.",
    e_group: "Aucun appareil dans ce type pour l'instant.", e_type: "Type « {0} » introuvable.",
    s_general: "Général", s_types: "Types de piles", s_unassigned: "Non classées", s_advanced: "Avancé",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    title: "Titre", warn: "Seuil d'alerte (%)", crit: "Seuil critique (%)", sort: "Tri",
    o_level: "Niveau le plus bas d'abord", o_name: "Nom", columns: "Colonnes (0 = auto)",
    show_summary: "Afficher le résumé", only_type: "N'afficher que", o_all: "Tout", o_summary: "Le résumé seulement",
    name: "Nom", cells: "Piles par appareil", icon: "Icône", entity: "Entité",
    warn_t: "Seuil d'alerte (%) — facultatif", crit_t: "Seuil critique (%) — facultatif",
    add_type: "Ajouter un type", add_entity: "Ajouter une entité", move_to: "Déplacer vers…", put_in: "Ranger dans…",
    up: "Monter", down: "Descendre", del: "Supprimer", suggest: "Choix rapide",
    no_ents: "Aucune entité dans ce type.", no_types: "Créez d'abord un type pour y ranger ces entités.",
    all_sorted: "Toutes les batteries détectées sont rangées dans un type.",
    word_map: "État texte → % (word_map)", auto_unassigned: "Afficher un groupe « Non classées » avec les batteries détectées",
    hint_types: "Un type par modèle de pile. « Piles par appareil » sert au comptage à racheter (2 pour 2xAA).",
    hint_unassigned: "Entités batterie détectées mais rangées dans aucun type.",
    desc: "Parc de piles classé par type de pile, avec seuils et résumé « à racheter ».",
  },
};
const biLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const biDict = (loc) => BI_I18N[/^fr/i.test(loc) ? "fr" : "en"];
/* {0}, {1}… placeholders; object values are plural forms selected on the first argument */
function biT(h, k, ...a) {
  const loc = biLoc(h);
  let v = biDict(loc)[k];
  if (v === undefined) v = BI_I18N.en[k] !== undefined ? BI_I18N.en[k] : k;
  if (v && typeof v === "object") v = v[new Intl.PluralRules(loc).select(Number(a[0]) || 0)] || v.other;
  return String(v).replace(/\{(\d)\}/g, (m, i) => (a[i] !== undefined ? a[i] : m));
}
const biEsc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const biPct = (h, v) =>
  new Intl.NumberFormat(biLoc(h), { style: "percent", maximumFractionDigits: 0 }).format(v / 100);

/* ---------- values ---------- */
const BI_WORDS = { low: 15, medium: 50, high: 85, full: 100, normal: 85 };
const BI_DEAD = ["", "unavailable", "unknown", "none", "inconnu"];
const BI_SUGGEST = ["CR2032", "CR2450", "CR2025", "CR1632", "CR123A", "AAA", "AA", "2xAAA", "2xAA", "9V",
  "AAA rechargeable", "AA rechargeable"];
const biWordMap = (wm) => {
  const out = {};
  Object.entries(Object.assign({}, BI_WORDS, wm && typeof wm === "object" ? wm : {})).forEach(([k, v]) => {
    if (!isNaN(Number(v))) out[String(k).toLowerCase()] = Number(v);
  });
  return out;
};
/* { v } numeric level, { v, text } textual state, { v, word } binary sensor, { dead } offline */
function biValue(st, wm) {
  if (!st) return { dead: true };
  const s = String(st.state == null ? "" : st.state).trim().toLowerCase();
  if (BI_DEAD.includes(s)) return { dead: true };
  const dom = st.entity_id.split(".")[0], a = st.attributes || {};
  if (dom === "binary_sensor") {
    if (s === "on") return { v: 10, word: "low" };
    return s === "off" ? { v: 100, word: "ok" } : { dead: true };
  }
  if (dom !== "sensor") {
    const n = parseFloat(a.battery_level !== undefined ? a.battery_level : a.battery);
    if (!isNaN(n)) return { v: n };
  }
  const n = parseFloat(st.state);
  if (!isNaN(n)) return { v: n };
  if (wm[s] !== undefined) return { v: wm[s], text: String(st.state) };
  return { dead: true };
}

/* ---------- detection ---------- */
function biDetect(hass, wm) {
  if (!hass || !hass.states) return [];
  const ents = hass.entities || {};
  const cand = Object.keys(hass.states).filter((id) => {
    const dom = id.split(".")[0];
    if (dom !== "sensor" && dom !== "binary_sensor") return false;
    const e = ents[id];
    if (e && (e.hidden || e.hidden_by)) return false;
    const st = hass.states[id], a = st.attributes || {};
    if (a.device_class === "battery") return true;
    return dom === "sensor" && /batter/i.test(id.split(".")[1]) &&
      (a.unit_of_measurement === "%" || wm[String(st.state).toLowerCase()] !== undefined);
  });
  /* A device with a battery level sensor does not also need its "battery low" binary sensor */
  const withSensor = new Set(cand.filter((id) => id.startsWith("sensor.") && ents[id] && ents[id].device_id)
    .map((id) => ents[id].device_id));
  return cand.filter((id) => !(id.startsWith("binary_sensor.") && ents[id] && withSensor.has(ents[id].device_id)));
}
/* Display name: config > device name > friendly_name without the "battery" word */
function biName(hass, id, cfgName) {
  if (cfgName) return String(cfgName);
  const e = (hass.entities || {})[id], dv = e && e.device_id && (hass.devices || {})[e.device_id];
  if (dv && (dv.name_by_user || dv.name)) return dv.name_by_user || dv.name;
  const st = hass.states[id], fn = String((st && st.attributes && st.attributes.friendly_name) || id);
  const s = fn.replace(/\b(battery|batterie|pile|niveau|level)\b/gi, " ")
    .replace(/\s{2,}/g, " ").replace(/^[\s\-–:·]+|[\s\-–:·]+$/g, "");
  return s || fn;
}

/* Colors: vivid on dark themes, darker text tints on light themes for contrast */
const BI_BAR = { dead: "#5b5b60", crit: "#ff4d3d", warn: "#ffc531", ok: "#3ecf5a" };
const BI_TXT_LIGHT = { dead: "#6b6b70", crit: "#d93025", warn: "#a86a00", ok: "#1e8e3e" };
const BI_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

class BatteryInventoryCard extends HTMLElement {
  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    const num = (v, d) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? d : Number(v));
    const crit = num(config.crit, 35), warn = num(config.warn, 60);
    this._config = {
      title: config.title ? String(config.title) : "",
      crit, warn,
      wm: biWordMap(config.word_map),
      show_summary: config.show_summary !== false,
      only_type: config.only_type ? String(config.only_type) : "",
      columns: Math.max(0, Math.min(4, parseInt(config.columns, 10) || 0)),
      sort: config.sort === "name" ? "name" : "level",
      // Default: only when no type is defined yet (so a configured fleet is not polluted by phones, tablets…)
      auto_unassigned: config.auto_unassigned === undefined ? !(Array.isArray(config.types) && config.types.length) : !!config.auto_unassigned,
      types: (Array.isArray(config.types) ? config.types : []).filter((t) => t && typeof t === "object").map((t) => ({
        name: t.name ? String(t.name) : "",
        cells: Math.max(1, parseInt(t.cells, 10) || 1),
        crit: num(t.crit, crit), warn: num(t.warn, warn),
        icon: t.icon ? String(t.icon) : "",
        entities: (Array.isArray(t.entities) ? t.entities : [])
          .map((e) => (typeof e === "string" ? { entity: e } : e)).filter((e) => e && e.entity),
      })),
    };
    this._det = null;
    this._last = null;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config) this._render();
  }

  _detected() {
    const h = this._hass, key = Object.keys(h.states).length;
    if (!this._det || this._det.ents !== h.entities || this._det.key !== key) {
      this._det = { ents: h.entities, key, ids: biDetect(h, this._config.wm) };
    }
    return this._det.ids;
  }

  _groups() {
    const h = this._hass, c = this._config, t = (k, ...a) => biT(h, k, ...a);
    const groups = c.types.map((ty, i) => Object.assign({}, ty, { name: ty.name || t("type_hash", i + 1), key: ty.name }));
    if (!c.types.length || c.auto_unassigned) {
      const assigned = new Set();
      c.types.forEach((ty) => ty.entities.forEach((e) => assigned.add(e.entity)));
      const rest = this._detected().filter((id) => !assigned.has(id)).map((id) => ({ entity: id }));
      if (!c.types.length || rest.length) {
        groups.push({ name: t(c.types.length ? "unassigned" : "def_group"), key: null, cells: 1,
          crit: c.crit, warn: c.warn, icon: "", entities: rest, auto: true });
      }
    }
    const loc = biLoc(h);
    return groups.map((g) => {
      const items = g.entities.map((e) => {
        const st = h.states[e.entity];
        const val = biValue(st, c.wm);
        const lvl = val.dead ? "dead" : val.v <= g.crit ? "crit" : val.v <= g.warn ? "warn" : "ok";
        return Object.assign({ id: e.entity, name: biName(h, e.entity, e.name), lvl }, val);
      });
      items.sort((a, b) => {
        if (c.sort === "level" && (a.dead !== b.dead || a.v !== b.v)) {
          return a.dead !== b.dead ? (a.dead ? 1 : -1) : a.v - b.v;
        }
        return a.name.localeCompare(b.name, loc, { numeric: true });
      });
      const low = items.filter((it) => it.lvl === "crit" || it.lvl === "warn").length;
      return Object.assign({}, g, { items, buy: low * g.cells, off: items.filter((it) => it.dead).length });
    });
  }

  _render() {
    const h = this._hass, c = this._config;
    if (!h || !h.states) return;
    const t = (k, ...a) => biT(h, k, ...a);
    const light = !!(h.themes && h.themes.darkMode === false);
    const txt = (lvl) => (light ? BI_TXT_LIGHT : BI_BAR)[lvl];
    const all = this._groups();
    const items = [].concat(...all.map((g) => g.items));

    let showSum = c.show_summary, groups = all, missing = false;
    if (c.only_type === "__summary__") { showSum = true; groups = []; }
    else if (c.only_type) {
      groups = all.filter((g) => g.key === c.only_type);
      showSum = false; missing = !groups.length;
    }

    let html = "";
    if (c.title) html += '<div class="title">' + biEsc(c.title) + "</div>";

    if (showSum) {
      if (!items.length) {
        html += '<ha-card class="sum"><div class="empty"><ha-icon icon="mdi:battery-unknown"></ha-icon><span>' +
          biEsc(t("e_none")) + "</span></div></ha-card>";
      } else {
        const nCrit = items.filter((it) => it.lvl === "crit").length;
        const nWarn = items.filter((it) => it.lvl === "warn").length;
        const nOk = items.filter((it) => it.lvl === "ok").length;
        const nOff = items.filter((it) => it.dead).length;
        const lvl = nCrit ? "crit" : nWarn ? "warn" : "ok";
        const w = biPct(h, c.warn);
        const head = nCrit ? t("t_crit", nCrit) : nWarn ? t("t_warn") : t("t_ok");
        const sub = nCrit ? (nWarn ? t("s_other", nWarn, w) : t("s_none_other", 0, w))
          : nWarn ? t("s_below", nWarn, w) : t("s_none", 0, w);
        const pills = all.filter((g) => g.buy > 0 && g.key !== null)
          .map((g) => '<span class="pill buy">' + biEsc(t("p_buy", g.buy, g.name)) + "</span>");
        if (!pills.length) pills.push('<span class="pill">' + biEsc(t("p_nothing")) + "</span>");
        pills.push('<span class="pill">' + biEsc(t("p_fleet", nOk, items.length)) + "</span>");
        if (nOff) pills.push('<span class="pill">' + biEsc(t("p_off", nOff)) + "</span>");
        html += '<ha-card class="sum">' +
          '<div class="big mono" style="color:' + txt(lvl) + '">' + (nCrit || nWarn) + "</div>" +
          '<div class="sumtxt"><div class="sh">' + biEsc(head) + '</div><div class="ss">' + biEsc(sub) + "</div></div>" +
          '<div class="pills">' + pills.join("") + "</div></ha-card>";
      }
    }

    if (missing) {
      html += '<ha-card class="grp"><div class="empty"><ha-icon icon="mdi:filter-off-outline"></ha-icon><span>' +
        biEsc(t("e_type", c.only_type)) + "</span></div></ha-card>";
    }

    groups.forEach((g) => {
      const subBits = [t("dev", g.items.length)];
      if (g.off) subBits.push(t("off_n", g.off));
      const badge = !g.items.length ? ""
        : g.buy ? '<span class="badge buy" style="color:' + txt("crit") + '">' + biEsc(t("rebuy", g.buy)) + "</span>"
        : '<span class="badge">' + biEsc(t("stock_ok")) + "</span>";
      const rows = g.items.map((it) => {
        const val = it.dead ? t("offline") : it.word ? t(it.word) : it.text !== undefined ? it.text : biPct(h, it.v);
        const w = it.dead ? 0 : Math.max(0, Math.min(100, it.v));
        return '<button type="button" class="row" data-eid="' + biEsc(it.id) + '" aria-label="' +
          biEsc(it.name + " : " + val) + '">' +
          '<span class="rn">' + biEsc(it.name) + "</span>" +
          '<span class="bar" aria-hidden="true"><span style="width:' + w.toFixed(1) + "%;background:" + BI_BAR[it.lvl] + '"></span></span>' +
          '<span class="rv mono" style="color:' + txt(it.lvl) + '">' + biEsc(val) + "</span></button>";
      }).join("");
      html += '<ha-card class="grp"><div class="gh">' +
        (g.icon ? '<ha-icon icon="' + biEsc(g.icon) + '"></ha-icon>' : "") +
        '<div class="gt"><div class="gn mono">' + biEsc(g.name) + '</div><div class="gs">' + biEsc(subBits.join(" · ")) + "</div></div>" +
        badge + "</div>" +
        (rows ? '<div class="rows">' + rows + "</div>"
          : '<div class="empty"><ha-icon icon="mdi:battery-outline"></ha-icon><span>' + biEsc(t("e_group")) + "</span></div>") +
        "</ha-card>";
    });

    const cols = c.columns ? "repeat(" + c.columns + ",minmax(0,1fr))" : "repeat(auto-fit,minmax(260px,1fr))";
    const sig = cols + "|" + html;
    if (sig === this._last) return;
    this._last = sig;
    this._nRows = items.length + groups.length * 2 + (showSum ? 3 : 0);

    if (!this.shadowRoot) this._build();
    const r = this.shadowRoot, wrap = r.querySelector(".wrap");
    const focused = r.activeElement && r.activeElement.dataset ? r.activeElement.dataset.eid : null;
    wrap.style.gridTemplateColumns = cols;
    wrap.innerHTML = html;
    if (focused) {
      const b = Array.from(wrap.querySelectorAll(".row")).find((x) => x.dataset.eid === focused);
      if (b) b.focus();
    }
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .wrap { display:grid; gap:12px; }
        .title { grid-column:1/-1; font-size:16px; font-weight:600; color:var(--primary-text-color); padding:0 4px; }
        ha-card { border-radius:16px; border:1px solid var(--divider-color, rgba(127,127,127,.25));
          background:var(--ha-card-background, var(--card-background-color)); padding:14px 16px; box-sizing:border-box; }
        .mono { font-family:${BI_MONO}; font-variant-numeric:tabular-nums; }
        .sum { grid-column:1/-1; display:grid; grid-template-columns:auto minmax(0,1fr); gap:4px 14px; align-items:center; }
        .big { font-size:40px; font-weight:700; line-height:1; }
        .sh { font-size:15px; font-weight:600; color:var(--primary-text-color); }
        .ss { font-size:12px; color:var(--secondary-text-color); margin-top:2px; }
        .pills { grid-column:1/-1; display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .pill { font-size:12px; padding:3px 10px; border-radius:999px; color:var(--primary-text-color);
          border:1px solid var(--divider-color, rgba(127,127,127,.25)); }
        .pill.buy { color:var(--primary-text-color); background:rgba(255,77,61,.12); border-color:rgba(255,77,61,.35); }
        .gh { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
        .gh ha-icon { --mdc-icon-size:20px; color:var(--secondary-text-color); flex-shrink:0; }
        .gt { flex:1; min-width:0; }
        .gn { font-size:14px; font-weight:700; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gs { font-size:11.5px; color:var(--secondary-text-color); margin-top:1px; }
        .badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:999px; white-space:nowrap; flex-shrink:0;
          color:var(--secondary-text-color); border:1px solid var(--divider-color, rgba(127,127,127,.25)); }
        .badge.buy { background:rgba(255,77,61,.12); border-color:rgba(255,77,61,.35); }
        .rows { display:flex; flex-direction:column; gap:1px; }
        .row { all:unset; box-sizing:border-box; display:grid; grid-template-columns:minmax(0,1fr) minmax(48px,34%) 5.5em;
          align-items:center; gap:10px; padding:6px 8px; margin:0 -8px; border-radius:8px; cursor:pointer; }
        .row:hover { background:var(--secondary-background-color, rgba(127,127,127,.08)); }
        .row:focus-visible { outline:2px solid var(--primary-color); outline-offset:-2px; }
        .rn { font-size:13px; color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bar { height:6px; border-radius:3px; background:var(--divider-color, rgba(127,127,127,.25)); overflow:hidden; }
        .bar > span { display:block; height:100%; border-radius:3px; }
        .rv { font-size:12px; font-weight:600; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .empty { grid-column:1/-1; display:flex; align-items:center; gap:8px; font-size:12.5px; line-height:1.4;
          color:var(--secondary-text-color); padding:4px 0; }
        .empty ha-icon { --mdc-icon-size:20px; flex-shrink:0; }
        @media (prefers-reduced-motion: no-preference) { .bar > span { transition:width .4s ease; } }
      </style>
      <div class="wrap"></div>`;
    this.shadowRoot.querySelector(".wrap").addEventListener("click", (e) => {
      const b = e.target.closest(".row");
      if (!b) return;
      const ev = new Event("hass-more-info", { bubbles: true, composed: true });
      ev.detail = { entityId: b.dataset.eid };
      this.dispatchEvent(ev);
    });
  }

  getCardSize() { return Math.max(2, Math.ceil((this._nRows || 4) / 2)); }
  static getStubConfig() { return { type: "custom:battery-inventory-card", types: [] }; }
  static getConfigElement() { return document.createElement("battery-inventory-card-editor"); }
}
customElements.define("battery-inventory-card", BatteryInventoryCard);

/* ================= EDITOR ================= */
const BI_ENT_SEL = { entity: { filter: [{ domain: ["sensor", "binary_sensor"] }] } };
const BI_S_GEN = (t, types) => [
  { name: "title", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "warn", selector: { number: { min: 0, max: 100, mode: "box" } } },
    { name: "crit", selector: { number: { min: 0, max: 100, mode: "box" } } },
  ]},
  { type: "grid", schema: [
    { name: "sort", selector: { select: { mode: "dropdown", options: [
      { value: "level", label: t("o_level") }, { value: "name", label: t("o_name") }] } } },
    { name: "columns", selector: { number: { min: 0, max: 4, mode: "box" } } },
  ]},
  { name: "show_summary", selector: { boolean: {} } },
  { name: "only_type", selector: { select: { mode: "dropdown", options: [
    { value: "__all__", label: t("o_all") }, { value: "__summary__", label: t("o_summary") }]
    .concat(types.filter((ty) => ty.name).map((ty) => ({ value: ty.name, label: ty.name }))) } } },
];
const BI_S_TYPE = [
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "cells", selector: { number: { min: 1, max: 12, mode: "box" } } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_t", selector: { number: { min: 0, max: 100, mode: "box" } } },
    { name: "crit_t", selector: { number: { min: 0, max: 100, mode: "box" } } },
  ]},
];
const BI_S_ENT = [{ type: "grid", schema: [
  { name: "entity", selector: BI_ENT_SEL },
  { name: "name", selector: { text: {} } },
]}];
const BI_S_ADV = [
  { name: "auto_unassigned", selector: { boolean: {} } },
  { name: "word_map", selector: { object: {} } },
];

/* ---------- Collapsible sections (open state survives editor re-creations) ---------- */
const BI_SEC_STATE = new Map();
const BI_SEC_CSS = `
  .sec-tools { display:flex; justify-content:flex-end; margin-bottom:4px; }
  .sec-all { background:none; border:none; padding:2px 4px; border-radius:4px; cursor:pointer;
    font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-all:hover { color:var(--primary-text-color); }
  button.sec-head { display:flex; align-items:center; gap:8px; width:100%; background:none; border:none;
    padding:0 0 6px 0; margin-bottom:10px; border-bottom:1px solid var(--divider-color);
    font:inherit; color:inherit; text-align:left; cursor:pointer; }
  .sec-head:focus-visible, .sec-all:focus-visible, .chip:focus-visible, .addbtn:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:2px; }
  .sec-title { font-size:15px; font-weight:600; color:var(--primary-text-color); flex:1; min-width:0;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sec-chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; flex-shrink:0; }
  .sec-head[aria-expanded="false"] .sec-chev { transform:rotate(-90deg); }
  .sec-body[hidden] { display:none !important; }`;
const biHead = (id, title) =>
  '<button type="button" class="sec-head" data-sec="' + id + '" aria-expanded="false" aria-controls="sec-' + id + '">' +
  '<ha-icon class="sec-chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + biEsc(title) + "</span></button>";
const biSec = (id, title, body) =>
  '<div class="sec">' + biHead(id, title) + '<div class="sec-body" id="sec-' + id + '" hidden>' + body + "</div></div>";
function biWire(head, body, key, defOpen, onToggle) {
  head._set = (open) => {
    head.setAttribute("aria-expanded", String(open));
    body.hidden = !open;
    BI_SEC_STATE.set(key, open);
  };
  head._set(BI_SEC_STATE.has(key) ? BI_SEC_STATE.get(key) : defOpen);
  head.addEventListener("click", () => { head._set(head.getAttribute("aria-expanded") !== "true"); onToggle(); });
}

class BatteryInventoryCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    if (!Array.isArray(this._config.types)) this._config.types = [];
    if (!this._hass) return;
    if (!this._built) this._build();
    this._update();
  }
  set hass(h) {
    this._hass = h;
    if (!this._config) return;
    /* Built once hass is known so the UI language is right from the start */
    if (!this._built) { this._build(); this._update(); }
    else {
      this.shadowRoot.querySelectorAll("ha-form").forEach((f) => { f.hass = h; });
      this._renderUnassigned();
    }
  }
  _t(k, ...a) { return biT(this._hass, k, ...a); }
  _key(id) { return this.tagName.toLowerCase() + ":" + id; }

  /* Emits a clean config: no empty keys, entity rows kept so the editor rows persist */
  _emit() {
    const c = this._config;
    ["title", "only_type"].forEach((k) => { if (!c[k]) delete c[k]; });
    if (c.word_map && typeof c.word_map === "object" && !Object.keys(c.word_map).length) delete c.word_map;
    c.types.forEach((ty) => {
      Object.keys(ty).forEach((k) => { if (ty[k] === "" || ty[k] === null || ty[k] === undefined) delete ty[k]; });
      (ty.entities || []).forEach((e) => { Object.keys(e).forEach((k) => { if (!e[k]) delete e[k]; }); });
    });
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: JSON.parse(JSON.stringify(c)) }, bubbles: true, composed: true }));
  }

  _syncAll() {
    const r = this.shadowRoot;
    const heads = Array.from(r.querySelectorAll(".sec-head"));
    r.querySelector(".sec-all").textContent =
      this._t(heads.some((h) => h.getAttribute("aria-expanded") !== "true") ? "expand_all" : "collapse_all");
  }

  _build() {
    this._built = true;
    const t = (k) => biEsc(this._t(k));
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom:18px; }
        .hint { font-size:12px; color:var(--secondary-text-color); margin:-4px 0 10px 0; line-height:1.4; }
        ha-form { display:block; }
        .tblock { border:1px solid var(--divider-color); border-radius:10px; padding:10px 12px 2px 12px;
          margin-bottom:10px; background:var(--secondary-background-color); }
        .thead { display:flex; align-items:flex-start; gap:2px; }
        .thead button.sec-head { flex:1; min-width:0; margin-bottom:8px; }
        .thead .sec-title { font-size:14px; }
        .iconbtn { --mdc-icon-button-size:32px; --mdc-icon-size:18px; color:var(--secondary-text-color); margin-top:-6px; }
        .iconbtn.del { color:var(--error-color,#e24b4a); }
        .chips { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:10px; }
        .chips-l { font-size:12px; color:var(--secondary-text-color); margin-right:2px; }
        .chip { font:inherit; font-size:12px; padding:3px 10px; border-radius:999px; cursor:pointer;
          background:var(--card-background-color); color:var(--primary-text-color); border:1px solid var(--divider-color); }
        .chip:hover { border-color:var(--primary-color); }
        .ents { margin:6px 0 4px 0; }
        .erow { display:flex; align-items:flex-start; gap:6px; padding:8px 0; border-top:1px solid var(--divider-color); }
        .erow ha-form { flex:1; min-width:0; }
        .erow .iconbtn { margin-top:12px; }
        select { font:inherit; font-size:13px; padding:6px 8px; border-radius:6px; max-width:100%;
          border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color); }
        .erow select { margin-top:14px; max-width:9.5em; }
        .urow { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--divider-color); }
        .urow:last-child { border-bottom:none; }
        .un { flex:1; min-width:0; }
        .un-n { font-size:13px; color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .un-id { font-size:11px; color:var(--secondary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .addbtn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; margin-bottom:8px;
          border-radius:8px; cursor:pointer; background:var(--secondary-background-color);
          border:1px dashed var(--divider-color); font:inherit; font-size:13px; color:var(--primary-text-color); }
        .addbtn:hover { background:var(--divider-color); }
        .addbtn.small { padding:5px 10px; font-size:12px; }
        .empty { font-size:12px; color:var(--secondary-text-color); font-style:italic; margin-bottom:10px; }
        ${BI_SEC_CSS}
      </style>
      <div class="sec-tools"><button type="button" class="sec-all"></button></div>
      ${biSec("general", this._t("s_general"), '<ha-form class="f-gen"></ha-form>')}
      ${biSec("types", this._t("s_types"), `<div class="hint">${t("hint_types")}</div><div class="types"></div>
        <button type="button" class="addbtn add-type"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_type")}</span></button>`)}
      ${biSec("unassigned", this._t("s_unassigned"), `<div class="hint">${t("hint_unassigned")}</div><div class="unas"></div>`)}
      ${biSec("advanced", this._t("s_advanced"), '<ha-form class="f-adv"></ha-form>')}
    `;
    const r = this.shadowRoot, sync = () => this._syncAll();
    r.querySelectorAll(".sec-head").forEach((h, i) =>
      biWire(h, r.getElementById(h.getAttribute("aria-controls")), this._key(h.dataset.sec), i === 0, sync));
    r.querySelector(".sec-all").addEventListener("click", () => {
      const heads = Array.from(r.querySelectorAll(".sec-head"));
      const open = heads.some((h) => h.getAttribute("aria-expanded") !== "true");
      heads.forEach((h) => h._set(open));
      sync();
    });

    const label = (s) => this._t(s.name);
    const fg = r.querySelector(".f-gen");
    fg.computeLabel = label;
    fg.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const v = Object.assign({}, e.detail.value);
      if (v.only_type === "__all__") v.only_type = "";
      Object.assign(this._config, v);
      this._emit();
    });
    const fa = r.querySelector(".f-adv");
    fa.computeLabel = label;
    fa.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const v = e.detail.value;
      this._config.auto_unassigned = v.auto_unassigned !== false;
      if (v.word_map && typeof v.word_map === "object") this._config.word_map = v.word_map;
      else delete this._config.word_map;
      this._emit(); this._renderUnassigned(true);
    });
    r.querySelector(".add-type").addEventListener("click", () => {
      const i = this._config.types.length;
      BI_SEC_STATE.set(this._key("type-" + i), true);
      this._config.types.push({ name: "", entities: [] });
      this._emit(); this._update(true);
    });
    sync();
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config, t = (k) => this._t(k);
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    const sch = BI_S_GEN(t, c.types), schSig = JSON.stringify(sch);
    if (schSig !== this._genSig) { this._genSig = schSig; fg.schema = sch; }
    fg.data = {
      title: c.title || "", warn: c.warn !== undefined ? c.warn : 60, crit: c.crit !== undefined ? c.crit : 35,
      sort: c.sort === "name" ? "name" : "level", columns: c.columns || 0,
      show_summary: c.show_summary !== false, only_type: c.only_type || "__all__",
    };
    const fa = r.querySelector(".f-adv");
    fa.hass = this._hass;
    if (!fa.schema) fa.schema = BI_S_ADV;
    fa.data = { auto_unassigned: c.auto_unassigned === undefined ? !(Array.isArray(c.types) && c.types.length) : !!c.auto_unassigned, word_map: c.word_map || Object.assign({}, BI_WORDS) };
    this._renderTypes(force);
    this._renderUnassigned(force);
  }

  /* Rebuilds the type blocks only on structural change, so fields never lose focus while typing */
  _renderTypes(force) {
    const box = this.shadowRoot.querySelector(".types"), types = this._config.types;
    const sig = types.map((ty) => (ty.entities || []).length).join(",") + "/" + types.length;
    if (!force && sig === this._typesSig) {
      box.querySelectorAll(".tblock").forEach((b, i) => {
        const ty = types[i];
        b._form.hass = this._hass; b._form.data = this._typeData(ty);
        b.querySelectorAll(".erow").forEach((row, j) => {
          row._form.hass = this._hass; row._form.data = Object.assign({}, (ty.entities || [])[j]);
        });
      });
      return;
    }
    this._typesSig = sig;
    box.innerHTML = "";
    if (!types.length) {
      const e = document.createElement("div");
      e.className = "empty"; e.textContent = this._t("e_group");
      box.appendChild(e);
    }
    types.forEach((ty, i) => box.appendChild(this._typeBlock(ty, i)));
    this._syncAll();
  }

  _typeData(ty) {
    return { name: ty.name || "", cells: ty.cells || 1, icon: ty.icon || "", warn_t: ty.warn, crit_t: ty.crit };
  }

  _btn(icon, cls, labelKey, fn, dis) {
    const b = document.createElement("ha-icon-button");
    b.className = "iconbtn " + cls; b.disabled = !!dis;
    b.label = this._t(labelKey); b.setAttribute("title", this._t(labelKey));
    const ic = document.createElement("ha-icon"); ic.setAttribute("icon", icon);
    b.appendChild(ic); b.addEventListener("click", fn);
    return b;
  }

  _typeBlock(ty, i) {
    const types = this._config.types, label = (s) => this._t(s.name);
    const block = document.createElement("div");
    block.className = "tblock";
    block.innerHTML = '<div class="thead">' + biHead("type-" + i, ty.name || this._t("type_hash", i + 1)) + "</div>" +
      '<div class="sec-body" id="sec-type-' + i + '" hidden></div>';
    const thead = block.querySelector(".thead"), head = thead.querySelector(".sec-head");
    const body = block.querySelector(".sec-body"), title = head.querySelector(".sec-title");
    thead.appendChild(this._btn("mdi:arrow-up", "up", "up", () => this._move(i, -1), i === 0));
    thead.appendChild(this._btn("mdi:arrow-down", "down", "down", () => this._move(i, 1), i === types.length - 1));
    thead.appendChild(this._btn("mdi:delete-outline", "del", "del", () => {
      this._shiftState(i, null);
      this._config.types.splice(i, 1);
      this._emit(); this._update(true);
    }));
    biWire(head, body, this._key("type-" + i), false, () => this._syncAll());

    /* Quick picks, shown while the type has no name */
    const chips = document.createElement("div");
    chips.className = "chips"; chips.hidden = !!ty.name;
    chips.innerHTML = '<span class="chips-l">' + biEsc(this._t("suggest")) + "</span>";
    BI_SUGGEST.forEach((s) => {
      const c = document.createElement("button");
      c.type = "button"; c.className = "chip"; c.textContent = s;
      c.addEventListener("click", () => {
        const m = /^(\d+)\s*x/i.exec(s);
        this._patchType(i, Object.assign({ name: s }, m ? { cells: Number(m[1]) } : {}));
        form.data = this._typeData(this._config.types[i]);
      });
      chips.appendChild(c);
    });
    body.appendChild(chips);

    const form = document.createElement("ha-form");
    form.schema = BI_S_TYPE; form.computeLabel = label; form.hass = this._hass;
    form.data = this._typeData(ty);
    form.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const v = e.detail.value;
      this._patchType(i, { name: v.name || "", cells: v.cells && Number(v.cells) !== 1 ? Number(v.cells) : undefined,
        icon: v.icon || undefined, warn: v.warn_t, crit: v.crit_t });
    });
    block._form = form;
    block._title = title; block._chips = chips;
    body.appendChild(form);

    const ents = document.createElement("div");
    ents.className = "ents";
    const list = ty.entities || [];
    if (!list.length) {
      const e = document.createElement("div");
      e.className = "empty"; e.textContent = this._t("no_ents");
      ents.appendChild(e);
    }
    list.forEach((it, j) => ents.appendChild(this._entRow(it, i, j)));
    body.appendChild(ents);

    const add = document.createElement("button");
    add.type = "button"; add.className = "addbtn small";
    add.innerHTML = '<ha-icon icon="mdi:plus"></ha-icon><span>' + biEsc(this._t("add_entity")) + "</span>";
    add.addEventListener("click", () => {
      this._config.types[i].entities = (this._config.types[i].entities || []).concat([{ entity: "" }]);
      this._emit(); this._update(true);
    });
    body.appendChild(add);
    return block;
  }

  /* Merges fields into type i and refreshes what depends on its name, without rebuilding */
  _patchType(i, patch) {
    const ty = Object.assign({}, this._config.types[i], patch);
    Object.keys(ty).forEach((k) => { if (ty[k] === undefined || ty[k] === "") delete ty[k]; });
    const renamed = (this._config.types[i].name || "") !== (ty.name || "");
    if (renamed && this._config.only_type && this._config.only_type === this._config.types[i].name) {
      this._config.only_type = ty.name || "";
    }
    this._config.types[i] = ty;
    this._emit();
    if (!renamed) return;
    const b = this.shadowRoot.querySelectorAll(".tblock")[i];
    if (b) { b._title.textContent = ty.name || this._t("type_hash", i + 1); b._chips.hidden = !!ty.name; }
    this.shadowRoot.querySelectorAll("option[data-ti='" + i + "']").forEach((o) => {
      o.textContent = ty.name || this._t("type_hash", i + 1);
    });
    this._update();
  }

  _typeSelect(placeholderKey, exclude, onPick) {
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", this._t(placeholderKey));
    const p = document.createElement("option");
    p.value = ""; p.textContent = this._t(placeholderKey);
    sel.appendChild(p);
    this._config.types.forEach((ty, k) => {
      if (k === exclude) return;
      const o = document.createElement("option");
      o.value = String(k); o.dataset.ti = String(k);
      o.textContent = ty.name || this._t("type_hash", k + 1);
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => { if (sel.value !== "") onPick(Number(sel.value)); });
    return sel;
  }

  _entRow(item, i, j) {
    const row = document.createElement("div");
    row.className = "erow";
    const f = document.createElement("ha-form");
    f.schema = BI_S_ENT; f.computeLabel = (s) => this._t(s.name); f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.types[i].entities || []).slice();
      const m = Object.assign({}, l[j], e.detail.value);
      Object.keys(m).forEach((k) => { if (!m[k]) delete m[k]; });
      l[j] = m; this._config.types[i].entities = l;
      this._emit(); this._renderUnassigned();
    });
    row._form = f;
    row.appendChild(f);
    if (this._config.types.length > 1) {
      row.appendChild(this._typeSelect("move_to", i, (k) => {
        const it = this._config.types[i].entities.splice(j, 1)[0];
        this._config.types[k].entities = (this._config.types[k].entities || []).concat([it]);
        this._emit(); this._update(true);
      }));
    }
    row.appendChild(this._btn("mdi:delete-outline", "del", "del", () => {
      this._config.types[i].entities.splice(j, 1);
      this._emit(); this._update(true);
    }));
    return row;
  }

  _renderUnassigned(force) {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const box = this.shadowRoot.querySelector(".unas"), c = this._config;
    const assigned = new Set();
    c.types.forEach((ty) => (ty.entities || []).forEach((e) => e.entity && assigned.add(e.entity)));
    const rest = biDetect(this._hass, biWordMap(c.word_map)).filter((id) => !assigned.has(id));
    const named = rest.map((id) => ({ id, name: biName(this._hass, id) }))
      .sort((a, b) => a.name.localeCompare(b.name, biLoc(this._hass), { numeric: true }));
    const sig = named.map((x) => x.id + "=" + x.name).join("|") + "/" + c.types.map((ty) => ty.name || "").join("|");
    if (!force && sig === this._unasSig) return;
    this._unasSig = sig;
    box.innerHTML = "";
    const msg = (k) => {
      const e = document.createElement("div");
      e.className = "empty"; e.textContent = this._t(k);
      box.appendChild(e);
    };
    if (!named.length) { msg("all_sorted"); return; }
    if (!c.types.length) msg("no_types");
    named.forEach((x) => {
      const row = document.createElement("div");
      row.className = "urow";
      row.innerHTML = '<div class="un"><div class="un-n">' + biEsc(x.name) + '</div><div class="un-id">' +
        biEsc(x.id) + "</div></div>";
      if (c.types.length) {
        row.appendChild(this._typeSelect("put_in", -1, (k) => {
          c.types[k].entities = (c.types[k].entities || []).concat([{ entity: x.id }]);
          this._emit(); this._update(true);
        }));
      }
      box.appendChild(row);
    });
  }

  /* Keeps each type block's open state attached to its type when blocks move or disappear */
  _shiftState(i, j) {
    const n = this._config.types.length, k = (x) => this._key("type-" + x);
    const st = Array.from({ length: n }, (_, x) => BI_SEC_STATE.get(k(x)));
    if (j === null) st.splice(i, 1);
    else { const tmp = st[i]; st[i] = st[j]; st[j] = tmp; }
    for (let x = 0; x < n; x++) {
      if (st[x] === undefined) BI_SEC_STATE.delete(k(x)); else BI_SEC_STATE.set(k(x), st[x]);
    }
  }

  _move(i, d) {
    const l = this._config.types, j = i + d;
    if (j < 0 || j >= l.length) return;
    this._shiftState(i, j);
    const tmp = l[i]; l[i] = l[j]; l[j] = tmp;
    this._emit(); this._update(true);
  }
}
customElements.define("battery-inventory-card-editor", BatteryInventoryCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "battery-inventory-card",
  name: "Battery Inventory Card",
  description: biDict(document.documentElement.lang || navigator.language || "en").desc,
});
console.info("%c BATTERY-INVENTORY-CARD %c v" + BI_VERSION + " ",
  "color:#fff;background:#3ecf5a;font-weight:700", "color:#3ecf5a;background:#222");

/* ============================================================
CONFIG EXAMPLES

Minimal (every detected battery entity in one group):

type: custom:battery-inventory-card

Grouped by battery type (entity IDs are placeholders, use your own):

type: custom:battery-inventory-card
title: Batteries
warn: 60
crit: 35
sort: level
types:
  - name: CR2032
    entities:
      - entity: sensor.example_sensor_battery
        name: Example sensor
  - name: 2xAA
    cells: 2
    warn: 50
    entities:
      - sensor.example_remote_battery
      - binary_sensor.example_lock_battery

One group per card:  only_type: CR2032      Summary only:  only_type: __summary__
============================================================ */
