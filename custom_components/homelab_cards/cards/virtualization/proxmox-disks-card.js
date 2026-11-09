/**
 * Proxmox Disks Card — physical disks (S.M.A.R.T. health)
 * Version 1.1.0
 *
 * ⚠️ An SSD "wearout" is ambiguous depending on the disk and firmware:
 *    some report the consumed wear (0 = new), others the remaining life
 *    (100 = new). Set `wearout_mode` per disk:
 *      used      → the value IS the wear  (0 % = new)
 *      remaining → the value is the remaining life (100 % = new)
 *    When in doubt, compare with the disk's age: a recent disk showing
 *    95 % wear is almost certainly in "remaining" mode.
 *
 * Loaded automatically by the Homelab Cards integration.
 * With an empty `disks` list, disks are detected from the Proxmox VE (HACS
 * "proxmoxve") integration through the entity/device registries
 * (platform + translation_key), never from names or UI language.
 */

const PDISK_VERSION = "1.1.0";

/* ---------- i18n ---------- */
const PD_I18N = {
  en: {
    def_title: "Disks", healthy_1: "{0} healthy", healthy_n: "{0} healthy",
    disk_1: "{0} disk", disk_n: "{0} disks", disk: "Disk", failing: "failing", ok: "healthy",
    wear: "Wear", cycles: "{0} cycles",
    y: ["year", "years"], d: ["day", "days"], d_short: "d",
    none: "No disk found (Proxmox VE integration).",
    /* editor */
    title: "Title", icon: "Icon", warn_at: "Wear — warning threshold (%)",
    critical_at: "Wear — critical threshold (%)", temp_warn: "Warning temperature (°C)",
    temp_critical: "Critical temperature (°C)", show_wearout: "Show the wear bar",
    node: "Node (name or device ID, auto-detection)",
    name: "Disk name", health: "Health (S.M.A.R.T.)",
    health_invert: "Invert health reading", wearout: "Wear",
    wearout_mode: "Wear interpretation", temperature: "Temperature",
    power_on_hours: "Power-on hours", power_cycles: "Power cycles", size: "Size",
    m_used: "Consumed wear (0 % = new)", m_remaining: "Remaining life (100 % = new)",
    s_general: "General", s_color: "Color", s_disks: "Disks",
    c_accent: "Accent", empty: "No disk.", add: "Add a disk", disk_hash: "Disk #{0}",
    expand_all: "Expand all", collapse_all: "Collapse all",
    hint_disks: "The “Wear interpretation” field matters: depending on the disk, Proxmox reports either the consumed wear or the remaining life. If a recent disk shows huge wear, switch to “Remaining life”.<br>If a healthy disk is marked failing, tick “Invert health reading”.<br>Leave the list empty to detect disks automatically.",
    desc: "Physical disks: S.M.A.R.T. health, wear, temperature.",
  },
  fr: {
    def_title: "Disques", healthy_1: "{0} sain", healthy_n: "{0} sains",
    disk_1: "{0} disque", disk_n: "{0} disques", disk: "Disque", failing: "défaillant", ok: "sain",
    wear: "Usure", cycles: "{0} cycles",
    y: ["an", "ans"], d: ["jour", "jours"], d_short: "j",
    none: "Aucun disque détecté (intégration Proxmox VE).",
    title: "Titre", icon: "Icône", warn_at: "Usure — seuil d'alerte (%)",
    critical_at: "Usure — seuil critique (%)", temp_warn: "Température d'alerte (°C)",
    temp_critical: "Température critique (°C)", show_wearout: "Afficher la barre d'usure",
    node: "Nœud (nom ou ID d'appareil, détection auto)",
    name: "Nom du disque", health: "Santé (S.M.A.R.T.)",
    health_invert: "Inverser la lecture de la santé", wearout: "Usure",
    wearout_mode: "Interprétation de l'usure", temperature: "Température",
    power_on_hours: "Heures de fonctionnement", power_cycles: "Cycles d'alimentation", size: "Taille",
    m_used: "Usure consommée (0 % = neuf)", m_remaining: "Vie restante (100 % = neuf)",
    s_general: "Général", s_color: "Couleur", s_disks: "Disques",
    c_accent: "Accent", empty: "Aucun disque.", add: "Ajouter un disque", disk_hash: "Disque #{0}",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    hint_disks: "Le champ « Interprétation de l'usure » compte : selon le disque, Proxmox rapporte soit l'usure consommée, soit la vie restante. Si un disque récent affiche une usure énorme, bascule sur « Vie restante ».<br>Si un disque sain est marqué défaillant, coche « Inverser la lecture de la santé ».<br>Laisse la liste vide pour détecter les disques automatiquement.",
    desc: "Disques physiques : santé S.M.A.R.T., usure, température.",
  },
};
const dLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const dDict = (loc) => PD_I18N[/^fr/i.test(loc) ? "fr" : "en"];
const dT = (h, k, a) => {
  const v = dDict(dLoc(h))[k];
  const s = v !== undefined ? v : (PD_I18N.en[k] !== undefined ? PD_I18N.en[k] : k);
  return a === undefined ? s : String(s).replace("{0}", a);
};

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
const dFmt = (st, d, h) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state === "unavailable" || st.state === "unknown" ? "—" : st.state;
  return n.toLocaleString(dLoc(h), { maximumFractionDigits: d === undefined ? 0 : d });
};
const dUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const dEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* A binary_sensor with device_class "problem" is INVERTED: "on" means a
   problem was detected, "off" that all is fine (Home Assistant shows "OK"
   for off). Without this reading a healthy disk is reported failing.
   `invert` forces it manually. */
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
  /* Some integrations return a label directly */
  if (s === "passed" || s === "ok" || s === "healthy" || s === "good") return true;
  if (s === "failed" || s === "failing" || s === "bad" || s === "ko") return false;
  return null;
};

/* Turns power-on hours into a readable duration */
function dHours(h, hass) {
  if (isNaN(h)) return null;
  const u = (k, n) => n + " " + dT(hass, k)[n > 1 ? 1 : 0];
  const y = Math.floor(h / 8760);
  const rest = h % 8760;
  const d = Math.floor(rest / 24);
  if (y >= 1) return u("y", y) + (d ? " " + d + " " + dT(hass, "d_short") : "");
  if (d >= 1) return u("d", d);
  return Math.floor(h) + " h";
}

/* ---------- proxmoxve auto-detection ---------- */
/* { device_id: { "<domain>.<translation_key>": entity_id } } for proxmoxve entities */
function pdByDevice(hass) {
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
function pdNodeId(hass, by, want) {
  const devs = hass.devices || {};
  return Object.keys(by).find((id) => {
    const e = by[id];
    if (!(e["sensor.node_status"] || e["sensor.qemu_on"] || e["sensor.lxc_on"] || e["button.start_all"])) return false;
    return [id, devs[id] && devs[id].name_by_user, devs[id] && devs[id].name]
      .some((x) => x && (x === want || String(x).endsWith(" " + want)));
  }) || null;
}
/* Disk devices expose disk-only sensors (disk_size, power_hours, wearout, life_left).
   proxmoxve's "disk_wearout" is already the consumed wear; "life_left" is remaining life. */
function pdDetect(hass, want) {
  if (!hass) return [];
  const by = pdByDevice(hass), devs = hass.devices || {};
  const nodeId = want ? pdNodeId(hass, by, want) : null;
  if (want && !nodeId) return [];
  return Object.keys(by).map((id) => {
    const e = by[id], d = devs[id] || {};
    if (!(e["sensor.disk_size"] || e["sensor.power_hours"] || e["sensor.disk_wearout"] || e["sensor.life_left"])) return null;
    if (nodeId && d.via_device_id !== nodeId) return null;
    const wear = e["sensor.disk_wearout"] || e["sensor.life_left"];
    return {
      name: d.name_by_user || d.name || id,
      health: e["binary_sensor.health"],
      wearout: wear,
      wearout_mode: wear && !e["sensor.disk_wearout"] ? "remaining" : "used",
      temperature: e["sensor.temperature"] || e["sensor.temperature_air"],
      power_on_hours: e["sensor.power_hours"],
      power_cycles: e["sensor.power_cycles"],
      size: e["sensor.disk_size"],
    };
  }).filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}

class ProxmoxDisksCard extends HTMLElement {
  setConfig(config) {
    this._auto = !(config.disks && config.disks.length);
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      color_ok: config.color_ok || "#1D9E75",
      color_ko: config.color_ko || "#E24B4A",
      warn_at: config.warn_at || 60,
      critical_at: config.critical_at || 85,
      temp_warn: config.temp_warn || 50,
      temp_critical: config.temp_critical || 60,
      show_wearout: config.show_wearout !== false,
      node: config.node || null,
      disks: this._auto ? [] : config.disks,
    };
    this._ents = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._auto && hass.entities !== this._ents) {
      this._ents = hass.entities;
      this._config.disks = pdDetect(hass, this._config.node);
    }
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
    return dLoc(h) + "#" + this._config.disks.length + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Returns the actual wear in %, whatever the disk's reporting mode */
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
    const t = (k, a) => dT(hass, k, a);

    r.querySelector("ha-card").style.borderColor = dRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = dRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || t("def_title");

    let healthy = 0, known = 0;
    c.disks.forEach((d) => {
      const st = d.health ? hass.states[d.health] : null;
      const ok = dOk(st, d.health_invert);
      if (ok !== null) { known++; if (ok) healthy++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (healthy === known ? c.color_ok : c.color_ko) + '">' +
        dEsc(t(healthy > 1 ? "healthy_n" : "healthy_1", healthy)) + "</b> / " + known
      : dEsc(t(c.disks.length > 1 ? "disk_n" : "disk_1", c.disks.length));

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (!c.disks.length) {
      const n = document.createElement("div");
      n.className = "none";
      n.textContent = t("none");
      list.appendChild(n);
    }

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
          '<span class="dk-name">' + dEsc(d.name || t("disk")) + "</span>" +
          (ok === false
            ? '<span class="badko"><ha-icon icon="mdi:alert"></ha-icon>' + dEsc(t("failing")) + "</span>"
            : ok === true
              ? '<span class="badok"><ha-icon icon="mdi:check-circle"></ha-icon>' + dEsc(t("ok")) + "</span>"
              : "") +
          (sizeSt ? '<span class="dk-size">' + dEsc(dFmt(sizeSt, 0, hass)) + " " +
            dEsc(dUnit(sizeSt)) + "</span>" : "") +
        "</div>";

      if (c.show_wearout && !isNaN(wearUsed)) {
        html +=
          '<div class="w-top"><span>' + dEsc(t("wear")) + "</span><span>" + wearUsed.toFixed(0) + " %</span></div>" +
          '<div class="w-t"><div class="w-f" style="width:' +
            Math.min(Math.max(wearUsed, 0), 100).toFixed(1) +
            "%;background:" + wearCol + '"></div></div>';
      }

      const foot = [];
      if (tempSt) foot.push('<span style="color:' + this._tempColor(temp) +
        '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + dEsc(dFmt(tempSt, 0, hass)) + " " +
        dEsc(dUnit(tempSt) || "°C") + "</span>");
      if (pohSt) {
        const lbl = dHours(dNum(pohSt), hass);
        foot.push('<span><ha-icon icon="mdi:power"></ha-icon> ' +
          dEsc(lbl || dFmt(pohSt, 0, hass) + " h") + "</span>");
      }
      if (pcSt) foot.push('<span><ha-icon icon="mdi:restart"></ha-icon> ' +
        dEsc(t("cycles", dFmt(pcSt, 0, hass))) + "</span>");
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
  static getStubConfig(hass) {
    /* JSON round-trip drops the undefined keys of entities that do not exist */
    const disks = JSON.parse(JSON.stringify(pdDetect(hass, null)));
    return { type: "custom:proxmox-disks-card", title: dT(hass, "def_title"),
      disks: disks.length ? disks : [{ name: dT(hass, "disk") + " 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-disks-card-editor"); }
}
customElements.define("proxmox-disks-card", ProxmoxDisksCard);

/* ================= EDITOR ================= */
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
  { name: "node", selector: { text: {} } },
];
const PD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const PD_S_DISK = (t) => [
  { name: "name", selector: { text: {} } },
  { name: "health", selector: { entity: { filter: { domain: ["binary_sensor", "sensor"] } } } },
  { name: "health_invert", selector: { boolean: {} } },
  { name: "wearout", selector: PD_SENSOR },
  { name: "wearout_mode", selector: { select: { mode: "dropdown", options: [
    { value: "used", label: t("m_used") },
    { value: "remaining", label: t("m_remaining") },
  ]}}},
  { name: "temperature", selector: PD_SENSOR },
  { name: "power_on_hours", selector: PD_SENSOR },
  { name: "power_cycles", selector: PD_SENSOR },
  { name: "size", selector: PD_SENSOR },
];

/* ---------- Collapsible editor sections (state kept across editor re-creations) ---------- */
const PD_SEC_STATE = new Map();
const PD_SEC_CSS = `
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
const pdSec = (id, title, body) =>
  '<div class="sec"><button type="button" class="sec-head" data-sec="' + id + '" aria-expanded="false" aria-controls="sec-' + id + '">' +
  '<ha-icon class="sec-chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + dEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '" hidden>' + body + "</div></div>";
/* Wires headers + "expand/collapse all"; the first section is open by default, the others closed */
function pdWireSections(root, tag, t) {
  const heads = Array.from(root.querySelectorAll(".sec-head"));
  const all = root.querySelector(".sec-all");
  const sync = () => {
    all.textContent = t(heads.some((h) => h.getAttribute("aria-expanded") !== "true") ? "expand_all" : "collapse_all");
  };
  const set = (h, open) => {
    h.setAttribute("aria-expanded", String(open));
    root.getElementById(h.getAttribute("aria-controls")).hidden = !open;
    PD_SEC_STATE.set(tag + ":" + h.dataset.sec, open);
  };
  heads.forEach((h, i) => {
    const k = tag + ":" + h.dataset.sec;
    set(h, PD_SEC_STATE.has(k) ? PD_SEC_STATE.get(k) : i === 0);
    h.addEventListener("click", () => { set(h, h.getAttribute("aria-expanded") !== "true"); sync(); });
  });
  all.addEventListener("click", () => {
    const open = heads.some((h) => h.getAttribute("aria-expanded") !== "true");
    heads.forEach((h) => set(h, open)); sync();
  });
  sync();
}

class ProxmoxDisksCardEditor extends HTMLElement {
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
  _t(k, a) { return dT(this._hass, k, a); }
  _label(s) { return this._t(s.name); }

  _build() {
    const t = (k) => dEsc(this._t(k));
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
        ${PD_SEC_CSS}
      </style>
      <div class="sec-tools"><button type="button" class="sec-all"></button></div>
      ${pdSec("general", this._t("s_general"), `<ha-form class="f-gen"></ha-form>`)}
      ${pdSec("color", this._t("s_color"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("c_accent")}</label></div>
        </div>`)}
      ${pdSec("disks", this._t("s_disks"), `
        <div class="sec-hint">${this._t("hint_disks")}</div>
        <div class="rows-disks"></div>
        <div class="addbtn add-disk"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    pdWireSections(r, this.tagName.toLowerCase(), (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = PD_S_GEN; f.computeLabel = (s) => this._label(s);
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
      show_wearout: c.show_wearout !== false, node: c.node || "",
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-disks");
    const list = c.disks || [];
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
    num.textContent = item.name || this._t("disk_hash", index + 1);
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
    f.schema = PD_S_DISK((k) => this._t(k)); f.computeLabel = (s) => this._label(s); f.hass = this._hass;
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
  description: dDict(document.documentElement.lang || navigator.language || "en").desc,
});
console.info("%c PROXMOX-DISKS-CARD %c v" + PDISK_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
CONFIG EXAMPLES

Minimal (auto-detection through the proxmoxve integration):

type: custom:proxmox-disks-card
node: example-node        # optional, only needed with several nodes

Explicit (entity IDs are placeholders, use your own):

type: custom:proxmox-disks-card
title: Disks
icon: mdi:harddisk
accent: "#7F77DD"
warn_at: 60
critical_at: 85
temp_warn: 50
temp_critical: 60
disks:
  - name: Example SSD
    health: binary_sensor.disk_example_ssd_health
    wearout: sensor.disk_example_ssd_wearout
    wearout_mode: used
    temperature: sensor.disk_example_ssd_temperature
    power_on_hours: sensor.disk_example_ssd_power_on_hours
    power_cycles: sensor.disk_example_ssd_power_cycles
    size: sensor.disk_example_ssd_size
============================================================ */
