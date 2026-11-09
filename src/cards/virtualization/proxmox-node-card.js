/**
 * Proxmox Node Card — nœud PVE (CPU, mémoire, disque, swap, actions)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/proxmox-node-card.js
 *  2. Resources → /local/perso/proxmox-node-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PNODE_VERSION = "1.0.0";

/* ---------- Helpers ---------- */
const pRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const pNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const pFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const pUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const pEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Convertit un horodatage (last_boot) en durée lisible : "42 jours" */
function pSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const mo = Math.floor((d % 365) / 30);
    return y + " an" + (y > 1 ? "s" : "") + (mo ? " " + mo + " mois" : "");
  }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

const pOn = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "running" || s === "online" || s === "home";
};

class ProxmoxNodeCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Nœud Proxmox",
      icon: config.icon || "mdi:server",
      accent: config.accent || "#E2782D",
      accent_off: config.accent_off || "#E24B4A",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
      status_entity: config.status_entity || null,
      last_boot: config.last_boot || null,
      vms_running: config.vms_running || null,
      containers_running: config.containers_running || null,
      updates_count: config.updates_count || null,
      updates_available: config.updates_available || null,
      gauges: config.gauges || [],
      actions_label: config.actions_label || null,
      actions: config.actions || [],
      confirm_actions: config.confirm_actions !== false,
    };
    this._built = false;
  }

  connectedCallback() {
    /* "Démarré il y a X" doit vieillir même sans changement d'état */
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._renderUptime();
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
    const c = this._config, ids = [];
    [c.status_entity, c.last_boot, c.vms_running, c.containers_running,
     c.updates_count, c.updates_available].forEach((x) => x && ids.push(x));
    c.gauges.forEach((g) => { ["percentage", "used", "total", "free"].forEach((k) => g[k] && ids.push(g[k])); });
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
        .badge { padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600;
          flex-shrink:0; cursor:pointer; }
        .subline { padding:8px 15px 0 15px; display:flex; align-items:center; gap:6px;
          font-size:10.5px; color:var(--disabled-text-color); cursor:pointer; }
        .subline ha-icon { --mdc-icon-size:12px; }
        .gauges { padding:14px 15px 12px 15px; display:flex; flex-direction:column; gap:9px; }
        .g { display:flex; align-items:center; gap:9px; cursor:pointer; }
        .g-n { font-size:10.5px; color:var(--secondary-text-color); width:56px; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .g-t { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .g-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .g-v { font-size:11px; font-weight:600; color:var(--primary-text-color);
          width:88px; text-align:right; flex-shrink:0; white-space:nowrap; }
        .footer { padding:11px 15px 14px 15px;
          border-top:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.015); }
        .footer-label { display:flex; align-items:center; gap:7px; margin-bottom:8px; }
        .footer-label ha-icon { --mdc-icon-size:13px; color:var(--disabled-text-color); }
        .footer-label span { font-size:10.5px; color:var(--disabled-text-color); letter-spacing:.3px; }
        .actions { display:flex; gap:6px; flex-wrap:wrap; }
        .action { flex:1; min-width:56px;
          display:flex; align-items:center; justify-content:center; gap:4px;
          padding:8px 5px; border-radius:8px; cursor:pointer;
          background:rgba(255,255,255,0.045); font-size:11px; font-weight:600;
          color:var(--primary-text-color); user-select:none;
          transition:background .2s ease, transform .1s ease; }
        .action:hover { background:rgba(255,255,255,0.1); }
        .action:active { transform:scale(.95); }
        .action ha-icon { --mdc-icon-size:13px; }
        .action.fired { background:rgba(29,158,117,0.25); }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div class="htext"><div class="htitle"></div><div class="hsub"></div></div>
          <div class="badge hidden"></div>
        </div>
        <div class="subline hidden"><ha-icon icon="mdi:clock-outline"></ha-icon><span></span></div>
        <div class="gauges hidden"></div>
        <div class="footer hidden">
          <div class="footer-label hidden"><ha-icon icon="mdi:cog-outline"></ha-icon><span></span></div>
          <div class="actions"></div>
        </div>
      </ha-card>`;
    this.shadowRoot.querySelector(".header").addEventListener("click", () =>
      this._more(this._config.status_entity));
  }

  _renderUptime() {
    const c = this._config, r = this.shadowRoot;
    const sub = r.querySelector(".subline");
    const st = c.last_boot ? this._hass.states[c.last_boot] : null;
    const since = st ? pSince(st.state) : null;
    if (since) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Démarré il y a " + since;
      sub.onclick = () => this._more(c.last_boot);
    } else sub.classList.add("hidden");
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const stSt = c.status_entity ? hass.states[c.status_entity] : null;
    const online = c.status_entity ? pOn(stSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = pRgba(accent, 0.3);
    card.style.boxShadow = "0 0 24px " + pRgba(accent, 0.1);

    const disc = r.querySelector(".disc");
    disc.style.background = pRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    const bits = ['<b style="color:' + accent + '">' + (online ? "En ligne" : "Hors ligne") + "</b>"];
    if (c.vms_running && hass.states[c.vms_running]) {
      const n = pFmt(hass.states[c.vms_running], 0);
      bits.push(n + " VM");
    }
    if (c.containers_running && hass.states[c.containers_running]) {
      const n = pNum(hass.states[c.containers_running]);
      bits.push(pFmt(hass.states[c.containers_running], 0) + " conteneur" + (n > 1 ? "s" : ""));
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    this._renderUptime();

    /* Badge mises à jour */
    const badge = r.querySelector(".badge");
    const upCount = c.updates_count ? hass.states[c.updates_count] : null;
    const upAvail = c.updates_available ? hass.states[c.updates_available] : null;
    const n = upCount ? pNum(upCount) : NaN;
    const has = upAvail ? pOn(upAvail) : (!isNaN(n) && n > 0);
    if (upCount || upAvail) {
      badge.classList.remove("hidden");
      badge.textContent = has ? (!isNaN(n) && n > 0 ? n + " MAJ" : "MAJ dispo") : "À jour";
      badge.style.background = pRgba(has ? "#BA7517" : "#1D9E75", 0.14);
      badge.style.color = has ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.updates_count || c.updates_available); };
    } else badge.classList.add("hidden");

    /* Jauges */
    const gz = r.querySelector(".gauges");
    if (c.gauges.length) {
      gz.classList.remove("hidden");
      gz.innerHTML = "";
      c.gauges.forEach((g) => {
        const pctSt = g.percentage ? hass.states[g.percentage] : null;
        const usedSt = g.used ? hass.states[g.used] : null;
        const totSt = g.total ? hass.states[g.total] : null;
        let pct = pNum(pctSt);
        if (isNaN(pct) && usedSt && totSt) {
          const u = pNum(usedSt), t = pNum(totSt);
          if (!isNaN(u) && t) pct = (u / t) * 100;
        }
        const col = this._barColor(pct, g.color || "#378ADD");

        /* Valeur à droite : "20,5/32 Go" si dispo, sinon le pourcentage */
        let val;
        if (usedSt && totSt) {
          val = pFmt(usedSt, 1) + "/" + pFmt(totSt, 0) + " " + pEsc(pUnit(totSt) || pUnit(usedSt));
        } else {
          val = isNaN(pct) ? "—" : pct.toFixed(0) + " %";
        }

        const el = document.createElement("div");
        el.className = "g";
        el.innerHTML =
          '<span class="g-n">' + pEsc(g.name || "—") + "</span>" +
          '<span class="g-t"><span class="g-f" style="display:block;width:' +
            (isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100)).toFixed(1) +
            "%;background:" + col + '"></span></span>' +
          '<span class="g-v">' + val + "</span>";
        el.addEventListener("click", () => this._more(g.percentage || g.used));
        gz.appendChild(el);
      });
    } else gz.classList.add("hidden");

    /* Actions */
    const footer = r.querySelector(".footer");
    if (c.actions.length) {
      footer.classList.remove("hidden");
      const fl = r.querySelector(".footer-label");
      fl.classList.toggle("hidden", !c.actions_label);
      if (c.actions_label) fl.querySelector("span").textContent = c.actions_label;

      const box = r.querySelector(".actions");
      box.innerHTML = "";
      c.actions.forEach((a) => {
        const el = document.createElement("div");
        el.className = "action";
        el.innerHTML =
          (a.icon ? '<ha-icon icon="' + a.icon + '" style="color:' + (a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + pEsc(a.name) + "</span>";
        el.addEventListener("click", () => {
          const needs = a.confirm !== undefined ? a.confirm : (c.confirm_actions && a.destructive !== false);
          if (needs && !window.confirm(a.confirm_text || ("Confirmer : " + a.name + " ?"))) return;
          const domain = a.entity.split(".")[0];
          const svc = domain === "button" ? "press" : domain === "switch" ? "toggle" : "turn_on";
          this._hass.callService(domain, svc, { entity_id: a.entity });
          el.classList.add("fired");
          setTimeout(() => el.classList.remove("fired"), 700);
        });
        box.appendChild(el);
      });
    } else footer.classList.add("hidden");
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    return 2 + Math.ceil(c.gauges.length / 2) + (c.actions.length ? 1 : 0);
  }
  static getStubConfig() { return { type: "custom:proxmox-node-card", title: "Nœud Proxmox" }; }
  static getConfigElement() { return document.createElement("proxmox-node-card-editor"); }
}
customElements.define("proxmox-node-card", ProxmoxNodeCard);

/* ================= ÉDITEUR ================= */
const PN_L = {
  title: "Titre", icon: "Icône", status_entity: "Capteur d'état",
  last_boot: "Dernier démarrage", vms_running: "VM en marche",
  containers_running: "Conteneurs en marche", updates_count: "Nombre de mises à jour",
  updates_available: "Mises à jour disponibles", warn_at: "Seuil d'alerte (%)",
  critical_at: "Seuil critique (%)", confirm_actions: "Confirmer les actions par défaut",
  name: "Nom affiché", percentage: "Capteur de pourcentage", used: "Utilisé", total: "Total",
  entity: "Entité", actions_label: "Titre de la zone d'actions",
  confirm: "Demander confirmation",
};
const PN_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "status_entity", selector: { entity: { filter: { domain: ["binary_sensor", "sensor"] } } } },
  { name: "last_boot", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { type: "grid", schema: [
    { name: "vms_running", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "containers_running", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "updates_count", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "updates_available", selector: { entity: { filter: { domain: ["binary_sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
];
const PN_S_GAUGE = [
  { name: "name", selector: { text: {} } },
  { name: "percentage", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { type: "grid", schema: [
    { name: "used", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "total", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const PN_S_ACTION = [
  { name: "name", selector: { text: {} } },
  { name: "entity", selector: { entity: { filter: { domain: ["button", "switch", "script", "scene"] } } } },
  { type: "grid", schema: [
    { name: "icon", selector: { icon: {} } },
    { name: "confirm", selector: { boolean: {} } },
  ]},
];

class ProxmoxNodeCardEditor extends HTMLElement {
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
  _label(s) { return PN_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Hors ligne</label></div>
        </div>
        <div class="sec-hint">Les jauges passent en ambre puis en rouge au-delà des seuils.</div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Jauges</span></div>
        <div class="sec-hint">Si tu renseignes « Utilisé » et « Total », la valeur affichée devient « 20,5/32 Go » au lieu du pourcentage.</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une jauge</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">Coche « Demander confirmation » pour les actions à risque (arrêt, redémarrage).</div>
        <ha-form class="f-actlabel"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une action</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", PN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "status_entity", "last_boot", "vms_running", "containers_running",
       "updates_count", "updates_available"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
    });
    wire(".f-actlabel", [{ name: "actions_label", selector: { text: {} } }], (v) => {
      Object.assign(this._config, v);
      if (this._config.actions_label === "") delete this._config.actions_label;
    });
    const bind = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bind(".c-on", "accent");
    bind(".c-off", "accent_off");
    r.querySelector(".add-gauge").addEventListener("click", () => {
      this._config.gauges = (this._config.gauges || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
    r.querySelector(".add-action").addEventListener("click", () => {
      this._config.actions = (this._config.actions || []).concat([{ name: "", entity: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "", icon: c.icon || "mdi:server",
      status_entity: c.status_entity || "", last_boot: c.last_boot || "",
      vms_running: c.vms_running || "", containers_running: c.containers_running || "",
      updates_count: c.updates_count || "", updates_available: c.updates_available || "",
      warn_at: c.warn_at || 75, critical_at: c.critical_at || 90,
    };
    const fa = r.querySelector(".f-actlabel");
    fa.hass = this._hass;
    fa.data = { actions_label: c.actions_label || "" };
    this._setColor(".c-on", c.accent || "#E2782D");
    this._setColor(".c-off", c.accent_off || "#E24B4A");
    this._rows("gauges", ".rows-gauges", PN_S_GAUGE, force);
    this._rows("actions", ".rows-actions", PN_S_ACTION, force);
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
    num.textContent = item.name || "#" + (index + 1);
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
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined) delete m[k];
      });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config[key] = l; this._emit();
    });
    row.appendChild(f);

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
customElements.define("proxmox-node-card-editor", ProxmoxNodeCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxmox-node-card",
  name: "Proxmox Node Card",
  description: "Nœud Proxmox : CPU, mémoire, disque, swap, mises à jour et actions.",
});
console.info("%c PROXMOX-NODE-CARD %c v" + PNODE_VERSION + " ",
  "color:#fff;background:#E2782D;font-weight:700", "color:#E2782D;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:proxmox-node-card
title: Node pve01
icon: mdi:server
accent: "#E2782D"
warn_at: 75
critical_at: 90
status_entity: binary_sensor.node_pve01_status
last_boot: sensor.node_pve01_last_boot
vms_running: sensor.node_pve01_virtual_machines_running
containers_running: sensor.node_pve01_containers_running
updates_count: sensor.node_pve01_total_updates
updates_available: binary_sensor.node_pve01_updates_packages
gauges:
  - name: CPU
    percentage: sensor.node_pve01_cpu_used
    color: "#378ADD"
  - name: Mémoire
    percentage: sensor.node_pve01_memory_used_percentage
    used: sensor.node_pve01_memory_used
    total: sensor.node_pve01_memory_total
    color: "#7F77DD"
  - name: Disque
    percentage: sensor.node_pve01_disk_used_percentage
    used: sensor.node_pve01_disk_used
    total: sensor.node_pve01_disk_total
    color: "#1D9E75"
  - name: Swap
    percentage: sensor.node_pve01_swap_used_percentage
    color: "#8a8a86"
actions_label: Contrôles du nœud
actions:
  - name: Tout démarrer
    entity: button.node_pve01_start_all
    icon: mdi:play
    color: "#1D9E75"
    confirm: false
  - name: Tout arrêter
    entity: button.node_pve01_stop_all
    icon: mdi:stop
    color: "#BA7517"
    confirm: true
  - name: Redémarrer
    entity: button.node_pve01_reboot
    icon: mdi:restart
    color: "#378ADD"
    confirm: true
  - name: Éteindre
    entity: button.node_pve01_shutdown
    icon: mdi:power
    color: "#E24B4A"
    confirm: true
============================================================ */
