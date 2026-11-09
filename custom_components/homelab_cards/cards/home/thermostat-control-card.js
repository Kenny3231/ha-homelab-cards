/**
 * Thermostat Control Card — vanilla JS custom Lovelace card
 * Works with any climate entity (Netatmo, HomeKit, Tado, Zigbee, Generic Thermostat…).
 *
 * No dependency. Visual editor included.
 *
 *  - Circular gauge: current temperature, setpoint marker, colour by temperature
 *  - Status pill (hvac_action / heating demand), demand bar, preset & schedule chips
 *  - Setpoint −/+ with hold-to-repeat and debounce (optimistic value meanwhile)
 *  - HVAC mode selector (when the entity offers several modes)
 *  - Preset buttons (auto from preset_modes, or an explicit list)
 *  - Built-in 24 h history (temperature + setpoint) through history/history_during_period
 *  - Rich entity with automatic fallback to a basic one when unavailable
 *
 * Minimal config:
 *   type: custom:thermostat-control-card
 *   entity: climate.example_room
 */

const TC_VERSION = "1.0.0";
const TC_TAG = "thermostat-control-card";

const TC_DEFAULTS = {
  show_gauge: true,
  show_presets: true,
  show_history: true,
  history_hours: 24,
  hvac_modes: true,
  battery_threshold: 20,
  power_attribute: "heating_power_request",
  schedule_attribute: "selected_schedule",
};

/* T < below => color (°C, converted when the entity is in °F). Last entry = everything above. */
const TC_SCALE = [
  { below: 16, color: "#7ec8f5" },
  { below: 20, color: "#42a5f5" },
  { below: 24, color: "#ff9800" },
  { below: 28, color: "#f57c00" },
  { color: "#e53935" },
];
const TC_GREY = "#9e9e9e";

/* Known presets: label key, icon, color. Unknown presets fall back to a prettified raw value. */
const TC_PRESETS = {
  schedule: { icon: "mdi:calendar-clock", color: "#4caf50" },
  auto: { icon: "mdi:thermostat-auto", color: "#4caf50" },
  home: { icon: "mdi:home", color: "#4caf50" },
  comfort: { icon: "mdi:sofa", color: "#ff9800" },
  eco: { icon: "mdi:leaf", color: "#8bc34a" },
  away: { icon: "mdi:home-export-outline", color: "#78909c" },
  sleep: { icon: "mdi:power-sleep", color: "#7e57c2" },
  activity: { icon: "mdi:run", color: "#ff7043" },
  boost: { icon: "mdi:fire", color: "#ff9800" },
  frost_guard: { icon: "mdi:snowflake", color: "#42a5f5" },
  manual: { icon: "mdi:hand-back-right", color: "#9e9e9e" },
  none: { icon: "mdi:close-circle-outline", color: "#9e9e9e" },
};

const TC_MODES = {
  off: "mdi:power", heat: "mdi:fire", cool: "mdi:snowflake", auto: "mdi:thermostat-auto",
  heat_cool: "mdi:sun-snowflake-variant", dry: "mdi:water-percent", fan_only: "mdi:fan",
};

/* ---------- i18n ---------- */
const TC_I18N = {
  fr: {
    desc: "Thermostat : jauge, consigne, modes, presets et historique intégré.",
    target: "cible", setpoint: "consigne", manual_setpoint: "consigne manuelle",
    demand: "Demande", reached: "Consigne atteinte", unavailable: "Indisponible",
    not_found: "Entité introuvable : {e}", fallback: "Repli", history: "Historique {h} h",
    temperature: "Température", humidity: "Humidité", battery: "Batterie",
    a_heating: "Chauffe", a_preheating: "Préchauffe", a_cooling: "Refroidit", a_drying: "Déshumidifie",
    a_fan: "Ventile", a_idle: "Au repos", a_off: "Arrêt", a_defrosting: "Dégivrage",
    m_off: "Arrêt", m_heat: "Chauffage", m_cool: "Clim", m_auto: "Auto", m_heat_cool: "Chaud/Froid",
    m_dry: "Déshumid.", m_fan_only: "Ventilation",
    p_schedule: "Planning", p_auto: "Auto", p_home: "Maison", p_comfort: "Confort", p_eco: "Éco",
    p_away: "Absent", p_sleep: "Nuit", p_activity: "Activité", p_boost: "Forcer",
    p_frost_guard: "Hors-gel", p_manual: "Manuel", p_none: "Aucun",
    dec: "Diminuer la consigne", inc: "Augmenter la consigne",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    sec_gen: "Général", sec_ent: "Entités", sec_disp: "Affichage", sec_presets: "Modes et presets",
    sec_adv: "Couleurs / Avancé",
    hint_ent: "L'entité de repli est utilisée quand l'entité principale est indisponible. Les capteurs externes sont prioritaires sur les attributs du thermostat.",
    hint_presets: "Liste vide = presets détectés automatiquement depuis l'entité (preset_modes).",
    hint_scale: "Seuils de couleur : liste de { below: 16, color: \"#42a5f5\" }, la dernière entrée sans below.",
    add_preset: "Ajouter un preset", fill_presets: "Remplir depuis l'entité", remove: "Supprimer",
    ph_preset: "preset (ex. eco)", ph_name: "libellé", ph_icon: "mdi:icône", ph_color: "couleur",
    l_name: "Nom affiché", l_icon: "Icône", l_entity: "Thermostat principal (climate)",
    l_fallback_entity: "Thermostat de repli (climate)", l_temperature_entity: "Capteur de température",
    l_humidity_entity: "Capteur d'humidité", l_battery_entity: "Batterie",
    l_show_gauge: "Afficher la jauge", l_show_presets: "Afficher les presets",
    l_show_history: "Afficher l'historique", l_history_hours: "Durée de l'historique (h)",
    l_hvac_modes: "Afficher le sélecteur de mode", l_step: "Pas de consigne",
    l_min: "Consigne minimale", l_max: "Consigne maximale",
    l_power_attribute: "Attribut de demande de chauffe", l_schedule_attribute: "Attribut du planning",
    l_battery_threshold: "Seuil d'alerte batterie (%)", l_color_scale: "Échelle de couleurs",
  },
  en: {
    desc: "Thermostat: gauge, setpoint, modes, presets and built-in history.",
    target: "target", setpoint: "setpoint", manual_setpoint: "manual setpoint",
    demand: "Demand", reached: "Setpoint reached", unavailable: "Unavailable",
    not_found: "Entity not found: {e}", fallback: "Fallback", history: "History {h} h",
    temperature: "Temperature", humidity: "Humidity", battery: "Battery",
    a_heating: "Heating", a_preheating: "Preheating", a_cooling: "Cooling", a_drying: "Drying",
    a_fan: "Fan", a_idle: "Idle", a_off: "Off", a_defrosting: "Defrosting",
    m_off: "Off", m_heat: "Heat", m_cool: "Cool", m_auto: "Auto", m_heat_cool: "Heat/Cool",
    m_dry: "Dry", m_fan_only: "Fan",
    p_schedule: "Schedule", p_auto: "Auto", p_home: "Home", p_comfort: "Comfort", p_eco: "Eco",
    p_away: "Away", p_sleep: "Sleep", p_activity: "Activity", p_boost: "Boost",
    p_frost_guard: "Frost guard", p_manual: "Manual", p_none: "None",
    dec: "Decrease setpoint", inc: "Increase setpoint",
    expand_all: "Expand all", collapse_all: "Collapse all",
    sec_gen: "General", sec_ent: "Entities", sec_disp: "Display", sec_presets: "Modes and presets",
    sec_adv: "Colors / Advanced",
    hint_ent: "The fallback entity is used when the main entity is unavailable. External sensors take precedence over the thermostat attributes.",
    hint_presets: "Empty list = presets detected automatically from the entity (preset_modes).",
    hint_scale: "Color thresholds: list of { below: 16, color: \"#42a5f5\" }, last entry without below.",
    add_preset: "Add preset", fill_presets: "Fill from entity", remove: "Remove",
    ph_preset: "preset (e.g. eco)", ph_name: "label", ph_icon: "mdi:icon", ph_color: "color",
    l_name: "Display name", l_icon: "Icon", l_entity: "Main thermostat (climate)",
    l_fallback_entity: "Fallback thermostat (climate)", l_temperature_entity: "Temperature sensor",
    l_humidity_entity: "Humidity sensor", l_battery_entity: "Battery",
    l_show_gauge: "Show gauge", l_show_presets: "Show presets",
    l_show_history: "Show history", l_history_hours: "History length (h)",
    l_hvac_modes: "Show mode selector", l_step: "Setpoint step",
    l_min: "Minimum setpoint", l_max: "Maximum setpoint",
    l_power_attribute: "Heating demand attribute", l_schedule_attribute: "Schedule attribute",
    l_battery_threshold: "Battery alert threshold (%)", l_color_scale: "Color scale",
  },
};
const tcLocale = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const tcLang = (h) => (String(tcLocale(h)).toLowerCase().indexOf("fr") === 0 ? "fr" : "en");
function tcT(lang, k, vars) {
  let s = TC_I18N[lang][k];
  if (s === undefined) s = TC_I18N.en[k] !== undefined ? TC_I18N.en[k] : k;
  return vars ? s.replace(/\{(\w+)\}/g, (_, v) => vars[v]) : s;
}
const tcEsc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tcPretty = (s) => { const v = String(s).replace(/_/g, " "); return v.charAt(0).toUpperCase() + v.slice(1); };
const tcNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
/* User colors end up in a style attribute: keep only plain color syntax. */
const tcColor = (c, def) => (typeof c === "string" && /^[#a-zA-Z0-9(),.%\s-]{1,40}$/.test(c) ? c : def);
const TC_BAD = ["unavailable", "unknown", "", undefined, null];

class ThermostatControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pending = null;
    this._hist = null;
    this._histKey = "";
    this._histAt = 0;
    this._sigs = {};
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("entity is required (climate.*)");
    this._config = { ...TC_DEFAULTS, ...config };
    this._built = false;
    this._sigs = {};
    this._histKey = "";
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    this._lang = tcLang(hass);
    if (!this._config) return;
    if (!this._built) { this._build(); this._built = true; }
    this._refresh();
    this._maybeFetchHistory();
  }

  disconnectedCallback() { this._stepStop(); }

  getCardSize() {
    const c = this._config || TC_DEFAULTS;
    return 4 + (c.show_gauge !== false ? 1 : 0) + (c.show_presets !== false ? 1 : 0) + (c.show_history !== false ? 3 : 0);
  }
  static getConfigElement() { return document.createElement(TC_TAG + "-editor"); }
  /* Richest existing climate (one with preset_modes), else the first one, else a placeholder. */
  static getStubConfig(hass) {
    const all = Object.values((hass && hass.states) || {}).filter((s) => s.entity_id.indexOf("climate.") === 0);
    const rich = all.find((s) => Array.isArray(s.attributes.preset_modes) && s.attributes.preset_modes.length);
    return { entity: (rich || all[0] || { entity_id: "climate.example" }).entity_id };
  }

  /* ---------- data helpers ---------- */
  _t(k, vars) { return tcT(this._lang || "en", k, vars); }
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _ok(id) { const s = this._st(id); return !!s && !TC_BAD.includes(s.state); }
  /* Active entity: main if usable, else fallback if usable, else main (shown unavailable). */
  _activeId() {
    const c = this._config;
    if (this._ok(c.entity)) return c.entity;
    if (c.fallback_entity && this._ok(c.fallback_entity)) return c.fallback_entity;
    return c.entity;
  }
  _unit() {
    const a = (this._st(this._activeId()) || {}).attributes || {};
    const us = this._hass && this._hass.config && this._hass.config.unit_system;
    return a.temperature_unit || (us && us.temperature) || "°C";
  }
  _isF() { return /F/.test(this._unit()); }
  _fmt(v, dec) {
    if (v === null || v === undefined) return "--";
    try {
      return new Intl.NumberFormat(tcLocale(this._hass), { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    } catch (e) { return Number(v).toFixed(dec); }
  }
  _attrs() { const s = this._st(this._activeId()); return (s && s.attributes) || {}; }
  _step() { return tcNum(this._config.step) || tcNum(this._attrs().target_temp_step) || (this._isF() ? 1 : 0.5); }
  _min() { const c = tcNum(this._config.min); if (c !== null) return c; const a = tcNum(this._attrs().min_temp); return a !== null ? a : (this._isF() ? 45 : 7); }
  _max() { const c = tcNum(this._config.max); if (c !== null) return c; const a = tcNum(this._attrs().max_temp); return a !== null ? a : (this._isF() ? 86 : 30); }
  _stepDec() { return Math.min(2, Math.max(1, (String(this._step()).split(".")[1] || "").length)); }
  _curTemp() {
    const t = this._config.temperature_entity;
    if (t && this._ok(t)) { const v = tcNum(this._st(t).state); if (v !== null) return v; }
    return tcNum(this._attrs().current_temperature);
  }
  _humidity() {
    const h = this._config.humidity_entity;
    if (h && this._ok(h)) { const v = tcNum(this._st(h).state); if (v !== null) return v; }
    return tcNum(this._attrs().current_humidity);
  }
  _target() { return this._pending !== null ? this._pending : tcNum(this._attrs().temperature); }
  _scale() {
    const user = Array.isArray(this._config.color_scale) && this._config.color_scale.length ? this._config.color_scale : null;
    if (user) return user;
    return this._isF() ? TC_SCALE.map((s) => (s.below === undefined ? s : { ...s, below: s.below * 9 / 5 + 32 })) : TC_SCALE;
  }
  _tempColor(v) {
    if (v === null) return TC_GREY;
    for (const s of this._scale()) {
      const b = s && tcNum(s.below !== undefined ? s.below : s.temp); // `temp` = alias used by the valve card
      if (b === null || v < b) return tcColor(s && s.color, TC_GREY);
    }
    return TC_GREY;
  }
  _presetInfo(p) {
    const k = String(p).toLowerCase(), d = TC_PRESETS[k];
    const lbl = TC_I18N.en["p_" + k] !== undefined ? this._t("p_" + k) : tcPretty(p);
    return { icon: d ? d.icon : "mdi:tune-variant", color: d ? d.color : "#03a9f4", name: lbl };
  }
  /* Explicit list (strings or objects) filtered by what the entity accepts, else auto. */
  _presets() {
    const modes = this._attrs().preset_modes;
    if (!Array.isArray(modes) || !modes.length) return [];
    const src = Array.isArray(this._config.presets) && this._config.presets.length
      ? this._config.presets : modes.filter((m) => String(m).toLowerCase() !== "none");
    return src.map((p) => (typeof p === "string" ? { preset: p } : p || {}))
      .filter((p) => p.preset && modes.includes(p.preset))
      .map((p) => {
        const d = this._presetInfo(p.preset);
        return { preset: p.preset, name: p.name || d.name, icon: p.icon || d.icon, color: tcColor(p.color, d.color) };
      });
  }
  _modes() {
    const c = this._config.hvac_modes;
    let modes = this._attrs().hvac_modes;
    if (c === false || !Array.isArray(modes)) return [];
    if (Array.isArray(c) && c.length) modes = modes.filter((m) => c.includes(m));
    return modes.length > 1 ? modes : [];
  }

  /* ---------- actions ---------- */
  _moreInfo(id) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id || this._activeId() }, bubbles: true, composed: true }));
  }
  _canSet() { return this._ok(this._activeId()) && tcNum(this._attrs().temperature) !== null; }
  _nudge(dir) {
    if (!this._canSet()) return;
    const step = this._step();
    const base = this._target() !== null ? this._target() : (this._curTemp() !== null ? this._curTemp() : this._min());
    let next = Math.round((base + dir * step) / step) * step;
    next = Number(Math.min(this._max(), Math.max(this._min(), next)).toFixed(3));
    if (next === base) { this._stepStop(); return; } /* bound reached: a disabled button gets no pointerup */
    this._pending = next;
    clearTimeout(this._debT);
    this._debT = setTimeout(() => this._commit(), 600);
    this._refresh();
  }
  _commit() {
    this._debT = null;
    if (this._pending === null) return;
    this._sentAt = Date.now();
    this._hass.callService("climate", "set_temperature", { entity_id: this._activeId(), temperature: this._pending });
  }
  _stepStart(dir) {
    this._stepStop();
    this._nudge(dir);
    this._holdT = setTimeout(() => { this._holdI = setInterval(() => this._nudge(dir), 150); }, 450);
  }
  _stepStop() { clearTimeout(this._holdT); clearInterval(this._holdI); this._holdT = this._holdI = null; }

  /* ---------- DOM ---------- */
  _build() {
    const root = this.shadowRoot, t = (k) => tcEsc(this._t(k));
    root.innerHTML = `
      <style>${TC_CSS}</style>
      <ha-card>
        <div class="hdr" id="hdr" role="button" tabindex="0">
          <span class="hicon"><ha-icon id="hicon"></ha-icon></span>
          <span class="hname" id="hname"></span>
          <span class="hchips" id="hchips"></span>
        </div>
        <div class="warn" id="warn" hidden></div>
        <div class="panel">
          <div class="top">
            <div class="gauge" id="gauge" role="slider" tabindex="0">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <path class="track" d="${tcArc(0, 1)}"></path>
                <path class="val" id="arc" d="${tcArc(0, 1)}" pathLength="100" stroke-dasharray="0 100"></path>
                <circle class="mark" id="mark" r="4.5" cx="60" cy="10"></circle>
              </svg>
              <div class="gc">
                <div class="gt"><span id="gtemp">--</span><sup id="gunit"></sup></div>
                <div class="gs" id="gtarget"></div>
                <div class="gh" id="ghum" hidden><ha-icon icon="mdi:water-percent"></ha-icon><span></span></div>
              </div>
              <span class="lim lmin" id="lmin"></span><span class="lim lmax" id="lmax"></span>
            </div>
            <div class="info">
              <span class="pill" id="pill"><ha-icon></ha-icon><span></span></span>
              <div class="demand" id="demand" hidden>
                <div class="drow"><span>${t("demand")}</span><span id="dval"></span></div>
                <div class="dbar"><div id="dfill"></div></div>
              </div>
              <div class="reached" id="reached" hidden><ha-icon icon="mdi:check-circle-outline"></ha-icon>${t("reached")}</div>
              <div class="chips" id="chips"></div>
            </div>
          </div>
          <div class="setrow" id="setrow">
            <button class="sbtn" id="minus" aria-label="${t("dec")}"><ha-icon icon="mdi:minus"></ha-icon></button>
            <div class="sval"><div class="sv" id="sv">--</div><div class="sl" id="sl"></div></div>
            <button class="sbtn" id="plus" aria-label="${t("inc")}"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          <div class="btns modes" id="modes"></div>
          <div class="btns presets" id="presets"></div>
        </div>
        <div class="hist" id="hist" hidden>
          <div class="htitle" id="htitle"></div>
          <div class="hval" id="hval"></div>
          <div class="legend"><span class="lt">${t("temperature")}</span><span class="ls">${t("setpoint")}</span></div>
          <div class="chart">
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#ff9800" stop-opacity=".45"></stop>
                <stop offset="1" stop-color="#ff9800" stop-opacity="0"></stop></linearGradient></defs>
              <path id="harea" fill="url(#hg)"></path>
              <path id="hset" class="hset"></path>
              <path id="hline" class="hline"></path>
            </svg>
            <span class="ylab ytop" id="ytop"></span><span class="ylab ybot" id="ybot"></span>
          </div>
        </div>
      </ha-card>`;

    const hdr = root.getElementById("hdr");
    hdr.addEventListener("click", () => this._moreInfo());
    hdr.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._moreInfo(); } });
    const g = root.getElementById("gauge");
    g.addEventListener("click", () => this._moreInfo());
    g.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); this._nudge(d); } else if (e.key === "Enter") this._moreInfo();
    });
    [["minus", -1], ["plus", 1]].forEach(([id, dir]) => {
      const b = root.getElementById(id);
      b.addEventListener("pointerdown", (e) => { if (e.button === 0) { e.preventDefault(); this._stepStart(dir); } });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => this._stepStop()));
      /* detail === 0: keyboard activation (pointer clicks are handled on pointerdown). */
      b.addEventListener("click", (e) => { if (e.detail === 0) this._nudge(dir); });
    });
    root.getElementById("modes").addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (b && this._ok(this._activeId())) this._hass.callService("climate", "set_hvac_mode", { entity_id: this._activeId(), hvac_mode: b.dataset.mode });
    });
    root.getElementById("presets").addEventListener("click", (e) => {
      const b = e.target.closest("[data-preset]");
      if (b && this._ok(this._activeId())) this._hass.callService("climate", "set_preset_mode", { entity_id: this._activeId(), preset_mode: b.dataset.preset });
    });
    root.getElementById("hchips").addEventListener("click", (e) => {
      if (e.target.closest(".bat")) { e.stopPropagation(); this._moreInfo(this._config.battery_entity); }
    });
  }

  /* Rewrites a container only when its content signature changes (keeps focus/hover otherwise). */
  _html(id, html) {
    if (this._sigs[id] === html) return;
    this._sigs[id] = html;
    this.shadowRoot.getElementById(id).innerHTML = html;
  }

  _refresh() {
    const root = this.shadowRoot, c = this._config;
    if (!root.getElementById("gauge")) { this._built = false; return; }
    const id = this._activeId(), st = this._st(id), a = (st && st.attributes) || {};
    const ok = this._ok(id), unit = this._unit();
    const cur = ok ? this._curTemp() : null;

    /* Drop the optimistic value once HA confirms it (or after a timeout). */
    if (this._pending !== null && !this._debT && (tcNum(a.temperature) === this._pending || Date.now() - (this._sentAt || 0) > 5000)) this._pending = null;
    const tgt = ok ? this._target() : null;
    const min = this._min(), max = this._max(), col = ok ? this._tempColor(cur) : TC_GREY;

    root.getElementById("hicon").setAttribute("icon", c.icon || a.icon || "mdi:thermostat");
    root.getElementById("hname").textContent = c.name || a.friendly_name || c.entity;
    const warn = root.getElementById("warn");
    warn.hidden = !!this._st(c.entity);
    warn.textContent = this._t("not_found", { e: c.entity });
    root.querySelector("ha-card").style.setProperty("--tc", col);
    root.querySelector("ha-card").classList.toggle("off", !ok);

    /* header chips: fallback + battery */
    let hc = "";
    if (ok && id !== c.entity) hc += `<span class="chip"><ha-icon icon="mdi:swap-horizontal"></ha-icon>${tcEsc(this._t("fallback"))}</span>`;
    const bs = this._st(c.battery_entity);
    if (bs && !TC_BAD.includes(bs.state)) {
      const lvl = tcNum(bs.state), bin = c.battery_entity.indexOf("binary_sensor.") === 0;
      const low = bin ? bs.state === "on" : lvl !== null && lvl < (tcNum(c.battery_threshold) || 20);
      const ic = bin ? (low ? "mdi:battery-alert" : "mdi:battery") : (lvl === null ? "mdi:battery-unknown" : low ? "mdi:battery-alert" : `mdi:battery${lvl >= 95 ? "" : "-" + Math.max(10, Math.round(lvl / 10) * 10)}`);
      hc += `<span class="chip bat${low ? " low" : ""}" title="${tcEsc(this._t("battery"))}"><ha-icon icon="${ic}"></ha-icon>${bin ? "" : tcEsc(this._fmt(lvl, 0) + " %")}</span>`;
    }
    this._html("hchips", hc);

    /* gauge */
    const gauge = root.getElementById("gauge");
    gauge.hidden = c.show_gauge === false;
    const frac = (v) => Math.min(1, Math.max(0, (v - min) / ((max - min) || 1)));
    root.getElementById("arc").setAttribute("stroke-dasharray", `${cur === null ? 0 : (frac(cur) * 100).toFixed(1)} 100`);
    const mark = root.getElementById("mark");
    mark.style.display = tgt === null ? "none" : "";
    if (tgt !== null) { const p = tcPoint(frac(tgt)); mark.setAttribute("cx", p[0]); mark.setAttribute("cy", p[1]); }
    root.getElementById("gtemp").textContent = ok ? this._fmt(cur, 1) : "—";
    root.getElementById("gunit").textContent = ok ? "°" : "";
    root.getElementById("gtarget").textContent = !ok ? this._t("unavailable") : tgt !== null ? `${this._t("target")} ${this._fmt(tgt, this._stepDec())}°` : "";
    const hum = ok ? this._humidity() : null, gh = root.getElementById("ghum");
    gh.hidden = hum === null;
    gh.querySelector("span").textContent = hum === null ? "" : this._fmt(hum, 0) + " %";
    root.getElementById("lmin").textContent = this._fmt(min, 0) + "°";
    root.getElementById("lmax").textContent = this._fmt(max, 0) + "°";
    gauge.setAttribute("aria-valuemin", min);
    gauge.setAttribute("aria-valuemax", max);
    gauge.setAttribute("aria-valuenow", tgt === null ? "" : tgt);
    gauge.setAttribute("aria-label", `${this._t("temperature")} ${this._fmt(cur, 1)} ${unit}`);

    /* status pill */
    const power = tcNum(a[c.power_attribute]);
    let act = a.hvac_action || (st && st.state === "off" ? "off" : power !== null && power > 0 ? "heating" : "idle");
    if (st && st.state === "off") act = "off";
    const actIcon = { heating: "mdi:fire", preheating: "mdi:fire", cooling: "mdi:snowflake", drying: "mdi:water-percent",
      fan: "mdi:fan", idle: "mdi:weather-night", off: "mdi:power", defrosting: "mdi:snowflake-melt" }[act] || "mdi:fan";
    const pill = root.getElementById("pill");
    pill.className = "pill " + (!ok ? "na" : act === "heating" || act === "preheating" ? "heat" : act === "cooling" ? "cool" : act);
    pill.querySelector("ha-icon").setAttribute("icon", ok ? actIcon : "mdi:lan-disconnect");
    pill.querySelector("span").textContent = !ok ? this._t("unavailable") : TC_I18N.en["a_" + act] ? this._t("a_" + act) : tcPretty(act);

    const dm = root.getElementById("demand");
    dm.hidden = !ok || power === null;
    if (power !== null) {
      const pct = Math.min(100, Math.max(0, power));
      root.getElementById("dval").textContent = pct > 0 ? this._fmt(pct, 0) + " %" : "–";
      root.getElementById("dfill").style.width = pct + "%";
    }
    const cool = st && st.state === "cool";
    root.getElementById("reached").hidden = !(ok && cur !== null && tgt !== null && st.state !== "off" && (cool ? cur <= tgt : cur >= tgt));

    /* chips: preset + schedule */
    let ch = "";
    if (ok && a.preset_mode && String(a.preset_mode).toLowerCase() !== "none") {
      const p = this._presetInfo(a.preset_mode);
      ch += `<span class="chip"><ha-icon icon="${tcEsc(p.icon)}"></ha-icon>${tcEsc(p.name)}</span>`;
    }
    const sch = a[c.schedule_attribute];
    if (ok && sch !== undefined && sch !== null && sch !== "" && typeof sch !== "object") {
      ch += `<span class="chip"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon>${tcEsc(sch)}</span>`;
    }
    this._html("chips", ch);

    /* setpoint row */
    root.getElementById("setrow").hidden = !ok || tcNum(a.temperature) === null;
    root.getElementById("sv").textContent = tgt === null ? "--" : `${this._fmt(tgt, this._stepDec())}${unit}`;
    const manual = st && st.state === "heat" && Array.isArray(a.preset_modes) && a.preset_modes.length;
    root.getElementById("sl").textContent = this._t(manual ? "manual_setpoint" : "setpoint");
    root.getElementById("minus").disabled = tgt === null || tgt <= min;
    root.getElementById("plus").disabled = tgt === null || tgt >= max;

    /* modes */
    const modes = ok ? this._modes() : [];
    this._html("modes", modes.map((m) => {
      const on = st.state === m;
      return `<button class="mb${on ? " on" : ""}" data-mode="${tcEsc(m)}" aria-pressed="${on}" style="--bc:${m === "off" ? "#9e9e9e" : m === "cool" ? "#42a5f5" : m === "heat" ? "#ff9800" : "#4caf50"}">`
        + `<ha-icon icon="${TC_MODES[m] || "mdi:thermostat"}"></ha-icon><span>${tcEsc(TC_I18N.en["m_" + m] ? this._t("m_" + m) : tcPretty(m))}</span></button>`;
    }).join(""));

    /* presets */
    const presets = ok && c.show_presets !== false ? this._presets() : [];
    this._html("presets", presets.map((p) => {
      const on = a.preset_mode === p.preset;
      return `<button class="mb${on ? " on" : ""}" data-preset="${tcEsc(p.preset)}" aria-pressed="${on}" style="--bc:${tcEsc(p.color)}">`
        + `<ha-icon icon="${tcEsc(p.icon)}"></ha-icon><span>${tcEsc(p.name)}</span></button>`;
    }).join(""));

    this._renderHistory(cur, unit);
  }

  /* ---------- history ---------- */
  _maybeFetchHistory() {
    const c = this._config;
    if (c.show_history === false || !this._hass || !this._hass.callWS) return;
    const id = this._activeId(), key = [id, c.temperature_entity || "", c.history_hours].join("|");
    if (this._histBusy || (key === this._histKey && Date.now() - this._histAt < 300000)) return;
    this._histKey = key;
    this._histAt = Date.now();
    this._histBusy = true;
    const hours = tcNum(c.history_hours) || 24, end = new Date(), start = new Date(end - hours * 3600000);
    const ids = [id].concat(c.temperature_entity ? [c.temperature_entity] : []);
    this._hass.callWS({
      type: "history/history_during_period", start_time: start.toISOString(), end_time: end.toISOString(),
      entity_ids: ids, minimal_response: false, no_attributes: false, significant_changes_only: false,
    }).then((res) => {
      this._hist = tcSeries(res || {}, id, c.temperature_entity, start.getTime());
      this._refresh();
    }).catch((err) => {
      console.warn("[" + TC_TAG + "] history unavailable:", err);
      this._hist = null;
    }).then(() => { this._histBusy = false; });
  }

  _renderHistory(cur, unit) {
    const root = this.shadowRoot, c = this._config, box = root.getElementById("hist");
    const h = this._hist;
    box.hidden = c.show_history === false || !h || h.temp.length < 2;
    if (box.hidden) return;
    const now = Date.now(), t0 = h.start;
    const temp = h.temp.concat(cur !== null ? [{ t: now, v: cur }] : []);
    const tgtNow = tcNum(this._attrs().temperature);
    const set = h.set.length ? h.set.concat(tgtNow !== null ? [{ t: now, v: tgtNow }] : []) : [];
    const vals = temp.concat(set).map((p) => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    const W = 300, H = 80, pad = 6;
    const x = (t) => (((t - t0) / ((now - t0) || 1)) * W).toFixed(1);
    const y = (v) => (pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad)).toFixed(1);
    const line = temp.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(p.v)}`).join(" ");
    root.getElementById("hline").setAttribute("d", line);
    root.getElementById("harea").setAttribute("d", `${line} L${x(temp[temp.length - 1].t)},${H} L${x(temp[0].t)},${H} Z`);
    root.getElementById("hset").setAttribute("d", set.map((p, i) => (i ? `H${x(p.t)} V${y(p.v)}` : `M${x(p.t)},${y(p.v)}`)).join(" "));
    root.getElementById("ytop").textContent = this._fmt(hi, 1);
    root.getElementById("ybot").textContent = this._fmt(lo, 1);
    root.getElementById("htitle").textContent = this._t("history", { h: tcNum(c.history_hours) || 24 });
    root.getElementById("hval").innerHTML = `${tcEsc(this._fmt(cur, 1))}<small>${tcEsc(unit)}</small>`;
  }
}

/* 270° arc geometry (gap at the bottom). f in [0,1]. */
function tcPoint(f) {
  const ang = (135 + 270 * f) * Math.PI / 180;
  return [(60 + 50 * Math.cos(ang)).toFixed(2), (60 + 50 * Math.sin(ang)).toFixed(2)];
}
function tcArc(f0, f1) {
  const a = tcPoint(f0), b = tcPoint(f1);
  return `M${a[0]},${a[1]} A50,50 0 ${(f1 - f0) * 270 > 180 ? 1 : 0} 1 ${b[0]},${b[1]}`;
}

/* WS compressed history -> {start, temp:[{t,v}], set:[{t,v}]}. Attributes are carried forward when omitted. */
function tcSeries(res, climateId, tempId, start) {
  const pts = (eid, pick) => {
    let last = {};
    return (res[eid] || []).map((s) => {
      if (s.a) last = s.a;
      const v = pick(s, last);
      return { t: Math.max(start, (s.lu || s.lc || 0) * 1000), v: TC_BAD.includes(s.s) ? null : v };
    }).filter((p) => p.v !== null);
  };
  const temp = tempId && res[tempId]
    ? pts(tempId, (s) => tcNum(s.s))
    : pts(climateId, (s, a) => tcNum(a.current_temperature));
  const set = pts(climateId, (s, a) => tcNum(a.temperature));
  return { start, temp, set };
}

const TC_CSS = `
  :host { --tc: ${TC_GREY}; }
  ha-card { padding: 12px; border-radius: var(--ha-card-border-radius, 14px); overflow: hidden; }
  [hidden] { display: none !important; }
  .hdr { display: flex; align-items: center; gap: 10px; padding: 2px 4px 10px; cursor: pointer; border-radius: 10px; }
  .hdr:focus-visible, .gauge:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .hicon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--tc) 18%, transparent); color: var(--tc); }
  .hicon ha-icon { --mdc-icon-size: 20px; }
  .hname { flex: 1; font-weight: 600; font-size: 15px; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hchips { display: flex; gap: 6px; }
  .warn { font-size: 12px; color: var(--error-color, #db4437); padding: 0 4px 8px; }
  .panel { background: var(--secondary-background-color, rgba(127,127,127,.08)); border: 1px solid var(--divider-color); border-radius: 14px; padding: 14px; }
  .top { display: flex; gap: 14px; align-items: center; }
  .gauge { position: relative; flex: 0 0 140px; width: 140px; height: 140px; cursor: pointer; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--tc) 14%, transparent) 0%, transparent 68%); }
  .gauge svg { width: 100%; height: 100%; overflow: visible; }
  .track { fill: none; stroke: var(--divider-color); stroke-width: 9; stroke-linecap: round; }
  .val { fill: none; stroke: var(--tc); stroke-width: 9; stroke-linecap: round; transition: stroke-dasharray .6s ease, stroke .6s;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--tc) 55%, transparent)); }
  .mark { fill: var(--card-background-color, #fff); stroke: var(--primary-text-color); stroke-width: 2.5; transition: cx .3s, cy .3s; }
  .gc { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .gt { font-size: 30px; font-weight: 700; line-height: 1; color: var(--primary-text-color); }
  .gt sup { font-size: 13px; font-weight: 500; margin-left: 1px; }
  .gs { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
  .gh { display: flex; align-items: center; gap: 2px; font-size: 12px; color: #42a5f5; margin-top: 3px; }
  .gh ha-icon { --mdc-icon-size: 14px; }
  .lim { position: absolute; bottom: 4px; font-size: 10px; color: var(--secondary-text-color); }
  .lmin { left: 18px; } .lmax { right: 18px; }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .pill { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;
    background: rgba(127,127,127,.15); color: var(--primary-text-color); }
  .pill ha-icon { --mdc-icon-size: 16px; }
  .pill.heat { background: rgba(255,152,0,.18); color: #ff9800; }
  .pill.heat ha-icon { animation: tc-flame 1.3s ease-in-out infinite; transform-origin: 50% 90%; }
  .pill.cool { background: rgba(66,165,245,.18); color: #42a5f5; }
  .pill.na { color: var(--secondary-text-color); }
  @keyframes tc-flame { 0%,100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.12) rotate(-5deg); } }
  .drow { display: flex; justify-content: space-between; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 4px; }
  .dbar { height: 6px; border-radius: 3px; background: rgba(127,127,127,.2); overflow: hidden; }
  .dbar div { height: 100%; width: 0; background: #ff9800; border-radius: 3px; transition: width .6s ease; }
  .reached { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--primary-text-color); }
  .reached ha-icon { --mdc-icon-size: 16px; color: #4caf50; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips:empty { display: none; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 8px; font-size: 11px;
    border: 1px solid var(--divider-color); color: var(--secondary-text-color); white-space: nowrap; }
  .chip ha-icon { --mdc-icon-size: 14px; }
  .chip.bat { cursor: pointer; }
  .chip.low { color: var(--error-color, #db4437); border-color: var(--error-color, #db4437); }
  .setrow { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
  .sbtn { flex: 0 0 56px; height: 44px; border-radius: 12px; border: 1px solid var(--divider-color); background: rgba(127,127,127,.1);
    color: var(--primary-text-color); cursor: pointer; display: flex; align-items: center; justify-content: center; touch-action: none; user-select: none; }
  .sbtn:hover:not(:disabled) { background: rgba(127,127,127,.2); }
  .sbtn:disabled { opacity: .35; cursor: default; }
  .sval { flex: 1; text-align: center; }
  .sv { font-size: 20px; font-weight: 700; color: var(--primary-text-color); }
  .sl { font-size: 11px; color: var(--secondary-text-color); }
  .btns { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 8px; margin-top: 12px; }
  .btns:empty { display: none; }
  .mb { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 6px; border-radius: 12px; font: inherit; font-size: 12px; font-weight: 600;
    border: 1px solid var(--divider-color); background: rgba(127,127,127,.1); color: var(--primary-text-color); cursor: pointer; transition: all .2s; min-width: 0; }
  .mb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mb ha-icon { --mdc-icon-size: 18px; color: var(--bc); flex-shrink: 0; }
  .mb:hover { border-color: var(--bc); }
  .mb.on { background: color-mix(in srgb, var(--bc) 18%, transparent); border-color: var(--bc); color: var(--bc); }
  .off .val, .off .mark { opacity: .4; }
  .hist { margin-top: 12px; }
  .htitle { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); padding: 0 4px; }
  .hval { font-size: 30px; color: var(--primary-text-color); padding: 2px 4px 4px; }
  .hval small { font-size: 14px; margin-left: 3px; color: var(--secondary-text-color); }
  .legend { display: flex; justify-content: center; gap: 18px; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 6px; }
  .legend span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
  .lt::before { background: #ff9800; } .ls::before { background: #9e9e9e; }
  .chart { position: relative; height: 90px; }
  .chart svg { width: 100%; height: 100%; display: block; }
  .hline { fill: none; stroke: #ff9800; stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
  .hset { fill: none; stroke: #9e9e9e; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .ylab { position: absolute; left: 4px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--card-background-color, #fff); color: var(--primary-text-color); opacity: .85; }
  .ytop { top: 2px; } .ybot { bottom: 2px; }
  @media (max-width: 380px) { .gauge { flex-basis: 120px; width: 120px; height: 120px; } .gt { font-size: 26px; } }
  @media (prefers-reduced-motion: reduce) { .pill.heat ha-icon { animation: none; } .val, .mark, .dbar div, .mb { transition: none; } }
`;

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const TC_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const TC_SEC_CSS = `
  .sec { margin-bottom:18px; }
  .sec-tools { display:flex; justify-content:flex-end; gap:4px; margin-bottom:6px; }
  .sec-tools button { background:none; border:none; cursor:pointer; padding:2px 6px;
    border-radius:4px; font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-tools button:hover { color:var(--primary-text-color); }
  .sec-head { width:100%; display:flex; align-items:center; gap:8px; margin:0 0 10px 0;
    padding:0 0 6px 0; background:none; border:none; border-bottom:1px solid var(--divider-color);
    cursor:pointer; font:inherit; text-align:left; color:var(--primary-text-color); }
  .sec-head[aria-expanded="false"] { margin-bottom:0; }
  .sec-head:focus-visible, .sec-tools button:focus-visible, .pbtn:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:2px; border-radius:4px; }
  .sec-head .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; }
  .sec-head[aria-expanded="false"] .chev { transform:rotate(-90deg); }
  .sec-title { font-size:15px; font-weight:600; flex:1; }
  .sec-hint { font-size:12px; color:var(--secondary-text-color); margin:-4px 0 10px 0; line-height:1.4; }
  .sec-body[hidden] { display:none; }
  ha-form { display:block; }
  .prow { display:grid; grid-template-columns:1.2fr 1.2fr 1.2fr .9fr auto; gap:6px; margin-bottom:6px; align-items:center; }
  .prow input { min-width:0; box-sizing:border-box; padding:8px; border-radius:6px; font:inherit; font-size:13px;
    border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color); }
  .pbtn { background:none; border:1px solid var(--divider-color); border-radius:6px; padding:6px 10px; cursor:pointer;
    font:inherit; font-size:13px; color:var(--primary-text-color); }
  .pbtn.rm { padding:4px 8px; color:var(--error-color, #db4437); }
  .pacts { display:flex; gap:6px; margin:6px 0 12px; flex-wrap:wrap; }
  @media (prefers-reduced-motion: reduce) { .sec-head .chev { transition:none; } }
`;
const tcSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + tcEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function tcSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    TC_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, TC_SEC_STATE.has(k) ? TC_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const TC_SCHEMAS = {
  gen: [
    { name: "name", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ],
  ent: [
    { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
    { name: "fallback_entity", selector: { entity: { domain: "climate" } } },
    { name: "temperature_entity", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
    { name: "humidity_entity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
    { name: "battery_entity", selector: { entity: { domain: ["sensor", "binary_sensor"], device_class: "battery" } } },
  ],
  disp: [
    { type: "grid", schema: [
      { name: "show_gauge", selector: { boolean: {} } },
      { name: "show_presets", selector: { boolean: {} } },
      { name: "show_history", selector: { boolean: {} } },
      { name: "hvac_modes", selector: { boolean: {} } },
    ] },
    { name: "history_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box" } } },
  ],
  presets: [
    { type: "grid", schema: [
      { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
      { name: "min", selector: { number: { step: 0.5, mode: "box" } } },
      { name: "max", selector: { number: { step: 0.5, mode: "box" } } },
    ] },
  ],
  adv: [
    { name: "power_attribute", selector: { text: {} } },
    { name: "schedule_attribute", selector: { text: {} } },
    { name: "battery_threshold", selector: { number: { min: 0, max: 100, step: 1, mode: "box" } } },
    { name: "color_scale", selector: { object: {} } },
  ],
};

class ThermostatControlCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._forms) this._render();
    else this._forms.forEach((f) => { f.hass = hass; });
  }
  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _render() {
    if (!this._config || !this._hass) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const L = tcLang(this._hass), t = (k) => tcEsc(tcT(L, k));
    if (!this._forms) {
      this.shadowRoot.innerHTML = `<style>${TC_SEC_CSS}</style>
        <div class="sec-tools"><button type="button" class="sec-all" data-open="1">${t("expand_all")}</button><button type="button" class="sec-all" data-open="0">${t("collapse_all")}</button></div>
        ${tcSec("gen", tcT(L, "sec_gen"), `<ha-form data-schema="gen"></ha-form>`)}
        ${tcSec("ent", tcT(L, "sec_ent"), `<div class="sec-hint">${t("hint_ent")}</div><ha-form data-schema="ent"></ha-form>`)}
        ${tcSec("disp", tcT(L, "sec_disp"), `<ha-form data-schema="disp"></ha-form>`)}
        ${tcSec("presets", tcT(L, "sec_presets"), `<ha-form data-schema="presets"></ha-form>
          <div class="sec-hint" style="margin-top:12px">${t("hint_presets")}</div>
          <datalist id="pmodes"></datalist><div id="prows"></div>
          <div class="pacts"><button type="button" class="pbtn" id="padd">${t("add_preset")}</button><button type="button" class="pbtn" id="pfill">${t("fill_presets")}</button></div>`)}
        ${tcSec("adv", tcT(L, "sec_adv"), `<div class="sec-hint">${t("hint_scale")}</div><ha-form data-schema="adv"></ha-form>`)}`;
      tcSecWire(this.shadowRoot, this.tagName.toLowerCase());
      this._forms = Array.from(this.shadowRoot.querySelectorAll("ha-form"));
      this._forms.forEach((f) => {
        f.schema = TC_SCHEMAS[f.dataset.schema];
        f.computeLabel = (s) => tcT(L, "l_" + s.name);
        f.addEventListener("value-changed", (e) => {
          const next = { ...e.detail.value };
          if (this._config.presets !== undefined) next.presets = this._config.presets;
          if (Array.isArray(this._config.hvac_modes) && next.hvac_modes === true) next.hvac_modes = this._config.hvac_modes;
          this._config = next;
          this._render();
          this._emit();
        });
      });
      this._wirePresets(L);
    }
    const data = { ...TC_DEFAULTS, ...this._config };
    if (Array.isArray(data.hvac_modes)) data.hvac_modes = true; /* list stays in YAML; the toggle only shows/hides */
    this._forms.forEach((f) => { f.hass = this._hass; f.data = data; });
    this._renderPresets();
  }

  /* ---------- preset list editor: rows rebuilt only when the list changes from outside ---------- */
  _presetList() {
    return (Array.isArray(this._config.presets) ? this._config.presets : [])
      .map((p) => (typeof p === "string" ? { preset: p } : { ...(p || {}) }));
  }
  _entityModes() {
    const s = this._hass && this._hass.states[this._config.entity];
    return (s && Array.isArray(s.attributes.preset_modes)) ? s.attributes.preset_modes : [];
  }
  _setPresets(list, rebuild) {
    const clean = list.map((p) => {
      const o = {};
      ["preset", "name", "icon", "color"].forEach((k) => { if (p[k]) o[k] = p[k]; });
      return o;
    });
    const next = { ...this._config };
    if (clean.length) next.presets = clean; else delete next.presets;
    this._config = next;
    if (!rebuild) this._presetSig = JSON.stringify(this._presetList());
    this._renderPresets();
    this._emit();
  }
  _wirePresets(L) {
    const root = this.shadowRoot, rows = root.getElementById("prows");
    rows.addEventListener("input", (e) => {
      const inp = e.target.closest("input[data-k]");
      if (!inp) return;
      const list = this._presetList(), i = +inp.closest(".prow").dataset.i;
      while (list.length <= i) list.push({});
      list[i][inp.dataset.k] = inp.value.trim();
      this._setPresets(list, false);
    });
    rows.addEventListener("click", (e) => {
      const b = e.target.closest(".rm");
      if (!b) return;
      const list = this._presetList();
      list.splice(+b.closest(".prow").dataset.i, 1);
      this._setPresets(list, true);
    });
    root.getElementById("padd").addEventListener("click", () => {
      /* The new row only enters the config once something is typed in it (see the input handler). */
      rows.insertAdjacentHTML("beforeend", this._rowHtml({}, rows.children.length));
      rows.lastElementChild.querySelector("input").focus();
    });
    root.getElementById("pfill").addEventListener("click", () => {
      const have = this._presetList();
      const add = this._entityModes().filter((m) => String(m).toLowerCase() !== "none" && !have.some((p) => p.preset === m)).map((m) => ({ preset: m }));
      this._setPresets(have.concat(add), true);
    });
    this._L = L;
  }
  _renderPresets() {
    const root = this.shadowRoot, rows = root && root.getElementById("prows");
    if (!rows) return;
    const list = this._presetList(), sig = JSON.stringify(list);
    const dl = root.getElementById("pmodes");
    const opts = this._entityModes().map((m) => `<option value="${tcEsc(m)}"></option>`).join("");
    if (dl.innerHTML !== opts) dl.innerHTML = opts;
    if (sig === this._presetSig) return; /* echo of our own edit: keep inputs (and focus) untouched */
    this._presetSig = sig;
    rows.innerHTML = list.map((p, i) => this._rowHtml(p, i)).join("");
  }
  _rowHtml(p, i) {
    const t = (k) => tcEsc(tcT(this._L || "en", k));
    return `<div class="prow" data-i="${i}">
      <input data-k="preset" list="pmodes" placeholder="${t("ph_preset")}" value="${tcEsc(p.preset || "")}">
      <input data-k="name" placeholder="${t("ph_name")}" value="${tcEsc(p.name || "")}">
      <input data-k="icon" placeholder="${t("ph_icon")}" value="${tcEsc(p.icon || "")}">
      <input data-k="color" placeholder="${t("ph_color")}" value="${tcEsc(p.color || "")}">
      <button type="button" class="pbtn rm" aria-label="${t("remove")}" title="${t("remove")}">✕</button></div>`;
  }
}

customElements.define(TC_TAG, ThermostatControlCard);
customElements.define(TC_TAG + "-editor", ThermostatControlCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: TC_TAG,
  name: "Thermostat",
  description: tcT(String(document.documentElement.lang || navigator.language || "en").toLowerCase().indexOf("fr") === 0 ? "fr" : "en", "desc"),
  preview: true,
});

console.info(`%c THERMOSTAT-CONTROL-CARD %c v${TC_VERSION} `,
  "color:#fff;background:#ff9800;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
  "color:#ff9800;background:#222;border-radius:0 4px 4px 0;padding:2px 4px");
