/**
 * Proxmox Guests Card — VM (QEMU) et conteneurs (LXC)
 * Version 1.0.0
 *
 * Une seule carte pour les deux : instancie-la deux fois si tu veux
 * un bloc « Machines virtuelles » et un bloc « Conteneurs ».
 *
 * Les boutons s'adaptent à l'état : un invité arrêté propose « Démarrer »,
 * un invité en marche propose « Éteindre / Forcer l'arrêt / Redémarrer ».
 *
 * Installation :
 *  1. config/www/perso/proxmox-guests-card.js
 *  2. Resources → /local/perso/proxmox-guests-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PGUEST_VERSION = "1.0.0";

const gRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const gNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const gFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const gUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const gEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gOn = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "running" || s === "online";
};
function gSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) { const y = Math.floor(d / 365); return y + " an" + (y > 1 ? "s" : ""); }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " j";
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

/* Catalogue des actions : icône, couleur, libellé, et si elles sont à risque */
const G_ACTIONS = {
  start:     { icon: "mdi:play",           color: "#1D9E75", label: "Démarrer",       risky: false, when: "off" },
  resume:    { icon: "mdi:play-pause",     color: "#1D9E75", label: "Reprendre",      risky: false, when: "off" },
  shutdown:  { icon: "mdi:power",          color: "#BA7517", label: "Éteindre",       risky: true,  when: "on" },
  stop:      { icon: "mdi:stop",           color: "#E24B4A", label: "Forcer l'arrêt", risky: true,  when: "on" },
  reboot:    { icon: "mdi:restart",        color: "#378ADD", label: "Redémarrer",     risky: true,  when: "on" },
  reset:     { icon: "mdi:restart-alert",  color: "#E24B4A", label: "Réinitialiser",  risky: true,  when: "on" },
  suspend:   { icon: "mdi:pause",          color: "#7F77DD", label: "Suspendre",      risky: true,  when: "on" },
  hibernate: { icon: "mdi:snowflake",      color: "#7F77DD", label: "Hiberner",       risky: true,  when: "on" },
};
const G_ORDER = ["start", "resume", "shutdown", "stop", "reboot", "reset", "suspend", "hibernate"];

class ProxmoxGuestsCard extends HTMLElement {
  setConfig(config) {
    if (!config.guests || !config.guests.length) {
      throw new Error("La clé 'guests' est requise (au moins un invité).");
    }
    this._config = {
      title: config.title || "Invités",
      icon: config.icon || "mdi:server",
      accent: config.accent || "#378ADD",
      color_on: config.color_on || "#1D9E75",
      color_off: config.color_off || "#4a4a48",
      color_cpu: config.color_cpu || "#378ADD",
      color_mem: config.color_mem || "#7F77DD",
      color_disk: config.color_disk || "#1D9E75",
      warn_at: config.warn_at || 80,
      critical_at: config.critical_at || 92,
      show_bars: config.show_bars !== false,
      show_network: config.show_network !== false,
      show_uptime: config.show_uptime !== false,
      confirm_actions: config.confirm_actions ||
        ["stop", "shutdown", "reboot", "reset", "suspend", "hibernate"],
      guests: config.guests,
    };
    this._built = false;
    this._pending = {};
  }

  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._built && this._hass && this._config.show_uptime) this._render();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.guests.forEach((g) => {
      ["status", "status_text", "health", "cpu", "memory", "disk",
       "network_in", "network_out", "last_boot"].forEach((k) => g[k] && ids.push(g[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _barColor(pct, base) {
    const c = this._config;
    if (isNaN(pct)) return "#4a4a48";
    if (pct >= c.critical_at) return "#E24B4A";
    if (pct >= c.warn_at) return "#BA7517";
    return base;
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
        .gu { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          transition:background .2s ease; }
        .gu.off { opacity:.55; }
        .gu-top { display:flex; align-items:center; gap:8px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .gu-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color); cursor:pointer;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gu-name .vmid { color:var(--disabled-text-color); font-weight:400; }
        .gu-state { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .gu-health { --mdc-icon-size:13px; flex-shrink:0; }
        .bars { display:flex; gap:8px; margin-top:9px; }
        .bar { flex:1; min-width:0; cursor:pointer; }
        .bar-top { display:flex; justify-content:space-between;
          font-size:9.5px; color:var(--disabled-text-color); margin-bottom:3px; }
        .bar-t { height:4px; border-radius:2px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .bar-f { height:100%; border-radius:2px; transition:width .4s ease; }
        .gu-foot { display:flex; align-items:center; gap:10px; margin-top:8px;
          font-size:10px; color:var(--disabled-text-color); }
        .gu-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .btns { display:flex; gap:4px; margin-left:auto; flex-shrink:0; }
        .btn { width:26px; height:26px; border-radius:6px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform .1s ease, opacity .2s ease; }
        .btn:active { transform:scale(.9); }
        .btn ha-icon { --mdc-icon-size:13px; }
        .btn.busy { opacity:.35; cursor:default; }
        .warn { font-size:11px; color:#BA7517; padding:2px 2px 8px 2px; line-height:1.4; }
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

    r.querySelector("ha-card").style.borderColor = gRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = gRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let running = 0, missing = 0;
    c.guests.forEach((g) => {
      const st = g.status ? hass.states[g.status] : null;
      if (g.status && !st) missing++;
      if (gOn(st)) running++;
    });
    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_on + '">' + running + " en marche</b> / " + c.guests.length;

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (missing) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = missing + " invité(s) avec une entité d'état introuvable.";
      list.appendChild(w);
    }

    c.guests.forEach((g) => {
      const stSt = g.status ? hass.states[g.status] : null;
      const on = gOn(stSt);
      const el = document.createElement("div");
      el.className = "gu" + (on ? "" : " off");

      /* --- Ligne 1 : état, nom, santé --- */
      const top = document.createElement("div");
      top.className = "gu-top";

      const stateLabel = g.status_text && hass.states[g.status_text]
        ? hass.states[g.status_text].state
        : (on ? "" : "arrêté");

      let healthHtml = "";
      if (g.health && hass.states[g.health]) {
        const ok = gOn(hass.states[g.health]);
        healthHtml = '<ha-icon class="gu-health" icon="' +
          (ok ? "mdi:heart-pulse" : "mdi:heart-broken") +
          '" style="color:' + (ok ? c.color_on : "#E24B4A") + '"></ha-icon>';
      }

      top.innerHTML =
        '<span class="dot" style="background:' + (on ? c.color_on : c.color_off) + '"></span>' +
        '<span class="gu-name">' + gEsc(g.name || "Invité") +
          (g.vmid ? ' <span class="vmid">· ' + gEsc(g.vmid) + "</span>" : "") + "</span>" +
        (stateLabel ? '<span class="gu-state">' + gEsc(stateLabel) + "</span>" : "") +
        healthHtml;
      top.querySelector(".gu-name").addEventListener("click", () =>
        this._more(g.status || g.cpu));
      el.appendChild(top);

      /* --- Ligne 2 : barres CPU / RAM / disque (seulement si en marche) --- */
      if (c.show_bars && on) {
        const bars = document.createElement("div");
        bars.className = "bars";
        const defs = [
          { e: g.cpu, n: "CPU", col: c.color_cpu },
          { e: g.memory, n: "RAM", col: c.color_mem },
          { e: g.disk, n: "Disque", col: c.color_disk },
        ].filter((d) => d.e);
        if (defs.length) {
          defs.forEach((d) => {
            const st = hass.states[d.e];
            const pct = gNum(st);
            const col = this._barColor(pct, d.col);
            const b = document.createElement("div");
            b.className = "bar";
            b.innerHTML =
              '<div class="bar-top"><span>' + d.n + "</span><span>" +
                (isNaN(pct) ? "—" : pct.toFixed(0) + " %") + "</span></div>" +
              '<div class="bar-t"><div class="bar-f" style="width:' +
                (isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100)).toFixed(1) +
                "%;background:" + col + '"></div></div>';
            b.addEventListener("click", () => this._more(d.e));
            bars.appendChild(b);
          });
          el.appendChild(bars);
        }
      }

      /* --- Ligne 3 : réseau, uptime, boutons --- */
      const foot = document.createElement("div");
      foot.className = "gu-foot";
      const parts = [];

      if (c.show_network && on) {
        const inSt = g.network_in ? hass.states[g.network_in] : null;
        const outSt = g.network_out ? hass.states[g.network_out] : null;
        if (inSt) parts.push('<span><ha-icon icon="mdi:arrow-down" style="color:' +
          c.color_cpu + '"></ha-icon> ' + gFmt(inSt) + " " + gEsc(gUnit(inSt)) + "</span>");
        if (outSt) parts.push('<span><ha-icon icon="mdi:arrow-up" style="color:' +
          c.color_disk + '"></ha-icon> ' + gFmt(outSt) + " " + gEsc(gUnit(outSt)) + "</span>");
      }
      if (c.show_uptime && on && g.last_boot && hass.states[g.last_boot]) {
        const since = gSince(hass.states[g.last_boot].state);
        if (since) parts.push('<span><ha-icon icon="mdi:clock-outline"></ha-icon> ' + since + "</span>");
      }
      foot.innerHTML = parts.join("");

      /* Boutons contextuels */
      const btns = document.createElement("div");
      btns.className = "btns";
      const acts = g.actions || {};
      let any = false;
      G_ORDER.forEach((key) => {
        const entity = acts[key];
        if (!entity) return;
        const def = G_ACTIONS[key];
        if (on && def.when === "off") return;
        if (!on && def.when === "on") return;
        any = true;
        const busy = this._pending[entity];
        const b = document.createElement("div");
        b.className = "btn" + (busy ? " busy" : "");
        b.title = def.label;
        b.style.background = gRgba(def.color, 0.14);
        b.innerHTML = '<ha-icon icon="' + def.icon + '" style="color:' + def.color + '"></ha-icon>';
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._pending[entity]) return;
          const needsConfirm = c.confirm_actions.indexOf(key) !== -1;
          if (needsConfirm) {
            const who = (g.name || "cet invité") + (g.vmid ? " (" + g.vmid + ")" : "");
            if (!window.confirm(def.label + " « " + who + " » ?")) return;
          }
          this._pending[entity] = true;
          this._render();
          this._hass.callService("button", "press", { entity_id: entity });
          setTimeout(() => { delete this._pending[entity]; this._render(); }, 3000);
        });
        btns.appendChild(b);
      });
      if (any) foot.appendChild(btns);
      if (parts.length || any) el.appendChild(foot);

      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.guests.length * 2; }
  static getStubConfig() {
    return { type: "custom:proxmox-guests-card", title: "Invités", guests: [{ name: "Invité 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-guests-card-editor"); }
}
customElements.define("proxmox-guests-card", ProxmoxGuestsCard);

/* ================= ÉDITEUR ================= */
const PG_L = {
  title: "Titre", icon: "Icône", show_bars: "Afficher les barres CPU/RAM/disque",
  show_network: "Afficher le trafic réseau", show_uptime: "Afficher la durée de marche",
  warn_at: "Seuil d'alerte (%)", critical_at: "Seuil critique (%)",
  name: "Nom de l'invité", vmid: "Identifiant (VMID)",
  status: "Capteur d'état", status_text: "État en texte", health: "Santé",
  cpu: "CPU (%)", memory: "Mémoire (%)", disk: "Disque (%)",
  network_in: "Réseau entrant", network_out: "Réseau sortant", last_boot: "Dernier démarrage",
  a_start: "Démarrer", a_resume: "Reprendre", a_shutdown: "Éteindre",
  a_stop: "Forcer l'arrêt", a_reboot: "Redémarrer", a_reset: "Réinitialiser",
  a_suspend: "Suspendre", a_hibernate: "Hiberner",
};
const PG_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { name: "show_bars", selector: { boolean: {} } },
  { name: "show_network", selector: { boolean: {} } },
  { name: "show_uptime", selector: { boolean: {} } },
];
const SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const BINSENS = { entity: { filter: { domain: ["binary_sensor", "sensor"] } } };
const BTN = { entity: { filter: { domain: ["button", "switch", "script"] } } };
const PG_S_GUEST = [
  { type: "grid", schema: [
    { name: "name", selector: { text: {} } },
    { name: "vmid", selector: { text: {} } },
  ]},
  { name: "status", selector: BINSENS },
  { name: "status_text", selector: SENSOR },
  { name: "health", selector: BINSENS },
  { name: "cpu", selector: SENSOR },
  { name: "memory", selector: SENSOR },
  { name: "disk", selector: SENSOR },
  { name: "network_in", selector: SENSOR },
  { name: "network_out", selector: SENSOR },
  { name: "last_boot", selector: SENSOR },
];
const PG_S_ACTS = [
  { name: "a_start", selector: BTN },
  { name: "a_shutdown", selector: BTN },
  { name: "a_stop", selector: BTN },
  { name: "a_reboot", selector: BTN },
  { name: "a_reset", selector: BTN },
  { name: "a_suspend", selector: BTN },
  { name: "a_resume", selector: BTN },
  { name: "a_hibernate", selector: BTN },
];

class ProxmoxGuestsCardEditor extends HTMLElement {
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
  _label(s) { return PG_L[s.name] || s.name; }

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
        .sub-lbl { font-size:11.5px; font-weight:600; color:var(--secondary-text-color);
          margin:12px 0 4px 0; padding-top:8px; border-top:1px solid var(--divider-color); }
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
          <div class="color-field"><input type="color" class="c-on"><label>En marche</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Invités</span></div>
        <div class="sec-hint">Les boutons s'adaptent à l'état : « Démarrer » quand l'invité est arrêté, « Éteindre / Forcer / Redémarrer » quand il tourne. Laisse vide les actions que ton type d'invité n'a pas.</div>
        <div class="rows-guests"></div>
        <div class="addbtn add-guest"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un invité</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = PG_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bind = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bind(".c-accent", "accent");
    bind(".c-on", "color_on");
    r.querySelector(".add-guest").addEventListener("click", () => {
      this._config.guests = (this._config.guests || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:server",
      warn_at: c.warn_at || 80, critical_at: c.critical_at || 92,
      show_bars: c.show_bars !== false,
      show_network: c.show_network !== false,
      show_uptime: c.show_uptime !== false,
    };
    this._setColor(".c-accent", c.accent || "#378ADD");
    this._setColor(".c-on", c.color_on || "#1D9E75");

    const box = r.querySelector(".rows-guests");
    const list = c.guests || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun invité.";
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        row.querySelector(".f-guest").hass = this._hass;
        row.querySelector(".f-guest").data = this._guestData(list[i]);
        row.querySelector(".f-acts").hass = this._hass;
        row.querySelector(".f-acts").data = this._actsData(list[i]);
      });
    }
  }

  _guestData(g) {
    const d = {};
    ["name", "vmid", "status", "status_text", "health", "cpu", "memory", "disk",
     "network_in", "network_out", "last_boot"].forEach((k) => { d[k] = g[k] || ""; });
    return d;
  }
  _actsData(g) {
    const a = g.actions || {}, d = {};
    G_ORDER.forEach((k) => { d["a_" + k] = a[k] || ""; });
    return d;
  }

  _row(item, index, total) {
    const row = document.createElement("div");
    row.className = "row";
    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = (item.name || "Invité #" + (index + 1)) + (item.vmid ? " · " + item.vmid : "");
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
      this._config.guests = this._config.guests.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const fg = document.createElement("ha-form");
    fg.className = "f-guest";
    fg.schema = PG_S_GUEST; fg.computeLabel = this._label; fg.hass = this._hass;
    fg.data = this._guestData(item);
    fg.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.guests || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (k !== "actions" && (m[k] === "" || m[k] === undefined)) delete m[k];
      });
      l[index] = m; this._config.guests = l; this._emit();
    });
    row.appendChild(fg);

    const lbl = document.createElement("div");
    lbl.className = "sub-lbl";
    lbl.textContent = "Boutons d'action";
    row.appendChild(lbl);

    const fa = document.createElement("ha-form");
    fa.className = "f-acts";
    fa.schema = PG_S_ACTS; fa.computeLabel = this._label; fa.hass = this._hass;
    fa.data = this._actsData(item);
    fa.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.guests || []).slice();
      const acts = {};
      G_ORDER.forEach((k) => {
        const v = e.detail.value["a_" + k];
        if (v) acts[k] = v;
      });
      const m = Object.assign({}, l[index]);
      if (Object.keys(acts).length) m.actions = acts; else delete m.actions;
      l[index] = m; this._config.guests = l; this._emit();
    });
    row.appendChild(fa);

    return row;
  }

  _move(i, d) {
    const l = (this._config.guests || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.guests = l; this._emit(); this._update(true);
  }
}
customElements.define("proxmox-guests-card-editor", ProxmoxGuestsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxmox-guests-card",
  name: "Proxmox Guests Card",
  description: "VM et conteneurs LXC : état, ressources et actions contextuelles.",
});
console.info("%c PROXMOX-GUESTS-CARD %c v" + PGUEST_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE — MACHINES VIRTUELLES

type: custom:proxmox-guests-card
title: Machines virtuelles
icon: mdi:server
accent: "#378ADD"
guests:
  - name: docker01
    vmid: 101
    status: binary_sensor.qemu_docker01_101_status
    status_text: sensor.qemu_docker01_101_status
    health: binary_sensor.qemu_docker01_101_health
    cpu: sensor.qemu_docker01_101_cpu_used
    memory: sensor.qemu_docker01_101_memory_used_percentage
    disk: sensor.qemu_docker01_101_disk_used_percentage
    network_in: sensor.qemu_docker01_101_network_in
    network_out: sensor.qemu_docker01_101_network_out
    last_boot: sensor.qemu_docker01_101_last_boot
    actions:
      start: button.qemu_docker01_101_start
      shutdown: button.qemu_docker01_101_shutdown
      stop: button.qemu_docker01_101_stop
      reboot: button.qemu_docker01_101_reboot
      reset: button.qemu_docker01_101_reset
      suspend: button.qemu_docker01_101_suspend
      resume: button.qemu_docker01_101_resume
      hibernate: button.qemu_docker01_101_hibernate

EXEMPLE — CONTENEURS LXC

type: custom:proxmox-guests-card
title: Conteneurs LXC
icon: mdi:package-variant-closed
accent: "#7F77DD"
guests:
  - name: DNSINTERNE
    vmid: 110
    status: binary_sensor.lxc_dnsinterne_110_status
    cpu: sensor.lxc_dnsinterne_110_cpu_used
    memory: sensor.lxc_dnsinterne_110_memory_used_percentage
    disk: sensor.lxc_dnsinterne_110_disk_used_percentage
    network_in: sensor.lxc_dnsinterne_110_network_in
    network_out: sensor.lxc_dnsinterne_110_network_out
    last_boot: sensor.lxc_dnsinterne_110_last_boot
    actions:
      start: button.lxc_dnsinterne_110_start
      shutdown: button.lxc_dnsinterne_110_shutdown
      stop: button.lxc_dnsinterne_110_stop
      reboot: button.lxc_dnsinterne_110_reboot
============================================================ */
