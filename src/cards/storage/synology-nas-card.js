/**
 * Synology NAS Card — système DSM (CPU, mémoire, charge, débits, actions)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/synology-nas-card.js
 *  2. Resources → /local/perso/synology-nas-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const SYNAS_VERSION = "1.0.0";

/* ---------- Helpers ---------- */
const nRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const nNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const nFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const nUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const nEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Met une valeur d'octets à l'échelle : 4200 GB → 4,2 TB */
function nScale(value, unit) {
  if (isNaN(value)) return null;
  const dec = ["B", "kB", "KB", "MB", "GB", "TB", "PB"];
  const bin = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let seq = dec, base = 1000, i = dec.indexOf(unit);
  if (i === -1) { i = bin.indexOf(unit); seq = bin; base = 1024; }
  if (i === -1) return null;
  let v = value;
  while (Math.abs(v) >= base && i < seq.length - 1) { v /= base; i++; }
  const d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: d }) + " " + seq[i];
}

/* Convertit un horodatage en durée lisible */
function nSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365), mo = Math.floor((d % 365) / 30);
    return y + " an" + (y > 1 ? "s" : "") + (mo ? " " + mo + " mois" : "");
  }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

/* Lecture d'un binary_sensor en tenant compte de device_class "problem",
   où "on" signifie qu'un problème est détecté. */
function nOk(st, invert) {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return null;
  const dc = st.attributes ? st.attributes.device_class : null;
  const inverted = invert !== undefined && invert !== null
    ? invert : (dc === "problem" || dc === "safety");
  if (s === "on") return inverted ? false : true;
  if (s === "off") return inverted ? true : false;
  if (s === "ok" || s === "safe" || s === "normal" || s === "good") return true;
  if (s === "risk" || s === "danger" || s === "warning" || s === "critical") return false;
  return null;
}

class SynologyNasCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "NAS",
      icon: config.icon || "mdi:nas",
      accent: config.accent || "#378ADD",
      accent_off: config.accent_off || "#E24B4A",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
      temp_warn: config.temp_warn || 50,
      temp_critical: config.temp_critical || 60,
      security_entity: config.security_entity || null,
      security_invert: config.security_invert,
      last_boot: config.last_boot || null,
      update_entity: config.update_entity || null,
      temperature: config.temperature || null,
      subtitle: config.subtitle || null,
      gauges: config.gauges || [],
      throughput: config.throughput || null,
      actions_label: config.actions_label || null,
      actions: config.actions || [],
    };
    this._built = false;
  }

  connectedCallback() {
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
    [c.security_entity, c.last_boot, c.update_entity, c.temperature].forEach((x) => x && ids.push(x));
    c.gauges.forEach((g) => {
      ["percentage", "value", "used", "free", "total"].forEach((k) => g[k] && ids.push(g[k]));
    });
    if (c.throughput) {
      if (c.throughput.download) ids.push(c.throughput.download);
      if (c.throughput.upload) ids.push(c.throughput.upload);
    }
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
  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "#1D9E75";
  }

  /* Une jauge accepte plusieurs sources : pourcentage direct, valeur/max,
     utilisé/total, ou libre/total (le cas Synology pour la mémoire). */
  _gaugeValue(g) {
    const hass = this._hass;
    const pctSt = g.percentage ? hass.states[g.percentage] : null;
    const valSt = g.value ? hass.states[g.value] : null;
    const usedSt = g.used ? hass.states[g.used] : null;
    const freeSt = g.free ? hass.states[g.free] : null;
    const totSt = g.total ? hass.states[g.total] : null;

    let pct = nNum(pctSt);
    let used = nNum(usedSt);
    const total = nNum(totSt);
    const free = nNum(freeSt);

    if (isNaN(used) && !isNaN(total) && !isNaN(free)) used = total - free;
    if (isNaN(pct) && !isNaN(used) && total) pct = (used / total) * 100;
    if (isNaN(pct) && valSt && g.max) {
      const v = nNum(valSt);
      if (!isNaN(v)) pct = (v / g.max) * 100;
    }

    /* Libellé de droite : le plus parlant disponible */
    let label;
    if (!isNaN(used) && !isNaN(total)) {
      const unit = nUnit(totSt) || nUnit(usedSt) || nUnit(freeSt);
      const su = nScale(used, unit), st_ = nScale(total, unit);
      label = (su && st_) ? su.split(" ")[0] + "/" + st_
        : used.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "/" +
          total.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " " + unit;
    } else if (valSt) {
      label = nFmt(valSt, 2) + (nUnit(valSt) ? " " + nUnit(valSt) : "");
    } else {
      label = isNaN(pct) ? "—" : pct.toFixed(0) + " %";
    }
    return { pct: pct, label: label };
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
        .gauges { padding:14px 15px 10px 15px; display:flex; flex-direction:column; gap:9px; }
        .g { display:flex; align-items:center; gap:9px; cursor:pointer; }
        .g-n { font-size:10.5px; color:var(--secondary-text-color); width:62px; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .g-t { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .g-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .g-v { font-size:11px; font-weight:600; color:var(--primary-text-color);
          width:86px; text-align:right; flex-shrink:0; white-space:nowrap;
          overflow:hidden; text-overflow:ellipsis; }
        .flow { padding:0 15px 12px 15px; display:flex; gap:9px; }
        .fbox { flex:1; min-width:0; background:rgba(255,255,255,0.035);
          border-radius:10px; padding:10px 12px; cursor:pointer; transition:background .2s ease; }
        .fbox:hover { background:rgba(255,255,255,0.07); }
        .fhead { display:flex; align-items:center; gap:5px; margin-bottom:5px; }
        .fhead ha-icon { --mdc-icon-size:13px; }
        .fhead span { font-size:10px; color:var(--secondary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .fval { font-size:17px; font-weight:700; color:var(--primary-text-color);
          white-space:nowrap; }
        .fval em { font-size:10px; font-weight:500; font-style:normal;
          color:var(--secondary-text-color); margin-left:2px; }
        .tbox { flex:0 0 82px; background:rgba(255,255,255,0.035); border-radius:10px;
          padding:10px 8px; text-align:center; cursor:pointer; transition:background .2s ease; }
        .tbox:hover { background:rgba(255,255,255,0.07); }
        .tbox ha-icon { --mdc-icon-size:15px; }
        .tbox .tv { font-size:16px; font-weight:700; color:var(--primary-text-color); margin-top:2px; }
        .tbox .tn { font-size:9px; color:var(--disabled-text-color); }
        .footer { padding:11px 15px 14px 15px;
          border-top:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.015); }
        .footer-label { display:flex; align-items:center; gap:7px; margin-bottom:8px; }
        .footer-label ha-icon { --mdc-icon-size:13px; color:var(--disabled-text-color); }
        .footer-label span { font-size:10.5px; color:var(--disabled-text-color); letter-spacing:.3px; }
        .actions { display:flex; gap:6px; flex-wrap:wrap; }
        .action { flex:1; min-width:60px;
          display:flex; align-items:center; justify-content:center; gap:5px;
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
        <div class="flow hidden"></div>
        <div class="footer hidden">
          <div class="footer-label hidden"><ha-icon icon="mdi:cog-outline"></ha-icon><span></span></div>
          <div class="actions"></div>
        </div>
      </ha-card>`;
    this.shadowRoot.querySelector(".header").addEventListener("click", () =>
      this._more(this._config.security_entity || this._config.temperature));
  }

  _renderUptime() {
    const c = this._config, r = this.shadowRoot;
    const sub = r.querySelector(".subline");
    const st = c.last_boot ? this._hass.states[c.last_boot] : null;
    const since = st ? nSince(st.state) : null;
    if (since) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Démarré il y a " + since;
      sub.onclick = () => this._more(c.last_boot);
    } else sub.classList.add("hidden");
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;

    const secSt = c.security_entity ? hass.states[c.security_entity] : null;
    const secOk = nOk(secSt, c.security_invert);
    const accent = secOk === false ? c.accent_off : c.accent;

    const card = r.querySelector("ha-card");
    card.style.borderColor = nRgba(accent, 0.3);
    card.style.boxShadow = "0 0 24px " + nRgba(accent, 0.1);

    const disc = r.querySelector(".disc");
    disc.style.background = nRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    const bits = [];
    if (secOk !== null) {
      bits.push('<b style="color:' + (secOk ? "#1D9E75" : "#E24B4A") + '">' +
        (secOk ? "Sécurisé" : "Alerte sécurité") + "</b>");
    }
    if (c.subtitle) bits.push(nEsc(c.subtitle));
    r.querySelector(".hsub").innerHTML = bits.length ? bits.join(" · ") : "&nbsp;";

    this._renderUptime();

    /* Badge DSM */
    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ DSM" : "DSM à jour";
      badge.style.background = nRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* Jauges */
    const gz = r.querySelector(".gauges");
    if (c.gauges.length) {
      gz.classList.remove("hidden");
      gz.innerHTML = "";
      c.gauges.forEach((g) => {
        const res = this._gaugeValue(g);
        const col = this._barColor(res.pct, g.color || "#378ADD");
        const el = document.createElement("div");
        el.className = "g";
        el.innerHTML =
          '<span class="g-n">' + nEsc(g.name || "—") + "</span>" +
          '<span class="g-t"><span class="g-f" style="display:block;width:' +
            (isNaN(res.pct) ? 0 : Math.min(Math.max(res.pct, 0), 100)).toFixed(1) +
            "%;background:" + col + '"></span></span>' +
          '<span class="g-v">' + nEsc(res.label) + "</span>";
        el.addEventListener("click", () =>
          this._more(g.percentage || g.value || g.used || g.free || g.total));
        gz.appendChild(el);
      });
    } else gz.classList.add("hidden");

    /* Débits + température */
    const flow = r.querySelector(".flow");
    const tp = c.throughput;
    const hasFlow = tp && (tp.download || tp.upload);
    const hasTemp = !!c.temperature;
    if (hasFlow || hasTemp) {
      flow.classList.remove("hidden");
      flow.innerHTML = "";
      const mk = (entity, label, icon, color) => {
        const st = hass.states[entity];
        const d = document.createElement("div");
        d.className = "fbox";
        d.innerHTML =
          '<div class="fhead"><ha-icon icon="' + icon + '" style="color:' + color + '"></ha-icon>' +
          "<span>" + nEsc(label) + "</span></div>" +
          '<div class="fval">' + nFmt(st, 2) +
            (nUnit(st) ? "<em>" + nEsc(nUnit(st)) + "</em>" : "") + "</div>";
        d.addEventListener("click", () => this._more(entity));
        flow.appendChild(d);
      };
      if (tp && tp.download) mk(tp.download, tp.download_label || "Téléchargement", "mdi:arrow-down", c.accent);
      if (tp && tp.upload) mk(tp.upload, tp.upload_label || "Téléversement", "mdi:arrow-up", "#1D9E75");
      if (hasTemp) {
        const st = hass.states[c.temperature];
        const t = nNum(st);
        const col = this._tempColor(t);
        const d = document.createElement("div");
        d.className = "tbox";
        d.innerHTML =
          '<ha-icon icon="mdi:thermometer" style="color:' + col + '"></ha-icon>' +
          '<div class="tv">' + nFmt(st, 0) + "°</div>" +
          '<div class="tn">Système</div>';
        d.addEventListener("click", () => this._more(c.temperature));
        flow.appendChild(d);
      }
    } else flow.classList.add("hidden");

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
          "<span>" + nEsc(a.name) + "</span>";
        el.addEventListener("click", () => {
          if (a.confirm !== false &&
              !window.confirm(a.confirm_text || (a.name + " le NAS « " + c.title + " » ?"))) return;
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
    return 2 + Math.ceil(c.gauges.length / 2) +
      ((c.throughput || c.temperature) ? 1 : 0) + (c.actions.length ? 1 : 0);
  }
  static getStubConfig() { return { type: "custom:synology-nas-card", title: "NAS" }; }
  static getConfigElement() { return document.createElement("synology-nas-card-editor"); }
}
customElements.define("synology-nas-card", SynologyNasCard);

/* ================= ÉDITEUR ================= */
const SN_L = {
  title: "Titre", icon: "Icône", subtitle: "Sous-titre libre",
  security_entity: "État de sécurité", security_invert: "Inverser l'état de sécurité",
  last_boot: "Dernier démarrage", update_entity: "Mise à jour DSM",
  temperature: "Température système",
  warn_at: "Seuil d'alerte (%)", critical_at: "Seuil critique (%)",
  temp_warn: "Température d'alerte (°C)", temp_critical: "Température critique (°C)",
  name: "Nom affiché", percentage: "Pourcentage", value: "Valeur brute",
  max: "Valeur max (échelle)", used: "Utilisé", free: "Disponible", total: "Total",
  download: "Débit descendant", upload: "Débit montant",
  download_label: "Libellé descendant", upload_label: "Libellé montant",
  entity: "Entité", confirm: "Demander confirmation",
  actions_label: "Titre de la zone d'actions",
};
const SN_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SN_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "subtitle", selector: { text: {} } },
  { name: "security_entity", selector: { entity: { filter: { domain: ["binary_sensor", "sensor"] } } } },
  { name: "security_invert", selector: { boolean: {} } },
  { name: "last_boot", selector: SN_SENSOR },
  { name: "update_entity", selector: { entity: { filter: { domain: ["update"] } } } },
  { name: "temperature", selector: SN_SENSOR },
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { type: "grid", schema: [
    { name: "temp_warn", selector: { number: { min: 20, max: 100, mode: "box" } } },
    { name: "temp_critical", selector: { number: { min: 20, max: 100, mode: "box" } } },
  ]},
];
const SN_S_FLOW = [
  { name: "download", selector: SN_SENSOR },
  { name: "upload", selector: SN_SENSOR },
];
const SN_S_GAUGE = [
  { name: "name", selector: { text: {} } },
  { name: "percentage", selector: SN_SENSOR },
  { name: "value", selector: SN_SENSOR },
  { name: "max", selector: { number: { min: 0.1, max: 1000, step: 0.1, mode: "box" } } },
  { name: "used", selector: SN_SENSOR },
  { name: "free", selector: SN_SENSOR },
  { name: "total", selector: SN_SENSOR },
];
const SN_S_ACTION = [
  { name: "name", selector: { text: {} } },
  { name: "entity", selector: { entity: { filter: { domain: ["button", "switch", "script", "scene"] } } } },
  { type: "grid", schema: [
    { name: "icon", selector: { icon: {} } },
    { name: "confirm", selector: { boolean: {} } },
  ]},
];

class SynologyNasCardEditor extends HTMLElement {
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
  _label(s) { return SN_L[s.name] || s.name; }

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
          <div class="color-field"><input type="color" class="c-on"><label>Normal</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Alerte</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Jauges</span></div>
        <div class="sec-hint">Plusieurs sources possibles par jauge : un pourcentage direct, ou « Disponible + Total » (cas de la mémoire Synology), ou « Valeur brute + Max » (cas de la charge processeur).</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une jauge</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Débits réseau</span></div>
        <ha-form class="f-flow"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">La confirmation est activée par défaut : arrêter un NAS à distance sans filet est risqué.</div>
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
    wire(".f-gen", SN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "subtitle", "security_entity", "last_boot", "update_entity", "temperature"]
        .forEach((k) => { if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k]; });
      if (this._config.security_invert === false) delete this._config.security_invert;
    });
    wire(".f-flow", SN_S_FLOW, (v) => {
      const t = Object.assign({}, this._config.throughput, v);
      Object.keys(t).forEach((k) => { if (t[k] === "" || t[k] === undefined) delete t[k]; });
      if (Object.keys(t).length) this._config.throughput = t;
      else delete this._config.throughput;
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
      title: c.title || "", icon: c.icon || "mdi:nas", subtitle: c.subtitle || "",
      security_entity: c.security_entity || "", security_invert: c.security_invert === true,
      last_boot: c.last_boot || "", update_entity: c.update_entity || "",
      temperature: c.temperature || "",
      warn_at: c.warn_at || 75, critical_at: c.critical_at || 90,
      temp_warn: c.temp_warn || 50, temp_critical: c.temp_critical || 60,
    };
    const ff = r.querySelector(".f-flow");
    ff.hass = this._hass;
    const tp = c.throughput || {};
    ff.data = { download: tp.download || "", upload: tp.upload || "" };
    const fa = r.querySelector(".f-actlabel");
    fa.hass = this._hass;
    fa.data = { actions_label: c.actions_label || "" };
    this._setColor(".c-on", c.accent || "#378ADD");
    this._setColor(".c-off", c.accent_off || "#E24B4A");
    this._rows("gauges", ".rows-gauges", SN_S_GAUGE, force);
    this._rows("actions", ".rows-actions", SN_S_ACTION, force);
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
        if (k === "confirm" && m[k] === true) delete m[k]; /* true = défaut */
      });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config[key] = l; this._emit();
    });
    row.appendChild(f);

    if (key === "gauges") {
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
customElements.define("synology-nas-card-editor", SynologyNasCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-nas-card",
  name: "Synology NAS Card",
  description: "NAS Synology : CPU, mémoire, débits, température et actions.",
});
console.info("%c SYNOLOGY-NAS-CARD %c v" + SYNAS_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:synology-nas-card
title: Guy
icon: mdi:nas
accent: "#378ADD"
subtitle: DiskStation
security_entity: binary_sensor.syno_security_status
last_boot: sensor.syno_last_boot
update_entity: update.syno_dsm_update
temperature: sensor.syno_temperature
temp_warn: 50
temp_critical: 60
warn_at: 75
critical_at: 90
gauges:
  - name: CPU
    percentage: sensor.syno_cpu_utilization_total
    color: "#378ADD"
  - name: Mémoire
    percentage: sensor.syno_memory_usage_real
    free: sensor.syno_memory_available_real
    total: sensor.syno_memory_total_real
    color: "#7F77DD"
  - name: Charge 5 min
    value: sensor.syno_cpu_load_average_5_min
    max: 4
    color: "#1D9E75"
throughput:
  download: sensor.syno_download_throughput
  upload: sensor.syno_upload_throughput
actions_label: Contrôles du NAS
actions:
  - name: Redémarrer
    entity: button.syno_reboot
    icon: mdi:restart
    color: "#378ADD"
  - name: Arrêter
    entity: button.syno_shutdown
    icon: mdi:power
    color: "#E24B4A"
============================================================ */
