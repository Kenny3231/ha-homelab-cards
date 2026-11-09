/**
 * UniFi WiFi Card — WiFi networks (SSID) management
 * Version 1.1.0
 *
 * Turns each network on/off and shows its connected clients.
 * Loaded by the Homelab Cards integration. With the native UniFi Network
 * integration, leave `networks` empty to list every WLAN automatically, or set
 * `device` per network (explicit keys always win over detection).
 *
 * Note: the UniFi integration creates WLAN switches only when the matching
 *       option is enabled (Settings → Devices & Services → UniFi Network → Configure).
 */

const UWF_VERSION = "1.1.0";

/* ---------- i18n ---------- */
const UWF_I18N = {
  fr: {
    title: "Réseaux WiFi", net: "Réseau", active_one: "{n} actif", active_other: "{n} actifs",
    clients: "clients", guest: "Invité", disabled: "Désactivé", missing_ent: "entité introuvable",
    missing: "{n} réseau(x) introuvable(s). Vérifie que les switches de réseau WiFi sont activés dans les options de l'intégration UniFi Network.",
    none: "Aucun réseau WiFi UniFi détecté.",
    confirm: "Désactiver le réseau « {n} » ?",
    general: "Général", colors: "Couleurs", nets_sec: "Réseaux",
    hint: "Un bloc par SSID. Liste vide = tous les réseaux UniFi détectés automatiquement. Choisis l'appareil (le SSID) pour détecter son switch et ses clients ; un champ rempli reste prioritaire. Le switch d'activation n'existe que si l'option est activée dans l'intégration UniFi.",
    add: "Ajouter un réseau", empty: "Aucun réseau (détection automatique).", row: "Réseau #{n}",
    accent: "Accent", on: "Actif", expand_all: "Tout déplier", collapse_all: "Tout replier",
    desc: "Réseaux WiFi UniFi : activer/désactiver et clients par SSID.",
  },
  en: {
    title: "WiFi networks", net: "Network", active_one: "{n} active", active_other: "{n} active",
    clients: "clients", guest: "Guest", disabled: "Disabled", missing_ent: "entity not found",
    missing: "{n} network(s) not found. Check that WiFi network switches are enabled in the UniFi Network integration options.",
    none: "No UniFi WiFi network detected.",
    confirm: "Disable network \"{n}\"?",
    general: "General", colors: "Colors", nets_sec: "Networks",
    hint: "One block per SSID. Empty list = every UniFi network detected automatically. Pick the device (the SSID) to detect its switch and clients; a filled field always wins. The enable switch only exists when the option is enabled in the UniFi integration.",
    add: "Add a network", empty: "No network (automatic detection).", row: "Network #{n}",
    accent: "Accent", on: "Active", expand_all: "Expand all", collapse_all: "Collapse all",
    desc: "UniFi WiFi networks: turn on/off and clients per SSID.",
  },
};
const UWF_L = {
  fr: {
    title: "Titre", icon: "Icône", confirm_disable: "Demander confirmation avant désactivation",
    device: "Appareil UniFi / SSID (détection auto)",
    name: "Nom du réseau", entity: "Switch d'activation", clients: "Nombre de clients",
    band: "Bande (texte libre)", guest: "Réseau invité",
  },
  en: {
    title: "Title", icon: "Icon", confirm_disable: "Ask for confirmation before disabling",
    device: "UniFi device / SSID (auto-detect)",
    name: "Network name", entity: "Enable switch", clients: "Client count",
    band: "Band (free text)", guest: "Guest network",
  },
};
const wLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) ||
  (typeof document !== "undefined" && document.documentElement.lang) || "en";
const wLang = (h) => (String(wLoc(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
const wT = (h, k, n) => {
  const d = UWF_I18N[wLang(h)];
  const s = d[k] !== undefined ? d[k] : UWF_I18N.en[k];
  return n === undefined ? s : s.replace("{n}", n);
};

/* ---------- helpers ---------- */
const wRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const wFmt = (st, d, loc) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString(loc, { maximumFractionDigits: d === undefined ? 0 : d });
};
const wEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- UniFi auto-detection (hass.entities / hass.devices) ---------- */
const UWF_KEYS = ["wlan_control", "wlan_clients"];
const wDevName = (hass, id) => { const d = hass.devices && hass.devices[id]; return d ? d.name_by_user || d.name : null; };
/* Each UniFi WLAN is its own device carrying wlan_control / wlan_clients entities */
const wWlans = (hass) => [...new Set(Object.values(hass.entities || {})
  .filter((e) => e.platform === "unifi" && e.device_id && UWF_KEYS.indexOf(e.translation_key) >= 0)
  .map((e) => e.device_id))]
  .sort((a, b) => String(wDevName(hass, a) || a).localeCompare(String(wDevName(hass, b) || b)));
const wAuto = (hass, devId) => {
  const ents = Object.values(hass.entities || {}).filter((e) => e.device_id === devId && e.platform === "unifi");
  const tk = (key) => { const e = ents.find((x) => x.translation_key === key); return e && e.entity_id; };
  const out = { name: wDevName(hass, devId), entity: tk("wlan_control"), clients: tk("wlan_clients") };
  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
  return out;
};

class UnifiWifiCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:wifi-cog",
      accent: config.accent || "#378ADD",
      color_on: config.color_on || "#1D9E75",
      color_off: config.color_off || "#6a6a67",
      confirm_disable: config.confirm_disable === true,
      networks: config.networks || [],
    };
    this._built = false;
    this._pending = {};
    this._nets = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._resolve(hass);
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  /* Explicit networks first, else every detected WLAN; recomputed only when the registry changes */
  _resolve(hass) {
    if (this._nets && hass.entities === this._entsRef) return;
    this._entsRef = hass.entities;
    const list = this._config.networks.length ? this._config.networks : wWlans(hass).map((d) => ({ device: d }));
    this._nets = list.map((n) => (n && n.device ? Object.assign(wAuto(hass, n.device), n) : n || {}));
  }

  _ids() {
    const ids = [];
    this._nets.forEach((n) => {
      ["entity", "clients"].forEach((k) => n[k] && ids.push(n[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return wLoc(h) + "|" + this._nets.length + "|" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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
        .net { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          display:flex; align-items:center; gap:10px; transition:background .2s ease; }
        .net:hover { background:rgba(255,255,255,0.07); }
        .net.off { opacity:.6; }
        .nic { width:32px; height:32px; border-radius:8px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; transition:background .25s ease; }
        .nic ha-icon { --mdc-icon-size:17px; transition:color .25s ease; }
        .nbody { flex:1; min-width:0; cursor:pointer; }
        .nname { font-size:12.5px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .nmeta { font-size:10.5px; color:var(--disabled-text-color); margin-top:2px;
          display:flex; align-items:center; gap:5px; }
        .nmeta ha-icon { --mdc-icon-size:11px; }
        .tag { padding:1px 6px; border-radius:10px; font-size:9px; font-weight:600; }
        .ncli { font-size:15px; font-weight:700; flex-shrink:0; min-width:26px; text-align:right; }
        .toggle { width:42px; height:24px; border-radius:12px; position:relative;
          cursor:pointer; flex-shrink:0; transition:background .3s ease; }
        .knob { width:18px; height:18px; border-radius:50%; background:#fff;
          position:absolute; top:3px; transition:left .25s ease;
          box-shadow:0 1px 3px rgba(0,0,0,.35); }
        .toggle.busy { opacity:.5; }
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
    const hass = this._hass, c = this._config, r = this.shadowRoot, nets = this._nets;
    const loc = wLoc(hass), t = (k, n) => wT(hass, k, n);

    r.querySelector("ha-card").style.borderColor = wRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = wRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || t("title");

    let active = 0, totalCli = 0, hasCli = false, missing = 0;
    nets.forEach((n) => {
      const st = n.entity ? hass.states[n.entity] : null;
      if (n.entity && !st) missing++;
      if (st && st.state === "on") active++;
      if (n.clients && hass.states[n.clients]) {
        const v = parseFloat(hass.states[n.clients].state);
        if (!isNaN(v)) { totalCli += v; hasCli = true; }
      }
    });

    const plural = new Intl.PluralRules(wLang(hass)).select(active) === "one" ? "active_one" : "active_other";
    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_on + '">' + wEsc(t(plural, active)) + "</b>" +
      " / " + nets.length +
      (hasCli ? " · " + totalCli.toLocaleString(loc) + " " + t("clients") : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (missing || !nets.length) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = nets.length ? t("missing", missing) : t("none");
      list.appendChild(w);
    }

    nets.forEach((n) => {
      const st = n.entity ? hass.states[n.entity] : null;
      const on = st ? st.state === "on" : false;
      const avail = !!st;
      const cliSt = n.clients ? hass.states[n.clients] : null;
      const busy = this._pending[n.entity];

      const el = document.createElement("div");
      el.className = "net" + (on ? "" : " off");

      const meta = [];
      if (n.guest) meta.push('<span class="tag" style="background:' + wRgba("#BA7517", 0.15) +
        ';color:#BA7517">' + wEsc(t("guest")) + "</span>");
      if (n.band) meta.push("<span>" + wEsc(n.band) + "</span>");
      if (!avail) meta.push('<span style="color:#E24B4A">' + wEsc(t("missing_ent")) + "</span>");
      else if (!on) meta.push("<span>" + wEsc(t("disabled")) + "</span>");

      el.innerHTML =
        '<div class="nic" style="background:' + wRgba(on ? c.color_on : c.color_off, on ? 0.16 : 0.08) + '">' +
          '<ha-icon icon="' + wEsc(on ? (n.icon || "mdi:wifi") : "mdi:wifi-off") +
            '" style="color:' + (on ? c.color_on : c.color_off) + '"></ha-icon>' +
        "</div>" +
        '<div class="nbody">' +
          '<div class="nname">' + wEsc(n.name || (st && st.attributes.friendly_name) || n.entity || t("net")) + "</div>" +
          (meta.length ? '<div class="nmeta">' + meta.join("") + "</div>" : "") +
        "</div>" +
        (cliSt ? '<div class="ncli" style="color:' + (on ? c.accent : c.color_off) + '">' +
          wEsc(wFmt(cliSt, undefined, loc)) + "</div>" : "") +
        '<div class="toggle' + (busy ? " busy" : "") + '"><div class="knob"></div></div>';

      const tg = el.querySelector(".toggle");
      tg.style.background = on ? c.color_on : "rgba(255,255,255,0.2)";
      el.querySelector(".knob").style.left = on ? "21px" : "3px";

      if (avail) {
        tg.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._pending[n.entity]) return;
          if (on && c.confirm_disable) {
            if (!window.confirm(t("confirm", n.name || n.entity))) return;
          }
          this._pending[n.entity] = true;
          this._render();
          /* switch.* and input_boolean.* both support <domain>.toggle */
          this._hass.callService(n.entity.split(".")[0], "toggle", { entity_id: n.entity });
          setTimeout(() => { delete this._pending[n.entity]; this._render(); }, 2500);
        });
      } else {
        tg.style.opacity = ".3";
        tg.style.cursor = "not-allowed";
      }

      el.querySelector(".nbody").addEventListener("click", () =>
        this._more(n.clients || n.entity));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + (this._nets || this._config.networks).length; }
  static getStubConfig(hass) {
    /* With detected WLANs the card lists them itself; otherwise one placeholder row */
    return hass && wWlans(hass).length
      ? { type: "custom:unifi-wifi-card" }
      : { type: "custom:unifi-wifi-card", networks: [{ name: "SSID 1" }] };
  }
  static getConfigElement() { return document.createElement("unifi-wifi-card-editor"); }
}
customElements.define("unifi-wifi-card", UnifiWifiCard);

/* ================= EDITOR ================= */
const UWF_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "confirm_disable", selector: { boolean: {} } },
];
const UWF_S_NET = [
  { name: "device", selector: { device: { filter: { integration: "unifi" } } } },
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "entity", selector: { entity: { filter: { domain: ["switch", "input_boolean"] } } } },
    { name: "clients", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "band", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "guest", selector: { boolean: {} } },
];

/* Collapsible sections: open/closed state survives editor re-creation */
const UWF_OPEN = new Map();
const wSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '">' +
    '<button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
      '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>' +
      '<span class="sec-title">' + title + "</span></button>" +
    '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const wInitSecs = (root, tag, t) => {
  const secs = [...root.querySelectorAll(".sec")];
  const all = root.querySelector(".tog-all");
  const closed = (s) => s.querySelector(".sec-body").hidden;
  const set = (s, open) => {
    s.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    s.querySelector(".sec-body").hidden = !open;
    UWF_OPEN.set(tag + ":" + s.dataset.sec, open);
  };
  const sync = () => { all.textContent = t(secs.some(closed) ? "expand_all" : "collapse_all"); };
  secs.forEach((s, i) => {
    const k = tag + ":" + s.dataset.sec;
    set(s, UWF_OPEN.has(k) ? UWF_OPEN.get(k) : i === 0);
    s.querySelector(".sec-head").addEventListener("click", () => { set(s, closed(s)); sync(); });
  });
  all.addEventListener("click", () => { const open = secs.some(closed); secs.forEach((s) => set(s, open)); sync(); });
  sync();
};

class UnifiWifiCardEditor extends HTMLElement {
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
  _t(k, n) { return wT(this._hass, k, n); }
  _label(s) { return UWF_L[wLang(this._hass)][s.name] || s.name; }

  _build() {
    const t = (k) => wEsc(this._t(k));
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
      ${wSec("general", t("general"), '<ha-form class="f-gen"></ha-form>')}
      ${wSec("colors", t("colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("accent")}</label></div>
          <div class="color-field"><input type="color" class="c-on"><label>${t("on")}</label></div>
        </div>`)}
      ${wSec("networks", t("nets_sec"), `
        <div class="sec-hint">${t("hint")}</div>
        <div class="rows-net"></div>
        <div class="addbtn add-net"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    wInitSecs(r, this.localName, (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = UWF_S_GEN; f.computeLabel = (s) => this._label(s);
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
    bindColor(".c-on", "color_on");
    r.querySelector(".add-net").addEventListener("click", () => {
      this._config.networks = (this._config.networks || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._built || !this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:wifi-cog",
      confirm_disable: c.confirm_disable === true,
    };
    this._setColor(".c-accent", c.accent || "#378ADD");
    this._setColor(".c-on", c.color_on || "#1D9E75");

    const box = r.querySelector(".rows-net");
    const list = c.networks || [];
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
    num.textContent = item.name || (item.device && wDevName(this._hass, item.device)) || this._t("row", index + 1);
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
      this._config.networks = this._config.networks.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = UWF_S_NET; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.networks || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined || (k === "guest" && m[k] === false)) delete m[k];
      });
      l[index] = m; this._config.networks = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.networks || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.networks = l; this._emit(); this._update(true);
  }
}
customElements.define("unifi-wifi-card-editor", UnifiWifiCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-wifi-card",
  name: "UniFi WiFi Card",
  description: wT(null, "desc"),
});
console.info("%c UNIFI-WIFI-CARD %c v" + UWF_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
CONFIG EXAMPLES

# Every UniFi WLAN, detected automatically
type: custom:unifi-wifi-card

# Explicit list
type: custom:unifi-wifi-card
icon: mdi:wifi-cog
accent: "#378ADD"
color_on: "#1D9E75"
confirm_disable: false
networks:
  - device: 0123456789abcdef0123456789abcdef   # entity / clients detected
    band: 2.4 + 5 GHz
  - name: Example_SSID
    entity: switch.example_ssid
    clients: sensor.example_ssid_clients
  - name: Example_Guest
    entity: switch.example_guest
    clients: sensor.example_guest_clients
    guest: true
============================================================ */
