/**
 * Synology Volumes Card — DSM volumes
 * Version 1.1.0
 *
 * Works with the native "synology_dsm" integration. Without a `volumes`
 * list, every Synology volume is detected automatically (platform +
 * translation_key, never display names), optionally limited to one NAS
 * with `device_id`.
 */

const SYVOL_VERSION = "1.1.0";

/* ---------- i18n ---------- */
const SV_I18N = {
  fr: {
    title: "Volumes", volume: "Volume",
    normal: (n) => n + " normal" + (n > 1 ? "s" : ""),
    count: (n) => n + " volume" + (n > 1 ? "s" : ""),
    none: "Aucun volume Synology détecté.",
    used: "{v} utilisés", of: "sur {v}", avg: "{v} moy.", critical: "espace critique",
    sort_config: "Ordre de la configuration", sort_usage: "Les plus remplis d'abord", sort_name: "Nom",
    sec_gen: "Général", sec_color: "Couleur", sec_vols: "Volumes",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    accent: "Accent", color: "Couleur", empty: "Aucun volume : détection automatique.", add: "Ajouter un volume",
    hint_vols: "Liste vide = tous les volumes Synology détectés automatiquement. Un état inconnu est affiché en ambre plutôt qu'en vert : mieux vaut douter que rassurer à tort.",
    l_device_id: "NAS Synology (filtre de détection)",
    l_title: "Titre", l_icon: "Icône", l_warn_at: "Seuil d'alerte (%)",
    l_critical_at: "Seuil critique (%)", l_temp_warn: "Température d'alerte (°C)",
    l_temp_critical: "Température critique (°C)", l_show_detail: "Afficher le détail",
    l_sort: "Tri", l_name: "Nom du volume", l_status: "État", l_percentage: "Pourcentage utilisé",
    l_used_space: "Espace utilisé", l_total_space: "Espace total",
    l_temperature: "Température moyenne des disques",
  },
  en: {
    title: "Volumes", volume: "Volume",
    normal: (n) => n + " normal",
    count: (n) => n + " volume" + (n > 1 ? "s" : ""),
    none: "No Synology volume detected.",
    used: "{v} used", of: "of {v}", avg: "{v} avg.", critical: "space critical",
    sort_config: "Configuration order", sort_usage: "Fullest first", sort_name: "Name",
    sec_gen: "General", sec_color: "Color", sec_vols: "Volumes",
    expand_all: "Expand all", collapse_all: "Collapse all",
    accent: "Accent", color: "Color", empty: "No volume: automatic detection.", add: "Add a volume",
    hint_vols: "Empty list = every Synology volume is detected automatically. An unknown status shows amber rather than green: better doubt than falsely reassure.",
    l_device_id: "Synology NAS (detection filter)",
    l_title: "Title", l_icon: "Icon", l_warn_at: "Warning threshold (%)",
    l_critical_at: "Critical threshold (%)", l_temp_warn: "Warning temperature (°C)",
    l_temp_critical: "Critical temperature (°C)", l_show_detail: "Show details",
    l_sort: "Sort", l_name: "Volume name", l_status: "Status", l_percentage: "Used percentage",
    l_used_space: "Used space", l_total_space: "Total space",
    l_temperature: "Average drive temperature",
  },
};
const vLocale = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const vLang = (h) => (String(vLocale(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
function svT(lang, k, vars) {
  let s = SV_I18N[lang][k];
  if (s === undefined) s = SV_I18N.en[k] !== undefined ? SV_I18N.en[k] : k;
  return vars ? s.replace(/\{(\w+)\}/g, (_, x) => vars[x]) : s;
}
/* Shared by all instances: every card on a page receives the same hass locale. */
let V_LOC = "en";

const vRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const vNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const vFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString(V_LOC, { maximumFractionDigits: d === undefined ? 1 : d });
};
const vUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const vEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function vScale(st) {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  const unit = vUnit(st);
  const dec = ["B", "kB", "KB", "MB", "GB", "TB", "PB"];
  const bin = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let seq = dec, base = 1000, i = dec.indexOf(unit);
  if (i === -1) { i = bin.indexOf(unit); seq = bin; base = 1024; }
  if (i === -1) return n.toLocaleString(V_LOC, { maximumFractionDigits: 1 }) + (unit ? " " + unit : "");
  let v = n;
  while (Math.abs(v) >= base && i < seq.length - 1) { v /= base; i++; }
  const d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return v.toLocaleString(V_LOC, { maximumFractionDigits: d }) + " " + seq[i];
}

/* Classifies a raw Synology status (API values, not translated): ok / warn / bad */
function vStatusKind(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "") return null;
  if (["normal", "ok", "healthy", "good", "normale"].indexOf(s) !== -1) return "ok";
  if (["background", "attention", "warning", "degraded", "degrade", "dégradé",
       "verifying", "migrating", "expanding", "deleting", "cleaning",
       "raid_syncing", "syncing"].indexOf(s) !== -1) return "warn";
  if (["crashed", "critical", "failed", "failing", "danger", "bad"].indexOf(s) !== -1) return "bad";
  return "warn"; /* unknown status: never pretend everything is fine */
}

/* ---------- synology_dsm auto-detection ---------- */
const V_AUTO = {
  volume_status: "status", volume_percentage_used: "percentage",
  volume_size_used: "used_space", volume_size_total: "total_space",
  volume_disk_temp_avg: "temperature",
};
/* One volume per Synology child device carrying volume_* entities.
   nasId (optional) keeps only the volumes of that NAS. */
function vDetect(hass, nasId) {
  const devs = hass.devices || {};
  const by = {};
  Object.values(hass.entities || {}).forEach((e) => {
    const f = V_AUTO[e.translation_key];
    if (!f || e.platform !== "synology_dsm" || !e.device_id) return;
    if (nasId && !(devs[e.device_id] && devs[e.device_id].via_device_id === nasId)) return;
    (by[e.device_id] = by[e.device_id] || {})[f] = e.entity_id;
  });
  return Object.keys(by).map((id) => {
    const it = by[id], d = devs[id] || {}, p = devs[d.via_device_id];
    /* Integration names child devices "<nas> (<volume>)": keep the volume part. */
    let n = d.name_by_user || d.name || "";
    if (!d.name_by_user && p && p.name && n.indexOf(p.name + " (") === 0 && n.slice(-1) === ")") {
      n = n.slice(p.name.length + 2, -1);
    }
    if (n) it.name = n;
    return it;
  }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true }));
}

class SynologyVolumesCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#1D9E75",
      warn_at: config.warn_at || 80,
      critical_at: config.critical_at || 90,
      temp_warn: config.temp_warn || 45,
      temp_critical: config.temp_critical || 55,
      show_detail: config.show_detail !== false,
      sort: config.sort || "config",
      device_id: config.device_id || null,
      /* Explicit list wins; without it, volumes are auto-detected. */
      volumes: config.volumes && config.volumes.length ? config.volumes : null,
    };
    this._auto = [];
    this._entRef = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    V_LOC = vLocale(hass);
    this._lang = vLang(hass);
    if (!this._config.volumes && hass.entities !== this._entRef) {
      this._entRef = hass.entities; this._auto = vDetect(hass, this._config.device_id); this._last = null;
    }
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }
  _t(k, vars) { return svT(this._lang || "en", k, vars); }
  _vols() { return this._config.volumes || this._auto; }

  _ids() {
    const ids = [];
    this._vols().forEach((v) => {
      ["status", "percentage", "used_space", "total_space", "temperature"]
        .forEach((k) => v[k] && ids.push(v[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._vols().length + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _barColor(pct, base) {
    const c = this._config;
    if (isNaN(pct)) return "#4a4a48";
    if (pct >= c.critical_at) return "#E24B4A";
    if (pct >= c.warn_at) return "#BA7517";
    return base;
  }
  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "var(--disabled-text-color)";
  }

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { border-radius:14px; padding:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);
          background:var(--card-background-color,#181a1b); }
        .header { padding:15px 15px 12px 15px; display:flex; align-items:center; gap:12px; }
        .disc { width:42px; height:42px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; }
        .disc ha-icon { --mdc-icon-size:22px; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color); }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .hsub b { font-weight:600; }
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:8px; }
        .vo { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; overflow:hidden; }
        .vo:hover { background:rgba(255,255,255,0.07); }
        .vo-top { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .vo-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .vo-state { font-size:10px; flex-shrink:0; }
        .vo-pct { font-size:11px; font-weight:700; flex-shrink:0; }
        .vo-t { height:5px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .vo-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .vo-foot { display:flex; gap:12px; flex-wrap:wrap; align-items:center;
          margin-top:6px; font-size:10px; color:var(--disabled-text-color); }
        .vo-foot span { white-space:nowrap; }
        .vo-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .spacer { flex:1; }
        .alert { display:inline-flex; align-items:center; gap:3px; }
        .alert ha-icon { --mdc-icon-size:11px; }
        .none { font-size:11px; color:var(--secondary-text-color); font-style:italic; }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div><div class="htitle"></div><div class="hsub"></div></div>
        </div>
        <div class="list"></div>
      </ha-card>`;
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const vols = this._vols();

    r.querySelector("ha-card").style.borderColor = vRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = vRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || this._t("title");

    let items = vols.map((v) => {
      const stSt = v.status ? hass.states[v.status] : null;
      const kind = stSt ? vStatusKind(stSt.state) : null;
      const pctSt = v.percentage ? hass.states[v.percentage] : null;
      let pct = vNum(pctSt);
      const usedSt = v.used_space ? hass.states[v.used_space] : null;
      const totSt = v.total_space ? hass.states[v.total_space] : null;
      if (isNaN(pct)) {
        const u = vNum(usedSt), t = vNum(totSt);
        if (!isNaN(u) && t) pct = (u / t) * 100;
      }
      return { v: v, kind: kind, stSt: stSt, pct: pct,
               usedSt: usedSt, totSt: totSt,
               tempSt: v.temperature ? hass.states[v.temperature] : null };
    });

    const okCount = items.filter((i) => i.kind === "ok").length;
    const known = items.filter((i) => i.kind !== null).length;
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (okCount === known ? "#1D9E75" : "#BA7517") + '">' +
        vEsc(this._t("normal")(okCount)) + "</b> / " + known
      : vEsc(this._t("count")(vols.length));

    if (c.sort === "usage") items.sort((a, b) => (b.pct || 0) - (a.pct || 0));
    else if (c.sort === "name") {
      items.sort((a, b) => String(a.v.name || "").localeCompare(String(b.v.name || ""), V_LOC, { numeric: true }));
    }

    const list = r.querySelector(".list");
    list.innerHTML = "";
    if (!items.length) {
      const e = document.createElement("div");
      e.className = "none"; e.textContent = this._t("none");
      list.appendChild(e);
    }

    items.forEach((it) => {
      const col = this._barColor(it.pct, it.v.color || c.accent);
      const dotCol = it.kind === "bad" ? "#E24B4A"
        : it.kind === "warn" ? "#BA7517"
        : it.kind === "ok" ? "#1D9E75" : "#4a4a48";
      const el = document.createElement("div");
      el.className = "vo";

      const foot = [];
      if (it.usedSt) foot.push("<span>" + vEsc(this._t("used", { v: vScale(it.usedSt) })) + "</span>");
      if (it.totSt) foot.push("<span>" + vEsc(this._t("of", { v: vScale(it.totSt) })) + "</span>");
      foot.push('<span class="spacer"></span>');
      if (it.tempSt) {
        const t = vNum(it.tempSt);
        foot.push('<span style="color:' + this._tempColor(t) +
          '"><ha-icon icon="mdi:thermometer"></ha-icon> ' +
          vEsc(this._t("avg", { v: vFmt(it.tempSt, 0) + " " + (vUnit(it.tempSt) || "°C") })) + "</span>");
      }
      if (!isNaN(it.pct) && it.pct >= c.critical_at) {
        foot.push('<span class="alert" style="color:#E24B4A">' +
          '<ha-icon icon="mdi:alert"></ha-icon>' + vEsc(this._t("critical")) + "</span>");
      }

      el.innerHTML =
        '<div class="vo-top">' +
          '<span class="dot" style="background:' + dotCol + '"></span>' +
          '<span class="vo-name">' + vEsc(it.v.name || this._t("volume")) + "</span>" +
          (it.stSt ? '<span class="vo-state" style="color:' + dotCol + '">' +
            vEsc(it.stSt.state) + "</span>" : "") +
          '<span class="vo-pct" style="color:' + col + '">' +
            (isNaN(it.pct) ? "—" : it.pct.toFixed(0) + " %") + "</span>" +
        "</div>" +
        '<div class="vo-t"><div class="vo-f" style="width:' +
          (isNaN(it.pct) ? 0 : Math.min(Math.max(it.pct, 0), 100)).toFixed(1) +
          "%;background:" + col + '"></div></div>' +
        (c.show_detail ? '<div class="vo-foot">' + foot.join("") + "</div>" : "");

      el.addEventListener("click", () =>
        this._more(it.v.percentage || it.v.status || it.v.used_space));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + Math.max(this._vols().length, 1); }
  /* No list in the stub: volumes are auto-detected. */
  static getStubConfig() { return { type: "custom:synology-volumes-card" }; }
  static getConfigElement() { return document.createElement("synology-volumes-card-editor"); }
}
customElements.define("synology-volumes-card", SynologyVolumesCard);

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const SV_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const SV_SEC_CSS = `
  .sec-tools { display:flex; justify-content:flex-end; gap:4px; margin-bottom:6px; }
  .sec-tools button { background:none; border:none; cursor:pointer; padding:2px 6px;
    border-radius:4px; font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-tools button:hover { color:var(--primary-text-color); }
  .sec-head { width:100%; display:flex; align-items:center; gap:8px; margin:0 0 10px 0;
    padding:0 0 6px 0; background:none; border:none; border-bottom:1px solid var(--divider-color);
    cursor:pointer; font:inherit; text-align:left; color:var(--primary-text-color); }
  .sec-head[aria-expanded="false"] { margin-bottom:0; }
  .sec-head:focus-visible, .sec-tools button:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:2px; border-radius:4px; }
  .sec-head .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; }
  .sec-head[aria-expanded="false"] .chev { transform:rotate(-90deg); }
  .sec-body[hidden] { display:none; }
`;
const svSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + vEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const svSecTools = (L) =>
  '<div class="sec-tools"><button type="button" class="sec-all" data-open="1">' + vEsc(svT(L, "expand_all")) +
  '</button><button type="button" class="sec-all" data-open="0">' + vEsc(svT(L, "collapse_all")) + "</button></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function svSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    SV_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, SV_SEC_STATE.has(k) ? SV_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const SV_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const svSGen = (L) => [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "device_id", selector: { device: { filter: { integration: "synology_dsm" } } } },
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { type: "grid", schema: [
    { name: "temp_warn", selector: { number: { min: 20, max: 100, mode: "box" } } },
    { name: "temp_critical", selector: { number: { min: 20, max: 100, mode: "box" } } },
  ]},
  { name: "sort", selector: { select: { mode: "dropdown", options: [
    { value: "config", label: svT(L, "sort_config") },
    { value: "usage", label: svT(L, "sort_usage") },
    { value: "name", label: svT(L, "sort_name") },
  ]}}},
  { name: "show_detail", selector: { boolean: {} } },
];
const SV_S_VOL = [
  { name: "name", selector: { text: {} } },
  { name: "status", selector: SV_SENSOR },
  { name: "percentage", selector: SV_SENSOR },
  { name: "used_space", selector: SV_SENSOR },
  { name: "total_space", selector: SV_SENSOR },
  { name: "temperature", selector: SV_SENSOR },
];

class SynologyVolumesCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    this._update();
  }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (first || !this._built) this._update(); else this._refreshHass();
  }
  _refreshHass() { this.shadowRoot.querySelectorAll("ha-form").forEach((f) => { f.hass = this._hass; }); }
  _setColor(sel, v) {
    const el = this.shadowRoot.querySelector(sel);
    if (!el || this.shadowRoot.activeElement === el) return;
    if (el.value !== v) el.value = v;
  }
  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _t(k) { return svT(this._lang, k); }
  _label(s) { return svT(this._lang, "l_" + s.name); }

  /* Built once hass is known, so the UI language is available. */
  _build() {
    this._lang = vLang(this._hass);
    const t = (k) => vEsc(this._t(k));
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom:18px; }
        .sec-title { font-size:15px; font-weight:600; color:var(--primary-text-color); flex:1; }
        .sec-hint { font-size:12px; color:var(--secondary-text-color); margin:-4px 0 10px 0; line-height:1.4; }
        .colors { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:6px; }
        .color-field { display:flex; align-items:center; gap:8px; }
        .color-field label { font-size:13px; color:var(--primary-text-color); }
        .color-field input[type=color] { width:42px; height:30px; padding:0; border:none;
          border-radius:6px; cursor:pointer; background:none; }
        .row { border:1px solid var(--divider-color); border-radius:10px; padding:10px 12px;
          margin-bottom:10px; background:var(--secondary-background-color); }
        .row-head { display:flex; align-items:center; gap:6px; margin-bottom:6px; }
        .row-num { font-size:12px; font-weight:600; flex:1; color:var(--secondary-text-color); }
        ha-form { display:block; }
        ha-form > * { align-items:flex-start !important; }
        .iconbtn { --mdc-icon-button-size:32px; --mdc-icon-size:18px; color:var(--secondary-text-color); }
        .iconbtn.del { color:var(--error-color,#e24b4a); }
        .addbtn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px;
          border-radius:8px; cursor:pointer; background:var(--secondary-background-color);
          border:1px dashed var(--divider-color); font-size:13px;
          color:var(--primary-text-color); user-select:none; }
        .addbtn:hover { background:var(--divider-color); }
        .empty { font-size:12px; color:var(--secondary-text-color); font-style:italic; margin-bottom:10px; }
        ${SV_SEC_CSS}
      </style>
      ${svSecTools(this._lang)}
      ${svSec("gen", this._t("sec_gen"), `<ha-form class="f-gen"></ha-form>`)}
      ${svSec("color", this._t("sec_color"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("accent")}</label></div>
        </div>`)}
      ${svSec("vols", this._t("sec_vols"), `
        <div class="sec-hint">${t("hint_vols")}</div>
        <div class="rows-vol"></div>
        <div class="addbtn add-vol"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    svSecWire(r, this.tagName.toLowerCase());
    const f = r.querySelector(".f-gen");
    f.schema = svSGen(this._lang); f.computeLabel = (s) => this._label(s);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      ["title", "device_id"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t2 = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t2); t2 = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t2); apply(e.target.value); });
    r.querySelector(".add-vol").addEventListener("click", () => {
      this._config.volumes = (this._config.volumes || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    if (!this._built) { this._build(); this._built = true; }
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:harddisk", device_id: c.device_id || "",
      warn_at: c.warn_at || 80, critical_at: c.critical_at || 90,
      temp_warn: c.temp_warn || 45, temp_critical: c.temp_critical || 55,
      sort: c.sort || "config", show_detail: c.show_detail !== false,
    };
    this._setColor(".c-accent", c.accent || "#1D9E75");

    const box = r.querySelector(".rows-vol");
    const list = c.volumes || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = this._t("empty");
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        const ff = row.querySelector("ha-form");
        ff.hass = this._hass; ff.data = Object.assign({}, list[i]);
      });
    }
  }

  _row(item, index, total) {
    const row = document.createElement("div");
    row.className = "row";
    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = item.name || this._t("volume") + " #" + (index + 1);
    head.appendChild(num);
    const mk = (icon, cls, fn, dis) => {
      const b = document.createElement("ha-icon-button");
      b.className = "iconbtn " + cls; b.disabled = !!dis;
      const i = document.createElement("ha-icon"); i.setAttribute("icon", icon);
      b.appendChild(i); b.addEventListener("click", fn); return b;
    };
    head.appendChild(mk("mdi:arrow-up", "up", () => this._move(index, -1), index === 0));
    head.appendChild(mk("mdi:arrow-down", "down", () => this._move(index, 1), index === total - 1));
    head.appendChild(mk("mdi:delete-outline", "del", () => {
      this._config.volumes = this._config.volumes.filter((_, i) => i !== index);
      if (!this._config.volumes.length) delete this._config.volumes; /* back to auto-detection */
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = SV_S_VOL; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.volumes || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config.volumes = l; this._emit();
    });
    row.appendChild(f);

    const cf = document.createElement("div");
    cf.className = "color-field"; cf.style.marginTop = "8px";
    const ci = document.createElement("input");
    ci.type = "color"; ci.value = item.color || "#1D9E75";
    const apply = (v) => {
      const l = (this._config.volumes || []).slice();
      l[index] = Object.assign({}, l[index], { color: v });
      this._config.volumes = l; this._emit();
    };
    let t = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = this._t("color");
    cf.appendChild(ci); cf.appendChild(cl); row.appendChild(cf);
    return row;
  }

  _move(i, d) {
    const l = (this._config.volumes || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.volumes = l; this._emit(); this._update(true);
  }
}
customElements.define("synology-volumes-card-editor", SynologyVolumesCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-volumes-card",
  name: "Synology Volumes Card",
  description: "Synology volumes: status, usage and average temperature.",
});
console.info("%c SYNOLOGY-VOLUMES-CARD %c v" + SYVOL_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
CONFIG EXAMPLES

# Minimal: every Synology volume auto-detected
type: custom:synology-volumes-card
sort: usage

# Explicit list (wins over detection)
type: custom:synology-volumes-card
title: Volumes
icon: mdi:harddisk
accent: "#1D9E75"
warn_at: 80
critical_at: 90
show_detail: true
volumes:
  - name: Volume 1
    status: sensor.example_nas_volume_1_status
    percentage: sensor.example_nas_volume_1_volume_used
    used_space: sensor.example_nas_volume_1_used_space
    temperature: sensor.example_nas_volume_1_average_disk_temperature
============================================================ */
