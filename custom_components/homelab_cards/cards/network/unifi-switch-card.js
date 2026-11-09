/**
 * UniFi Switch Card — grille de ports avec vitesse de lien
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/unifi-switch-card.js
 *  2. Resources → /local/perso/unifi-switch-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const USW_VERSION = "1.1.1";

const sRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const sFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const sUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const sEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sOnline = (st) => {
  if (!st) return true;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

/* Formate une vitesse de lien en Mbit/s vers un libellé court */
function linkLabel(raw) {
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

class UnifiSwitchCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Switch",
      icon: config.icon || "mdi:switch",
      accent: config.accent || "#1D9E75",
      accent_off: config.accent_off || "#E24B4A",
      state_entity: config.state_entity || null,
      clients_entity: config.clients_entity || null,
      uptime_entity: config.uptime_entity || null,
      update_entity: config.update_entity || null,
      columns: config.columns || 5,
      speed_colors: config.speed_colors || {},
      ports: config.ports || [],
      totals: config.totals || [],
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
    const c = this._config, ids = [];
    [c.state_entity, c.clients_entity, c.uptime_entity, c.update_entity].forEach((x) => x && ids.push(x));
    c.ports.forEach((p) => { ["link_speed", "rx", "tx"].forEach((k) => p[k] && ids.push(p[k])); });
    c.totals.forEach((t) => t.entity && ids.push(t.entity));
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Couleur d'un port selon sa vitesse */
  _portColor(mbits) {
    const custom = this._config.speed_colors;
    if (mbits === null) return null;
    if (custom[String(mbits)]) return custom[String(mbits)];
    if (mbits >= 10000) return "#BA7517";
    if (mbits >= 2500) return "#1D9E75";
    if (mbits >= 1000) return "#378ADD";
    return "#7F77DD";
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { border-radius:14px; padding:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);
          background:var(--card-background-color,#181a1b);
          transition:border-color .3s ease, box-shadow .3s ease; }
        .header { padding:15px 15px 12px 15px; display:flex; align-items:center; gap:12px; cursor:pointer; }
        .disc { width:42px; height:42px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; }
        .disc ha-icon { --mdc-icon-size:22px; }
        .htext { flex:1; min-width:0; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .hsub b { font-weight:600; }
        .subline { padding:0 15px 10px 15px; display:flex; align-items:center; gap:6px;
          font-size:10.5px; color:var(--disabled-text-color); }
        .subline ha-icon { --mdc-icon-size:12px; }
        .badge { padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600; flex-shrink:0; }
        .ports { padding:0 15px 12px 15px; display:grid; gap:6px; }
        .port { border-radius:8px; padding:9px 3px; text-align:center; cursor:pointer;
          transition:transform .1s ease, background .2s ease; }
        .port:active { transform:scale(.95); }
        .port .pn { font-size:9px; color:var(--disabled-text-color); }
        .port ha-icon { --mdc-icon-size:15px; margin:3px 0; display:block; }
        .port .ps { font-size:9.5px; font-weight:600; }
        .totals { padding:0 15px 14px 15px; display:flex; gap:7px; }
        .tot { flex:1; background:rgba(255,255,255,0.035); border-radius:9px; padding:8px 6px;
          text-align:center; cursor:pointer; transition:background .2s ease; }
        .tot:hover { background:rgba(255,255,255,0.07); }
        .tot .v { font-size:14px; font-weight:700; }
        .tot .n { font-size:9.5px; color:var(--disabled-text-color); margin-top:2px; }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div class="htext"><div class="htitle"></div><div class="hsub"></div></div>
          <div class="badge hidden"></div>
        </div>
        <div class="subline hidden"><ha-icon icon="mdi:clock-outline"></ha-icon><span></span></div>
        <div class="ports hidden"></div>
        <div class="totals hidden"></div>
      </ha-card>`;
    this.shadowRoot.querySelector(".header").addEventListener("click", () => {
      this._more(this._config.state_entity || this._config.clients_entity);
    });
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const stateSt = c.state_entity ? hass.states[c.state_entity] : null;
    const online = c.state_entity ? sOnline(stateSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = sRgba(accent, 0.28);
    card.style.boxShadow = "0 0 24px " + sRgba(accent, 0.09);

    const disc = r.querySelector(".disc");
    disc.style.background = sRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    /* Ports actifs = ceux avec une vitesse de lien exploitable */
    let active = 0;
    const portData = c.ports.map((p) => {
      const lsSt = p.link_speed ? hass.states[p.link_speed] : null;
      const label = lsSt ? linkLabel(lsSt.state) : null;
      const mbits = lsSt ? parseFloat(lsSt.state) : NaN;
      const up = label !== null;
      if (up) active++;
      return { p: p, label: label, color: up ? this._portColor(isNaN(mbits) ? 1000 : mbits) : null, up: up };
    });

    const bits = [];
    bits.push('<b style="color:' + accent + '">' +
      sEsc(stateSt ? stateSt.state : online ? "En ligne" : "Hors ligne") + "</b>");
    if (c.ports.length) bits.push(active + "/" + c.ports.length + " ports actifs");
    if (c.clients_entity && hass.states[c.clients_entity]) {
      bits.push(sFmt(hass.states[c.clients_entity], 0) + " clients");
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    /* L'uptime a sa propre ligne : il ne doit jamais être tronqué */
    const sub = r.querySelector(".subline");
    const upSt = c.uptime_entity ? hass.states[c.uptime_entity] : null;
    if (upSt) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Actif depuis " + upSt.state;
      sub.onclick = () => this._more(c.uptime_entity);
      sub.style.cursor = "pointer";
    } else sub.classList.add("hidden");

    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ dispo" : "À jour";
      badge.style.background = sRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* Grille de ports */
    const grid = r.querySelector(".ports");
    if (portData.length) {
      grid.classList.remove("hidden");
      grid.style.gridTemplateColumns = "repeat(" + c.columns + ",1fr)";
      grid.innerHTML = "";
      portData.forEach((d, i) => {
        const el = document.createElement("div");
        el.className = "port";
        const col = d.color || "#4a4a48";
        el.style.background = d.up ? sRgba(col, 0.1) : "rgba(255,255,255,0.03)";
        el.style.border = "1px solid " + (d.up ? sRgba(col, 0.25) : "rgba(255,255,255,0.06)");

        /* Info-bulle : trafic du port */
        const tips = [];
        if (d.p.rx && hass.states[d.p.rx]) {
          tips.push("↓ " + sFmt(hass.states[d.p.rx]) + " " + sUnit(hass.states[d.p.rx]));
        }
        if (d.p.tx && hass.states[d.p.tx]) {
          tips.push("↑ " + sFmt(hass.states[d.p.tx]) + " " + sUnit(hass.states[d.p.tx]));
        }
        el.title = (d.p.name || "Port " + (i + 1)) + (tips.length ? "\n" + tips.join("\n") : "");

        el.innerHTML =
          '<div class="pn">' + sEsc(d.p.name || "P" + (i + 1)) + "</div>" +
          '<ha-icon icon="' + (d.up ? "mdi:lan-connect" : "mdi:lan-disconnect") +
            '" style="color:' + col + '"></ha-icon>' +
          '<div class="ps" style="color:' + col + '">' + (d.label || "—") + "</div>";
        el.addEventListener("click", () => this._more(d.p.link_speed || d.p.rx || d.p.tx));
        grid.appendChild(el);
      });
    } else grid.classList.add("hidden");

    /* Totaux */
    const tot = r.querySelector(".totals");
    if (c.totals.length) {
      tot.classList.remove("hidden");
      tot.innerHTML = "";
      c.totals.forEach((t) => {
        const st = hass.states[t.entity];
        const el = document.createElement("div");
        el.className = "tot";
        el.innerHTML =
          '<div class="v" style="color:' + (t.color || "var(--primary-text-color)") + '">' +
            sFmt(st, t.digits === undefined ? 1 : t.digits) +
            (sUnit(st) ? " " + sEsc(sUnit(st)) : "") + "</div>" +
          '<div class="n">' + sEsc(t.name || (st && st.attributes.friendly_name) || t.entity) + "</div>";
        el.addEventListener("click", () => this._more(t.entity));
        tot.appendChild(el);
      });
    } else tot.classList.add("hidden");
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    return 2 + (c.ports.length ? Math.ceil(c.ports.length / c.columns) + 1 : 0) + (c.totals.length ? 1 : 0);
  }
  static getStubConfig() { return { type: "custom:unifi-switch-card", title: "Switch" }; }
  static getConfigElement() { return document.createElement("unifi-switch-card-editor"); }
}
customElements.define("unifi-switch-card", UnifiSwitchCard);

/* ================= ÉDITEUR ================= */
const USW_L = {
  title: "Titre", icon: "Icône", state_entity: "Capteur d'état",
  clients_entity: "Nombre de clients", uptime_entity: "Temps de fonctionnement",
  update_entity: "Entité de mise à jour", columns: "Colonnes dans la grille",
  name: "Nom du port", link_speed: "Vitesse de liaison", rx: "Réception", tx: "Émission",
  entity: "Entité", digits: "Décimales",
};
const USW_S_GEN = [
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
  { name: "columns", selector: { number: { min: 2, max: 12, mode: "box" } } },
];
const USW_S_PORT = [
  { name: "name", selector: { text: {} } },
  { name: "link_speed", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const USW_S_TOT = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { name: "name", selector: { text: {} } },
  { name: "digits", selector: { number: { min: 0, max: 3, mode: "box" } } },
];

class UnifiSwitchCardEditor extends HTMLElement {
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
  _label(s) { return USW_L[s.name] || s.name; }

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
        </div>
        <div class="sec-hint">Les ports se colorent automatiquement selon leur vitesse : 10G ambre, 2.5G vert, 1G bleu, en dessous violet.</div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Ports</span></div>
        <div class="sec-hint">Un port sans vitesse de liaison s'affiche déconnecté. Survole un port pour voir son trafic.</div>
        <div class="rows-ports"></div>
        <div class="addbtn add-port"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un port</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Totaux</span></div>
        <div class="sec-hint">Rangée du bas : trafic global, CPU, mémoire…</div>
        <div class="rows-tot"></div>
        <div class="addbtn add-tot"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un total</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = USW_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      ["title", "state_entity", "clients_entity", "uptime_entity", "update_entity"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-on", "accent");
    bindColor(".c-off", "accent_off");
    r.querySelector(".add-port").addEventListener("click", () => {
      const n = (this._config.ports || []).length + 1;
      this._config.ports = (this._config.ports || []).concat([{ name: "P" + n }]);
      this._emit(); this._update(true);
    });
    r.querySelector(".add-tot").addEventListener("click", () => {
      this._config.totals = (this._config.totals || []).concat([{ entity: "", name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:switch",
      state_entity: c.state_entity || "", clients_entity: c.clients_entity || "",
      uptime_entity: c.uptime_entity || "", update_entity: c.update_entity || "",
      columns: c.columns || 5,
    };
    this._setColor(".c-on", c.accent || "#1D9E75");
    this._setColor(".c-off", c.accent_off || "#E24B4A");
    this._rows("ports", ".rows-ports", USW_S_PORT, force);
    this._rows("totals", ".rows-tot", USW_S_TOT, force);
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
        const ff = row.querySelector("ha-form");
        ff.hass = this._hass; ff.data = Object.assign({}, list[i]);
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
    num.textContent = item.name || (key === "ports" ? "Port #" : "#") + (index + 1);
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
      const l = (this._config[key] || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config[key] = l; this._emit();
    });
    row.appendChild(f);

    if (key === "totals") {
      const cf = document.createElement("div");
      cf.className = "color-field"; cf.style.marginTop = "8px";
      const ci = document.createElement("input");
      ci.type = "color"; ci.value = item.color || "#378ADD";
      const apply = (v) => {
        const l = (this._config[key] || []).slice();
        l[index] = Object.assign({}, l[index], { color: v });
        this._config[key] = l; this._emit();
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
customElements.define("unifi-switch-card-editor", UnifiSwitchCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-switch-card",
  name: "UniFi Switch Card",
  description: "Switch UniFi : grille de ports colorée par vitesse de lien.",
});
console.info("%c UNIFI-SWITCH-CARD %c v" + USW_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-switch-card
title: USW Flex 2.5G Bureau
icon: mdi:switch
state_entity: sensor.usw_flex_2_5g_bureau_state
clients_entity: sensor.usw_flex_2_5g_bureau_clients
uptime_entity: sensor.usw_flex_2_5g_bureau_uptime
update_entity: update.usw_flex_2_5g_bureau
columns: 5
ports:
  - name: P1
    rx: sensor.usw_flex_2_5g_bureau_port_1_rx
    tx: sensor.usw_flex_2_5g_bureau_port_1_tx
  - name: P2
    link_speed: sensor.usw_flex_2_5g_bureau_port_2_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_2_rx
    tx: sensor.usw_flex_2_5g_bureau_port_2_tx
  - name: P3
    link_speed: sensor.usw_flex_2_5g_bureau_port_3_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_3_rx
    tx: sensor.usw_flex_2_5g_bureau_port_3_tx
  - name: P4
    link_speed: sensor.usw_flex_2_5g_bureau_port_4_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_4_rx
    tx: sensor.usw_flex_2_5g_bureau_port_4_tx
  - name: P5
    link_speed: sensor.usw_flex_2_5g_bureau_port_5_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_5_rx
    tx: sensor.usw_flex_2_5g_bureau_port_5_tx
totals:
  - entity: sensor.usw_flex_2_5g_bureau_cpu_utilization
    name: CPU
    color: "#378ADD"
    digits: 0
  - entity: sensor.usw_flex_2_5g_bureau_memory_utilization
    name: RAM
    color: "#7F77DD"
    digits: 0
============================================================ */
