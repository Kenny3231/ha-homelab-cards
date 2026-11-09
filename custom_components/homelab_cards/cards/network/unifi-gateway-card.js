/**
 * UniFi Gateway Card — custom Lovelace card (vanilla JS, zéro dépendance)
 * Version 1.0.0 — pour UCG / UDM / USG
 *
 * Installation :
 *  1. config/www/perso/unifi-gateway-card.js
 *  2. Resources → /local/perso/unifi-gateway-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 *
 * Config exemple en bas de fichier.
 */

const UGW_VERSION = "1.2.0";

/* ---------- Helpers partagés ---------- */
const uRgba = (color, a) => {
  if (!color || color.indexOf("var(") === 0 || color.indexOf("rgb") === 0) return color;
  const h = color.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const uNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const uFmt = (st, digits) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits === undefined ? 2 : digits });
};
const uUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const uEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uOnline = (st) => {
  if (!st) return false;
  const s = String(st.state).toLowerCase();
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

/* Formate une vitesse de liaison (Mbit/s) en libellé court : 2500 → "2,5G" */
function ugwLinkLabel(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "" || s === "0" || s === "none") return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return String(raw);
  if (n <= 0) return null;
  if (n >= 1000) {
    const g = n / 1000;
    return (g % 1 === 0 ? g.toFixed(0) : g.toFixed(1).replace(".", ",")) + "G";
  }
  return n.toFixed(0) + "M";
}

class UnifiGatewayCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Passerelle",
      icon: config.icon || "mdi:router-network",
      accent: config.accent || "#378ADD",
      accent_off: config.accent_off || "#E24B4A",
      state_entity: config.state_entity || null,
      clients_entity: config.clients_entity || null,
      uptime_entity: config.uptime_entity || null,
      update_entity: config.update_entity || null,
      wan: config.wan || [],
      latency: config.latency || [],
      latency_max: config.latency_max || 50,
      latency_warn: config.latency_warn || 30,
      latency_label: config.latency_label || "Latence WAN",
      columns: config.columns || 5,
      ports_label: config.ports_label || "PORTS",
      speed_colors: config.speed_colors || {},
      ports: config.ports || [],
      system: config.system || [],
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
    const c = this._config;
    const ids = [];
    [c.state_entity, c.clients_entity, c.uptime_entity, c.update_entity].forEach((x) => x && ids.push(x));
    c.wan.forEach((w) => { if (w.download) ids.push(w.download); if (w.upload) ids.push(w.upload); });
    c.latency.forEach((l) => l.entity && ids.push(l.entity));
    c.ports.forEach((p) => { ["link_speed", "rx", "tx"].forEach((k) => p[k] && ids.push(p[k])); });
    c.system.forEach((s) => s.entity && ids.push(s.entity));
    return [...new Set(ids)];
  }

  _sig(hass) {
    return this._ids().map((id) => id + ":" + (hass.states[id] ? hass.states[id].state : "∅")).join("|");
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { border-radius:14px; padding:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);
          background:var(--card-background-color,#181a1b);
          transition:border-color .3s ease, box-shadow .3s ease; }
        .header { padding:15px 15px 0 15px; display:flex; align-items:center; gap:12px; cursor:pointer; }
        .disc { width:46px; height:46px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; transition:background .3s ease; }
        .disc ha-icon { --mdc-icon-size:24px; transition:color .3s ease; }
        .htext { flex:1; min-width:0; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .hsub b { font-weight:600; }
        .badge { padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600; flex-shrink:0; }
        .subline { padding:8px 15px 0 15px; display:flex; align-items:center; gap:6px;
          font-size:10.5px; color:var(--disabled-text-color); cursor:pointer; }
        .subline ha-icon { --mdc-icon-size:12px; }
        .wan { padding:14px 15px 10px 15px; display:grid; gap:9px; }
        .wanbox { background:rgba(255,255,255,0.035); border-radius:10px; padding:10px 12px; cursor:pointer;
          transition:background .2s ease; }
        .wanbox:hover { background:rgba(255,255,255,0.07); }
        .wanhead { display:flex; align-items:center; gap:5px; margin-bottom:6px; }
        .wanhead ha-icon { --mdc-icon-size:13px; }
        .wanhead span { font-size:10px; color:var(--secondary-text-color); }
        .wanval { font-size:19px; font-weight:700; color:var(--primary-text-color); letter-spacing:-.3px; }
        .wanval em { font-size:10px; font-weight:500; font-style:normal;
          color:var(--secondary-text-color); margin-left:2px; }
        .ports { padding:0 15px 12px 15px; display:grid; gap:6px; }
        .port { border-radius:8px; padding:9px 3px; text-align:center; cursor:pointer;
          transition:transform .1s ease, background .2s ease; }
        .port:active { transform:scale(.95); }
        .port .pn { font-size:9px; color:var(--disabled-text-color); }
        .port ha-icon { --mdc-icon-size:15px; margin:3px 0; display:block; }
        .port .ps { font-size:9.5px; font-weight:600; }
        .sect { padding:0 15px 12px 15px; }
        .sect-lbl { font-size:10px; color:var(--disabled-text-color); margin-bottom:7px; letter-spacing:.3px; }
        .lat { display:flex; align-items:center; gap:9px; margin-bottom:6px; cursor:pointer; }
        .lat-n { font-size:10.5px; color:var(--secondary-text-color); width:68px; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .lat-t { flex:1; height:5px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .lat-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .lat-v { font-size:11px; font-weight:600; color:var(--primary-text-color);
          width:48px; text-align:right; flex-shrink:0; }
        .sys { padding:0 15px 14px 15px; display:flex; gap:7px; }
        .sysbox { flex:1; background:rgba(255,255,255,0.035); border-radius:9px; padding:8px 6px;
          text-align:center; cursor:pointer; transition:background .2s ease; }
        .sysbox:hover { background:rgba(255,255,255,0.07); }
        .sysbox .v { font-size:15px; font-weight:700; }
        .sysbox .n { font-size:9.5px; color:var(--disabled-text-color); margin-top:2px; }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div class="htext"><div class="htitle"></div><div class="hsub"></div></div>
          <div class="badge hidden"></div>
        </div>
        <div class="subline hidden"><ha-icon icon="mdi:clock-outline"></ha-icon><span></span></div>
        <div class="wan hidden"></div>
        <div class="sect ports-sect hidden"><div class="sect-lbl"></div></div>
        <div class="ports hidden"></div>
        <div class="sect lat-sect hidden"><div class="sect-lbl"></div><div class="lat-body"></div></div>
        <div class="sys hidden"></div>
      </ha-card>`;
    this.shadowRoot.querySelector(".header").addEventListener("click", () => {
      this._more(this._config.state_entity || this._config.clients_entity);
    });
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const stateSt = c.state_entity ? hass.states[c.state_entity] : null;
    const online = c.state_entity ? uOnline(stateSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = uRgba(accent, 0.3);
    card.style.boxShadow = "0 0 24px " + uRgba(accent, 0.1);

    const disc = r.querySelector(".disc");
    disc.style.background = uRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    /* Sous-titre : état · uptime · clients */
    const bits = [];
    if (stateSt) bits.push('<b style="color:' + accent + '">' + uEsc(stateSt.state) + "</b>");
    else bits.push('<b style="color:' + accent + '">' + (online ? "En ligne" : "Hors ligne") + "</b>");
    if (c.clients_entity && hass.states[c.clients_entity]) {
      bits.push(uFmt(hass.states[c.clients_entity], 0) + " clients");
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    /* Uptime sur sa propre ligne */
    const sub = r.querySelector(".subline");
    const upSt = c.uptime_entity ? hass.states[c.uptime_entity] : null;
    if (upSt) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Actif depuis " + upSt.state;
      sub.onclick = () => this._more(c.uptime_entity);
    } else sub.classList.add("hidden");

    /* Badge firmware */
    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ dispo" : "À jour";
      badge.style.background = uRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* WAN */
    const wanEl = r.querySelector(".wan");
    const wanBoxes = [];
    c.wan.forEach((w) => {
      if (w.download) wanBoxes.push({ e: w.download, n: (w.name || "WAN") + " ↓", i: "mdi:arrow-down", col: c.accent });
      if (w.upload) wanBoxes.push({ e: w.upload, n: (w.name || "WAN") + " ↑", i: "mdi:arrow-up", col: "#1D9E75" });
    });
    if (wanBoxes.length) {
      wanEl.classList.remove("hidden");
      wanEl.style.gridTemplateColumns = "repeat(" + Math.min(wanBoxes.length, 2) + ",1fr)";
      wanEl.innerHTML = "";
      wanBoxes.forEach((b) => {
        const st = hass.states[b.e];
        const d = document.createElement("div");
        d.className = "wanbox";
        d.innerHTML =
          '<div class="wanhead"><ha-icon icon="' + b.i + '" style="color:' + b.col + '"></ha-icon>' +
          "<span>" + uEsc(b.n) + "</span></div>" +
          '<div class="wanval">' + uFmt(st) + (uUnit(st) ? "<em>" + uEsc(uUnit(st)) + "</em>" : "") + "</div>";
        d.addEventListener("click", () => this._more(b.e));
        wanEl.appendChild(d);
      });
    } else wanEl.classList.add("hidden");

    /* Ports */
    const portsSect = r.querySelector(".ports-sect");
    const grid = r.querySelector(".ports");
    if (c.ports.length) {
      portsSect.classList.remove("hidden");
      grid.classList.remove("hidden");
      grid.style.gridTemplateColumns = "repeat(" + c.columns + ",1fr)";
      grid.innerHTML = "";

      let activePorts = 0;
      const portData = c.ports.map((p) => {
        const lsSt = p.link_speed ? hass.states[p.link_speed] : null;
        const label = lsSt ? ugwLinkLabel(lsSt.state) : null;
        const mbits = lsSt ? parseFloat(lsSt.state) : NaN;
        const up = label !== null;
        if (up) activePorts++;
        return { p: p, label: label, up: up,
                 color: up ? this._portColor(isNaN(mbits) ? 1000 : mbits) : null };
      });

      portsSect.querySelector(".sect-lbl").textContent =
        (c.ports_label || "PORTS") + " · " + activePorts + "/" + c.ports.length + " actifs";

      portData.forEach((d, i) => {
        const el = document.createElement("div");
        el.className = "port";
        const col = d.color || "#4a4a48";
        el.style.background = d.up ? uRgba(col, 0.1) : "rgba(255,255,255,0.03)";
        el.style.border = "1px solid " + (d.up ? uRgba(col, 0.25) : "rgba(255,255,255,0.06)");

        const tips = [];
        if (d.p.rx && hass.states[d.p.rx]) {
          tips.push("↓ " + uFmt(hass.states[d.p.rx]) + " " + uUnit(hass.states[d.p.rx]));
        }
        if (d.p.tx && hass.states[d.p.tx]) {
          tips.push("↑ " + uFmt(hass.states[d.p.tx]) + " " + uUnit(hass.states[d.p.tx]));
        }
        el.title = (d.p.name || "Port " + (i + 1)) + (tips.length ? "\n" + tips.join("\n") : "");

        el.innerHTML =
          '<div class="pn">' + uEsc(d.p.name || "P" + (i + 1)) + "</div>" +
          '<ha-icon icon="' + (d.up ? "mdi:lan-connect" : "mdi:lan-disconnect") +
            '" style="color:' + col + '"></ha-icon>' +
          '<div class="ps" style="color:' + col + '">' + (d.label || "—") + "</div>";
        el.addEventListener("click", () => this._more(d.p.link_speed || d.p.rx || d.p.tx));
        grid.appendChild(el);
      });
    } else {
      portsSect.classList.add("hidden");
      grid.classList.add("hidden");
    }

    /* Latences */
    const latSect = r.querySelector(".lat-sect");
    if (c.latency.length) {
      latSect.classList.remove("hidden");
      latSect.querySelector(".sect-lbl").textContent = c.latency_label;
      const body = r.querySelector(".lat-body");
      body.innerHTML = "";
      c.latency.forEach((l) => {
        const st = hass.states[l.entity];
        const v = uNum(st);
        const pct = isNaN(v) ? 0 : Math.min((v / c.latency_max) * 100, 100);
        const col = isNaN(v) ? "#4a4a48" : v >= c.latency_warn ? "#BA7517" : "#1D9E75";
        const d = document.createElement("div");
        d.className = "lat";
        d.innerHTML =
          '<span class="lat-n">' + uEsc(l.name || (st && st.attributes.friendly_name) || l.entity) + "</span>" +
          '<span class="lat-t"><span class="lat-f" style="display:block;width:' + pct.toFixed(1) +
            "%;background:" + col + '"></span></span>' +
          '<span class="lat-v">' + (isNaN(v) ? "—" : uFmt(st, 0) + " " + (uUnit(st) || "ms")) + "</span>";
        d.addEventListener("click", () => this._more(l.entity));
        body.appendChild(d);
      });
    } else latSect.classList.add("hidden");

    /* Système */
    const sys = r.querySelector(".sys");
    if (c.system.length) {
      sys.classList.remove("hidden");
      sys.innerHTML = "";
      c.system.forEach((s) => {
        const st = hass.states[s.entity];
        const d = document.createElement("div");
        d.className = "sysbox";
        d.innerHTML =
          '<div class="v" style="color:' + (s.color || "var(--primary-text-color)") + '">' +
            uFmt(st, s.digits === undefined ? 0 : s.digits) + uEsc(uUnit(st)) + "</div>" +
          '<div class="n">' + uEsc(s.name || (st && st.attributes.friendly_name) || s.entity) + "</div>";
        d.addEventListener("click", () => this._more(s.entity));
        sys.appendChild(d);
      });
    } else sys.classList.add("hidden");
  }

  /* Couleur d'un port selon sa vitesse de liaison */
  _portColor(mbits) {
    const custom = this._config.speed_colors;
    if (mbits === null) return null;
    if (custom[String(mbits)]) return custom[String(mbits)];
    if (mbits >= 10000) return "#BA7517";
    if (mbits >= 2500) return "#1D9E75";
    if (mbits >= 1000) return "#378ADD";
    return "#7F77DD";
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    return 2 + (c.wan.length ? 2 : 0) +
      (c.ports.length ? Math.ceil(c.ports.length / c.columns) + 1 : 0) +
      (c.latency.length ? 2 : 0) + (c.system.length ? 1 : 0);
  }

  static getStubConfig() {
    return { type: "custom:unifi-gateway-card", title: "Passerelle" };
  }
  static getConfigElement() {
    return document.createElement("unifi-gateway-card-editor");
  }
}
customElements.define("unifi-gateway-card", UnifiGatewayCard);

/* ================= ÉDITEUR ================= */
const UGW_L = {
  title: "Titre", icon: "Icône", state_entity: "Capteur d'état",
  clients_entity: "Nombre de clients", uptime_entity: "Temps de fonctionnement",
  update_entity: "Entité de mise à jour", latency_label: "Titre de la section latence",
  latency_max: "Latence max de l'échelle (ms)", latency_warn: "Seuil d'alerte (ms)",
  name: "Nom affiché", download: "Descendant (download)", upload: "Montant (upload)",
  entity: "Entité", digits: "Décimales",
  columns: "Colonnes dans la grille", ports_label: "Titre de la section ports",
  link_speed: "Vitesse de liaison", rx: "Réception", tx: "Émission",
};

const UGW_S_GENERAL = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "state_entity", selector: { entity: { filter: { domain: ["sensor", "binary_sensor", "device_tracker"] } } } },
    { name: "clients_entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "uptime_entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "update_entity", selector: { entity: { filter: { domain: ["update"] } } } },
  ]},
];
const UGW_S_LATOPT = [
  { name: "latency_label", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "latency_max", selector: { number: { min: 5, max: 500, mode: "box" } } },
    { name: "latency_warn", selector: { number: { min: 1, max: 500, mode: "box" } } },
  ]},
];
const UGW_S_WAN = [
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "download", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "upload", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const UGW_S_LAT = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { name: "name", selector: { text: {} } },
];
const UGW_S_PORTOPT = [
  { type: "grid", schema: [
    { name: "ports_label", selector: { text: {} } },
    { name: "columns", selector: { number: { min: 2, max: 12, mode: "box" } } },
  ]},
];
const UGW_S_PORT = [
  { name: "name", selector: { text: {} } },
  { name: "link_speed", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const UGW_S_SYS = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { name: "name", selector: { text: {} } },
  { name: "digits", selector: { number: { min: 0, max: 3, mode: "box" } } },
];

class UnifiGatewayCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    const first = !this._hass;
    this._hass = h;
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
  _label(s) { return UGW_L[s.name] || s.name; }

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
          <div class="color-field"><input type="color" class="c-on"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Hors ligne</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Liens WAN</span></div>
        <div class="sec-hint">Un bloc par lien (fibre, 4G…). Descendant et montant s'affichent côte à côte.</div>
        <div class="rows-wan"></div>
        <div class="addbtn add-wan"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un lien WAN</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Ports</span></div>
        <div class="sec-hint">Grille colorée par vitesse : 10G ambre, 2.5G vert, 1G bleu, en dessous violet. Un port sans vitesse de liaison s'affiche déconnecté. Survole un port pour voir son trafic.</div>
        <ha-form class="f-portopt"></ha-form>
        <div class="rows-ports"></div>
        <div class="addbtn add-port"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un port</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Latences</span></div>
        <div class="sec-hint">Barres comparatives. L'échelle commune rend la comparaison honnête.</div>
        <ha-form class="f-latopt"></ha-form>
        <div class="rows-lat"></div>
        <div class="addbtn add-lat"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une latence</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Système</span></div>
        <div class="sec-hint">CPU, mémoire, température… Rangée du bas.</div>
        <div class="rows-sys"></div>
        <div class="addbtn add-sys"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une mesure</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", UGW_S_GENERAL, (v) => { Object.assign(this._config, v); this._clean(); });
    wire(".f-latopt", UGW_S_LATOPT, (v) => { Object.assign(this._config, v); });
    wire(".f-portopt", UGW_S_PORTOPT, (v) => { Object.assign(this._config, v); });

    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-on", "accent");
    bindColor(".c-off", "accent_off");

    const add = (cls, key, item) => r.querySelector(cls).addEventListener("click", () => {
      this._config[key] = (this._config[key] || []).concat([item]);
      this._emit(); this._update(true);
    });
    add(".add-wan", "wan", { name: "" });
    r.querySelector(".add-port").addEventListener("click", () => {
      const n = (this._config.ports || []).length + 1;
      this._config.ports = (this._config.ports || []).concat([{ name: "P" + n }]);
      this._emit(); this._update(true);
    });
    add(".add-lat", "latency", { entity: "", name: "" });
    add(".add-sys", "system", { entity: "", name: "" });
  }

  _clean() {
    ["title", "state_entity", "clients_entity", "uptime_entity", "update_entity"].forEach((k) => {
      if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "", icon: c.icon || "mdi:router-network",
      state_entity: c.state_entity || "", clients_entity: c.clients_entity || "",
      uptime_entity: c.uptime_entity || "", update_entity: c.update_entity || "",
    };
    const fl = r.querySelector(".f-latopt");
    fl.hass = this._hass;
    fl.data = {
      latency_label: c.latency_label || "Latence WAN",
      latency_max: c.latency_max || 50, latency_warn: c.latency_warn || 30,
    };
    const fp = r.querySelector(".f-portopt");
    fp.hass = this._hass;
    fp.data = { ports_label: c.ports_label || "PORTS", columns: c.columns || 5 };
    this._setColor(".c-on", c.accent || "#378ADD");
    this._setColor(".c-off", c.accent_off || "#E24B4A");
    this._rows("wan", ".rows-wan", UGW_S_WAN, force);
    this._rows("ports", ".rows-ports", UGW_S_PORT, force);
    this._rows("latency", ".rows-lat", UGW_S_LAT, force);
    this._rows("system", ".rows-sys", UGW_S_SYS, force);
  }

  _rows(key, sel, schema, force) {
    const box = this.shadowRoot.querySelector(sel);
    const list = this._config[key] || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun élément.";
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(key, schema, it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        const f = row.querySelector("ha-form");
        f.hass = this._hass; f.data = Object.assign({}, list[i]);
      });
    }
  }

  _row(key, schema, item, index, total) {
    const row = document.createElement("div");
    row.className = "row";
    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = key === "ports" ? (item.name || "Port #" + (index + 1)) : "#" + (index + 1);
    head.appendChild(num);
    const mk = (icon, cls, fn, dis) => {
      const b = document.createElement("ha-icon-button");
      b.className = "iconbtn " + cls; b.disabled = !!dis;
      const i = document.createElement("ha-icon"); i.setAttribute("icon", icon);
      b.appendChild(i); b.addEventListener("click", fn); return b;
    };
    head.appendChild(mk("mdi:arrow-up", "up", () => this._move(key, index, -1), index === 0));
    head.appendChild(mk("mdi:arrow-down", "down", () => this._move(key, index, 1), index === total - 1));
    head.appendChild(mk("mdi:delete-outline", "del", () => {
      this._config[key] = this._config[key].filter((_, i) => i !== index);
      if (!this._config[key].length) delete this._config[key];
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = schema; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const list = (this._config[key] || []).slice();
      const m = Object.assign({}, list[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (list[index] && list[index].color) m.color = list[index].color;
      list[index] = m; this._config[key] = list; this._emit();
    });
    row.appendChild(f);

    if (key === "system") {
      const cf = document.createElement("div");
      cf.className = "color-field"; cf.style.marginTop = "8px";
      const ci = document.createElement("input");
      ci.type = "color"; ci.value = item.color || "#378ADD";
      const apply = (v) => {
        const list = (this._config[key] || []).slice();
        list[index] = Object.assign({}, list[index], { color: v });
        this._config[key] = list; this._emit();
      };
      let t = null;
      ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
      const cl = document.createElement("label"); cl.textContent = "Couleur";
      cf.appendChild(ci); cf.appendChild(cl); row.appendChild(cf);
    }
    return row;
  }

  _move(key, i, d) {
    const l = (this._config[key] || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config[key] = l; this._emit(); this._update(true);
  }
}
customElements.define("unifi-gateway-card-editor", UnifiGatewayCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-gateway-card",
  name: "UniFi Gateway Card",
  description: "Passerelle UniFi : WAN, latences, CPU/RAM/température.",
});
console.info("%c UNIFI-GATEWAY-CARD %c v" + UGW_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-gateway-card
title: UCG Max
icon: mdi:router-network
state_entity: sensor.ucg_max_state
clients_entity: sensor.ucg_max_clients
uptime_entity: sensor.ucg_max_uptime
update_entity: update.ucg_max
wan:
  - name: WAN Fibre
    download: sensor.REMPLACE_debit_descendant
    upload: sensor.REMPLACE_debit_montant
latency_label: Latence WAN
latency_max: 50
latency_warn: 30
latency:
  - entity: sensor.ucg_max_cloudflare_wan_latency
    name: Cloudflare
  - entity: sensor.ucg_max_google_wan_latency
    name: Google
  - entity: sensor.ucg_max_microsoft_wan_latency
    name: Microsoft
ports_label: PORTS
columns: 5
ports:
  - name: P1
    link_speed: sensor.ucg_max_port_1_link_speed
    rx: sensor.ucg_max_port_1_rx
    tx: sensor.ucg_max_port_1_tx
  - name: P2
    link_speed: sensor.ucg_max_port_2_link_speed
    rx: sensor.ucg_max_port_2_rx
    tx: sensor.ucg_max_port_2_tx
  - name: P3
    link_speed: sensor.ucg_max_port_3_link_speed
    rx: sensor.ucg_max_port_3_rx
    tx: sensor.ucg_max_port_3_tx
  - name: P4
    link_speed: sensor.ucg_max_port_4_link_speed
    rx: sensor.ucg_max_port_4_rx
    tx: sensor.ucg_max_port_4_tx
  - name: P5
    link_speed: sensor.ucg_max_port_5_link_speed
    rx: sensor.ucg_max_port_5_rx
    tx: sensor.ucg_max_port_5_tx
system:
  - entity: sensor.ucg_max_cpu_utilization
    name: CPU
    color: "#378ADD"
  - entity: sensor.ucg_max_memory_utilization
    name: RAM
    color: "#7F77DD"
  - entity: sensor.ucg_max_cpu_temperature
    name: Temp
    color: "#BA7517"
============================================================ */