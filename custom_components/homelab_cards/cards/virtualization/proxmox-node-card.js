/**
 * Proxmox Node Card — PVE node (CPU, memory, disk, swap, updates, actions)
 * Version 1.0.0
 *
 * Loaded automatically by the Homelab Cards integration.
 * Works with the Proxmox VE (HACS "proxmoxve") integration: when no entity is
 * configured, the node is detected from the entity/device registries
 * (platform + translation_key), never from entity names or UI language.
 */

const PNODE_VERSION = "1.0.0";

/* ---------- i18n ---------- */
const PN_I18N = {
  en: {
    def_title: "Proxmox node", online: "Online", offline: "Offline",
    vm_1: "{0} VM", vm_n: "{0} VMs", ct_1: "{0} container", ct_n: "{0} containers",
    upd_n: "{0} updates", upd_avail: "Updates available", upd_ok: "Up to date",
    boot: "Started {0} ago", confirm: "Confirm: {0}?",
    y: ["year", "years"], mo: ["month", "months"], d: ["day", "days"],
    g_cpu: "CPU", g_mem: "Memory", g_disk: "Disk", g_swap: "Swap",
    a_start_all: "Start all", a_stop_all: "Stop all", a_reboot: "Reboot", a_shutdown: "Shut down",
    /* editor */
    title: "Title", icon: "Icon", status_entity: "Status sensor", node: "Node (name or device ID, auto-detection)",
    last_boot: "Last boot", vms_running: "Running VMs",
    containers_running: "Running containers", updates_count: "Number of updates",
    updates_available: "Updates available", warn_at: "Warning threshold (%)",
    critical_at: "Critical threshold (%)", confirm_actions: "Confirm actions by default",
    name: "Display name", percentage: "Percentage sensor", used: "Used", total: "Total",
    entity: "Entity", actions_label: "Actions area title", confirm_field: "Ask for confirmation",
    s_general: "General", s_colors: "Colors", s_gauges: "Gauges", s_actions: "Actions",
    c_on: "Online", c_off: "Offline", color: "Color", empty: "No item.",
    add_gauge: "Add a gauge", add_action: "Add an action",
    expand_all: "Expand all", collapse_all: "Collapse all",
    hint_auto: "With no entity configured, the card detects the node from the Proxmox VE (proxmoxve) integration.",
    hint_colors: "Gauges turn amber then red above the thresholds.",
    hint_gauges: "If you set “Used” and “Total”, the value shows as “20.5/32 GB” instead of the percentage.",
    hint_actions: "Tick “Ask for confirmation” for risky actions (stop, reboot).",
    desc: "Proxmox node: CPU, memory, disk, swap, updates and actions.",
  },
  fr: {
    def_title: "Nœud Proxmox", online: "En ligne", offline: "Hors ligne",
    vm_1: "{0} VM", vm_n: "{0} VM", ct_1: "{0} conteneur", ct_n: "{0} conteneurs",
    upd_n: "{0} MAJ", upd_avail: "MAJ dispo", upd_ok: "À jour",
    boot: "Démarré il y a {0}", confirm: "Confirmer : {0} ?",
    y: ["an", "ans"], mo: ["mois", "mois"], d: ["jour", "jours"],
    g_cpu: "CPU", g_mem: "Mémoire", g_disk: "Disque", g_swap: "Swap",
    a_start_all: "Tout démarrer", a_stop_all: "Tout arrêter", a_reboot: "Redémarrer", a_shutdown: "Éteindre",
    title: "Titre", icon: "Icône", status_entity: "Capteur d'état", node: "Nœud (nom ou ID d'appareil, détection auto)",
    last_boot: "Dernier démarrage", vms_running: "VM en marche",
    containers_running: "Conteneurs en marche", updates_count: "Nombre de mises à jour",
    updates_available: "Mises à jour disponibles", warn_at: "Seuil d'alerte (%)",
    critical_at: "Seuil critique (%)", confirm_actions: "Confirmer les actions par défaut",
    name: "Nom affiché", percentage: "Capteur de pourcentage", used: "Utilisé", total: "Total",
    entity: "Entité", actions_label: "Titre de la zone d'actions", confirm_field: "Demander confirmation",
    s_general: "Général", s_colors: "Couleurs", s_gauges: "Jauges", s_actions: "Actions",
    c_on: "En ligne", c_off: "Hors ligne", color: "Couleur", empty: "Aucun élément.",
    add_gauge: "Ajouter une jauge", add_action: "Ajouter une action",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    hint_auto: "Sans aucune entité renseignée, la carte détecte le nœud via l'intégration Proxmox VE (proxmoxve).",
    hint_colors: "Les jauges passent en ambre puis en rouge au-delà des seuils.",
    hint_gauges: "Si tu renseignes « Utilisé » et « Total », la valeur affichée devient « 20,5/32 Go » au lieu du pourcentage.",
    hint_actions: "Coche « Demander confirmation » pour les actions à risque (arrêt, redémarrage).",
    desc: "Nœud Proxmox : CPU, mémoire, disque, swap, mises à jour et actions.",
  },
};
const pLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const pDict = (loc) => PN_I18N[/^fr/i.test(loc) ? "fr" : "en"];
const pT = (h, k, a) => {
  const v = pDict(pLoc(h))[k];
  const s = v !== undefined ? v : (PN_I18N.en[k] !== undefined ? PN_I18N.en[k] : k);
  return a === undefined ? s : String(s).replace("{0}", a);
};

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
const pFmt = (st, d, h) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state === "unavailable" || st.state === "unknown" ? "—" : st.state;
  return n.toLocaleString(pLoc(h), { maximumFractionDigits: d === undefined ? 1 : d });
};
const pUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const pEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Turns a timestamp (last_boot) into a readable duration: "42 days" */
function pSince(raw, h) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const u = (k, n) => n + " " + pT(h, k)[n > 1 ? 1 : 0];
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const mo = Math.floor((d % 365) / 30);
    return u("y", y) + (mo ? " " + u("mo", mo) : "");
  }
  if (d >= 30) return u("mo", Math.floor(d / 30));
  if (d >= 1) return u("d", d);
  const hr = Math.floor(sec / 3600);
  if (hr >= 1) return hr + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

const pOn = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "running" || s === "online" || s === "home";
};

/* ---------- proxmoxve auto-detection ---------- */
/* { device_id: { "<domain>.<translation_key>": entity_id } } for proxmoxve entities */
function pnByDevice(hass) {
  const out = {};
  Object.values((hass && hass.entities) || {}).forEach((e) => {
    if (!e || e.platform !== "proxmoxve" || !e.device_id || !e.translation_key) return;
    if (!hass.states[e.entity_id]) return;
    const m = out[e.device_id] || (out[e.device_id] = {});
    m[e.entity_id.split(".")[0] + "." + e.translation_key] = e.entity_id;
  });
  return out;
}
/* Node devices are the only ones exposing node_status / qemu_on / lxc_on / start_all */
function pnFindNode(hass, want) {
  const by = pnByDevice(hass), devs = (hass && hass.devices) || {};
  const dn = (id) => (devs[id] && (devs[id].name_by_user || devs[id].name)) || id;
  const ids = Object.keys(by).filter((id) => {
    const e = by[id];
    return e["sensor.node_status"] || e["sensor.qemu_on"] || e["sensor.lxc_on"] || e["button.start_all"];
  }).sort((a, b) => String(dn(a)).localeCompare(String(dn(b))));
  const hit = (id) => [id, devs[id] && devs[id].name_by_user, devs[id] && devs[id].name]
    .some((x) => x && (x === want || String(x).endsWith(" " + want)));
  const id = want ? ids.find(hit) : ids[0];
  return id ? { id: id, e: by[id], name: dn(id) } : null;
}
function pnDetect(hass, want) {
  const n = pnFindNode(hass, want);
  if (!n) return null;
  const e = n.e, t = (k) => pT(hass, k);
  const gauge = (name, p, u, tot, color) => (p || u) ? { name: name, percentage: p, used: u, total: tot, color: color } : null;
  const act = (k, icon, color, confirm) => e["button." + k]
    ? { name: t("a_" + k), entity: e["button." + k], icon: icon, color: color, confirm: confirm } : null;
  return {
    title: n.name,
    status_entity: e["binary_sensor.status"],
    last_boot: e["sensor.uptime"],
    vms_running: e["sensor.qemu_on"],
    containers_running: e["sensor.lxc_on"],
    updates_count: e["sensor.updates_total"],
    updates_available: e["binary_sensor.update_avail"],
    gauges: [
      gauge(t("g_cpu"), e["sensor.cpu_used"], null, null, "#378ADD"),
      gauge(t("g_mem"), e["sensor.memory_used_perc"], e["sensor.memory_used"], e["sensor.memory_total"], "#7F77DD"),
      gauge(t("g_disk"), e["sensor.disk_used_perc"], e["sensor.disk_used"], e["sensor.disk_total"], "#1D9E75"),
      gauge(t("g_swap"), e["sensor.swap_used_perc"], null, null, "#8a8a86"),
    ].filter(Boolean),
    actions: [
      act("start_all", "mdi:play", "#1D9E75", false),
      act("stop_all", "mdi:stop", "#BA7517", true),
      act("reboot", "mdi:restart", "#378ADD", true),
      act("shutdown", "mdi:power", "#E24B4A", true),
    ].filter(Boolean),
  };
}
const PN_ENTITY_KEYS = ["status_entity", "last_boot", "vms_running", "containers_running",
  "updates_count", "updates_available"];

class ProxmoxNodeCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || null,
      icon: config.icon || "mdi:server",
      accent: config.accent || "#E2782D",
      accent_off: config.accent_off || "#E24B4A",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
      node: config.node || null,
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
    /* Nothing configured at all → fall back to proxmoxve auto-detection */
    this._auto = !PN_ENTITY_KEYS.some((k) => config[k]) &&
      !(config.gauges && config.gauges.length) && !(config.actions && config.actions.length);
    this._userTitle = !!config.title;
    this._ents = undefined;
    this._built = false;
  }

  connectedCallback() {
    /* "Started X ago" must age even without a state change */
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._renderUptime();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (this._auto && hass.entities !== this._ents) {
      this._ents = hass.entities;
      const d = pnDetect(hass, this._config.node);
      if (d) {
        if (this._userTitle) delete d.title;
        Object.assign(this._config, d);
      }
    }
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const c = this._config, ids = [];
    PN_ENTITY_KEYS.forEach((k) => c[k] && ids.push(c[k]));
    c.gauges.forEach((g) => { ["percentage", "used", "total", "free"].forEach((k) => g[k] && ids.push(g[k])); });
    return [...new Set(ids)];
  }
  _sig(h) {
    return pLoc(h) + "#" + (this._config.title || "") + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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
    const c = this._config, r = this.shadowRoot, h = this._hass;
    const sub = r.querySelector(".subline");
    const st = c.last_boot ? h.states[c.last_boot] : null;
    const since = st ? pSince(st.state, h) : null;
    if (since) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = pT(h, "boot", since);
      sub.onclick = () => this._more(c.last_boot);
    } else sub.classList.add("hidden");
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const t = (k, a) => pT(hass, k, a);
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

    r.querySelector(".htitle").textContent = c.title || t("def_title");

    const bits = ['<b style="color:' + accent + '">' + t(online ? "online" : "offline") + "</b>"];
    if (c.vms_running && hass.states[c.vms_running]) {
      const n = pNum(hass.states[c.vms_running]);
      bits.push(pEsc(t(n > 1 ? "vm_n" : "vm_1", pFmt(hass.states[c.vms_running], 0, hass))));
    }
    if (c.containers_running && hass.states[c.containers_running]) {
      const n = pNum(hass.states[c.containers_running]);
      bits.push(pEsc(t(n > 1 ? "ct_n" : "ct_1", pFmt(hass.states[c.containers_running], 0, hass))));
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    this._renderUptime();

    /* Updates badge */
    const badge = r.querySelector(".badge");
    const upCount = c.updates_count ? hass.states[c.updates_count] : null;
    const upAvail = c.updates_available ? hass.states[c.updates_available] : null;
    const n = upCount ? pNum(upCount) : NaN;
    const has = upAvail ? pOn(upAvail) : (!isNaN(n) && n > 0);
    if (upCount || upAvail) {
      badge.classList.remove("hidden");
      badge.textContent = has ? (!isNaN(n) && n > 0 ? t("upd_n", n) : t("upd_avail")) : t("upd_ok");
      badge.style.background = pRgba(has ? "#BA7517" : "#1D9E75", 0.14);
      badge.style.color = has ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.updates_count || c.updates_available); };
    } else badge.classList.add("hidden");

    /* Gauges */
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
          const u = pNum(usedSt), tt = pNum(totSt);
          if (!isNaN(u) && tt) pct = (u / tt) * 100;
        }
        const col = this._barColor(pct, g.color || "#378ADD");

        /* Right-hand value: "20.5/32 GB" when available, otherwise the percentage */
        let val;
        if (usedSt && totSt) {
          val = pEsc(pFmt(usedSt, 1, hass)) + "/" + pEsc(pFmt(totSt, 0, hass)) + " " + pEsc(pUnit(totSt) || pUnit(usedSt));
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
          (a.icon ? '<ha-icon icon="' + pEsc(a.icon) + '" style="color:' + pEsc(a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + pEsc(a.name || "") + "</span>";
        el.addEventListener("click", () => {
          if (!a.entity) return;
          const needs = a.confirm !== undefined ? a.confirm : (c.confirm_actions && a.destructive !== false);
          if (needs && !window.confirm(a.confirm_text || t("confirm", a.name || a.entity))) return;
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
  static getStubConfig(hass) {
    const d = pnDetect(hass);
    /* JSON round-trip drops the undefined keys of entities that do not exist */
    return Object.assign({ type: "custom:proxmox-node-card", title: pT(hass, "def_title") },
      d ? JSON.parse(JSON.stringify(d)) : {});
  }
  static getConfigElement() { return document.createElement("proxmox-node-card-editor"); }
}
customElements.define("proxmox-node-card", ProxmoxNodeCard);

/* ================= EDITOR ================= */
const PN_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "node", selector: { text: {} } },
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

/* ---------- Collapsible editor sections (state kept across editor re-creations) ---------- */
const PN_SEC_STATE = new Map();
const PN_SEC_CSS = `
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
const pnSec = (id, title, body) =>
  '<div class="sec"><button type="button" class="sec-head" data-sec="' + id + '" aria-expanded="false" aria-controls="sec-' + id + '">' +
  '<ha-icon class="sec-chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + pEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '" hidden>' + body + "</div></div>";
/* Wires headers + "expand/collapse all"; the first section is open by default, the others closed */
function pnWireSections(root, tag, t) {
  const heads = Array.from(root.querySelectorAll(".sec-head"));
  const all = root.querySelector(".sec-all");
  const sync = () => {
    all.textContent = t(heads.some((h) => h.getAttribute("aria-expanded") !== "true") ? "expand_all" : "collapse_all");
  };
  const set = (h, open) => {
    h.setAttribute("aria-expanded", String(open));
    root.getElementById(h.getAttribute("aria-controls")).hidden = !open;
    PN_SEC_STATE.set(tag + ":" + h.dataset.sec, open);
  };
  heads.forEach((h, i) => {
    const k = tag + ":" + h.dataset.sec;
    set(h, PN_SEC_STATE.has(k) ? PN_SEC_STATE.get(k) : i === 0);
    h.addEventListener("click", () => { set(h, h.getAttribute("aria-expanded") !== "true"); sync(); });
  });
  all.addEventListener("click", () => {
    const open = heads.some((h) => h.getAttribute("aria-expanded") !== "true");
    heads.forEach((h) => set(h, open)); sync();
  });
  sync();
}

class ProxmoxNodeCardEditor extends HTMLElement {
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
  _t(k) { return pT(this._hass, k); }
  _label(s) { return this._t(s.name === "confirm" ? "confirm_field" : s.name); }

  _build() {
    const t = (k) => pEsc(this._t(k));
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
        ${PN_SEC_CSS}
      </style>
      <div class="sec-tools"><button type="button" class="sec-all"></button></div>
      ${pnSec("general", this._t("s_general"), `
        <div class="sec-hint">${t("hint_auto")}</div>
        <ha-form class="f-gen"></ha-form>`)}
      ${pnSec("colors", this._t("s_colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>${t("c_on")}</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>${t("c_off")}</label></div>
        </div>
        <div class="sec-hint">${t("hint_colors")}</div>`)}
      ${pnSec("gauges", this._t("s_gauges"), `
        <div class="sec-hint">${t("hint_gauges")}</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_gauge")}</span></div>`)}
      ${pnSec("actions", this._t("s_actions"), `
        <div class="sec-hint">${t("hint_actions")}</div>
        <ha-form class="f-actlabel"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_action")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    pnWireSections(r, this.tagName.toLowerCase(), (k) => this._t(k));
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = (s) => this._label(s);
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", PN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "node"].concat(PN_ENTITY_KEYS).forEach((k) => {
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
      let tm = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
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
      title: c.title || "", icon: c.icon || "mdi:server", node: c.node || "",
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
        e.className = "empty"; e.textContent = this._t("empty");
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
    f.schema = schema; f.computeLabel = (s) => this._label(s); f.hass = this._hass;
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
    let tm = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = this._t("color");
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
  description: pDict(document.documentElement.lang || navigator.language || "en").desc,
});
console.info("%c PROXMOX-NODE-CARD %c v" + PNODE_VERSION + " ",
  "color:#fff;background:#E2782D;font-weight:700", "color:#E2782D;background:#222");

/* ============================================================
CONFIG EXAMPLES

Minimal (auto-detection through the proxmoxve integration):

type: custom:proxmox-node-card
node: example-node        # optional, only needed with several nodes

Explicit (entity IDs are placeholders, use your own):

type: custom:proxmox-node-card
title: Example node
icon: mdi:server
accent: "#E2782D"
warn_at: 75
critical_at: 90
status_entity: binary_sensor.example_node_status
last_boot: sensor.example_node_last_boot
vms_running: sensor.example_node_virtual_machines_running
containers_running: sensor.example_node_containers_running
updates_count: sensor.example_node_total_updates
updates_available: binary_sensor.example_node_updates_packages
gauges:
  - name: CPU
    percentage: sensor.example_node_cpu_used
    color: "#378ADD"
  - name: Memory
    percentage: sensor.example_node_memory_used_percentage
    used: sensor.example_node_memory_used
    total: sensor.example_node_memory_total
    color: "#7F77DD"
actions_label: Node controls
actions:
  - name: Reboot
    entity: button.example_node_reboot
    icon: mdi:restart
    color: "#378ADD"
    confirm: true
============================================================ */
