/**
 * Proxmox Storage Card — PVE storage volumes
 * Version 1.0.0
 *
 * Loaded automatically by the Homelab Cards integration.
 * With an empty `storages` list, volumes are detected from the Proxmox VE (HACS
 * "proxmoxve") integration through the entity/device registries
 * (platform + translation_key + device model), never from names or UI language.
 */

const PSTOR_VERSION = "1.0.0";

/* ---------- i18n ---------- */
const PS_I18N = {
  en: {
    def_title: "Storage", vol_1: "{0} volume", vol_n: "{0} volumes", free_sum: "{0} free",
    crit_1: "{0} critical", crit_n: "{0} critical", volume: "Volume",
    used_d: "{0} used", free_d: "{0} free", total_d: "{0} total",
    a_crit: "critical space", a_warn: "keep an eye on it",
    none: "No storage found (Proxmox VE integration).",
    /* editor */
    title: "Title", icon: "Icon", warn_at: "Warning threshold (%)",
    critical_at: "Critical threshold (%)", show_detail: "Show details under the bar",
    sort: "Sort", name: "Volume name", percentage: "Used percentage",
    used: "Used", free: "Free", total: "Total", node: "Node (name or device ID, auto-detection)",
    o_config: "Configuration order", o_usage: "Fullest first", o_name: "Name",
    s_general: "General", s_color: "Color", s_volumes: "Volumes",
    c_accent: "Accent", color: "Color", empty: "No volume.", add: "Add a volume", vol_hash: "Volume #{0}",
    expand_all: "Expand all", collapse_all: "Collapse all",
    hint_color: "A bar turns amber at the warning threshold and red at the critical one, with an explicit label.",
    hint_volumes: "The percentage is enough for the bar. “Used / Free / Total” enrich the detail line. Leave the list empty to detect volumes automatically.",
    desc: "Proxmox storage volumes with alert thresholds.",
  },
  fr: {
    def_title: "Stockages", vol_1: "{0} volume", vol_n: "{0} volumes", free_sum: "{0} libres",
    crit_1: "{0} critique", crit_n: "{0} critiques", volume: "Volume",
    used_d: "{0} utilisés", free_d: "{0} libres", total_d: "{0} au total",
    a_crit: "espace critique", a_warn: "surveiller",
    none: "Aucun stockage détecté (intégration Proxmox VE).",
    title: "Titre", icon: "Icône", warn_at: "Seuil d'alerte (%)",
    critical_at: "Seuil critique (%)", show_detail: "Afficher le détail sous la barre",
    sort: "Tri", name: "Nom du volume", percentage: "Pourcentage utilisé",
    used: "Utilisé", free: "Libre", total: "Total", node: "Nœud (nom ou ID d'appareil, détection auto)",
    o_config: "Ordre de la configuration", o_usage: "Les plus remplis d'abord", o_name: "Nom",
    s_general: "Général", s_color: "Couleur", s_volumes: "Volumes",
    c_accent: "Accent", color: "Couleur", empty: "Aucun volume.", add: "Ajouter un volume", vol_hash: "Volume #{0}",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    hint_color: "Une barre passe en ambre au seuil d'alerte, en rouge au seuil critique, avec une mention explicite.",
    hint_volumes: "Le pourcentage suffit pour la barre. « Utilisé / Libre / Total » enrichissent la ligne de détail. Laisse la liste vide pour détecter les volumes automatiquement.",
    desc: "Volumes de stockage Proxmox avec seuils d'alerte.",
  },
};
const sLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const sDict = (loc) => PS_I18N[/^fr/i.test(loc) ? "fr" : "en"];
const sT = (h, k, a) => {
  const v = sDict(sLoc(h))[k];
  const s = v !== undefined ? v : (PS_I18N.en[k] !== undefined ? PS_I18N.en[k] : k);
  return a === undefined ? s : String(s).replace("{0}", a);
};

const sRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const sNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const sFmt = (st, d, h) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state === "unavailable" || st.state === "unknown" ? "—" : st.state;
  return n.toLocaleString(sLoc(h), { maximumFractionDigits: d === undefined ? 1 : d });
};
const sUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const sEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- proxmoxve auto-detection ---------- */
/* { device_id: { "<domain>.<translation_key>": entity_id } } for proxmoxve entities */
function psByDevice(hass) {
  const out = {};
  Object.values((hass && hass.entities) || {}).forEach((e) => {
    if (!e || e.platform !== "proxmoxve" || !e.device_id || !e.translation_key) return;
    if (!hass.states[e.entity_id]) return;
    const m = out[e.device_id] || (out[e.device_id] = {});
    m[e.entity_id.split(".")[0] + "." + e.translation_key] = e.entity_id;
  });
  return out;
}
/* Node device id matching `want` (device id, device name or "… <node>") */
function psNodeId(hass, by, want) {
  const devs = hass.devices || {};
  return Object.keys(by).find((id) => {
    const e = by[id];
    if (!(e["sensor.node_status"] || e["sensor.qemu_on"] || e["sensor.lxc_on"] || e["button.start_all"])) return false;
    return [id, devs[id] && devs[id].name_by_user, devs[id] && devs[id].name]
      .some((x) => x && (x === want || String(x).endsWith(" " + want)));
  }) || null;
}
/* Storage devices: model "Storage" / "Shared storage", or storage_* binary sensors */
function psDetect(hass, want) {
  if (!hass) return [];
  const by = psByDevice(hass), devs = hass.devices || {};
  const nodeId = want ? psNodeId(hass, by, want) : null;
  if (want && !nodeId) return [];
  return Object.keys(by).map((id) => {
    const e = by[id], d = devs[id] || {};
    const isStorage = /storage/i.test(d.model || "") ||
      e["binary_sensor.storage_active"] || e["binary_sensor.storage_enabled"];
    if (!isStorage || !(e["sensor.disk_used_perc"] || e["sensor.disk_used"])) return null;
    if (nodeId && d.via_device_id !== nodeId) return null;
    return {
      name: d.name_by_user || d.name || id,
      percentage: e["sensor.disk_used_perc"],
      used: e["sensor.disk_used"],
      free: e["sensor.disk_free"],
      total: e["sensor.disk_total"],
    };
  }).filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}

class ProxmoxStorageCard extends HTMLElement {
  setConfig(config) {
    this._auto = !(config.storages && config.storages.length);
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:database",
      accent: config.accent || "#1D9E75",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
      show_detail: config.show_detail !== false,
      sort: config.sort || "config",
      node: config.node || null,
      storages: this._auto ? [] : config.storages,
    };
    this._ents = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._auto && hass.entities !== this._ents) {
      this._ents = hass.entities;
      this._config.storages = psDetect(hass, this._config.node);
    }
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.storages.forEach((s) => {
      ["percentage", "used", "free", "total"].forEach((k) => s[k] && ids.push(s[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return sLoc(h) + "#" + this._config.storages.length + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _color(pct, base) {
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
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:8px; }
        .st { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; }
        .st:hover { background:rgba(255,255,255,0.07); }
        .st-top { display:flex; align-items:baseline; gap:8px; margin-bottom:7px; }
        .st-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .st-pct { font-size:11px; font-weight:700; flex-shrink:0; }
        .st-t { height:5px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .st-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .st-foot { font-size:10px; color:var(--disabled-text-color); margin-top:5px; }
        .alert { display:inline-flex; align-items:center; gap:3px; margin-left:6px; }
        .alert ha-icon { --mdc-icon-size:11px; }
        .none { font-size:11px; color:var(--secondary-text-color); font-style:italic; padding:2px; }
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
    const t = (k, a) => sT(hass, k, a);

    r.querySelector("ha-card").style.borderColor = sRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = sRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || t("def_title");

    /* Compute each volume */
    let items = c.storages.map((s) => {
      const pctSt = s.percentage ? hass.states[s.percentage] : null;
      const usedSt = s.used ? hass.states[s.used] : null;
      const freeSt = s.free ? hass.states[s.free] : null;
      const totSt = s.total ? hass.states[s.total] : null;
      let pct = sNum(pctSt);
      if (isNaN(pct)) {
        const u = sNum(usedSt), tt = sNum(totSt);
        if (!isNaN(u) && tt) pct = (u / tt) * 100;
      }
      return { s: s, pct: pct, usedSt: usedSt, freeSt: freeSt, totSt: totSt };
    });

    /* Total free space for the subtitle */
    let freeSum = 0, freeUnit = "", hasFree = false;
    items.forEach((it) => {
      const v = sNum(it.freeSt);
      if (!isNaN(v)) { freeSum += v; hasFree = true; freeUnit = sUnit(it.freeSt) || freeUnit; }
    });
    const nCrit = items.filter((it) => !isNaN(it.pct) && it.pct >= c.critical_at).length;
    const subBits = [sEsc(t(c.storages.length > 1 ? "vol_n" : "vol_1", c.storages.length))];
    if (hasFree) {
      subBits.push(sEsc(t("free_sum", freeSum.toLocaleString(sLoc(hass), { maximumFractionDigits: 0 }) +
        " " + freeUnit)));
    }
    if (nCrit) subBits.push('<span style="color:#E24B4A;font-weight:600">' +
      sEsc(t(nCrit > 1 ? "crit_n" : "crit_1", nCrit)) + "</span>");
    r.querySelector(".hsub").innerHTML = subBits.join(" · ");

    if (c.sort === "usage") items.sort((a, b) => (b.pct || 0) - (a.pct || 0));
    else if (c.sort === "name") {
      items.sort((a, b) => String(a.s.name || "").localeCompare(String(b.s.name || ""), sLoc(hass), { numeric: true }));
    }

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (!items.length) {
      const n = document.createElement("div");
      n.className = "none";
      n.textContent = t("none");
      list.appendChild(n);
    }

    items.forEach((it) => {
      const col = this._color(it.pct, it.s.color || c.accent);
      const el = document.createElement("div");
      el.className = "st";

      /* Detail: used · free · total */
      const q = (st) => sFmt(st, 0, hass) + " " + sUnit(st);
      const det = [];
      if (it.usedSt) det.push(sEsc(t("used_d", q(it.usedSt))));
      if (it.freeSt) det.push(sEsc(t("free_d", q(it.freeSt))));
      if (it.totSt) det.push(sEsc(t("total_d", q(it.totSt))));

      let alert = "";
      if (!isNaN(it.pct) && it.pct >= c.critical_at) {
        alert = '<span class="alert" style="color:#E24B4A">' +
          '<ha-icon icon="mdi:alert"></ha-icon>' + sEsc(t("a_crit")) + "</span>";
      } else if (!isNaN(it.pct) && it.pct >= c.warn_at) {
        alert = '<span class="alert" style="color:#BA7517">' +
          '<ha-icon icon="mdi:alert-outline"></ha-icon>' + sEsc(t("a_warn")) + "</span>";
      }

      el.innerHTML =
        '<div class="st-top">' +
          '<span class="st-name">' + sEsc(it.s.name || t("volume")) + "</span>" +
          '<span class="st-pct" style="color:' + col + '">' +
            (isNaN(it.pct) ? "—" : it.pct.toFixed(0) + " %") + "</span>" +
        "</div>" +
        '<div class="st-t"><div class="st-f" style="width:' +
          (isNaN(it.pct) ? 0 : Math.min(Math.max(it.pct, 0), 100)).toFixed(1) +
          "%;background:" + col + '"></div></div>' +
        (c.show_detail && (det.length || alert)
          ? '<div class="st-foot">' + det.join(" · ") + alert + "</div>" : "");

      el.addEventListener("click", () =>
        this._more(it.s.percentage || it.s.used || it.s.total));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.storages.length; }
  static getStubConfig(hass) {
    /* JSON round-trip drops the undefined keys of entities that do not exist */
    const storages = JSON.parse(JSON.stringify(psDetect(hass, null)));
    return { type: "custom:proxmox-storage-card", title: sT(hass, "def_title"),
      storages: storages.length ? storages : [{ name: sT(hass, "volume") + " 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-storage-card-editor"); }
}
customElements.define("proxmox-storage-card", ProxmoxStorageCard);

/* ================= EDITOR ================= */
const PS_S_GEN = (t) => [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { name: "sort", selector: { select: { mode: "dropdown", options: [
    { value: "config", label: t("o_config") },
    { value: "usage", label: t("o_usage") },
    { value: "name", label: t("o_name") },
  ]}}},
  { name: "show_detail", selector: { boolean: {} } },
  { name: "node", selector: { text: {} } },
];
const PS_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const PS_S_STOR = [
  { name: "name", selector: { text: {} } },
  { name: "percentage", selector: PS_SENSOR },
  { name: "used", selector: PS_SENSOR },
  { name: "free", selector: PS_SENSOR },
  { name: "total", selector: PS_SENSOR },
];

/* ---------- Collapsible editor sections (state kept across editor re-creations) ---------- */
const PS_SEC_STATE = new Map();
const PS_SEC_CSS = `
  .sec-tools { display:flex; justify-content:flex-end; margin-bottom:4px; }
  .sec-all { background:none; border:none; padding:2px 4px; border-radius:4px; cursor:pointer;
    font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-all:hover { color:var(--primary-text-color); }
  button.sec-head { width:100%; background:none; border:none; border-bottom:1px solid var(--divider-color);
    padding:0 0 6px 0; font:inherit; color:inherit; text-align:left; cursor:pointer; }
  .sec-head:focus-visible, .sec-all:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  .sec-chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; flex-shrink:0; }
  .sec-head[aria-expanded="false"] .sec-chev { transform:rotate(-90deg); }
  .sec-body[hidden] { display:none !important; }`;
const psSec = (id, title, body) =>
  '<div class="sec"><button type="button" class="sec-head" data-sec="' + id + '" aria-expanded="false" aria-controls="sec-' + id + '">' +
  '<ha-icon class="sec-chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + sEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '" hidden>' + body + "</div></div>";
/* Wires headers + "expand/collapse all"; the first section is open by default, the others closed */
function psWireSections(root, tag, t) {
  const heads = Array.from(root.querySelectorAll(".sec-head"));
  const all = root.querySelector(".sec-all");
  const sync = () => {
    all.textContent = t(heads.some((h) => h.getAttribute("aria-expanded") !== "true") ? "expand_all" : "collapse_all");
  };
  const set = (h, open) => {
    h.setAttribute("aria-expanded", String(open));
    root.getElementById(h.getAttribute("aria-controls")).hidden = !open;
    PS_SEC_STATE.set(tag + ":" + h.dataset.sec, open);
  };
  heads.forEach((h, i) => {
    const k = tag + ":" + h.dataset.sec;
    set(h, PS_SEC_STATE.has(k) ? PS_SEC_STATE.get(k) : i === 0);
    h.addEventListener("click", () => { set(h, h.getAttribute("aria-expanded") !== "true"); sync(); });
  });
  all.addEventListener("click", () => {
    const open = heads.some((h) => h.getAttribute("aria-expanded") !== "true");
    heads.forEach((h) => set(h, open)); sync();
  });
  sync();
}

class ProxmoxStorageCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    if (!this._hass) return;
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    this._hass = h;
    if (!this._config) return;
    /* Built once hass is known so the UI language is right from the start */
    if (!this._built) { this._build(); this._built = true; this._update(); }
    else this._refreshHass();
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
  _t(k, a) { return sT(this._hass, k, a); }
  _label(s) { return this._t(s.name); }

  _build() {
    const t = (k) => sEsc(this._t(k));
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
        ${PS_SEC_CSS}
      </style>
      <div class="sec-tools"><button type="button" class="sec-all"></button></div>
      ${psSec("general", this._t("s_general"), `<ha-form class="f-gen"></ha-form>`)}
      ${psSec("color", this._t("s_color"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("c_accent")}</label></div>
        </div>
        <div class="sec-hint">${t("hint_color")}</div>`)}
      ${psSec("volumes", this._t("s_volumes"), `
        <div class="sec-hint">${t("hint_volumes")}</div>
        <div class="rows-stor"></div>
        <div class="addbtn add-stor"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    psWireSections(r, this.tagName.toLowerCase(), (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = PS_S_GEN((k) => this._t(k)); f.computeLabel = (s) => this._label(s);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      if (!this._config.node) delete this._config.node;
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let tm = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });

    r.querySelector(".add-stor").addEventListener("click", () => {
      this._config.storages = (this._config.storages || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:database",
      warn_at: c.warn_at || 75, critical_at: c.critical_at || 90,
      sort: c.sort || "config", show_detail: c.show_detail !== false, node: c.node || "",
    };
    this._setColor(".c-accent", c.accent || "#1D9E75");

    const box = r.querySelector(".rows-stor");
    const list = c.storages || [];
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
    num.textContent = item.name || this._t("vol_hash", index + 1);
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
      this._config.storages = this._config.storages.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = PS_S_STOR; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.storages || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config.storages = l; this._emit();
    });
    row.appendChild(f);

    const cf = document.createElement("div");
    cf.className = "color-field"; cf.style.marginTop = "8px";
    const ci = document.createElement("input");
    ci.type = "color"; ci.value = item.color || "#1D9E75";
    const apply = (v) => {
      const l = (this._config.storages || []).slice();
      l[index] = Object.assign({}, l[index], { color: v });
      this._config.storages = l; this._emit();
    };
    let tm = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = this._t("color");
    cf.appendChild(ci); cf.appendChild(cl); row.appendChild(cf);
    return row;
  }

  _move(i, d) {
    const l = (this._config.storages || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.storages = l; this._emit(); this._update(true);
  }
}
customElements.define("proxmox-storage-card-editor", ProxmoxStorageCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxmox-storage-card",
  name: "Proxmox Storage Card",
  description: sDict(document.documentElement.lang || navigator.language || "en").desc,
});
console.info("%c PROXMOX-STORAGE-CARD %c v" + PSTOR_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
CONFIG EXAMPLES

Minimal (auto-detection through the proxmoxve integration):

type: custom:proxmox-storage-card
node: example-node        # optional, only needed with several nodes

Explicit (entity IDs are placeholders, use your own):

type: custom:proxmox-storage-card
title: Storage
icon: mdi:database
accent: "#1D9E75"
warn_at: 75
critical_at: 90
sort: usage
show_detail: true
storages:
  - name: example-storage
    percentage: sensor.storage_example_disk_used_percentage
    used: sensor.storage_example_disk_used
    free: sensor.storage_example_disk_free
    total: sensor.storage_example_disk_total
============================================================ */
