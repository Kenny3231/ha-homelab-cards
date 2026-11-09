/**
 * Synology Drives Card — disques DSM
 * Version 1.0.0
 *
 * Affiche l'état, la température et les deux alarmes S.M.A.R.T. que
 * l'intégration Synology expose : secteurs défectueux et durée de vie.
 *
 * ⚠️ Ces binary_sensor sont en device_class "problem" : l'état "on" signifie
 *    qu'un problème EST détecté. La carte en tient compte automatiquement.
 *
 * Installation :
 *  1. config/www/perso/synology-drives-card.js
 *  2. Resources → /local/perso/synology-drives-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const SYDRV_VERSION = "1.0.0";

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
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d });
};
const kUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const kEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Un binary_sensor de device_class "problem" est inversé : "on" = problème.
   Renvoie true si tout va bien, false si problème, null si indéterminé. */
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

/* Classe un état textuel de disque */
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

class SynologyDrivesCard extends HTMLElement {
  setConfig(config) {
    if (!config.drives || !config.drives.length) {
      throw new Error("La clé 'drives' est requise (au moins un disque).");
    }
    this._config = {
      title: config.title || "Disques",
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      temp_warn: config.temp_warn || 45,
      temp_critical: config.temp_critical || 55,
      show_alarms: config.show_alarms !== false,
      label_sectors_ok: config.label_sectors_ok || "secteurs OK",
      label_sectors_ko: config.label_sectors_ko || "secteurs défectueux",
      label_life_ok: config.label_life_ok || "durée de vie OK",
      label_life_ko: config.label_life_ko || "fin de vie proche",
      drives: config.drives,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.drives.forEach((d) => {
      ["status", "temperature", "bad_sectors", "remaining_life", "size"]
        .forEach((k) => d[k] && ids.push(d[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "var(--disabled-text-color)";
  }

  /* Un disque est sain si son état est normal ET qu'aucune alarme n'est levée */
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
    this.attachShadow({ mode: "open" });
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

    r.querySelector("ha-card").style.borderColor = kRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = kRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let ok = 0, known = 0;
    c.drives.forEach((d) => {
      const o = this._overall(d);
      if (o !== null) { known++; if (o === "ok") ok++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (ok === known ? "#1D9E75" : "#E24B4A") + '">' +
        ok + " sain" + (ok > 1 ? "s" : "") + "</b> / " + known
      : c.drives.length + " disque" + (c.drives.length > 1 ? "s" : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

    c.drives.forEach((d) => {
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
          '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + kFmt(tempSt, 0) + " " +
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
        mkAlarm(d.bad_sectors, c.label_sectors_ok, c.label_sectors_ko);
        mkAlarm(d.remaining_life, c.label_life_ok, c.label_life_ko);
      }

      el.innerHTML =
        '<div class="dk-top">' +
          '<span class="dot" style="background:' + dotCol + '"></span>' +
          '<span class="dk-name">' + kEsc(d.name || "Disque") + "</span>" +
          (sizeSt ? '<span class="dk-size">' + kFmt(sizeSt, 0) + " " +
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

  getCardSize() { return 2 + this._config.drives.length; }
  static getStubConfig() {
    return { type: "custom:synology-drives-card", title: "Disques", drives: [{ name: "Drive 1" }] };
  }
  static getConfigElement() { return document.createElement("synology-drives-card-editor"); }
}
customElements.define("synology-drives-card", SynologyDrivesCard);

/* ================= ÉDITEUR ================= */
const SD_L = {
  title: "Titre", icon: "Icône", temp_warn: "Température d'alerte (°C)",
  temp_critical: "Température critique (°C)", show_alarms: "Afficher les alarmes S.M.A.R.T.",
  label_sectors_ok: "Libellé secteurs — OK", label_sectors_ko: "Libellé secteurs — problème",
  label_life_ok: "Libellé durée de vie — OK", label_life_ko: "Libellé durée de vie — problème",
  name: "Nom du disque", status: "État", temperature: "Température",
  bad_sectors: "Alarme secteurs défectueux", remaining_life: "Alarme durée de vie",
  size: "Taille", alarm_invert: "Inverser la lecture des alarmes",
};
const SD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SD_BIN = { entity: { filter: { domain: ["binary_sensor", "sensor"] } } };
const SD_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
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
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (!this._built) return;
    if (first) this._update(); else this._refreshHass();
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
  _label(s) { return SD_L[s.name] || s.name; }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom:18px; }
        .sec-head { display:flex; align-items:center; gap:8px; margin-bottom:10px;
          padding-bottom:6px; border-bottom:1px solid var(--divider-color); }
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
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleur</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Libellés des alarmes</span></div>
        <ha-form class="f-labels"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Disques</span></div>
        <div class="sec-hint">Les alarmes Synology sont en device_class « problem » : leur lecture est inversée automatiquement. Coche « Inverser » seulement si un disque sain apparaît en défaut.</div>
        <div class="rows-drives"></div>
        <div class="addbtn add-drive"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un disque</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", SD_S_GEN, (v) => {
      Object.assign(this._config, v);
      if (this._config.title === "") delete this._config.title;
    });
    wire(".f-labels", SD_S_LABELS, (v) => {
      Object.assign(this._config, v);
      ["label_sectors_ok", "label_sectors_ko", "label_life_ok", "label_life_ko"]
        .forEach((k) => { if (this._config[k] === "") delete this._config[k]; });
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    r.querySelector(".add-drive").addEventListener("click", () => {
      this._config.drives = (this._config.drives || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:harddisk",
      temp_warn: c.temp_warn || 45, temp_critical: c.temp_critical || 55,
      show_alarms: c.show_alarms !== false,
    };
    const fl = r.querySelector(".f-labels");
    fl.hass = this._hass;
    fl.data = {
      label_sectors_ok: c.label_sectors_ok || "secteurs OK",
      label_sectors_ko: c.label_sectors_ko || "secteurs défectueux",
      label_life_ok: c.label_life_ok || "durée de vie OK",
      label_life_ko: c.label_life_ko || "fin de vie proche",
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-drives");
    const list = c.drives || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun disque.";
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
    num.textContent = item.name || "Disque #" + (index + 1);
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
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = SD_S_DRIVE; f.computeLabel = this._label; f.hass = this._hass;
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
  description: "Disques Synology : état, température et alarmes S.M.A.R.T.",
});
console.info("%c SYNOLOGY-DRIVES-CARD %c v" + SYDRV_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:synology-drives-card
title: Disques
icon: mdi:harddisk
accent: "#7F77DD"
temp_warn: 45
temp_critical: 55
show_alarms: true
drives:
  - name: Drive 1
    status: sensor.syno_drive_1_status
    temperature: sensor.syno_drive_1_temperature
    bad_sectors: binary_sensor.syno_drive_1_exceeded_max_bad_sectors
    remaining_life: binary_sensor.syno_drive_1_below_min_remaining_life
  - name: Drive 2
    status: sensor.syno_drive_2_status
    temperature: sensor.syno_drive_2_temperature
    bad_sectors: binary_sensor.syno_drive_2_exceeded_max_bad_sectors
    remaining_life: binary_sensor.syno_drive_2_below_min_remaining_life
============================================================ */
