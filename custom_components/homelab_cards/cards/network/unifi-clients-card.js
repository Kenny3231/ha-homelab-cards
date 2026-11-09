/**
 * UniFi Clients Card — équipements connectés
 * Version 1.0.0
 *
 * Deux modes cumulables :
 *   - liste manuelle (devices:)   → contrôle total, icônes et trafic par appareil
 *   - découverte auto (auto:)     → tous les device_tracker, filtrables par plage IP
 *
 * ⚠️ Le filtre par plage IP suppose que tes device_tracker exposent un attribut IP.
 *    Vérifie dans Developer Tools → States. Le nom de l'attribut est configurable
 *    via `auto.ip_attribute` (défaut : "ip"). Sans attribut IP, le filtre de plage
 *    est ignoré et tous les appareils passent (voir `auto.require_ip`).
 *
 * Installation :
 *  1. config/www/perso/unifi-clients-card.js
 *  2. Resources → /local/perso/unifi-clients-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const UCL_VERSION = "1.1.1";

const cRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const cFmt = (st, d) => {
  if (!st) return null;
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const cUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const cEsc = (s) => String(s).replace(/[&<>"']/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

/* ---------- Utilitaires IP ---------- */
function ipToLong(ip) {
  if (!ip) return null;
  const m = String(ip).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  let v = 0;
  for (let i = 1; i <= 4; i++) {
    const o = parseInt(m[i], 10);
    if (o > 255) return null;
    v = v * 256 + o;
  }
  return v;
}

/* Accepte : "192.168.1.0/24", "192.168.1.10-192.168.1.50", "192.168.1.*", "192.168.1.42" */
function parseRange(spec) {
  const s = String(spec).trim();
  if (!s) return null;

  if (s.indexOf("/") !== -1) {
    const parts = s.split("/");
    const base = ipToLong(parts[0]);
    const bits = parseInt(parts[1], 10);
    if (base === null || isNaN(bits) || bits < 0 || bits > 32) return null;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    const net = (base & mask) >>> 0;
    const bcast = (net | (~mask >>> 0)) >>> 0;
    return { lo: net, hi: bcast };
  }
  if (s.indexOf("-") !== -1) {
    const parts = s.split("-");
    let lo = ipToLong(parts[0]);
    let hi = ipToLong(parts[1]);
    // Forme courte "192.168.1.10-50"
    if (hi === null && /^\d{1,3}$/.test(parts[1].trim()) && lo !== null) {
      hi = (lo - (lo % 256)) + parseInt(parts[1], 10);
    }
    if (lo === null || hi === null) return null;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    return { lo: lo, hi: hi };
  }
  if (s.indexOf("*") !== -1) {
    const lo = ipToLong(s.replace(/\*/g, "0"));
    const hi = ipToLong(s.replace(/\*/g, "255"));
    if (lo === null || hi === null) return null;
    return { lo: lo, hi: hi };
  }
  const one = ipToLong(s);
  return one === null ? null : { lo: one, hi: one };
}

function inRanges(ip, ranges) {
  const v = ipToLong(ip);
  if (v === null) return false;
  for (let i = 0; i < ranges.length; i++) {
    if (ranges[i] && v >= ranges[i].lo && v <= ranges[i].hi) return true;
  }
  return false;
}

class UnifiClientsCard extends HTMLElement {
  setConfig(config) {
    const auto = config.auto || {};
    this._config = {
      title: config.title || "Équipements",
      icon: config.icon || "mdi:devices",
      accent: config.accent || "#BA7517",
      color_home: config.color_home || "#1D9E75",
      color_away: config.color_away || "#4a4a48",
      color_rx: config.color_rx || "#378ADD",
      color_tx: config.color_tx || "#1D9E75",
      show_filters: config.show_filters !== false,
      max_items: config.max_items || 15,
      sort: config.sort || "status",
      sort_dir: config.sort_dir === "desc" ? "desc" : "asc",
      show_sort: config.show_sort !== false,
      devices: config.devices || [],
      auto: {
        enabled: auto.enabled === true,
        ip_ranges: auto.ip_ranges || [],
        ip_attribute: auto.ip_attribute || "ip",
        require_ip: auto.require_ip !== false,
        entity_prefix: auto.entity_prefix || "",
        exclude: auto.exclude || [],
      },
    };
    this._ranges = this._config.auto.ip_ranges.map(parseRange).filter(Boolean);
    this._filter = "all";
    this._sort = this._config.sort;
    this._dir = this._config.sort_dir;
    this._page = 0;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  /* Collecte les appareils : manuels puis auto (sans doublon) */
  _collect() {
    const hass = this._hass, c = this._config;
    const out = [];
    const seen = {};

    c.devices.forEach((d) => {
      if (!d.entity) return;
      seen[d.entity] = true;
      out.push({
        entity: d.entity, name: d.name, icon: d.icon,
        rx: d.rx, tx: d.tx, manual: true,
      });
    });

    if (c.auto.enabled) {
      const ex = c.auto.exclude || [];
      Object.keys(hass.states).forEach((id) => {
        if (id.indexOf("device_tracker.") !== 0) return;
        if (seen[id]) return;
        if (c.auto.entity_prefix && id.indexOf("device_tracker." + c.auto.entity_prefix) !== 0) return;
        if (ex.indexOf(id) !== -1) return;

        if (this._ranges.length) {
          const st = hass.states[id];
          const ip = st.attributes ? st.attributes[c.auto.ip_attribute] : null;
          if (ip) {
            if (!inRanges(ip, this._ranges)) return;
          } else if (c.auto.require_ip) {
            return; // pas d'IP exploitable → exclu
          }
        }
        out.push({ entity: id, manual: false });
      });
    }
    return out;
  }

  _sig(hass) {
    const items = this._collect();
    return items
      .map((d) => {
        const st = hass.states[d.entity];
        let s = d.entity + ":" + (st ? st.state : "∅");
        if (d.rx && hass.states[d.rx]) s += ">" + hass.states[d.rx].state;
        if (d.tx && hass.states[d.tx]) s += "<" + hass.states[d.tx].state;
        return s;
      })
      .join("|") + "#" + this._filter + "#" + this._sort + this._dir + "#" + this._page;
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
        .tabs { padding:0 15px 6px 15px; display:flex; gap:5px; }
        .tab { flex:1; text-align:center; padding:6px 4px; border-radius:7px;
          font-size:11px; cursor:pointer; user-select:none;
          background:rgba(255,255,255,0.035); color:var(--secondary-text-color);
          transition:background .2s ease, color .2s ease; }
        .tab.on { font-weight:600; }
        .list { padding:8px 15px 14px 15px; display:flex; flex-direction:column; gap:5px; }
        .dev { display:flex; align-items:center; gap:9px;
          background:rgba(255,255,255,0.035); border-radius:9px; padding:9px 11px;
          cursor:pointer; transition:background .2s ease; }
        .dev:hover { background:rgba(255,255,255,0.07); }
        .dev.away { opacity:.55; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .dev > ha-icon { --mdc-icon-size:15px; color:var(--secondary-text-color); flex-shrink:0; }
        .dname { flex:1; min-width:0; font-size:12px; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dip { font-size:9.5px; color:var(--disabled-text-color); flex-shrink:0; }
        .dtraf { font-size:10px; flex-shrink:0; }
        .dstat { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .more { font-size:10.5px; color:var(--disabled-text-color);
          font-style:italic; padding:4px 2px; }
        .warn { font-size:11px; color:#BA7517; padding:6px 2px; line-height:1.4; }
        .sortbar { padding:0 15px 4px 15px; display:flex; align-items:center; gap:5px; }
        .sortbar .lbl { font-size:10px; color:var(--disabled-text-color);
          margin-right:2px; flex-shrink:0; }
        .sb { padding:5px 10px; border-radius:7px; font-size:11px; cursor:pointer;
          user-select:none; background:rgba(255,255,255,0.035);
          color:var(--secondary-text-color); transition:background .2s ease, color .2s ease; }
        .sb.on { font-weight:600; }
        .dirbtn { margin-left:auto; display:flex; align-items:center; gap:4px;
          padding:5px 9px; border-radius:7px; cursor:pointer; user-select:none;
          background:rgba(255,255,255,0.035); font-size:10.5px;
          color:var(--secondary-text-color); flex-shrink:0; }
        .dirbtn ha-icon { --mdc-icon-size:13px; }
        .pager { padding:2px 15px 14px 15px; display:flex; align-items:center;
          gap:5px; flex-wrap:wrap; }
        .pg { min-width:26px; text-align:center; padding:5px 7px; border-radius:7px;
          font-size:11px; cursor:pointer; user-select:none;
          background:rgba(255,255,255,0.035); color:var(--secondary-text-color);
          transition:background .2s ease, color .2s ease; }
        .pg.on { font-weight:700; }
        .pg.nav ha-icon { --mdc-icon-size:14px; vertical-align:-3px; }
        .pg.dis { opacity:.3; cursor:default; }
        .pg.gap { background:none; cursor:default; min-width:14px; padding:5px 2px; }
        .pginfo { margin-left:auto; font-size:10px; color:var(--disabled-text-color); }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div><div class="htitle"></div><div class="hsub"></div></div>
        </div>
        <div class="tabs hidden">
          <div class="tab t-all" data-f="all">Tous</div>
          <div class="tab t-home" data-f="home">Connectés</div>
          <div class="tab t-away" data-f="away">Absents</div>
        </div>
        <div class="sortbar hidden">
          <span class="lbl">Trier</span>
          <span class="sb s-status" data-s="status">État</span>
          <span class="sb s-name" data-s="name">Nom</span>
          <span class="sb s-ip" data-s="ip">IP</span>
          <span class="dirbtn"><ha-icon></ha-icon><span class="dirtxt"></span></span>
        </div>
        <div class="list"></div>
        <div class="pager hidden"></div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        this._filter = t.getAttribute("data-f");
        this._page = 0;
        this._render();
      });
    });
    this.shadowRoot.querySelectorAll(".sb").forEach((b) => {
      b.addEventListener("click", () => {
        const s = b.getAttribute("data-s");
        // Recliquer sur le tri actif inverse le sens
        if (this._sort === s) this._dir = this._dir === "asc" ? "desc" : "asc";
        else { this._sort = s; this._dir = "asc"; }
        this._page = 0;
        this._render();
      });
    });
    this.shadowRoot.querySelector(".dirbtn").addEventListener("click", () => {
      this._dir = this._dir === "asc" ? "desc" : "asc";
      this._page = 0;
      this._render();
    });
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;

    r.querySelector("ha-card").style.borderColor = cRgba(c.accent, 0.25);
    const disc = r.querySelector(".disc");
    disc.style.background = cRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let items = this._collect();

    /* Enrichit chaque entrée */
    items = items.map((d) => {
      const st = hass.states[d.entity];
      const state = st ? String(st.state).toLowerCase() : "unknown";
      const home = state === "home" || state === "on" || state === "connected";
      const ip = st && st.attributes ? st.attributes[c.auto.ip_attribute] : null;
      const name = d.name || (st && st.attributes ? st.attributes.friendly_name : null) ||
                   d.entity.replace("device_tracker.", "");
      return Object.assign({}, d, { st: st, home: home, ip: ip, label: name });
    });

    const nHome = items.filter((d) => d.home).length;
    const nAway = items.length - nHome;
    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_home + '">' + nHome + " connecté" + (nHome > 1 ? "s" : "") + "</b>" +
      (nAway ? " · " + nAway + " absent" + (nAway > 1 ? "s" : "") : "");

    /* Onglets */
    const tabs = r.querySelector(".tabs");
    tabs.classList.toggle("hidden", !c.show_filters);
    if (c.show_filters) {
      r.querySelectorAll(".tab").forEach((t) => {
        const on = t.getAttribute("data-f") === this._filter;
        t.classList.toggle("on", on);
        t.style.background = on ? cRgba(c.accent, 0.14) : "rgba(255,255,255,0.035)";
        t.style.color = on ? c.accent : "var(--secondary-text-color)";
      });
      if (this._filter === "home") items = items.filter((d) => d.home);
      else if (this._filter === "away") items = items.filter((d) => !d.home);
    }

    /* Barre de tri */
    const sortbar = r.querySelector(".sortbar");
    sortbar.classList.toggle("hidden", !c.show_sort);
    if (c.show_sort) {
      r.querySelectorAll(".sb").forEach((b) => {
        const on = b.getAttribute("data-s") === this._sort;
        b.classList.toggle("on", on);
        b.style.background = on ? cRgba(c.accent, 0.14) : "rgba(255,255,255,0.035)";
        b.style.color = on ? c.accent : "var(--secondary-text-color)";
      });
      const db = r.querySelector(".dirbtn");
      const asc = this._dir === "asc";
      db.querySelector("ha-icon").setAttribute("icon",
        asc ? "mdi:sort-ascending" : "mdi:sort-descending");
      db.querySelector(".dirtxt").textContent = asc ? "Croissant" : "Décroissant";
    }

    /* Tri — l'IP est comparée numériquement (1, 2, 3… 10, 11), jamais en texte */
    const dir = this._dir === "desc" ? -1 : 1;
    if (this._sort === "name") {
      items.sort((a, b) => dir * a.label.localeCompare(b.label, "fr", { numeric: true }));
    } else if (this._sort === "ip") {
      items.sort((a, b) => {
        const av = ipToLong(a.ip);
        const bv = ipToLong(b.ip);
        // Les appareils sans IP exploitable finissent toujours en bas
        if (av === null && bv === null) return a.label.localeCompare(b.label, "fr");
        if (av === null) return 1;
        if (bv === null) return -1;
        if (av === bv) return a.label.localeCompare(b.label, "fr");
        return dir * (av - bv);
      });
    } else {
      items.sort((a, b) => {
        if (a.home !== b.home) return dir * (a.home ? -1 : 1);
        return a.label.localeCompare(b.label, "fr", { numeric: true });
      });
    }

    /* Rendu */
    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (!items.length) {
      const e = document.createElement("div");
      e.className = "more";
      e.textContent = "Aucun appareil à afficher.";
      list.appendChild(e);
    }

    /* Avertissement si le filtre IP est configuré mais inopérant */
    if (this._ranges.length && c.auto.enabled) {
      const anyIp = items.some((d) => d.ip);
      if (!anyIp) {
        const w = document.createElement("div");
        w.className = "warn";
        w.textContent = "Filtre IP configuré mais aucun appareil n'expose l'attribut « " +
          c.auto.ip_attribute + " ». Vérifie le nom de l'attribut dans Developer Tools → States.";
        list.appendChild(w);
      }
    }

    /* Pagination : découpe la liste et borne la page courante */
    const per = c.max_items;
    const pages = Math.max(1, Math.ceil(items.length / per));
    if (this._page > pages - 1) this._page = pages - 1;
    if (this._page < 0) this._page = 0;
    const shown = items.slice(this._page * per, this._page * per + per);

    shown.forEach((d) => {
      const el = document.createElement("div");
      el.className = "dev" + (d.home ? "" : " away");

      const rxSt = d.rx ? hass.states[d.rx] : null;
      const txSt = d.tx ? hass.states[d.tx] : null;

      let right = "";
      if (d.home && (rxSt || txSt)) {
        if (rxSt) right += '<span class="dtraf" style="color:' + c.color_rx + '">↓ ' +
          cFmt(rxSt) + " " + cEsc(cUnit(rxSt)) + "</span>";
        if (txSt) right += '<span class="dtraf" style="color:' + c.color_tx + '">↑ ' +
          cFmt(txSt) + " " + cEsc(cUnit(txSt)) + "</span>";
      } else if (!d.home) {
        right = '<span class="dstat">absent</span>';
      }

      el.innerHTML =
        '<span class="dot" style="background:' + (d.home ? c.color_home : c.color_away) + '"></span>' +
        '<ha-icon icon="' + (d.icon || (d.home ? "mdi:lan-connect" : "mdi:lan-disconnect")) + '"></ha-icon>' +
        '<span class="dname">' + cEsc(d.label) + "</span>" +
        (d.ip ? '<span class="dip">' + cEsc(d.ip) + "</span>" : "") +
        right;
      el.addEventListener("click", () => this._more(d.entity));
      list.appendChild(el);
    });

    /* Barre de pages — affichée uniquement s'il y a plus d'une page */
    this._renderPager(pages, items.length);
  }

  _renderPager(pages, total) {
    const r = this.shadowRoot, c = this._config;
    const pager = r.querySelector(".pager");
    if (pages <= 1) { pager.classList.add("hidden"); return; }
    pager.classList.remove("hidden");
    pager.innerHTML = "";

    const mk = (label, opts) => {
      const o = opts || {};
      const el = document.createElement("span");
      el.className = "pg" + (o.on ? " on" : "") + (o.dis ? " dis" : "") +
        (o.nav ? " nav" : "") + (o.gap ? " gap" : "");
      if (o.icon) el.innerHTML = '<ha-icon icon="' + o.icon + '"></ha-icon>';
      else el.textContent = label;
      if (o.on) {
        el.style.background = cRgba(c.accent, 0.16);
        el.style.color = c.accent;
      }
      if (!o.dis && !o.gap && o.go !== undefined) {
        el.addEventListener("click", () => { this._page = o.go; this._render(); });
      }
      pager.appendChild(el);
    };

    mk("", { icon: "mdi:chevron-left", nav: true, dis: this._page === 0, go: this._page - 1 });

    /* Fenêtre glissante : 1 … 4 5 6 … 12 */
    const cur = this._page;
    const nums = [];
    for (let i = 0; i < pages; i++) {
      if (i === 0 || i === pages - 1 || Math.abs(i - cur) <= 1) nums.push(i);
    }
    let prev = -1;
    nums.forEach((i) => {
      if (prev !== -1 && i - prev > 1) mk("…", { gap: true });
      mk(String(i + 1), { on: i === cur, go: i });
      prev = i;
    });

    mk("", { icon: "mdi:chevron-right", nav: true, dis: this._page >= pages - 1, go: this._page + 1 });

    const info = document.createElement("span");
    info.className = "pginfo";
    info.textContent = total + " appareils";
    pager.appendChild(info);
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    return 2 + Math.min(this._config.max_items, 10);
  }
  static getStubConfig() {
    return { type: "custom:unifi-clients-card", title: "Équipements" };
  }
  static getConfigElement() { return document.createElement("unifi-clients-card-editor"); }
}
customElements.define("unifi-clients-card", UnifiClientsCard);

/* ================= ÉDITEUR ================= */
const UCL_L = {
  title: "Titre", icon: "Icône", show_filters: "Afficher les onglets de filtre",
  max_items: "Appareils par page", sort: "Tri par défaut",
  sort_dir: "Sens par défaut", show_sort: "Afficher la barre de tri",
  entity: "Entité de présence", name: "Nom affiché", rx: "Réception", tx: "Émission",
  enabled: "Activer la découverte automatique",
  ip_attribute: "Nom de l'attribut IP",
  require_ip: "Exclure les appareils sans IP",
  entity_prefix: "Préfixe d'entité (optionnel)",
  ranges_text: "Plages IP (une par ligne)",
};
const UCL_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "max_items", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "sort", selector: { select: { mode: "dropdown", options: [
      { value: "status", label: "Connectés d'abord" },
      { value: "name", label: "Nom" },
      { value: "ip", label: "Adresse IP" },
    ]}}},
  ]},
  { type: "grid", schema: [
    { name: "show_filters", selector: { boolean: {} } },
    { name: "show_sort", selector: { boolean: {} } },
  ]},
  { name: "sort_dir", selector: { select: { mode: "dropdown", options: [
    { value: "asc", label: "Croissant" },
    { value: "desc", label: "Décroissant" },
  ]}}},
];
const UCL_S_AUTO = [
  { name: "ip_attribute", selector: { text: {} } },
  { name: "entity_prefix", selector: { text: {} } },
  { name: "require_ip", selector: { boolean: {} } },
];
const UCL_S_DEV = [
  { name: "entity", selector: { entity: { filter: { domain: ["device_tracker", "binary_sensor", "sensor"] } } } },
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { name: "icon", selector: { icon: {} } },
];

class UnifiClientsCardEditor extends HTMLElement {
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
  _label(s) { return UCL_L[s.name] || s.name; }

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
        .ta-lbl { font-size:13px; color:var(--primary-text-color); display:block; margin-bottom:5px; }
        textarea { width:100%; box-sizing:border-box; min-height:78px; resize:vertical;
          border-radius:8px; padding:9px 11px; font-family:monospace; font-size:12.5px;
          background:var(--secondary-background-color); color:var(--primary-text-color);
          border:1px solid var(--divider-color); }
        .ta-help { font-size:11.5px; color:var(--secondary-text-color); margin-top:6px; line-height:1.5; }
        code { background:rgba(255,255,255,0.07); padding:1px 4px; border-radius:3px; font-size:11px; }
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
          <div class="color-field"><input type="color" class="c-home"><label>Connecté</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Appareils listés</span></div>
        <div class="sec-hint">Liste manuelle, affichée en premier. Le trafic est optionnel.</div>
        <div class="rows-dev"></div>
        <div class="addbtn add-dev"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un appareil</span></div></div>
      <div class="sec">
        <div class="sec-head"><span class="sec-title">Découverte automatique</span>
          <ha-switch class="sw-auto"></ha-switch></div>
        <div class="sec-hint">Ajoute tous les <code>device_tracker</code> non déjà listés, filtrés par plage IP.</div>
        <div class="auto-body">
          <label class="ta-lbl">Plages IP (une par ligne)</label>
          <textarea class="ta-ranges" placeholder="192.168.1.0/24&#10;192.168.2.10-192.168.2.50&#10;10.0.0.*"></textarea>
          <div class="ta-help">Formats acceptés : <code>192.168.1.0/24</code> · <code>192.168.1.10-192.168.1.50</code> · <code>192.168.1.10-50</code> · <code>192.168.1.*</code> · <code>192.168.1.42</code><br>
            Laisse vide pour ne filtrer sur aucune plage.</div>
          <div style="height:12px"></div>
          <ha-form class="f-auto"></ha-form>
        </div>
      </div>
    `;
    const r = this.shadowRoot;

    const fg = r.querySelector(".f-gen");
    fg.schema = UCL_S_GEN; fg.computeLabel = this._label;
    fg.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });

    const fa = r.querySelector(".f-auto");
    fa.schema = UCL_S_AUTO; fa.computeLabel = this._label;
    fa.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      this._config.auto = Object.assign({ enabled: true }, this._config.auto, e.detail.value);
      if (this._config.auto.entity_prefix === "") delete this._config.auto.entity_prefix;
      this._emit();
    });

    const ta = r.querySelector(".ta-ranges");
    let tt = null;
    const applyRanges = () => {
      const lines = ta.value.split("\n").map((s) => s.trim()).filter(Boolean);
      this._config.auto = Object.assign({ enabled: true }, this._config.auto);
      if (lines.length) this._config.auto.ip_ranges = lines;
      else delete this._config.auto.ip_ranges;
      this._emit();
    };
    ta.addEventListener("input", () => { clearTimeout(tt); tt = setTimeout(applyRanges, 400); });
    ta.addEventListener("blur", () => { clearTimeout(tt); applyRanges(); });

    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-accent", "accent");
    bindColor(".c-home", "color_home");

    r.querySelector(".sw-auto").addEventListener("change", (e) => {
      if (e.target.checked) {
        this._config.auto = Object.assign({ ip_attribute: "ip", require_ip: true },
          this._config.auto, { enabled: true });
      } else {
        this._config.auto = Object.assign({}, this._config.auto, { enabled: false });
      }
      this._emit(); this._update();
    });

    r.querySelector(".add-dev").addEventListener("click", () => {
      this._config.devices = (this._config.devices || []).concat([{ entity: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const auto = c.auto || {};

    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "", icon: c.icon || "mdi:devices",
      max_items: c.max_items || 15, sort: c.sort || "status",
      sort_dir: c.sort_dir === "desc" ? "desc" : "asc",
      show_filters: c.show_filters !== false,
      show_sort: c.show_sort !== false,
    };

    this._setColor(".c-accent", c.accent || "#BA7517");
    this._setColor(".c-home", c.color_home || "#1D9E75");

    const on = auto.enabled === true;
    r.querySelector(".sw-auto").checked = on;
    r.querySelector(".auto-body").style.display = on ? "" : "none";
    if (on) {
      const ta = r.querySelector(".ta-ranges");
      if (this.shadowRoot.activeElement !== ta) {
        const txt = (auto.ip_ranges || []).join("\n");
        if (ta.value !== txt) ta.value = txt;
      }
      const fa = r.querySelector(".f-auto");
      fa.hass = this._hass;
      fa.data = {
        ip_attribute: auto.ip_attribute || "ip",
        entity_prefix: auto.entity_prefix || "",
        require_ip: auto.require_ip !== false,
      };
    }

    const box = r.querySelector(".rows-dev");
    const list = c.devices || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun appareil listé.";
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        const f = row.querySelector("ha-form");
        f.hass = this._hass; f.data = Object.assign({}, list[i]);
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
    num.textContent = item.name || item.entity || "Appareil #" + (index + 1);
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
      this._config.devices = this._config.devices.filter((_, i) => i !== index);
      if (!this._config.devices.length) delete this._config.devices;
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = UCL_S_DEV; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.devices || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      l[index] = m; this._config.devices = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.devices || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.devices = l; this._emit(); this._update(true);
  }
}
customElements.define("unifi-clients-card-editor", UnifiClientsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-clients-card",
  name: "UniFi Clients Card",
  description: "Équipements connectés : liste manuelle et/ou découverte par plage IP.",
});
console.info("%c UNIFI-CLIENTS-CARD %c v" + UCL_VERSION + " ",
  "color:#fff;background:#BA7517;font-weight:700", "color:#BA7517;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-clients-card
title: Équipements
icon: mdi:devices
accent: "#BA7517"
max_items: 15
sort: status
show_filters: true
devices:
  - entity: device_tracker.home_assistant
    name: Home Assistant
    icon: mdi:server
    rx: sensor.home_assistant_rx
    tx: sensor.home_assistant_tx
auto:
  enabled: true
  ip_attribute: ip
  require_ip: true
  ip_ranges:
    - 192.168.1.0/24
    - 192.168.2.10-192.168.2.50
  exclude:
    - device_tracker.ucg_max
    - device_tracker.u7_pro
============================================================ */
