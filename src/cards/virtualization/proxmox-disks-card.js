/**
 * Proxmox Disks Card — disques physiques (santé S.M.A.R.T.)
 * Version 1.0.0
 *
 * ⚠️ Le « wearout » d'un SSD est ambigu selon le disque et le firmware :
 *    certains rapportent l'usure consommée (0 = neuf), d'autres la vie
 *    restante (100 = neuf). Règle `wearout_mode` par disque :
 *      used      → la valeur EST l'usure  (0 % = neuf)
 *      remaining → la valeur est la vie restante (100 % = neuf)
 *    En cas de doute, compare avec l'âge du disque : un disque récent
 *    affichant 95 % d'usure est presque sûrement en mode "remaining".
 *
 * Installation :
 *  1. config/www/perso/proxmox-disks-card.js
 *  2. Resources → /local/perso/proxmox-disks-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PDISK_VERSION = "1.1.0";

const dRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const dNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const dFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d });
};
const dUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const dEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Un binary_sensor de device_class "problem" est INVERSÉ : "on" signifie
   qu'un problème est détecté, "off" que tout va bien. Home Assistant affiche
   d'ailleurs "OK" pour l'état off dans ce cas. Sans cette lecture, un disque
   sain est signalé défaillant. `invert` permet de forcer manuellement. */
const dOk = (st, invert) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return null;
  const dc = st.attributes ? st.attributes.device_class : null;
  const inverted = invert !== undefined && invert !== null
    ? invert
    : (dc === "problem" || dc === "safety");
  if (s === "on") return inverted ? false : true;
  if (s === "off") return inverted ? true : false;
  /* Certaines intégrations renvoient directement un libellé */
  if (s === "passed" || s === "ok" || s === "healthy" || s === "good") return true;
  if (s === "failed" || s === "failing" || s === "bad" || s === "ko") return false;
  return null;
};

/* Convertit les heures de fonctionnement en durée lisible */
function dHours(h) {
  if (isNaN(h)) return null;
  const y = Math.floor(h / 8760);
  const rest = h % 8760;
  const d = Math.floor(rest / 24);
  if (y >= 1) return y + " an" + (y > 1 ? "s" : "") + (d ? " " + d + " j" : "");
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  return Math.floor(h) + " h";
}

class ProxmoxDisksCard extends HTMLElement {
  setConfig(config) {
    if (!config.disks || !config.disks.length) {
      throw new Error("La clé 'disks' est requise (au moins un disque).");
    }
    this._config = {
      title: config.title || "Disques",
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      color_ok: config.color_ok || "#1D9E75",
      color_ko: config.color_ko || "#E24B4A",
      warn_at: config.warn_at || 60,
      critical_at: config.critical_at || 85,
      temp_warn: config.temp_warn || 50,
      temp_critical: config.temp_critical || 60,
      show_wearout: config.show_wearout !== false,
      disks: config.disks,
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
    this._config.disks.forEach((d) => {
      ["health", "wearout", "temperature", "power_on_hours", "power_cycles", "size"]
        .forEach((k) => d[k] && ids.push(d[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Renvoie l'usure réelle en %, quel que soit le mode de rapport du disque */
  _wearUsed(disk, raw) {
    if (isNaN(raw)) return NaN;
    return (disk.wearout_mode === "remaining") ? 100 - raw : raw;
  }

  _wearColor(used) {
    const c = this._config;
    if (isNaN(used)) return "#4a4a48";
    if (used >= c.critical_at) return "#E24B4A";
    if (used >= c.warn_at) return "#BA7517";
    return c.color_ok;
  }
  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "var(--disabled-text-color)";
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
          cursor:pointer; transition:background .2s ease; }
        .dk:hover { background:rgba(255,255,255,0.07); }
        .dk-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .dk-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dk-size { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .w-top { display:flex; justify-content:space-between;
          font-size:9.5px; color:var(--disabled-text-color); margin-bottom:3px; }
        .w-t { height:4px; border-radius:2px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .w-f { height:100%; border-radius:2px; transition:width .4s ease; }
        .dk-foot { display:flex; gap:12px; flex-wrap:wrap; margin-top:7px;
          font-size:10px; color:var(--disabled-text-color); }
        .dk-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .badko { display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; color:#E24B4A; flex-shrink:0; }
        .badko ha-icon { --mdc-icon-size:12px; }
        .badok { display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; color:#1D9E75; flex-shrink:0; }
        .badok ha-icon { --mdc-icon-size:12px; }
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

    r.querySelector("ha-card").style.borderColor = dRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = dRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let healthy = 0, known = 0;
    c.disks.forEach((d) => {
      const st = d.health ? hass.states[d.health] : null;
      const ok = dOk(st, d.health_invert);
      if (ok !== null) { known++; if (ok) healthy++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (healthy === known ? c.color_ok : c.color_ko) + '">' +
        healthy + " sain" + (healthy > 1 ? "s" : "") + "</b> / " + known
      : c.disks.length + " disque" + (c.disks.length > 1 ? "s" : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

    c.disks.forEach((d) => {
      const healthSt = d.health ? hass.states[d.health] : null;
      const ok = dOk(healthSt, d.health_invert);
      const el = document.createElement("div");
      el.className = "dk";

      const sizeSt = d.size ? hass.states[d.size] : null;
      const wearSt = d.wearout ? hass.states[d.wearout] : null;
      const tempSt = d.temperature ? hass.states[d.temperature] : null;
      const pohSt = d.power_on_hours ? hass.states[d.power_on_hours] : null;
      const pcSt = d.power_cycles ? hass.states[d.power_cycles] : null;

      const wearUsed = this._wearUsed(d, dNum(wearSt));
      const wearCol = this._wearColor(wearUsed);
      const temp = dNum(tempSt);

      let html =
        '<div class="dk-top">' +
          '<span class="dot" style="background:' +
            (ok === false ? c.color_ko : ok === true ? c.color_ok : "#4a4a48") + '"></span>' +
          '<span class="dk-name">' + dEsc(d.name || "Disque") + "</span>" +
          (ok === false
            ? '<span class="badko"><ha-icon icon="mdi:alert"></ha-icon>défaillant</span>'
            : ok === true
              ? '<span class="badok"><ha-icon icon="mdi:check-circle"></ha-icon>sain</span>'
              : "") +
          (sizeSt ? '<span class="dk-size">' + dFmt(sizeSt, 0) + " " +
            dEsc(dUnit(sizeSt)) + "</span>" : "") +
        "</div>";

      if (c.show_wearout && !isNaN(wearUsed)) {
        html +=
          '<div class="w-top"><span>Usure</span><span>' + wearUsed.toFixed(0) + " %</span></div>" +
          '<div class="w-t"><div class="w-f" style="width:' +
            Math.min(Math.max(wearUsed, 0), 100).toFixed(1) +
            "%;background:" + wearCol + '"></div></div>';
      }

      const foot = [];
      if (tempSt) foot.push('<span style="color:' + this._tempColor(temp) +
        '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + dFmt(tempSt, 0) + " " +
        dEsc(dUnit(tempSt) || "°C") + "</span>");
      if (pohSt) {
        const lbl = dHours(dNum(pohSt));
        foot.push('<span><ha-icon icon="mdi:power"></ha-icon> ' +
          (lbl || dFmt(pohSt, 0) + " h") + "</span>");
      }
      if (pcSt) foot.push('<span><ha-icon icon="mdi:restart"></ha-icon> ' +
        dFmt(pcSt, 0) + " cycles</span>");
      if (foot.length) html += '<div class="dk-foot">' + foot.join("") + "</div>";

      el.innerHTML = html;
      el.addEventListener("click", () => this._more(d.health || d.wearout || d.temperature));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.disks.length * 2; }
  static getStubConfig() {
    return { type: "custom:proxmox-disks-card", title: "Disques", disks: [{ name: "Disque 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-disks-card-editor"); }
}
customElements.define("proxmox-disks-card", ProxmoxDisksCard);

/* ================= ÉDITEUR ================= */
const PD_L = {
  title: "Titre", icon: "Icône", warn_at: "Usure — seuil d'alerte (%)",
  critical_at: "Usure — seuil critique (%)", temp_warn: "Température d'alerte (°C)",
  temp_critical: "Température critique (°C)", show_wearout: "Afficher la barre d'usure",
  name: "Nom du disque", health: "Santé (S.M.A.R.T.)",
  health_invert: "Inverser la lecture de la santé", wearout: "Usure",
  wearout_mode: "Interprétation de l'usure", temperature: "Température",
  power_on_hours: "Heures de fonctionnement", power_cycles: "Cycles d'alimentation",
  size: "Taille",
};
const PD_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { type: "grid", schema: [
    { name: "temp_warn", selector: { number: { min: 20, max: 100, mode: "box" } } },
    { name: "temp_critical", selector: { number: { min: 20, max: 100, mode: "box" } } },
  ]},
  { name: "show_wearout", selector: { boolean: {} } },
];
const PD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const PD_S_DISK = [
  { name: "name", selector: { text: {} } },
  { name: "health", selector: { entity: { filter: { domain: ["binary_sensor", "sensor"] } } } },
  { name: "health_invert", selector: { boolean: {} } },
  { name: "wearout", selector: PD_SENSOR },
  { name: "wearout_mode", selector: { select: { mode: "dropdown", options: [
    { value: "used", label: "Usure consommée (0 % = neuf)" },
    { value: "remaining", label: "Vie restante (100 % = neuf)" },
  ]}}},
  { name: "temperature", selector: PD_SENSOR },
  { name: "power_on_hours", selector: PD_SENSOR },
  { name: "power_cycles", selector: PD_SENSOR },
  { name: "size", selector: PD_SENSOR },
];

class ProxmoxDisksCardEditor extends HTMLElement {
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
  _label(s) { return PD_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Disques</span></div>
        <div class="sec-hint">Le champ « Interprétation de l'usure » compte : selon le disque, Proxmox rapporte soit l'usure consommée, soit la vie restante. Si un disque récent affiche une usure énorme, bascule sur « Vie restante ».<br>Si un disque sain est marqué défaillant, coche « Inverser la lecture de la santé ».</div>
        <div class="rows-disks"></div>
        <div class="addbtn add-disk"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un disque</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = PD_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });

    r.querySelector(".add-disk").addEventListener("click", () => {
      this._config.disks = (this._config.disks || []).concat([{ name: "", wearout_mode: "used" }]);
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
      warn_at: c.warn_at || 60, critical_at: c.critical_at || 85,
      temp_warn: c.temp_warn || 50, temp_critical: c.temp_critical || 60,
      show_wearout: c.show_wearout !== false,
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-disks");
    const list = c.disks || [];
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
        ff.data = Object.assign({ wearout_mode: "used", health_invert: false }, list[i]);
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
      this._config.disks = this._config.disks.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = PD_S_DISK; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({ wearout_mode: "used", health_invert: false }, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.disks || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined) delete m[k];
        if (k === "health_invert" && m[k] === false) delete m[k];
      });
      l[index] = m; this._config.disks = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.disks || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.disks = l; this._emit(); this._update(true);
  }
}
customElements.define("proxmox-disks-card-editor", ProxmoxDisksCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxmox-disks-card",
  name: "Proxmox Disks Card",
  description: "Disques physiques : santé S.M.A.R.T., usure, température.",
});
console.info("%c PROXMOX-DISKS-CARD %c v" + PDISK_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:proxmox-disks-card
title: Disques
icon: mdi:harddisk
accent: "#7F77DD"
warn_at: 60
critical_at: 85
temp_warn: 50
temp_critical: 60
disks:
  - name: Samsung SSD 840 Series
    health: binary_sensor.disk_pve01_samsung_ssd_840_series_health
    wearout: sensor.disk_pve01_samsung_ssd_840_series_wearout
    wearout_mode: used
    temperature: sensor.disk_pve01_samsung_ssd_840_series_airflow_temperature
    power_on_hours: sensor.disk_pve01_samsung_ssd_840_series_power_on_hours
    power_cycles: sensor.disk_pve01_samsung_ssd_840_series_power_cycles
    size: sensor.disk_pve01_samsung_ssd_840_series_size
============================================================ */