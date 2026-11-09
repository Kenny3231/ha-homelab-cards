/**
 * UniFi AP Card — WiFi access points (several APs in one card)
 * Version 1.2.0
 *
 * Loaded by the Homelab Cards integration. Works with the native UniFi Network
 * integration: pick a device per AP and its sensors are detected automatically
 * (explicit entity keys always win over detection).
 */

const UAP_VERSION = "1.2.0";

/* ---------- i18n ---------- */
const UAP_I18N = {
  fr: {
    title: "Bornes WiFi", ap: "Borne", aps_one: "{n} borne", aps_other: "{n} bornes",
    clients: "clients", up_since: "Actif depuis {n}",
    err_aps: "La clé 'aps' est requise (au moins une borne).",
    general: "Général", colors: "Couleurs", aps_sec: "Bornes",
    hint: "Une ligne par borne. Choisis l'appareil UniFi pour détecter ses capteurs automatiquement ; un champ rempli reste prioritaire. Laisse vide ce qui n'existe pas chez toi.",
    add: "Ajouter une borne", empty: "Aucune borne.", row: "Borne #{n}",
    accent: "Accent", ok: "En ligne", ko: "Hors ligne",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    desc: "Bornes WiFi UniFi : clients, trafic, CPU/RAM par borne.",
  },
  en: {
    title: "WiFi access points", ap: "Access point", aps_one: "{n} access point", aps_other: "{n} access points",
    clients: "clients", up_since: "Up since {n}",
    err_aps: "The 'aps' key is required (at least one access point).",
    general: "General", colors: "Colors", aps_sec: "Access points",
    hint: "One row per access point. Pick the UniFi device to detect its sensors automatically; a filled field always wins. Leave empty what you don't have.",
    add: "Add an access point", empty: "No access point.", row: "Access point #{n}",
    accent: "Accent", ok: "Online", ko: "Offline",
    expand_all: "Expand all", collapse_all: "Collapse all",
    desc: "UniFi WiFi access points: clients, traffic, CPU/RAM per AP.",
  },
};
const UAP_L = {
  fr: {
    title: "Titre", icon: "Icône", show_system: "Afficher CPU / RAM",
    device: "Appareil UniFi (détection auto)",
    name: "Nom de la borne", state: "Capteur d'état", clients: "Nombre de clients",
    rx: "Réception", tx: "Émission", cpu: "Processeur", memory: "Mémoire",
    uptime: "Temps de fonctionnement", more_info: "Entité au clic (optionnel)",
  },
  en: {
    title: "Title", icon: "Icon", show_system: "Show CPU / RAM",
    device: "UniFi device (auto-detect)",
    name: "Access point name", state: "State sensor", clients: "Client count",
    rx: "Download", tx: "Upload", cpu: "CPU", memory: "Memory",
    uptime: "Uptime", more_info: "Entity on click (optional)",
  },
};
const aLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) ||
  (typeof document !== "undefined" && document.documentElement.lang) || "en";
const aLang = (h) => (String(aLoc(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
const aT = (h, k, n) => {
  const d = UAP_I18N[aLang(h)];
  const s = d[k] !== undefined ? d[k] : UAP_I18N.en[k];
  return n === undefined ? s : s.replace("{n}", n);
};

/* ---------- helpers ---------- */
const aRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const aFmt = (st, d, loc) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString(loc, { maximumFractionDigits: d === undefined ? 1 : d });
};
const aUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const aEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aBad = (st) => !st || st.state === "unavailable" || st.state === "unknown";
const aOnline = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};
/* Uptime sensors of the UniFi integration are timestamps: format them with the user locale */
const aSince = (st, loc) => {
  const d = new Date(st.state);
  return st.attributes && (st.attributes.device_class === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(st.state)) && !isNaN(d)
    ? d.toLocaleString(loc, { dateStyle: "short", timeStyle: "short" }) : st.state;
};

/* ---------- UniFi auto-detection (hass.entities / hass.devices) ---------- */
const aDevEnts = (hass, devId) => Object.values(hass.entities || {})
  .filter((e) => e.device_id === devId && e.platform === "unifi");
/* Entity ids of a UniFi device, by translation_key (language independent) */
const aAuto = (hass, devId) => {
  const ents = aDevEnts(hass, devId);
  const tk = (key) => { const e = ents.find((x) => x.translation_key === key); return e && e.entity_id; };
  const up = ents.find((x) => x.entity_id.indexOf("sensor.") === 0 && !x.translation_key &&
    hass.states[x.entity_id] && hass.states[x.entity_id].attributes.device_class === "timestamp");
  const rx = ents.filter((x) => x.translation_key === "port_bandwidth_rx");
  const tx = ents.filter((x) => x.translation_key === "port_bandwidth_tx");
  const dev = hass.devices && hass.devices[devId];
  const out = {
    name: dev ? dev.name_by_user || dev.name : undefined,
    state: tk("device_state"), clients: tk("device_clients"),
    cpu: tk("device_cpu_utilization"), memory: tk("device_memory_utilization"),
    uptime: up && up.entity_id,
    /* AP traffic = its uplink port, only when unambiguous */
    rx: rx.length === 1 ? rx[0].entity_id : undefined,
    tx: tx.length === 1 ? tx[0].entity_id : undefined,
  };
  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
  return out;
};

class UnifiApCard extends HTMLElement {
  setConfig(config) {
    if (!config.aps || !config.aps.length) {
      throw new Error(aT(this._hass, "err_aps"));
    }
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:wifi",
      accent: config.accent || "#7F77DD",
      color_ok: config.color_ok || "#1D9E75",
      color_ko: config.color_ko || "#E24B4A",
      color_rx: config.color_rx || "#378ADD",
      color_tx: config.color_tx || "#1D9E75",
      show_system: config.show_system !== false,
      aps: config.aps,
    };
    this._built = false;
    this._aps = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._resolve(hass);
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  /* Merge detected entities under explicit ones; recomputed only when the registry changes */
  _resolve(hass) {
    if (this._aps && hass.entities === this._entsRef) return;
    this._entsRef = hass.entities;
    this._aps = this._config.aps.map((a) =>
      (a && a.device ? Object.assign(aAuto(hass, a.device), a) : a || {}));
  }

  _ids() {
    const ids = [];
    this._aps.forEach((a) => {
      ["state", "clients", "rx", "tx", "cpu", "memory", "uptime", "update"].forEach((k) => {
        if (a[k]) ids.push(a[k]);
      });
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return aLoc(h) + "|" + this._config.aps.length + "|" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { border-radius:14px; padding:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);
          background:var(--card-background-color,#181a1b);
          transition:border-color .3s ease; }
        .header { padding:15px 15px 12px 15px; display:flex; align-items:center; gap:12px; }
        .disc { width:42px; height:42px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; }
        .disc ha-icon { --mdc-icon-size:22px; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color); }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:7px; }
        .ap { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; }
        .ap:hover { background:rgba(255,255,255,0.07); }
        .ap-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .ap-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ap-cli { font-size:12px; font-weight:700; }
        .ap-top ha-icon { --mdc-icon-size:13px; color:var(--disabled-text-color); }
        .ap-foot { display:flex; gap:14px; font-size:10px;
          color:var(--disabled-text-color); align-items:center; }
        .ap-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .ap-foot .sys { flex:1; text-align:right; }
        .ap-up { display:flex; align-items:center; gap:5px; margin-top:6px;
          padding-top:6px; border-top:1px solid rgba(255,255,255,0.05);
          font-size:10px; color:var(--disabled-text-color); }
        .ap-up ha-icon { --mdc-icon-size:11px; }
        .ap-off { opacity:.5; }
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
    const loc = aLoc(hass), t = (k, n) => aT(hass, k, n);

    const disc = r.querySelector(".disc");
    disc.style.background = aRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;

    r.querySelector("ha-card").style.borderColor = aRgba(c.accent, 0.28);
    r.querySelector(".htitle").textContent = c.title || t("title");

    /* Total clients across all APs */
    let total = 0, hasTotal = false;
    this._aps.forEach((a) => {
      if (a.clients && hass.states[a.clients]) {
        const n = parseFloat(hass.states[a.clients].state);
        if (!isNaN(n)) { total += n; hasTotal = true; }
      }
    });
    const nAps = this._aps.length;
    const plural = new Intl.PluralRules(aLang(hass)).select(nAps) === "one" ? "aps_one" : "aps_other";
    r.querySelector(".hsub").textContent = t(plural, nAps) +
      (hasTotal ? " · " + total.toLocaleString(loc) + " " + t("clients") : "");

    /* Rows */
    const list = r.querySelector(".list");
    list.innerHTML = "";
    this._aps.forEach((a) => {
      const stState = a.state ? hass.states[a.state] : null;
      const on = a.state ? aOnline(stState) : true;
      const el = document.createElement("div");
      el.className = "ap" + (on === false ? " ap-off" : "");

      const cliSt = a.clients ? hass.states[a.clients] : null;
      const rxSt = a.rx ? hass.states[a.rx] : null;
      const txSt = a.tx ? hass.states[a.tx] : null;
      const cpuSt = a.cpu ? hass.states[a.cpu] : null;
      const memSt = a.memory ? hass.states[a.memory] : null;

      const foot = [];
      if (rxSt) foot.push('<span><ha-icon icon="mdi:arrow-down" style="color:' + c.color_rx +
        '"></ha-icon> ' + aEsc(aFmt(rxSt, undefined, loc)) + " " + aEsc(aUnit(rxSt)) + "</span>");
      if (txSt) foot.push('<span><ha-icon icon="mdi:arrow-up" style="color:' + c.color_tx +
        '"></ha-icon> ' + aEsc(aFmt(txSt, undefined, loc)) + " " + aEsc(aUnit(txSt)) + "</span>");

      const sysBits = [];
      if (c.show_system && cpuSt) sysBits.push("CPU " + aEsc(aFmt(cpuSt, 0, loc)) + aEsc(aUnit(cpuSt)));
      if (c.show_system && memSt) sysBits.push("RAM " + aEsc(aFmt(memSt, 0, loc)) + aEsc(aUnit(memSt)));
      if (sysBits.length) foot.push('<span class="sys">' + sysBits.join(" · ") + "</span>");

      /* Uptime has its own line so CPU/RAM never overwrite it */
      const upSt = a.uptime ? hass.states[a.uptime] : null;
      const upLine = !aBad(upSt)
        ? '<div class="ap-up"><ha-icon icon="mdi:clock-outline"></ha-icon>' +
          "<span>" + aEsc(t("up_since", aSince(upSt, loc))) + "</span></div>"
        : "";

      el.innerHTML =
        '<div class="ap-top">' +
          '<span class="dot" style="background:' + (on === false ? c.color_ko : c.color_ok) + '"></span>' +
          '<span class="ap-name">' + aEsc(a.name || (stState && stState.attributes.friendly_name) || t("ap")) + "</span>" +
          (cliSt ? '<span class="ap-cli" style="color:' + c.accent + '">' + aEsc(aFmt(cliSt, 0, loc)) + "</span>" +
                   '<ha-icon icon="mdi:account-multiple"></ha-icon>' : "") +
        "</div>" +
        (foot.length ? '<div class="ap-foot">' + foot.join("") + "</div>" : "") +
        upLine;

      el.addEventListener("click", () =>
        this._more(a.more_info || a.clients || a.state));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.aps.length; }
  static getStubConfig(hass) {
    /* shortcut: devices with a UniFi state sensor and no switch-port entities are assumed to be APs;
       gateways may slip in — the user removes them in the editor */
    const ents = Object.values((hass && hass.entities) || {}).filter((e) => e.platform === "unifi" && e.device_id);
    const isSwitch = new Set(ents.filter((e) => e.translation_key === "poe_port_control" ||
      e.translation_key === "port_poe_power").map((e) => e.device_id));
    const devs = [...new Set(ents.filter((e) => e.translation_key === "device_state" &&
      !isSwitch.has(e.device_id)).map((e) => e.device_id))];
    return {
      type: "custom:unifi-ap-card",
      aps: devs.length ? devs.map((d) => ({ device: d })) : [{ name: aT(hass, "ap") + " 1" }],
    };
  }
  static getConfigElement() { return document.createElement("unifi-ap-card-editor"); }
}
customElements.define("unifi-ap-card", UnifiApCard);

/* ================= EDITOR ================= */
const UAP_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "show_system", selector: { boolean: {} } },
];
const UAP_S_AP = [
  { name: "device", selector: { device: { filter: { integration: "unifi" } } } },
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "state", selector: { entity: { filter: { domain: ["sensor", "binary_sensor", "device_tracker"] } } } },
    { name: "clients", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "cpu", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "memory", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { name: "uptime", selector: { entity: { filter: { domain: ["sensor"] } } } },
];

/* Collapsible sections: open/closed state survives editor re-creation */
const UAP_OPEN = new Map();
const aSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '">' +
    '<button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
      '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>' +
      '<span class="sec-title">' + title + "</span></button>" +
    '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const aInitSecs = (root, tag, t) => {
  const secs = [...root.querySelectorAll(".sec")];
  const all = root.querySelector(".tog-all");
  const closed = (s) => s.querySelector(".sec-body").hidden;
  const set = (s, open) => {
    s.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    s.querySelector(".sec-body").hidden = !open;
    UAP_OPEN.set(tag + ":" + s.dataset.sec, open);
  };
  const sync = () => { all.textContent = t(secs.some(closed) ? "expand_all" : "collapse_all"); };
  secs.forEach((s, i) => {
    const k = tag + ":" + s.dataset.sec;
    set(s, UAP_OPEN.has(k) ? UAP_OPEN.get(k) : i === 0);
    s.querySelector(".sec-head").addEventListener("click", () => { set(s, closed(s)); sync(); });
  });
  all.addEventListener("click", () => { const open = secs.some(closed); secs.forEach((s) => set(s, open)); sync(); });
  sync();
};

class UnifiApCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    this._ensure();
    this._update();
  }
  set hass(h) {
    this._hass = h;
    if (!this._built) { this._ensure(); this._update(); } else this._refreshHass();
  }
  /* Built once both config and hass are known, so labels use the user's language */
  _ensure() {
    if (this._built || !this._hass || !this._config) return;
    this._build(); this._built = true;
  }
  _refreshHass() {
    this.shadowRoot.querySelectorAll("ha-form").forEach((f) => { f.hass = this._hass; });
  }
  _setColor(sel, val) {
    const el = this.shadowRoot.querySelector(sel);
    if (!el || this.shadowRoot.activeElement === el) return;
    if (el.value !== val) el.value = val;
  }
  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _t(k, n) { return aT(this._hass, k, n); }
  _label(s) { return UAP_L[aLang(this._hass)][s.name] || s.name; }

  _build() {
    const t = (k) => aEsc(this._t(k));
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .toolbar { display:flex; justify-content:flex-end; margin-bottom:4px; }
        .tog-all { background:none; border:none; padding:2px 6px; font:inherit; font-size:12px;
          color:var(--secondary-text-color); cursor:pointer; border-radius:4px; }
        .tog-all:hover { color:var(--primary-text-color); }
        .sec { margin-bottom:18px; }
        .sec-head { display:flex; align-items:center; gap:8px; width:100%; margin:0 0 10px 0;
          padding:0 0 6px 0; background:none; border:none; border-bottom:1px solid var(--divider-color);
          font:inherit; color:inherit; text-align:left; cursor:pointer; }
        .sec-head[aria-expanded="false"] { margin-bottom:0; }
        .sec-head:focus-visible, .tog-all:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
        .chev { --mdc-icon-size:18px; color:var(--secondary-text-color); flex-shrink:0; transition:transform .2s ease; }
        .sec-head[aria-expanded="false"] .chev { transform:rotate(-90deg); }
        .sec-body[hidden] { display:none; }
        @media (prefers-reduced-motion: reduce) { .chev { transition:none; } }
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
        /* Controls of one form align at the top: an entity picker is taller than a
           text field and would shift its neighbours. */
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
      </style>
      <div class="toolbar"><button type="button" class="tog-all"></button></div>
      ${aSec("general", t("general"), '<ha-form class="f-gen"></ha-form>')}
      ${aSec("colors", t("colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("accent")}</label></div>
          <div class="color-field"><input type="color" class="c-ok"><label>${t("ok")}</label></div>
          <div class="color-field"><input type="color" class="c-ko"><label>${t("ko")}</label></div>
        </div>`)}
      ${aSec("aps", t("aps_sec"), `
        <div class="sec-hint">${t("hint")}</div>
        <div class="rows-aps"></div>
        <div class="addbtn add-ap"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    aInitSecs(r, this.localName, (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = UAP_S_GEN; f.computeLabel = (s) => this._label(s);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let tm = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
    };
    bindColor(".c-accent", "accent");
    bindColor(".c-ok", "color_ok");
    bindColor(".c-ko", "color_ko");
    r.querySelector(".add-ap").addEventListener("click", () => {
      this._config.aps = (this._config.aps || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._built || !this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:wifi",
      show_system: c.show_system !== false,
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");
    this._setColor(".c-ok", c.color_ok || "#1D9E75");
    this._setColor(".c-ko", c.color_ko || "#E24B4A");

    const box = r.querySelector(".rows-aps");
    const list = c.aps || [];
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
    const dev = item.device && this._hass.devices && this._hass.devices[item.device];
    num.textContent = item.name || (dev && (dev.name_by_user || dev.name)) || this._t("row", index + 1);
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
      this._config.aps = this._config.aps.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = UAP_S_AP; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.aps || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      l[index] = m; this._config.aps = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.aps || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.aps = l; this._emit(); this._update(true);
  }
}
customElements.define("unifi-ap-card-editor", UnifiApCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-ap-card",
  name: "UniFi AP Card",
  description: aT(null, "desc"),
});
console.info("%c UNIFI-AP-CARD %c v" + UAP_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
CONFIG EXAMPLE

type: custom:unifi-ap-card
icon: mdi:wifi
accent: "#7F77DD"
show_system: true
aps:
  # Auto-detection from the UniFi device (device id picked in the editor)
  - device: 0123456789abcdef0123456789abcdef
  # Fully explicit
  - name: Access point 2
    state: sensor.example_ap_state
    clients: sensor.example_ap_clients
    rx: sensor.example_ap_rx
    tx: sensor.example_ap_tx
    cpu: sensor.example_ap_cpu_utilization
    memory: sensor.example_ap_memory_utilization
    uptime: sensor.example_ap_uptime
============================================================ */
