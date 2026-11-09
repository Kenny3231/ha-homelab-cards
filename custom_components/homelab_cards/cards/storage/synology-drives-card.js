/**
 * Synology Drives Card — DSM drives
 * Version 1.1.0
 *
 * Shows status, temperature and the two S.M.A.R.T. alarms exposed by the
 * native "synology_dsm" integration: bad sectors and remaining life.
 *
 * These binary_sensors use device_class "safety"/"problem": "on" means a
 * problem IS detected. The card handles the inversion automatically.
 *
 * Without a `drives` list, every Synology drive is detected automatically
 * (platform + translation_key, never display names), optionally limited to
 * one NAS with `device_id`.
 */

const SYDRV_VERSION = "1.1.0";

/* ---------- i18n ---------- */
const SD_I18N = {
  fr: {
    title: "Disques", drive: "Disque",
    healthy: (n) => n + " sain" + (n > 1 ? "s" : ""),
    count: (n) => n + " disque" + (n > 1 ? "s" : ""),
    none: "Aucun disque Synology détecté.",
    sectors_ok: "secteurs OK", sectors_ko: "secteurs défectueux",
    life_ok: "durée de vie OK", life_ko: "fin de vie proche",
    sec_gen: "Général", sec_color: "Couleur", sec_labels: "Libellés des alarmes", sec_drives: "Disques",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    accent: "Accent", empty: "Aucun disque : détection automatique.", add: "Ajouter un disque",
    hint_drives: "Liste vide = tous les disques Synology détectés automatiquement. Les alarmes Synology sont en device_class « safety » : leur lecture est inversée automatiquement. Coche « Inverser » seulement si un disque sain apparaît en défaut.",
    l_device_id: "NAS Synology (filtre de détection)",
    l_title: "Titre", l_icon: "Icône", l_temp_warn: "Température d'alerte (°C)",
    l_temp_critical: "Température critique (°C)", l_show_alarms: "Afficher les alarmes S.M.A.R.T.",
    l_label_sectors_ok: "Libellé secteurs — OK", l_label_sectors_ko: "Libellé secteurs — problème",
    l_label_life_ok: "Libellé durée de vie — OK", l_label_life_ko: "Libellé durée de vie — problème",
    l_name: "Nom du disque", l_status: "État", l_temperature: "Température",
    l_bad_sectors: "Alarme secteurs défectueux", l_remaining_life: "Alarme durée de vie",
    l_size: "Taille", l_alarm_invert: "Inverser la lecture des alarmes",
  },
  en: {
    title: "Drives", drive: "Drive",
    healthy: (n) => n + " healthy",
    count: (n) => n + " drive" + (n > 1 ? "s" : ""),
    none: "No Synology drive detected.",
    sectors_ok: "sectors OK", sectors_ko: "bad sectors",
    life_ok: "lifespan OK", life_ko: "end of life near",
    sec_gen: "General", sec_color: "Color", sec_labels: "Alarm labels", sec_drives: "Drives",
    expand_all: "Expand all", collapse_all: "Collapse all",
    accent: "Accent", empty: "No drive: automatic detection.", add: "Add a drive",
    hint_drives: "Empty list = every Synology drive is detected automatically. Synology alarms use device_class “safety”: they are inverted automatically. Tick “Invert” only if a healthy drive shows as failing.",
    l_device_id: "Synology NAS (detection filter)",
    l_title: "Title", l_icon: "Icon", l_temp_warn: "Warning temperature (°C)",
    l_temp_critical: "Critical temperature (°C)", l_show_alarms: "Show S.M.A.R.T. alarms",
    l_label_sectors_ok: "Sectors label — OK", l_label_sectors_ko: "Sectors label — problem",
    l_label_life_ok: "Lifespan label — OK", l_label_life_ko: "Lifespan label — problem",
    l_name: "Drive name", l_status: "Status", l_temperature: "Temperature",
    l_bad_sectors: "Bad sectors alarm", l_remaining_life: "Remaining life alarm",
    l_size: "Size", l_alarm_invert: "Invert alarm reading",
  },
};
const kLocale = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const kLang = (h) => (String(kLocale(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
const sdT = (lang, k) => (SD_I18N[lang][k] !== undefined ? SD_I18N[lang][k] : SD_I18N.en[k] !== undefined ? SD_I18N.en[k] : k);
/* Shared by all instances: every card on a page receives the same hass locale. */
let K_LOC = "en";

const kRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const kNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const kFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString(K_LOC, { maximumFractionDigits: d === undefined ? 0 : d });
};
const kUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const kEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* A "problem"/"safety" binary_sensor is inverted: "on" = problem.
   Returns true if fine, false on problem, null if unknown. */
function kAlarmOk(st, invert) {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return null;
  const dc = st.attributes ? st.attributes.device_class : null;
  const inverted = invert !== undefined && invert !== null
    ? invert : (dc === "problem" || dc === "safety");
  if (s === "on") return inverted ? false : true;
  if (s === "off") return inverted ? true : false;
  if (s === "ok" || s === "normal" || s === "good") return true;
  if (s === "bad" || s === "critical" || s === "failed") return false;
  return null;
}

/* Classifies a raw drive status (API values, not translated) */
function kStatusKind(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "") return null;
  if (["normal", "ok", "healthy", "good", "normale"].indexOf(s) !== -1) return "ok";
  if (["warning", "attention", "degraded", "background", "initialized",
       "verifying", "smart_warning"].indexOf(s) !== -1) return "warn";
  if (["crashed", "critical", "failed", "failing", "bad", "danger"].indexOf(s) !== -1) return "bad";
  return "warn";
}

/* ---------- synology_dsm auto-detection ---------- */
const K_AUTO = {
  disk_status: "status", disk_smart_status: "_smart",
  disk_exceed_bad_sector_thr: "bad_sectors", disk_below_remain_life_thr: "remaining_life",
};
/* One drive per Synology child device carrying disk_* entities.
   nasId (optional) keeps only the drives of that NAS. */
function kDetect(hass, nasId) {
  const devs = hass.devices || {};
  const ents = Object.values(hass.entities || {})
    .filter((e) => e.platform === "synology_dsm" && e.device_id &&
      (!nasId || (devs[e.device_id] && devs[e.device_id].via_device_id === nasId)));
  const by = {};
  ents.forEach((e) => {
    const f = K_AUTO[e.translation_key];
    if (f) (by[e.device_id] = by[e.device_id] || {})[f] = e.entity_id;
  });
  /* Drive temperature has no translation_key: match by device_class on the drive device. */
  ents.forEach((e) => {
    const it = by[e.device_id], st = hass.states[e.entity_id];
    if (it && !it.temperature && e.entity_id.indexOf("sensor.") === 0 && !e.translation_key &&
        st && st.attributes && st.attributes.device_class === "temperature") it.temperature = e.entity_id;
  });
  return Object.keys(by).map((id) => {
    const it = by[id], d = devs[id] || {}, p = devs[d.via_device_id];
    if (!it.status && it._smart) it.status = it._smart;
    delete it._smart;
    /* Integration names child devices "<nas> (<drive>)": keep the drive part. */
    let n = d.name_by_user || d.name || "";
    if (!d.name_by_user && p && p.name && n.indexOf(p.name + " (") === 0 && n.slice(-1) === ")") {
      n = n.slice(p.name.length + 2, -1);
    }
    if (n) it.name = n;
    return it;
  }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true }));
}

class SynologyDrivesCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      temp_warn: config.temp_warn || 45,
      temp_critical: config.temp_critical || 55,
      show_alarms: config.show_alarms !== false,
      label_sectors_ok: config.label_sectors_ok || null,
      label_sectors_ko: config.label_sectors_ko || null,
      label_life_ok: config.label_life_ok || null,
      label_life_ko: config.label_life_ko || null,
      device_id: config.device_id || null,
      /* Explicit list wins; without it, drives are auto-detected. */
      drives: config.drives && config.drives.length ? config.drives : null,
    };
    this._auto = [];
    this._entRef = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    K_LOC = kLocale(hass);
    this._lang = kLang(hass);
    if (!this._config.drives && hass.entities !== this._entRef) {
      this._entRef = hass.entities; this._auto = kDetect(hass, this._config.device_id); this._last = null;
    }
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }
  _t(k) { return sdT(this._lang || "en", k); }
  _drives() { return this._config.drives || this._auto; }

  _ids() {
    const ids = [];
    this._drives().forEach((d) => {
      ["status", "temperature", "bad_sectors", "remaining_life", "size"]
        .forEach((k) => d[k] && ids.push(d[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._drives().length + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "var(--disabled-text-color)";
  }

  /* A drive is healthy if its status is normal AND no alarm is raised */
  _overall(d) {
    const hass = this._hass;
    const kind = d.status && hass.states[d.status]
      ? kStatusKind(hass.states[d.status].state) : null;
    const alarms = [
      kAlarmOk(d.bad_sectors ? hass.states[d.bad_sectors] : null, d.alarm_invert),
      kAlarmOk(d.remaining_life ? hass.states[d.remaining_life] : null, d.alarm_invert),
    ];
    if (alarms.indexOf(false) !== -1) return "bad";
    if (kind === "bad") return "bad";
    if (kind === "warn") return "warn";
    if (kind === "ok") return "ok";
    if (alarms.indexOf(true) !== -1) return "ok";
    return null;
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
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:7px; }
        .dk { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; overflow:hidden; }
        .dk:hover { background:rgba(255,255,255,0.07); }
        .dk-top { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .dk-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dk-size { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .dk-state { display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; flex-shrink:0; }
        .dk-state ha-icon { --mdc-icon-size:12px; }
        .dk-foot { display:flex; gap:12px; flex-wrap:wrap;
          font-size:10px; color:var(--disabled-text-color); line-height:1.5; }
        .dk-foot span { white-space:nowrap; }
        .dk-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
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
    const drives = this._drives();

    r.querySelector("ha-card").style.borderColor = kRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = kRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || this._t("title");

    let ok = 0, known = 0;
    drives.forEach((d) => {
      const o = this._overall(d);
      if (o !== null) { known++; if (o === "ok") ok++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (ok === known ? "#1D9E75" : "#E24B4A") + '">' +
        kEsc(this._t("healthy")(ok)) + "</b> / " + known
      : kEsc(this._t("count")(drives.length));

    const list = r.querySelector(".list");
    list.innerHTML = "";
    if (!drives.length) {
      const e = document.createElement("div");
      e.className = "none"; e.textContent = this._t("none");
      list.appendChild(e);
    }

    drives.forEach((d) => {
      const overall = this._overall(d);
      const dotCol = overall === "bad" ? "#E24B4A"
        : overall === "warn" ? "#BA7517"
        : overall === "ok" ? "#1D9E75" : "#4a4a48";

      const stSt = d.status ? hass.states[d.status] : null;
      const tempSt = d.temperature ? hass.states[d.temperature] : null;
      const sizeSt = d.size ? hass.states[d.size] : null;
      const el = document.createElement("div");
      el.className = "dk";

      let stateHtml = "";
      if (stSt) {
        stateHtml = '<span class="dk-state" style="color:' + dotCol + '">' +
          '<ha-icon icon="' + (overall === "bad" ? "mdi:alert" :
            overall === "warn" ? "mdi:alert-outline" : "mdi:check-circle") + '"></ha-icon>' +
          kEsc(stSt.state) + "</span>";
      }

      const foot = [];
      if (tempSt) {
        const t = kNum(tempSt);
        foot.push('<span style="color:' + this._tempColor(t) +
          '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + kEsc(kFmt(tempSt, 0)) + " " +
          kEsc(kUnit(tempSt) || "°C") + "</span>");
      }
      if (c.show_alarms) {
        const mkAlarm = (entity, okLbl, koLbl) => {
          if (!entity) return;
          const a = kAlarmOk(hass.states[entity], d.alarm_invert);
          if (a === null) return;
          foot.push('<span style="color:' + (a ? "inherit" : "#E24B4A") +
            '"><ha-icon icon="' + (a ? "mdi:check-circle" : "mdi:alert-circle") +
            '" style="color:' + (a ? "#1D9E75" : "#E24B4A") + '"></ha-icon> ' +
            kEsc(a ? okLbl : koLbl) + "</span>");
        };
        mkAlarm(d.bad_sectors, c.label_sectors_ok || this._t("sectors_ok"), c.label_sectors_ko || this._t("sectors_ko"));
        mkAlarm(d.remaining_life, c.label_life_ok || this._t("life_ok"), c.label_life_ko || this._t("life_ko"));
      }

      el.innerHTML =
        '<div class="dk-top">' +
          '<span class="dot" style="background:' + dotCol + '"></span>' +
          '<span class="dk-name">' + kEsc(d.name || this._t("drive")) + "</span>" +
          (sizeSt ? '<span class="dk-size">' + kEsc(kFmt(sizeSt, 0)) + " " +
            kEsc(kUnit(sizeSt)) + "</span>" : "") +
          stateHtml +
        "</div>" +
        (foot.length ? '<div class="dk-foot">' + foot.join("") + "</div>" : "");

      el.addEventListener("click", () =>
        this._more(d.status || d.temperature || d.bad_sectors));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + Math.max(this._drives().length, 1); }
  /* No list in the stub: drives are auto-detected. */
  static getStubConfig() { return { type: "custom:synology-drives-card" }; }
  static getConfigElement() { return document.createElement("synology-drives-card-editor"); }
}
customElements.define("synology-drives-card", SynologyDrivesCard);

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const SD_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const SD_SEC_CSS = `
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
const sdSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + kEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const sdSecTools = (L) =>
  '<div class="sec-tools"><button type="button" class="sec-all" data-open="1">' + kEsc(sdT(L, "expand_all")) +
  '</button><button type="button" class="sec-all" data-open="0">' + kEsc(sdT(L, "collapse_all")) + "</button></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function sdSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    SD_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, SD_SEC_STATE.has(k) ? SD_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const SD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SD_BIN = { entity: { filter: { domain: ["binary_sensor", "sensor"] } } };
const SD_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "device_id", selector: { device: { filter: { integration: "synology_dsm" } } } },
  { type: "grid", schema: [
    { name: "temp_warn", selector: { number: { min: 20, max: 100, mode: "box" } } },
    { name: "temp_critical", selector: { number: { min: 20, max: 100, mode: "box" } } },
  ]},
  { name: "show_alarms", selector: { boolean: {} } },
];
const SD_S_LABELS = [
  { type: "grid", schema: [
    { name: "label_sectors_ok", selector: { text: {} } },
    { name: "label_sectors_ko", selector: { text: {} } },
  ]},
  { type: "grid", schema: [
    { name: "label_life_ok", selector: { text: {} } },
    { name: "label_life_ko", selector: { text: {} } },
  ]},
];
const SD_S_DRIVE = [
  { name: "name", selector: { text: {} } },
  { name: "status", selector: SD_SENSOR },
  { name: "temperature", selector: SD_SENSOR },
  { name: "bad_sectors", selector: SD_BIN },
  { name: "remaining_life", selector: SD_BIN },
  { name: "size", selector: SD_SENSOR },
  { name: "alarm_invert", selector: { boolean: {} } },
];

class SynologyDrivesCardEditor extends HTMLElement {
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
  _t(k) { return sdT(this._lang, k); }
  _label(s) { return sdT(this._lang, "l_" + s.name); }

  /* Built once hass is known, so the UI language is available. */
  _build() {
    this._lang = kLang(this._hass);
    const t = (k) => kEsc(this._t(k));
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
        ${SD_SEC_CSS}
      </style>
      ${sdSecTools(this._lang)}
      ${sdSec("gen", this._t("sec_gen"), `<ha-form class="f-gen"></ha-form>`)}
      ${sdSec("color", this._t("sec_color"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("accent")}</label></div>
        </div>`)}
      ${sdSec("labels", this._t("sec_labels"), `<ha-form class="f-labels"></ha-form>`)}
      ${sdSec("drives", this._t("sec_drives"), `
        <div class="sec-hint">${t("hint_drives")}</div>
        <div class="rows-drives"></div>
        <div class="addbtn add-drive"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    sdSecWire(r, this.tagName.toLowerCase());
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = (s) => this._label(s);
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", SD_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "device_id"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
    });
    wire(".f-labels", SD_S_LABELS, (v) => {
      Object.assign(this._config, v);
      ["label_sectors_ok", "label_sectors_ko", "label_life_ok", "label_life_ko"]
        .forEach((k) => { if (this._config[k] === "") delete this._config[k]; });
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t2 = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t2); t2 = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t2); apply(e.target.value); });
    r.querySelector(".add-drive").addEventListener("click", () => {
      this._config.drives = (this._config.drives || []).concat([{ name: "" }]);
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
      temp_warn: c.temp_warn || 45, temp_critical: c.temp_critical || 55,
      show_alarms: c.show_alarms !== false,
    };
    const fl = r.querySelector(".f-labels");
    fl.hass = this._hass;
    fl.data = {
      label_sectors_ok: c.label_sectors_ok || this._t("sectors_ok"),
      label_sectors_ko: c.label_sectors_ko || this._t("sectors_ko"),
      label_life_ok: c.label_life_ok || this._t("life_ok"),
      label_life_ko: c.label_life_ko || this._t("life_ko"),
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-drives");
    const list = c.drives || [];
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
        ff.hass = this._hass;
        ff.data = Object.assign({ alarm_invert: false }, list[i]);
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
    num.textContent = item.name || this._t("drive") + " #" + (index + 1);
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
      this._config.drives = this._config.drives.filter((_, i) => i !== index);
      if (!this._config.drives.length) delete this._config.drives; /* back to auto-detection */
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = SD_S_DRIVE; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
    f.data = Object.assign({ alarm_invert: false }, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.drives || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined) delete m[k];
        if (k === "alarm_invert" && m[k] === false) delete m[k];
      });
      l[index] = m; this._config.drives = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.drives || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.drives = l; this._emit(); this._update(true);
  }
}
customElements.define("synology-drives-card-editor", SynologyDrivesCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-drives-card",
  name: "Synology Drives Card",
  description: "Synology drives: status, temperature and S.M.A.R.T. alarms.",
});
console.info("%c SYNOLOGY-DRIVES-CARD %c v" + SYDRV_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
CONFIG EXAMPLES

# Minimal: every Synology drive auto-detected
type: custom:synology-drives-card

# Explicit list (wins over detection)
type: custom:synology-drives-card
title: Drives
icon: mdi:harddisk
accent: "#7F77DD"
temp_warn: 45
temp_critical: 55
show_alarms: true
drives:
  - name: Drive 1
    status: sensor.example_nas_drive_1_status
    temperature: sensor.example_nas_drive_1_temperature
    bad_sectors: binary_sensor.example_nas_drive_1_exceeded_max_bad_sectors
    remaining_life: binary_sensor.example_nas_drive_1_below_min_remaining_life
============================================================ */
