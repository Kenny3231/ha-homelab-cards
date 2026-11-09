/**
 * UniFi Switch Card — port grid with link speed
 * Version 1.2.0
 *
 * Loaded by the Homelab Cards integration. Works with the native UniFi Network
 * integration: set `device` and the state, clients, uptime, update, ports and
 * CPU/RAM entities are detected automatically (explicit keys always win).
 */

const USW_VERSION = "1.2.0";

/* ---------- i18n ---------- */
const USW_I18N = {
  fr: {
    title: "Switch", online: "En ligne", offline: "Hors ligne",
    ports_active: "{n} ports actifs", clients: "clients", up_since: "Actif depuis {n}",
    upd_on: "MAJ dispo", upd_off: "À jour", port: "Port",
    general: "Général", colors: "Couleurs", ports_sec: "Ports", totals_sec: "Totaux",
    speed_hint: "Les ports se colorent automatiquement selon leur vitesse : 10G ambre, 2.5G vert, 1G bleu, en dessous violet.",
    ports_hint: "Un port sans vitesse de liaison s'affiche déconnecté. Survole un port pour voir son trafic. Laisse la liste vide pour détecter les ports de l'appareil UniFi choisi.",
    totals_hint: "Rangée du bas : trafic global, CPU, mémoire… Vide = CPU / RAM de l'appareil UniFi choisi.",
    add_port: "Ajouter un port", add_tot: "Ajouter un total", empty: "Aucun élément.",
    color: "Couleur", expand_all: "Tout déplier", collapse_all: "Tout replier",
    desc: "Switch UniFi : grille de ports colorée par vitesse de lien.",
  },
  en: {
    title: "Switch", online: "Online", offline: "Offline",
    ports_active: "{n} active ports", clients: "clients", up_since: "Up since {n}",
    upd_on: "Update available", upd_off: "Up to date", port: "Port",
    general: "General", colors: "Colors", ports_sec: "Ports", totals_sec: "Totals",
    speed_hint: "Ports are colored by link speed: 10G amber, 2.5G green, 1G blue, slower purple.",
    ports_hint: "A port without link speed shows as disconnected. Hover a port to see its traffic. Leave the list empty to detect the ports of the selected UniFi device.",
    totals_hint: "Bottom row: global traffic, CPU, memory… Empty = CPU / RAM of the selected UniFi device.",
    add_port: "Add a port", add_tot: "Add a total", empty: "No item.",
    color: "Color", expand_all: "Expand all", collapse_all: "Collapse all",
    desc: "UniFi switch: port grid colored by link speed.",
  },
};
const USW_L = {
  fr: {
    title: "Titre", icon: "Icône", device: "Appareil UniFi (détection auto)",
    state_entity: "Capteur d'état",
    clients_entity: "Nombre de clients", uptime_entity: "Temps de fonctionnement",
    update_entity: "Entité de mise à jour", columns: "Colonnes dans la grille",
    name: "Nom du port", link_speed: "Vitesse de liaison", rx: "Réception", tx: "Émission",
    entity: "Entité", digits: "Décimales",
  },
  en: {
    title: "Title", icon: "Icon", device: "UniFi device (auto-detect)",
    state_entity: "State sensor",
    clients_entity: "Client count", uptime_entity: "Uptime",
    update_entity: "Update entity", columns: "Grid columns",
    name: "Port name", link_speed: "Link speed", rx: "Download", tx: "Upload",
    entity: "Entity", digits: "Decimals",
  },
};
const sLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) ||
  (typeof document !== "undefined" && document.documentElement.lang) || "en";
const sLang = (h) => (String(sLoc(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
const sT = (h, k, n) => {
  const d = USW_I18N[sLang(h)];
  const s = d[k] !== undefined ? d[k] : USW_I18N.en[k];
  return n === undefined ? s : s.replace("{n}", n);
};

/* ---------- helpers ---------- */
const sRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const sFmt = (st, d, loc) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString(loc, { maximumFractionDigits: d === undefined ? 1 : d });
};
const sUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const sEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sBad = (st) => !st || st.state === "unavailable" || st.state === "unknown";
const sOnline = (st) => {
  if (!st) return true;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};
/* Uptime sensors of the UniFi integration are timestamps: format them with the user locale */
const sSince = (st, loc) => {
  const d = new Date(st.state);
  return st.attributes && (st.attributes.device_class === "timestamp" || /^\d{4}-\d\d-\d\dT/.test(st.state)) && !isNaN(d)
    ? d.toLocaleString(loc, { dateStyle: "short", timeStyle: "short" }) : st.state;
};

/* Formats a link speed in Mbit/s as a short label */
function linkLabel(raw, loc) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "" || s === "0" || s === "none") return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return String(raw);
  if (n <= 0) return null;
  if (n >= 1000) return (n / 1000).toLocaleString(loc, { maximumFractionDigits: 1 }) + "G";
  return n.toFixed(0) + "M";
}

/* ---------- UniFi auto-detection (hass.entities / hass.devices) ---------- */
const sPortNum = (id) => { const m = /(\d+)(?!.*\d)/.exec(id.split(".")[1] || ""); return m ? m[1] : null; };
const sAuto = (hass, devId) => {
  const ents = Object.values(hass.entities || {})
    .filter((e) => e.device_id === devId && e.platform === "unifi");
  const tk = (key) => ents.filter((x) => x.translation_key === key).map((x) => x.entity_id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const up = ents.find((x) => x.entity_id.indexOf("sensor.") === 0 && !x.translation_key &&
    hass.states[x.entity_id] && hass.states[x.entity_id].attributes.device_class === "timestamp");
  const upd = ents.find((x) => x.entity_id.indexOf("update.") === 0);
  /* Pair port rx/tx with link speed through the port number found in the entity id */
  const byNum = (ids) => { const m = {}; ids.forEach((id) => { const n = sPortNum(id); if (n) m[n] = m[n] ? null : id; }); return m; };
  const rx = byNum(tk("port_bandwidth_rx")), tx = byNum(tk("port_bandwidth_tx"));
  const ports = tk("port_link_speed").map((id, i) => {
    const n = sPortNum(id);
    const p = { name: "P" + (n || i + 1), link_speed: id };
    if (n && rx[n]) p.rx = rx[n];
    if (n && tx[n]) p.tx = tx[n];
    return p;
  });
  const totals = [];
  const cpu = tk("device_cpu_utilization")[0], mem = tk("device_memory_utilization")[0];
  if (cpu) totals.push({ entity: cpu, name: "CPU", color: "#378ADD", digits: 0 });
  if (mem) totals.push({ entity: mem, name: "RAM", color: "#7F77DD", digits: 0 });
  const dev = hass.devices && hass.devices[devId];
  return {
    name: dev ? dev.name_by_user || dev.name : null,
    state_entity: tk("device_state")[0], clients_entity: tk("device_clients")[0],
    uptime_entity: up && up.entity_id, update_entity: upd && upd.entity_id,
    ports: ports, totals: totals,
  };
};

class UnifiSwitchCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:switch",
      accent: config.accent || "#1D9E75",
      accent_off: config.accent_off || "#E24B4A",
      device: config.device || null,
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
    this._r = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._resolve(hass);
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  /* Explicit config first, detection from `device` as fallback; recomputed only when the registry changes */
  _resolve(hass) {
    if (this._r && hass.entities === this._entsRef) return;
    this._entsRef = hass.entities;
    const c = this._config, a = c.device ? sAuto(hass, c.device) : {};
    this._r = {
      title: c.title || a.name || null,
      state_entity: c.state_entity || a.state_entity || null,
      clients_entity: c.clients_entity || a.clients_entity || null,
      uptime_entity: c.uptime_entity || a.uptime_entity || null,
      update_entity: c.update_entity || a.update_entity || null,
      ports: c.ports.length ? c.ports : a.ports || [],
      totals: c.totals.length ? c.totals : a.totals || [],
    };
  }

  _ids() {
    const c = this._r, ids = [];
    [c.state_entity, c.clients_entity, c.uptime_entity, c.update_entity].forEach((x) => x && ids.push(x));
    c.ports.forEach((p) => { ["link_speed", "rx", "tx"].forEach((k) => p[k] && ids.push(p[k])); });
    c.totals.forEach((t) => t.entity && ids.push(t.entity));
    return [...new Set(ids)];
  }
  _sig(h) {
    return sLoc(h) + "|" + this._r.ports.length + "|" + this._r.totals.length + "|" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Port color from its speed */
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
      this._more(this._r.state_entity || this._r.clients_entity);
    });
  }

  _render() {
    const hass = this._hass, c = this._config, rc = this._r, r = this.shadowRoot;
    const loc = sLoc(hass), t = (k, n) => sT(hass, k, n);
    const stateSt = rc.state_entity ? hass.states[rc.state_entity] : null;
    const online = rc.state_entity ? sOnline(stateSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = sRgba(accent, 0.28);
    card.style.boxShadow = "0 0 24px " + sRgba(accent, 0.09);

    const disc = r.querySelector(".disc");
    disc.style.background = sRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = rc.title || t("title");

    /* Active ports = those with a usable link speed */
    let active = 0;
    const portData = rc.ports.map((p) => {
      const lsSt = p.link_speed ? hass.states[p.link_speed] : null;
      const label = lsSt ? linkLabel(lsSt.state, loc) : null;
      const mbits = lsSt ? parseFloat(lsSt.state) : NaN;
      const up = label !== null;
      if (up) active++;
      return { p: p, label: label, color: up ? this._portColor(isNaN(mbits) ? 1000 : mbits) : null, up: up };
    });

    const stateTxt = stateSt
      ? (typeof hass.formatEntityState === "function" ? hass.formatEntityState(stateSt) : stateSt.state)
      : t(online ? "online" : "offline");
    const bits = ['<b style="color:' + accent + '">' + sEsc(stateTxt) + "</b>"];
    if (rc.ports.length) bits.push(sEsc(t("ports_active", active + "/" + rc.ports.length)));
    if (rc.clients_entity && hass.states[rc.clients_entity]) {
      bits.push(sEsc(sFmt(hass.states[rc.clients_entity], 0, loc)) + " " + t("clients"));
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    /* Uptime has its own line so it is never truncated */
    const sub = r.querySelector(".subline");
    const upSt = rc.uptime_entity ? hass.states[rc.uptime_entity] : null;
    if (!sBad(upSt)) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = t("up_since", sSince(upSt, loc));
      sub.onclick = () => this._more(rc.uptime_entity);
      sub.style.cursor = "pointer";
    } else sub.classList.add("hidden");

    const badge = r.querySelector(".badge");
    if (rc.update_entity && hass.states[rc.update_entity]) {
      const up = hass.states[rc.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = t(up ? "upd_on" : "upd_off");
      badge.style.background = sRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(rc.update_entity); };
    } else badge.classList.add("hidden");

    /* Port grid */
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

        /* Tooltip: port traffic */
        const tips = [];
        if (d.p.rx && hass.states[d.p.rx]) {
          tips.push("↓ " + sFmt(hass.states[d.p.rx], undefined, loc) + " " + sUnit(hass.states[d.p.rx]));
        }
        if (d.p.tx && hass.states[d.p.tx]) {
          tips.push("↑ " + sFmt(hass.states[d.p.tx], undefined, loc) + " " + sUnit(hass.states[d.p.tx]));
        }
        el.title = (d.p.name || t("port") + " " + (i + 1)) + (tips.length ? "\n" + tips.join("\n") : "");

        el.innerHTML =
          '<div class="pn">' + sEsc(d.p.name || "P" + (i + 1)) + "</div>" +
          '<ha-icon icon="' + (d.up ? "mdi:lan-connect" : "mdi:lan-disconnect") +
            '" style="color:' + col + '"></ha-icon>' +
          '<div class="ps" style="color:' + col + '">' + sEsc(d.label || "—") + "</div>";
        el.addEventListener("click", () => this._more(d.p.link_speed || d.p.rx || d.p.tx));
        grid.appendChild(el);
      });
    } else grid.classList.add("hidden");

    /* Totals */
    const tot = r.querySelector(".totals");
    if (rc.totals.length) {
      tot.classList.remove("hidden");
      tot.innerHTML = "";
      rc.totals.forEach((tt) => {
        const st = tt.entity ? hass.states[tt.entity] : null;
        const el = document.createElement("div");
        el.className = "tot";
        el.innerHTML =
          '<div class="v" style="color:' + (tt.color || "var(--primary-text-color)") + '">' +
            sEsc(sFmt(st, tt.digits === undefined ? 1 : tt.digits, loc)) +
            (sUnit(st) ? " " + sEsc(sUnit(st)) : "") + "</div>" +
          '<div class="n">' + sEsc(tt.name || (st && st.attributes.friendly_name) || tt.entity || "—") + "</div>";
        el.addEventListener("click", () => this._more(tt.entity));
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
    const c = this._r || this._config;
    return 2 + (c.ports.length ? Math.ceil(c.ports.length / this._config.columns) + 1 : 0) + (c.totals.length ? 1 : 0);
  }
  static getStubConfig(hass) {
    /* Pick the UniFi device exposing the most port entities, if any */
    const cnt = {};
    Object.values((hass && hass.entities) || {}).forEach((e) => {
      if (e.platform === "unifi" && e.device_id && /^(port_|poe_port)/.test(e.translation_key || "")) {
        cnt[e.device_id] = (cnt[e.device_id] || 0) + 1;
      }
    });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    return best ? { type: "custom:unifi-switch-card", device: best } : { type: "custom:unifi-switch-card" };
  }
  static getConfigElement() { return document.createElement("unifi-switch-card-editor"); }
}
customElements.define("unifi-switch-card", UnifiSwitchCard);

/* ================= EDITOR ================= */
const USW_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "device", selector: { device: { filter: { integration: "unifi" } } } },
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

/* Collapsible sections: open/closed state survives editor re-creation */
const USW_OPEN = new Map();
const sSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '">' +
    '<button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
      '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>' +
      '<span class="sec-title">' + title + "</span></button>" +
    '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const sInitSecs = (root, tag, t) => {
  const secs = [...root.querySelectorAll(".sec")];
  const all = root.querySelector(".tog-all");
  const closed = (s) => s.querySelector(".sec-body").hidden;
  const set = (s, open) => {
    s.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    s.querySelector(".sec-body").hidden = !open;
    USW_OPEN.set(tag + ":" + s.dataset.sec, open);
  };
  const sync = () => { all.textContent = t(secs.some(closed) ? "expand_all" : "collapse_all"); };
  secs.forEach((s, i) => {
    const k = tag + ":" + s.dataset.sec;
    set(s, USW_OPEN.has(k) ? USW_OPEN.get(k) : i === 0);
    s.querySelector(".sec-head").addEventListener("click", () => { set(s, closed(s)); sync(); });
  });
  all.addEventListener("click", () => { const open = secs.some(closed); secs.forEach((s) => set(s, open)); sync(); });
  sync();
};

class UnifiSwitchCardEditor extends HTMLElement {
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
  _t(k, n) { return sT(this._hass, k, n); }
  _label(s) { return USW_L[sLang(this._hass)][s.name] || s.name; }

  _build() {
    const t = (k) => sEsc(this._t(k));
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
      ${sSec("general", t("general"), '<ha-form class="f-gen"></ha-form>')}
      ${sSec("colors", t("colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>${t("online")}</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>${t("offline")}</label></div>
        </div>
        <div class="sec-hint">${t("speed_hint")}</div>`)}
      ${sSec("ports", t("ports_sec"), `
        <div class="sec-hint">${t("ports_hint")}</div>
        <div class="rows-ports"></div>
        <div class="addbtn add-port"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_port")}</span></div>`)}
      ${sSec("totals", t("totals_sec"), `
        <div class="sec-hint">${t("totals_hint")}</div>
        <div class="rows-tot"></div>
        <div class="addbtn add-tot"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_tot")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    sInitSecs(r, this.localName, (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = USW_S_GEN; f.computeLabel = (s) => this._label(s);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      ["title", "device", "state_entity", "clients_entity", "uptime_entity", "update_entity"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let tm = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
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
    if (!this._built || !this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:switch", device: c.device || "",
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
        e.className = "empty"; e.textContent = this._t("empty");
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
    num.textContent = item.name || (key === "ports" ? this._t("port") + " #" : "#") + (index + 1);
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
    f.schema = schema; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
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
      let tm = null;
      ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      ci.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
      const cl = document.createElement("label"); cl.textContent = this._t("color");
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
  description: sT(null, "desc"),
});
console.info("%c UNIFI-SWITCH-CARD %c v" + USW_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
CONFIG EXAMPLES

# Auto-detection from the UniFi device (device id picked in the editor)
type: custom:unifi-switch-card
device: 0123456789abcdef0123456789abcdef

# Fully explicit
type: custom:unifi-switch-card
title: Example switch
icon: mdi:switch
state_entity: sensor.example_switch_state
clients_entity: sensor.example_switch_clients
uptime_entity: sensor.example_switch_uptime
update_entity: update.example_switch
columns: 5
ports:
  - name: P1
    link_speed: sensor.example_switch_port_1_link_speed
    rx: sensor.example_switch_port_1_rx
    tx: sensor.example_switch_port_1_tx
  - name: P2
    link_speed: sensor.example_switch_port_2_link_speed
totals:
  - entity: sensor.example_switch_cpu_utilization
    name: CPU
    color: "#378ADD"
    digits: 0
  - entity: sensor.example_switch_memory_utilization
    name: RAM
    color: "#7F77DD"
    digits: 0
============================================================ */
