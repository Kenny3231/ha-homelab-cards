/**
 * UniFi AP Card — bornes WiFi (multi-AP dans une seule carte)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/unifi-ap-card.js
 *  2. Resources → /local/perso/unifi-ap-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const UAP_VERSION = "1.1.1";

const aRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const aFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const aUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const aEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aOnline = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

class UnifiApCard extends HTMLElement {
  setConfig(config) {
    if (!config.aps || !config.aps.length) {
      throw new Error("La clé 'aps' est requise (au moins une borne).");
    }
    this._config = {
      title: config.title || "Bornes WiFi",
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
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.aps.forEach((a) => {
      ["state", "clients", "rx", "tx", "cpu", "memory", "uptime", "update"].forEach((k) => {
        if (a[k]) ids.push(a[k]);
      });
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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

    const disc = r.querySelector(".disc");
    disc.style.background = aRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;

    r.querySelector("ha-card").style.borderColor = aRgba(c.accent, 0.28);
    r.querySelector(".htitle").textContent = c.title;

    /* Total clients toutes bornes */
    let total = 0, hasTotal = false;
    c.aps.forEach((a) => {
      if (a.clients && hass.states[a.clients]) {
        const n = parseFloat(hass.states[a.clients].state);
        if (!isNaN(n)) { total += n; hasTotal = true; }
      }
    });
    r.querySelector(".hsub").textContent =
      c.aps.length + " borne" + (c.aps.length > 1 ? "s" : "") +
      (hasTotal ? " · " + total.toLocaleString("fr-FR") + " clients" : "");

    /* Lignes */
    const list = r.querySelector(".list");
    list.innerHTML = "";
    c.aps.forEach((a) => {
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
        '"></ha-icon> ' + aFmt(rxSt) + " " + aEsc(aUnit(rxSt)) + "</span>");
      if (txSt) foot.push('<span><ha-icon icon="mdi:arrow-up" style="color:' + c.color_tx +
        '"></ha-icon> ' + aFmt(txSt) + " " + aEsc(aUnit(txSt)) + "</span>");

      const sysBits = [];
      if (c.show_system && cpuSt) sysBits.push("CPU " + aFmt(cpuSt, 0) + aEsc(aUnit(cpuSt)));
      if (c.show_system && memSt) sysBits.push("RAM " + aFmt(memSt, 0) + aEsc(aUnit(memSt)));
      if (sysBits.length) foot.push('<span class="sys">' + sysBits.join(" · ") + "</span>");

      /* L'uptime a sa propre ligne : il ne doit jamais être écrasé par CPU/RAM */
      const upSt = a.uptime ? hass.states[a.uptime] : null;
      const upLine = upSt
        ? '<div class="ap-up"><ha-icon icon="mdi:clock-outline"></ha-icon>' +
          "<span>Actif depuis " + aEsc(upSt.state) + "</span></div>"
        : "";

      el.innerHTML =
        '<div class="ap-top">' +
          '<span class="dot" style="background:' + (on === false ? c.color_ko : c.color_ok) + '"></span>' +
          '<span class="ap-name">' + aEsc(a.name || (stState && stState.attributes.friendly_name) || "Borne") + "</span>" +
          (cliSt ? '<span class="ap-cli" style="color:' + c.accent + '">' + aFmt(cliSt, 0) + "</span>" +
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
  static getStubConfig() {
    return { type: "custom:unifi-ap-card", title: "Bornes WiFi", aps: [{ name: "Borne 1" }] };
  }
  static getConfigElement() { return document.createElement("unifi-ap-card-editor"); }
}
customElements.define("unifi-ap-card", UnifiApCard);

/* ================= ÉDITEUR ================= */
const UAP_L = {
  title: "Titre", icon: "Icône", show_system: "Afficher CPU / RAM",
  name: "Nom de la borne", state: "Capteur d'état", clients: "Nombre de clients",
  rx: "Réception", tx: "Émission", cpu: "Processeur", memory: "Mémoire",
  uptime: "Temps de fonctionnement", more_info: "Entité au clic (optionnel)",
};
const UAP_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "show_system", selector: { boolean: {} } },
];
const UAP_S_AP = [
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

class UnifiApCardEditor extends HTMLElement {
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
  _label(s) { return UAP_L[s.name] || s.name; }

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
        /* Les contrôles d'un même formulaire s'alignent en haut : un sélecteur
           d'entité est plus haut qu'un champ texte et décalerait ses voisins. */
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
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
          <div class="color-field"><input type="color" class="c-ok"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-ko"><label>Hors ligne</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Bornes</span></div>
        <div class="sec-hint">Une ligne par borne. Laisse un champ vide s'il n'existe pas chez toi.</div>
        <div class="rows-aps"></div>
        <div class="addbtn add-ap"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une borne</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = UAP_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
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
    if (!this._hass || !this._config) return;
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
        e.className = "empty"; e.textContent = "Aucune borne.";
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
    num.textContent = item.name ? item.name : "Borne #" + (index + 1);
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
    f.schema = UAP_S_AP; f.computeLabel = this._label; f.hass = this._hass;
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
  description: "Bornes WiFi UniFi : clients, trafic, CPU/RAM par borne.",
});
console.info("%c UNIFI-AP-CARD %c v" + UAP_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-ap-card
title: Bornes WiFi
icon: mdi:wifi
accent: "#7F77DD"
show_system: true
aps:
  - name: U7 Pro Bureau
    state: sensor.u7_pro_state
    clients: sensor.u7_pro_clients
    rx: sensor.u7_pro_bureau_reception
    tx: sensor.u7_pro_bureau_emission
    cpu: sensor.u7_pro_bureau_cpu_utilization
    memory: sensor.u7_pro_bureau_memory_utilization
    uptime: sensor.u7_pro_uptime
  - name: U7 Pro Wall Salon
    state: sensor.u7_pro_wall_state
    clients: sensor.u7_pro_wall_clients
    cpu: sensor.u7_pro_wall_salon_cpu_utilization
    memory: sensor.u7_pro_wall_salon_memory_utilization
    uptime: sensor.u7_pro_wall_uptime
============================================================ */
