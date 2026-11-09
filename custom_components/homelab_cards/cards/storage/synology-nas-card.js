/**
 * Synology NAS Card — DSM system (CPU, memory, load, throughput, actions)
 * Version 1.1.0
 *
 * Works with the native Home Assistant "synology_dsm" integration.
 * Entities left unset are auto-detected (platform + translation_key, never
 * display names) when a NAS device is chosen or when nothing is configured.
 */

const SYNAS_VERSION = "1.1.0";

/* ---------- i18n ---------- */
const SN_I18N = {
  fr: {
    booted: "Démarré il y a {d}", secure: "Sécurisé", sec_alert: "Alerte sécurité",
    upd_avail: "MAJ DSM", upd_ok: "DSM à jour",
    download: "Téléchargement", upload: "Téléversement", system: "Système",
    confirm: "{a} le NAS « {t} » ?", cpu: "CPU", memory: "Mémoire",
    reboot: "Redémarrer", shutdown: "Arrêter",
    sec_gen: "Général", sec_colors: "Couleurs", sec_gauges: "Jauges",
    sec_flow: "Débits réseau", sec_actions: "Actions",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    c_normal: "Normal", c_alert: "Alerte", color: "Couleur", empty: "Aucun élément.",
    add_gauge: "Ajouter une jauge", add_action: "Ajouter une action",
    hint_auto: "Choisis un NAS Synology : les champs laissés vides (entités, jauges, débits, actions) sont détectés automatiquement.",
    hint_gauges: "Plusieurs sources possibles par jauge : un pourcentage direct, ou « Disponible + Total » (cas de la mémoire Synology), ou « Valeur brute + Max » (cas de la charge processeur).",
    hint_actions: "La confirmation est activée par défaut : arrêter un NAS à distance sans filet est risqué.",
    l_device_id: "NAS Synology (détection auto)",
    l_title: "Titre", l_icon: "Icône", l_subtitle: "Sous-titre libre",
    l_security_entity: "État de sécurité", l_security_invert: "Inverser l'état de sécurité",
    l_last_boot: "Dernier démarrage", l_update_entity: "Mise à jour DSM",
    l_temperature: "Température système",
    l_warn_at: "Seuil d'alerte (%)", l_critical_at: "Seuil critique (%)",
    l_temp_warn: "Température d'alerte (°C)", l_temp_critical: "Température critique (°C)",
    l_name: "Nom affiché", l_percentage: "Pourcentage", l_value: "Valeur brute",
    l_max: "Valeur max (échelle)", l_used: "Utilisé", l_free: "Disponible", l_total: "Total",
    l_download: "Débit descendant", l_upload: "Débit montant",
    l_entity: "Entité", l_confirm: "Demander confirmation",
    l_actions_label: "Titre de la zone d'actions",
  },
  en: {
    booted: "Started {d} ago", secure: "Secure", sec_alert: "Security alert",
    upd_avail: "DSM update", upd_ok: "DSM up to date",
    download: "Download", upload: "Upload", system: "System",
    confirm: "{a} the NAS “{t}”?", cpu: "CPU", memory: "Memory",
    reboot: "Reboot", shutdown: "Shut down",
    sec_gen: "General", sec_colors: "Colors", sec_gauges: "Gauges",
    sec_flow: "Network throughput", sec_actions: "Actions",
    expand_all: "Expand all", collapse_all: "Collapse all",
    c_normal: "Normal", c_alert: "Alert", color: "Color", empty: "No items.",
    add_gauge: "Add a gauge", add_action: "Add an action",
    hint_auto: "Pick a Synology NAS: fields left empty (entities, gauges, throughput, actions) are detected automatically.",
    hint_gauges: "Several sources per gauge: a direct percentage, or “Free + Total” (Synology memory), or “Raw value + Max” (CPU load).",
    hint_actions: "Confirmation is on by default: shutting down a NAS remotely without a safety net is risky.",
    l_device_id: "Synology NAS (auto-detection)",
    l_title: "Title", l_icon: "Icon", l_subtitle: "Custom subtitle",
    l_security_entity: "Security status", l_security_invert: "Invert security status",
    l_last_boot: "Last boot", l_update_entity: "DSM update",
    l_temperature: "System temperature",
    l_warn_at: "Warning threshold (%)", l_critical_at: "Critical threshold (%)",
    l_temp_warn: "Warning temperature (°C)", l_temp_critical: "Critical temperature (°C)",
    l_name: "Display name", l_percentage: "Percentage", l_value: "Raw value",
    l_max: "Max value (scale)", l_used: "Used", l_free: "Free", l_total: "Total",
    l_download: "Download rate", l_upload: "Upload rate",
    l_entity: "Entity", l_confirm: "Ask for confirmation",
    l_actions_label: "Actions area title",
  },
};
const nLocale = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const nLang = (h) => (String(nLocale(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
function snT(lang, k, vars) {
  let s = SN_I18N[lang][k];
  if (s === undefined) s = SN_I18N.en[k] !== undefined ? SN_I18N.en[k] : k;
  return vars ? s.replace(/\{(\w+)\}/g, (_, v) => vars[v]) : s;
}
/* Shared by all instances: every card on a page receives the same hass locale. */
let N_LOC = "en";

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
  return n.toLocaleString(N_LOC, { maximumFractionDigits: d === undefined ? 1 : d });
};
const nUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const nEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Scales a byte value: 4200 GB -> 4.2 TB */
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
  return v.toLocaleString(N_LOC, { maximumFractionDigits: d }) + " " + seq[i];
}

/* Turns a timestamp into a readable, localized duration */
function nSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const u = (n, unit, long) => new Intl.NumberFormat(N_LOC,
    { style: "unit", unit: unit, unitDisplay: long ? "long" : "short" }).format(n);
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365), mo = Math.floor((d % 365) / 30);
    return u(y, "year", true) + (mo ? " " + u(mo, "month", true) : "");
  }
  if (d >= 30) return u(Math.floor(d / 30), "month", true);
  if (d >= 1) return u(d, "day", true);
  const h = Math.floor(sec / 3600);
  if (h >= 1) return u(h, "hour");
  return u(Math.max(1, Math.floor(sec / 60)), "minute");
}

/* Reads a binary_sensor honoring device_class "problem"/"safety",
   where "on" means a problem is detected. */
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

/* ---------- synology_dsm auto-detection ---------- */
const N_ENTITY_KEYS = ["security_entity", "last_boot", "update_entity", "temperature",
  "gauges", "throughput", "actions"];
/* Keys only present on the main NAS device (volumes/disks are child devices). */
const N_MAIN_KEYS = ["cpu_total_load", "memory_real_usage", "network_up", "network_down", "status", "shutdown"];

function nDetect(hass, deviceId) {
  const devs = hass.devices || {};
  const ents = Object.values(hass.entities || {})
    .filter((e) => e.platform === "synology_dsm" && e.device_id);
  let dev = deviceId;
  if (dev && devs[dev] && devs[dev].via_device_id) dev = devs[dev].via_device_id; /* volume/disk picked */
  if (!dev) {
    const e = ents.find((x) => N_MAIN_KEYS.indexOf(x.translation_key) !== -1);
    dev = e && e.device_id;
  }
  if (!dev) return null;
  const own = ents.filter((e) => e.device_id === dev);
  const dc = (e) => {
    const s = hass.states[e.entity_id];
    return s && s.attributes ? s.attributes.device_class : undefined;
  };
  const pick = (domain, test) => {
    const e = own.find((x) => x.entity_id.split(".")[0] === domain && test(x));
    return e ? e.entity_id : undefined;
  };
  const tk = (k) => (e) => e.translation_key === k;
  const d = devs[dev] || {};
  return {
    name: d.name_by_user || d.name,
    security_entity: pick("binary_sensor", tk("status")),
    last_boot: pick("sensor", (e) => !e.translation_key && ["timestamp", "uptime"].indexOf(dc(e)) !== -1),
    update_entity: pick("update", () => true),
    temperature: pick("sensor", (e) => !e.translation_key && dc(e) === "temperature"),
    cpu: pick("sensor", tk("cpu_total_load")),
    mem: pick("sensor", tk("memory_real_usage")),
    mem_free: pick("sensor", tk("memory_available_real")),
    mem_total: pick("sensor", tk("memory_total_real")),
    down: pick("sensor", tk("network_down")),
    up: pick("sensor", tk("network_up")),
    reboot: pick("button", (e) => dc(e) === "restart"),
    shutdown: pick("button", tk("shutdown")),
  };
}

function nBase(config) {
  return {
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
}

class SynologyNasCard extends HTMLElement {
  setConfig(config) {
    this._user = config;
    this._config = nBase(config);
    /* Explicit keys always win; detection only fills unset keys. */
    this._auto = !!config.device_id || !N_ENTITY_KEYS.some((k) => config[k] !== undefined);
    this._entRef = undefined;
    this._built = false;
  }

  /* Fills unset keys from the detected NAS device. */
  _resolve(hass) {
    const u = this._user, c = nBase(u), d = nDetect(hass, u.device_id);
    if (d) {
      const L = nLang(hass);
      if (!u.title && d.name) c.title = d.name;
      ["security_entity", "last_boot", "update_entity", "temperature"].forEach((k) => {
        if (u[k] === undefined && d[k]) c[k] = d[k];
      });
      if (u.gauges === undefined) {
        const g = [];
        if (d.cpu) g.push({ name: snT(L, "cpu"), percentage: d.cpu, color: "#378ADD" });
        if (d.mem || (d.mem_free && d.mem_total)) {
          g.push({ name: snT(L, "memory"), percentage: d.mem, free: d.mem_free,
                   total: d.mem_total, color: "#7F77DD" });
        }
        c.gauges = g;
      }
      if (u.throughput === undefined && (d.down || d.up)) c.throughput = { download: d.down, upload: d.up };
      if (u.actions === undefined) {
        const a = [];
        if (d.reboot) a.push({ name: snT(L, "reboot"), entity: d.reboot, icon: "mdi:restart", color: "#378ADD" });
        if (d.shutdown) a.push({ name: snT(L, "shutdown"), entity: d.shutdown, icon: "mdi:power", color: "#E24B4A" });
        c.actions = a;
      }
    }
    this._config = c;
  }

  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._renderUptime();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    N_LOC = nLocale(hass);
    this._lang = nLang(hass);
    if (this._auto && hass.entities !== this._entRef) {
      this._entRef = hass.entities; this._resolve(hass); this._last = null;
    }
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }
  _t(k, vars) { return snT(this._lang || "en", k, vars); }

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

  /* A gauge accepts several sources: direct percentage, value/max,
     used/total, or free/total (the Synology memory case). */
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

    /* Right-hand label: the most meaningful one available */
    let label;
    if (!isNaN(used) && !isNaN(total)) {
      const unit = nUnit(totSt) || nUnit(usedSt) || nUnit(freeSt);
      const su = nScale(used, unit), st_ = nScale(total, unit);
      label = (su && st_) ? su.split(" ")[0] + "/" + st_
        : used.toLocaleString(N_LOC, { maximumFractionDigits: 1 }) + "/" +
          total.toLocaleString(N_LOC, { maximumFractionDigits: 0 }) + " " + unit;
    } else if (valSt) {
      label = nFmt(valSt, 2) + (nUnit(valSt) ? " " + nUnit(valSt) : "");
    } else {
      label = isNaN(pct) ? "—" : pct.toFixed(0) + " %";
    }
    return { pct: pct, label: label };
  }

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
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
      sub.querySelector("span").textContent = this._t("booted", { d: since });
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
        nEsc(this._t(secOk ? "secure" : "sec_alert")) + "</b>");
    }
    if (c.subtitle) bits.push(nEsc(c.subtitle));
    r.querySelector(".hsub").innerHTML = bits.length ? bits.join(" · ") : "&nbsp;";

    this._renderUptime();

    /* DSM badge */
    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = this._t(up ? "upd_avail" : "upd_ok");
      badge.style.background = nRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* Gauges */
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

    /* Throughput + temperature */
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
          '<div class="fval">' + nEsc(nFmt(st, 2)) +
            (nUnit(st) ? "<em>" + nEsc(nUnit(st)) + "</em>" : "") + "</div>";
        d.addEventListener("click", () => this._more(entity));
        flow.appendChild(d);
      };
      if (tp && tp.download) mk(tp.download, tp.download_label || this._t("download"), "mdi:arrow-down", c.accent);
      if (tp && tp.upload) mk(tp.upload, tp.upload_label || this._t("upload"), "mdi:arrow-up", "#1D9E75");
      if (hasTemp) {
        const st = hass.states[c.temperature];
        const t = nNum(st);
        const col = this._tempColor(t);
        const d = document.createElement("div");
        d.className = "tbox";
        d.innerHTML =
          '<ha-icon icon="mdi:thermometer" style="color:' + col + '"></ha-icon>' +
          '<div class="tv">' + nEsc(nFmt(st, 0)) + "°</div>" +
          '<div class="tn">' + nEsc(this._t("system")) + "</div>";
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
          (a.icon ? '<ha-icon icon="' + nEsc(a.icon) + '" style="color:' + (a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + nEsc(a.name || "") + "</span>";
        el.addEventListener("click", () => {
          if (!a.entity) return;
          if (a.confirm !== false &&
              !window.confirm(a.confirm_text || this._t("confirm", { a: a.name || "", t: c.title }))) return;
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
  /* No entity in the stub: the card auto-detects the first Synology NAS. */
  static getStubConfig() { return { type: "custom:synology-nas-card" }; }
  static getConfigElement() { return document.createElement("synology-nas-card-editor"); }
}
customElements.define("synology-nas-card", SynologyNasCard);

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const SN_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const SN_SEC_CSS = `
  .sec-tools { display:flex; justify-content:flex-end; gap:4px; margin-bottom:6px; }
  .sec-tools button { background:none; border:none; cursor:pointer; padding:2px 6px;
    border-radius:4px; font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-tools button:hover { color:var(--primary-text-color); }
  .sec-head { width:100%; display:flex; align-items:center; gap:8px; margin:0 0 10px 0;
    padding:0 0 6px 0; background:none; border:none; border-bottom:1px solid var(--divider-color);
    cursor:pointer; font:inherit; text-align:left; color:var(--primary-text-color); }
  .sec-head[aria-expanded="false"] { margin-bottom:0; }
  .sec-head:focus-visible, .sec-tools button:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:2px; border-radius:4px; }
  .sec-head .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; }
  .sec-head[aria-expanded="false"] .chev { transform:rotate(-90deg); }
  .sec-body[hidden] { display:none; }
`;
const snSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + nEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
const snSecTools = (L) =>
  '<div class="sec-tools"><button type="button" class="sec-all" data-open="1">' + nEsc(snT(L, "expand_all")) +
  '</button><button type="button" class="sec-all" data-open="0">' + nEsc(snT(L, "collapse_all")) + "</button></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function snSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    SN_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, SN_SEC_STATE.has(k) ? SN_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const SN_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SN_S_GEN = [
  { name: "device_id", selector: { device: { filter: { integration: "synology_dsm" } } } },
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
    this._update();
  }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (first || !this._built) this._update(); else this._refreshHass();
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
  _t(k) { return snT(this._lang, k); }
  _label(s) { return snT(this._lang, "l_" + s.name); }

  /* Built once hass is known, so the UI language is available. */
  _build() {
    this._lang = nLang(this._hass);
    const t = (k) => nEsc(this._t(k));
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom:18px; }
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
        ${SN_SEC_CSS}
      </style>
      ${snSecTools(this._lang)}
      ${snSec("gen", this._t("sec_gen"), `
        <div class="sec-hint">${t("hint_auto")}</div>
        <ha-form class="f-gen"></ha-form>`)}
      ${snSec("colors", this._t("sec_colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>${t("c_normal")}</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>${t("c_alert")}</label></div>
        </div>`)}
      ${snSec("gauges", this._t("sec_gauges"), `
        <div class="sec-hint">${t("hint_gauges")}</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_gauge")}</span></div>`)}
      ${snSec("flow", this._t("sec_flow"), `<ha-form class="f-flow"></ha-form>`)}
      ${snSec("actions", this._t("sec_actions"), `
        <div class="sec-hint">${t("hint_actions")}</div>
        <ha-form class="f-actlabel"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_action")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    snSecWire(r, this.tagName.toLowerCase());
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = (s) => this._label(s);
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", SN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["device_id", "title", "subtitle", "security_entity", "last_boot", "update_entity", "temperature"]
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
    if (!this._built) { this._build(); this._built = true; }
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      device_id: c.device_id || "",
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
        if (k === "confirm" && m[k] === true) delete m[k]; /* true = default */
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
customElements.define("synology-nas-card-editor", SynologyNasCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-nas-card",
  name: "Synology NAS Card",
  description: "Synology NAS: CPU, memory, throughput, temperature and actions.",
});
console.info("%c SYNOLOGY-NAS-CARD %c v" + SYNAS_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
CONFIG EXAMPLES

# Minimal: everything auto-detected from the first Synology NAS
type: custom:synology-nas-card

# Explicit (any key set here wins over detection)
type: custom:synology-nas-card
title: NAS
icon: mdi:nas
accent: "#378ADD"
security_entity: binary_sensor.example_nas_security_status
last_boot: sensor.example_nas_last_boot
update_entity: update.example_nas_dsm_update
temperature: sensor.example_nas_temperature
gauges:
  - name: CPU
    percentage: sensor.example_nas_cpu_utilization_total
    color: "#378ADD"
  - name: Memory
    percentage: sensor.example_nas_memory_usage_real
    free: sensor.example_nas_memory_available_real
    total: sensor.example_nas_memory_total_real
    color: "#7F77DD"
  - name: Load 5 min
    value: sensor.example_nas_cpu_load_average_5_min
    max: 4
    color: "#1D9E75"
throughput:
  download: sensor.example_nas_download_throughput
  upload: sensor.example_nas_upload_throughput
actions:
  - name: Reboot
    entity: button.example_nas_reboot
    icon: mdi:restart
  - name: Shut down
    entity: button.example_nas_shutdown
    icon: mdi:power
    color: "#E24B4A"
============================================================ */
