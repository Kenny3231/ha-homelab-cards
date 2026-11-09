/**
 * Valve Control Card — vanilla JS custom Lovelace card
 * Thermostatic radiator valve (TRV) for any climate entity
 * (Netatmo, HomeKit, Tado, Zigbee2MQTT, Generic Thermostat…).
 *
 * No dependency. Visual editor included.
 *
 *  - Circular gauge: current temperature, setpoint marker, inner "opening" ring
 *  - Heating demand / valve opening (attribute, default heating_power_request)
 *  - Setpoint −/+ (hold to repeat, debounced service call, optimistic value)
 *  - Preset buttons (auto from preset_modes, or explicit list)
 *  - Several valves of the same room (compact list)
 *  - Built-in history chart (temperature + setpoint) via history_during_period
 *  - Main entity falls back to `fallback_entity` when unavailable
 */

const VC_VERSION = "1.0.0";
const VC_TAG = "valve-control-card";

const VC_DEFAULTS = {
  show_gauge: true,
  show_presets: true,
  show_history: true,
  history_hours: 24,
  hvac_modes: false, /* valves are usually heat-only */
  power_attribute: "heating_power_request",
  schedule_attribute: "selected_schedule",
  battery_threshold: 20,
};

/* Default colour scale, in °C (converted when the entity is in °F). */
const VC_SCALE_C = [
  { temp: 16, color: "#7dd3fc" },
  { temp: 20, color: "#3b82f6" },
  { temp: 24, color: "#f59e0b" },
  { temp: 28, color: "#ea580c" },
  { color: "#ef4444" },
];

/* Icons/colours for common preset values (labels live in the i18n table). */
const VC_PRESETS = {
  schedule: { icon: "mdi:calendar-clock", color: "#22c55e" },
  auto: { icon: "mdi:thermostat-auto", color: "#22c55e" },
  home: { icon: "mdi:home", color: "#22c55e" },
  comfort: { icon: "mdi:sofa", color: "#f59e0b" },
  eco: { icon: "mdi:leaf", color: "#10b981" },
  away: { icon: "mdi:account-arrow-right", color: "#3b82f6" },
  sleep: { icon: "mdi:power-sleep", color: "#8b5cf6" },
  activity: { icon: "mdi:motion-sensor", color: "#f59e0b" },
  boost: { icon: "mdi:fire", color: "#f97316" },
  frost_guard: { icon: "mdi:snowflake", color: "#38bdf8" },
  manual: { icon: "mdi:hand-back-right", color: "#9ca3af" },
  none: { icon: "mdi:close-circle-outline", color: "#9ca3af" },
};

const VC_MODE_ICONS = {
  off: "mdi:power", heat: "mdi:fire", cool: "mdi:snowflake", auto: "mdi:thermostat-auto",
  heat_cool: "mdi:sun-snowflake-variant", dry: "mdi:water-percent", fan_only: "mdi:fan",
};

/* ---------- i18n ---------- */
const VC_I18N = {
  fr: {
    idle: "Au repos", heating: "Chauffe", off: "Éteint", unavailable: "Indisponible",
    opening: "Ouverture", reached: "Consigne atteinte", target: "cible {t}",
    setpoint: "consigne", setpoint_manual: "consigne manuelle",
    history: "Historique {h} h", temperature: "Température", setpoint_l: "Consigne",
    no_history: "Pas d'historique", battery_low: "Batterie faible", humidity: "Humidité",
    dec: "Baisser la consigne", inc: "Augmenter la consigne", schedule: "Planning",
    p_schedule: "Planning", p_auto: "Auto", p_home: "Maison", p_comfort: "Confort", p_eco: "Éco",
    p_away: "Absent", p_sleep: "Nuit", p_activity: "Activité", p_boost: "Forcer",
    p_frost_guard: "Hors-gel", p_manual: "Manuel", p_none: "Aucun",
    m_off: "Arrêt", m_heat: "Chauffe", m_cool: "Froid", m_auto: "Auto", m_heat_cool: "Chaud/froid",
    m_dry: "Déshum.", m_fan_only: "Ventilation",
    /* editor */
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    sec_gen: "Général", sec_ent: "Entités", sec_disp: "Affichage", sec_presets: "Presets",
    sec_valves: "Vannes de la pièce", sec_adv: "Avancé / Couleurs",
    hint_presets: "Liste vide = presets détectés automatiquement (preset_modes de l'entité).",
    hint_valves: "Vannes supplémentaires de la même pièce, affichées sous la jauge.",
    hint_adv: "color_scale : liste de { temp, color } — couleur appliquée sous le seuil temp ; une entrée sans temp = au-delà.",
    add_preset: "Ajouter un preset", add_valve: "Ajouter une vanne", remove: "Supprimer",
    l_name: "Nom affiché", l_icon: "Icône", l_entity: "Climate principal",
    l_fallback_entity: "Climate de repli (si principal indisponible)",
    l_temperature_entity: "Capteur de température (facultatif)",
    l_humidity_entity: "Capteur d'humidité (facultatif)",
    l_battery_entity: "Batterie (facultatif)",
    l_show_gauge: "Afficher la jauge", l_show_presets: "Afficher les presets",
    l_show_history: "Afficher l'historique", l_history_hours: "Durée de l'historique (h)",
    l_hvac_modes: "Afficher le sélecteur de mode", l_step: "Pas (vide = entité)",
    l_min: "Min (vide = entité)", l_max: "Max (vide = entité)",
    l_power_attribute: "Attribut d'ouverture / demande", l_schedule_attribute: "Attribut du planning actif",
    l_battery_threshold: "Seuil d'alerte batterie (%)", l_color_scale: "Échelle de couleurs",
    r_preset: "Preset", r_name: "Libellé", r_icon: "Icône", r_color: "Couleur", r_entity: "Vanne (climate)",
  },
  en: {
    idle: "Idle", heating: "Heating", off: "Off", unavailable: "Unavailable",
    opening: "Opening", reached: "Setpoint reached", target: "target {t}",
    setpoint: "setpoint", setpoint_manual: "manual setpoint",
    history: "{h} h history", temperature: "Temperature", setpoint_l: "Setpoint",
    no_history: "No history", battery_low: "Low battery", humidity: "Humidity",
    dec: "Decrease setpoint", inc: "Increase setpoint", schedule: "Schedule",
    p_schedule: "Schedule", p_auto: "Auto", p_home: "Home", p_comfort: "Comfort", p_eco: "Eco",
    p_away: "Away", p_sleep: "Sleep", p_activity: "Activity", p_boost: "Boost",
    p_frost_guard: "Frost guard", p_manual: "Manual", p_none: "None",
    m_off: "Off", m_heat: "Heat", m_cool: "Cool", m_auto: "Auto", m_heat_cool: "Heat/cool",
    m_dry: "Dry", m_fan_only: "Fan",
    expand_all: "Expand all", collapse_all: "Collapse all",
    sec_gen: "General", sec_ent: "Entities", sec_disp: "Display", sec_presets: "Presets",
    sec_valves: "Valves in the room", sec_adv: "Advanced / Colours",
    hint_presets: "Empty list = presets detected automatically (entity preset_modes).",
    hint_valves: "Other valves of the same room, listed under the gauge.",
    hint_adv: "color_scale: list of { temp, color } — colour used below the temp threshold; an entry without temp = above.",
    add_preset: "Add a preset", add_valve: "Add a valve", remove: "Remove",
    l_name: "Display name", l_icon: "Icon", l_entity: "Main climate",
    l_fallback_entity: "Fallback climate (when main is unavailable)",
    l_temperature_entity: "Temperature sensor (optional)",
    l_humidity_entity: "Humidity sensor (optional)",
    l_battery_entity: "Battery (optional)",
    l_show_gauge: "Show gauge", l_show_presets: "Show presets",
    l_show_history: "Show history", l_history_hours: "History length (h)",
    l_hvac_modes: "Show mode selector", l_step: "Step (empty = entity)",
    l_min: "Min (empty = entity)", l_max: "Max (empty = entity)",
    l_power_attribute: "Opening / demand attribute", l_schedule_attribute: "Active schedule attribute",
    l_battery_threshold: "Battery alert threshold (%)", l_color_scale: "Colour scale",
    r_preset: "Preset", r_name: "Label", r_icon: "Icon", r_color: "Colour", r_entity: "Valve (climate)",
  },
};
const vcLang = (h) => {
  const l = (h && ((h.locale && h.locale.language) || h.language)) || "en";
  return String(l).toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
};
function vcT(lang, k, vars) {
  let s = VC_I18N[lang][k];
  if (s === undefined) s = VC_I18N.en[k] !== undefined ? VC_I18N.en[k] : k;
  return vars ? s.replace(/\{(\w+)\}/g, (_, v) => vars[v]) : s;
}
const vcEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const vcNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const vcOk = (s) => !!s && s.state !== "unavailable" && s.state !== "unknown";
const vcPretty = (v) => { const s = String(v).replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };
const vcLabel = (lang, prefix, v) => {
  const k = prefix + v;
  return VC_I18N[lang][k] !== undefined || VC_I18N.en[k] !== undefined ? vcT(lang, k) : vcPretty(v);
};

class ValveControlCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pending = null;   /* optimistic setpoint while debouncing */
    this._timer = null;     /* debounce timer */
    this._rep = null;       /* hold-to-repeat timer */
    this._hist = null;
    this._histKey = "";
    this._histAt = 0;
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("valve-control-card: 'entity' (climate) is required");
    this._config = { ...VC_DEFAULTS, ...config };
    this._built = false;
    this._sig = null;
    this._hist = null;
    this._histKey = "";
    if (this._hass) this._update();
  }

  set hass(hass) { this._hass = hass; this._update(); }

  disconnectedCallback() { this._stopRepeat(); }

  getCardSize() {
    const c = this._config || VC_DEFAULTS;
    return 5 + (c.show_history ? 3 : 0) + (Array.isArray(c.valves) ? c.valves.length : 0);
  }
  static getConfigElement() { return document.createElement(VC_TAG + "-editor"); }
  /* Richest existing climate (with preset_modes) first, else any climate, else a placeholder. */
  static getStubConfig(hass) {
    const all = Object.values((hass && hass.states) || {}).filter((s) => s.entity_id.indexOf("climate.") === 0);
    const best = all.find((s) => Array.isArray(s.attributes.preset_modes) && s.attributes.preset_modes.length) || all[0];
    return { entity: best ? best.entity_id : "climate.example" };
  }

  /* ---------- helpers ---------- */
  _t(k, vars) { return vcT(this._lang || "en", k, vars); }
  _locale() { const h = this._hass; return (h && ((h.locale && h.locale.language) || h.language)) || "en"; }
  _fmt(v, d = 1) {
    return new Intl.NumberFormat(this._locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  }
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  /* Main entity, or the fallback when the main one is unavailable and the fallback is not. */
  _activeId() {
    const c = this._config;
    if (vcOk(this._st(c.entity)) || !c.fallback_entity || !vcOk(this._st(c.fallback_entity))) return c.entity;
    return c.fallback_entity;
  }
  _unit(s) {
    const h = this._hass;
    return (s && s.attributes.temperature_unit) ||
      (h && h.config && h.config.unit_system && h.config.unit_system.temperature) || "°C";
  }
  _bounds(s, isF) {
    const c = this._config, a = (s && s.attributes) || {};
    const step = vcNum(c.step) || vcNum(a.target_temp_step) || (isF ? 1 : 0.5);
    let min = vcNum(c.min); if (min === null) min = vcNum(a.min_temp); if (min === null) min = isF ? 45 : 7;
    let max = vcNum(c.max); if (max === null) max = vcNum(a.max_temp); if (max === null) max = isF ? 86 : 30;
    if (max <= min) max = min + step;
    return { step, min, max };
  }
  _clamp(v, b) {
    const snapped = Math.round(v / b.step) * b.step;
    return +Math.max(b.min, Math.min(b.max, snapped)).toFixed(3);
  }
  _scale(isF) {
    const c = this._config.color_scale;
    // `below` is accepted as an alias of `temp` (same key as the thermostat card)
    const list = Array.isArray(c) && c.length ? c.map((e) => (e && e.temp === undefined && e.below !== undefined ? { ...e, temp: e.below } : e))
      : VC_SCALE_C.map((e) => (e.temp === undefined || !isF ? e : { ...e, temp: e.temp * 9 / 5 + 32 }));
    /* Thresholds ascending, open-ended entries (no temp) last. */
    return list.filter((e) => e && e.color).slice().sort((x, y) => {
      const a = vcNum(x.temp), b = vcNum(y.temp);
      return (a === null ? Infinity : a) - (b === null ? Infinity : b);
    });
  }
  _color(t, isF) {
    if (t === null) return "var(--disabled-text-color, #8a8a8a)";
    const scale = this._scale(isF);
    const e = scale.find((x) => vcNum(x.temp) === null || t < vcNum(x.temp));
    return e ? e.color : (scale.length ? scale[scale.length - 1].color : "var(--primary-color)");
  }
  _moreInfo(entityId) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }
  _call(service, data) { this._hass.callService("climate", service, { entity_id: this._activeId(), ...data }); }

  /* ---------- setpoint: optimistic + hold-to-repeat + debounce ---------- */
  _step(dir) {
    const id = this._activeId(), s = this._st(id);
    if (!vcOk(s) || s.state === "off") return;
    const b = this._bounds(s, /F/i.test(this._unit(s)));
    const base = this._pending !== null ? this._pending : vcNum(s.attributes.temperature);
    if (base === null) return;
    const next = this._clamp(base + dir * b.step, b);
    if (next === base) { this._stopRepeat(); return; } /* bound reached: a disabled button may never get pointerup */
    this._pending = next;
    this._refresh();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this._pendingUntil = Date.now() + 5000;
      this._hass.callService("climate", "set_temperature", { entity_id: id, temperature: next });
    }, 600);
  }
  _startRepeat(dir) {
    this._stopRepeat();
    this._step(dir);
    this._rep = setTimeout(() => { this._rep = setInterval(() => this._step(dir), 150); }, 400);
  }
  _stopRepeat() { clearTimeout(this._rep); clearInterval(this._rep); this._rep = null; }

  /* ---------- update cycle ---------- */
  _watched() {
    const c = this._config;
    const ids = [c.entity, c.fallback_entity, c.temperature_entity, c.humidity_entity, c.battery_entity];
    (Array.isArray(c.valves) ? c.valves : []).forEach((v) => v && ids.push(v.entity));
    return ids.filter(Boolean);
  }
  _update() {
    if (!this._config || !this._hass) return;
    this._lang = vcLang(this._hass);
    if (!this._built) { this._build(); this._built = true; this._sig = null; }
    const s = this._st(this._activeId());
    if (this._pending !== null && !this._timer && s &&
        (vcNum(s.attributes.temperature) === this._pending || Date.now() > (this._pendingUntil || 0))) {
      this._pending = null;
      this._sig = null; /* force a redraw with the real setpoint */
    }
    const states = this._watched().map((id) => this._hass.states[id]);
    const sig = this._sig;
    const same = sig && sig.lang === this._lang && sig.states.length === states.length &&
      sig.states.every((x, i) => x === states[i]);
    if (!same) { this._sig = { lang: this._lang, states }; this._refresh(); }
    this._maybeFetchHistory();
  }

  _build() {
    const root = this.shadowRoot, c = this._config;
    root.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="hdr" id="hdr" role="button" tabindex="0">
          <span class="hicon"><ha-icon id="icon"></ha-icon></span>
          <span class="name" id="name"></span>
          <span class="bat" id="bat" hidden></span>
        </div>
        <div class="panel">
          <div class="top">
            <div class="gauge" id="gauge" role="slider" tabindex="0" ${c.show_gauge === false ? "hidden" : ""}>
              <svg viewBox="0 0 120 120" id="gsvg" aria-hidden="true"></svg>
              <div class="gc"><div class="gt" id="gt"></div><div class="gs" id="gs"></div></div>
              <span class="gmin" id="gmin"></span><span class="gmax" id="gmax"></span>
            </div>
            <div class="info">
              <span class="chip state" id="state"></span>
              <div class="dem" id="dem" hidden>
                <div class="dl"><span>${vcEsc(this._t("opening"))}</span><b id="dval"></b></div>
                <div class="bar"><i id="dbar"></i></div>
              </div>
              <div class="ok" id="reached" hidden><ha-icon icon="mdi:check-circle-outline"></ha-icon><span>${vcEsc(this._t("reached"))}</span></div>
              <div class="chips" id="chips"></div>
            </div>
          </div>
          <div class="valves" id="valves"></div>
          <div class="modes" id="modes" hidden></div>
          <div class="set">
            <button class="stepbtn" id="minus" aria-label="${vcEsc(this._t("dec"))}"><ha-icon icon="mdi:minus"></ha-icon></button>
            <div class="sv"><div class="svv" id="sv"></div><div class="svl" id="svl"></div></div>
            <button class="stepbtn" id="plus" aria-label="${vcEsc(this._t("inc"))}"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          <div class="presets" id="presets" hidden></div>
        </div>
        <div class="hist" id="hist" ${c.show_history === false ? "hidden" : ""}></div>
      </ha-card>`;
    const $ = (id) => root.getElementById(id);
    const more = () => this._moreInfo(this._activeId());
    const key = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); more(); } };
    $("hdr").addEventListener("click", more);
    $("hdr").addEventListener("keydown", key);
    $("gauge").addEventListener("click", more);
    $("gauge").addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); this._step(1); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); this._step(-1); }
      else key(e);
    });
    [["minus", -1], ["plus", 1]].forEach(([id, dir]) => {
      const b = $(id);
      b.addEventListener("pointerdown", (e) => { if (e.button === 0) { e.preventDefault(); this._startRepeat(dir); } });
      ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => this._stopRepeat()));
      /* Keyboard activation only (detail 0); pointer presses are handled above. */
      b.addEventListener("click", (e) => { if (e.detail === 0) this._step(dir); });
    });
    $("presets").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-p]");
      if (b && !b.disabled) this._call("set_preset_mode", { preset_mode: b.dataset.p });
    });
    $("modes").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-m]");
      if (b && !b.disabled) this._call("set_hvac_mode", { hvac_mode: b.dataset.m });
    });
    $("valves").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-e]");
      if (b) this._moreInfo(b.dataset.e);
    });
    this._presetSig = null;
    this._modeSig = null;
  }

  _presetList(s) {
    const modes = s && s.attributes.preset_modes;
    if (!vcOk(s) || !Array.isArray(modes) || !modes.length) return [];
    const cfg = this._config.presets;
    const list = Array.isArray(cfg) && cfg.length
      ? cfg.filter((p) => p && p.preset && modes.includes(p.preset))
      : modes.map((m) => ({ preset: m }));
    return list.map((p) => {
      const d = VC_PRESETS[p.preset] || {};
      return {
        preset: p.preset,
        name: p.name || vcLabel(this._lang, "p_", p.preset),
        icon: p.icon || d.icon || "mdi:tune-variant",
        color: p.color || d.color || "var(--primary-color)",
      };
    });
  }

  _modeList(s) {
    const opt = this._config.hvac_modes;
    const modes = s && s.attributes.hvac_modes;
    if (!opt || !vcOk(s) || !Array.isArray(modes)) return [];
    const list = Array.isArray(opt) ? modes.filter((m) => opt.includes(m)) : modes;
    return list.length > 1 ? list : [];
  }

  _refresh() {
    const root = this.shadowRoot, c = this._config, $ = (id) => root.getElementById(id);
    if (!$("gauge")) { this._built = false; return; }
    const id = this._activeId(), s = this._st(id), ok = vcOk(s);
    const a = (s && s.attributes) || {};
    const unit = this._unit(s), isF = /F/i.test(unit);
    const b = this._bounds(s, isF);
    const tSensor = this._st(c.temperature_entity);
    let temp = vcOk(tSensor) ? vcNum(tSensor.state) : null;
    if (temp === null && ok) temp = vcNum(a.current_temperature);
    const target = this._pending !== null ? this._pending : (ok ? vcNum(a.temperature) : null);
    const isOff = ok && s.state === "off";
    const power = ok ? vcNum(a[c.power_attribute]) : null;
    const heating = ok && !isOff && (a.hvac_action === "heating" || (power !== null && power > 0));
    const col = ok ? this._color(temp, isF) : this._color(null, isF);

    /* Header */
    $("icon").setAttribute("icon", c.icon || "mdi:radiator");
    $("name").textContent = c.name || a.friendly_name || id;
    this._renderBattery($("bat"));

    /* Gauge */
    const g = $("gauge");
    g.style.setProperty("--gc", col);
    g.classList.toggle("unavail", !ok);
    g.setAttribute("aria-label", c.name || a.friendly_name || id);
    g.setAttribute("aria-valuemin", String(b.min));
    g.setAttribute("aria-valuemax", String(b.max));
    if (target !== null) g.setAttribute("aria-valuenow", String(target));
    $("gsvg").innerHTML = this._gaugeSvg(temp, target, power, b, col);
    $("gt").innerHTML = temp !== null ? `${vcEsc(this._fmt(temp))}<sup>°</sup>` : "—";
    $("gs").textContent = target !== null ? this._t("target", { t: this._fmt(target) + "°" }) : "";
    $("gmin").textContent = this._fmt(b.min, 0) + "°";
    $("gmax").textContent = this._fmt(b.max, 0) + "°";

    /* State chip */
    const st = $("state");
    const [cls, icon, lbl] = !ok ? ["unavail", "mdi:lan-disconnect", "unavailable"]
      : isOff ? ["off", "mdi:power", "off"]
      : heating ? ["heat", "mdi:fire", "heating"] : ["idle", "mdi:weather-night", "idle"];
    st.className = "chip state " + cls;
    st.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span>${vcEsc(this._t(lbl))}</span>`;

    /* Opening / demand */
    $("dem").hidden = power === null;
    if (power !== null) {
      const p = Math.max(0, Math.min(100, power));
      $("dval").textContent = this._fmt(p, 0) + " %";
      $("dbar").style.width = p + "%";
    }
    $("reached").hidden = !(ok && !isOff && temp !== null && target !== null && temp >= target);

    /* Chips: preset, schedule, humidity */
    const chips = [];
    if (ok && a.preset_mode && a.preset_mode !== "none") {
      const d = VC_PRESETS[a.preset_mode] || {};
      const cp = (Array.isArray(c.presets) ? c.presets : []).find((p) => p && p.preset === a.preset_mode) || {};
      chips.push([cp.icon || d.icon || "mdi:tune-variant", cp.name || vcLabel(this._lang, "p_", a.preset_mode)]);
    }
    const sched = ok ? a[c.schedule_attribute] : null;
    if (typeof sched === "string" && sched.trim()) chips.push(["mdi:timetable", sched]);
    const hs = this._st(c.humidity_entity);
    const hum = vcOk(hs) ? vcNum(hs.state) : (ok ? vcNum(a.current_humidity) : null);
    if (hum !== null) chips.push(["mdi:water-percent", this._fmt(hum, 0) + " %"]);
    $("chips").innerHTML = chips.map(([i, t]) =>
      `<span class="chip"><ha-icon icon="${vcEsc(i)}"></ha-icon><span>${vcEsc(t)}</span></span>`).join("");

    /* Other valves of the room */
    $("valves").innerHTML = this._valvesHtml();

    /* Mode selector */
    const modes = this._modeList(s), mEl = $("modes");
    mEl.hidden = !modes.length;
    const mSig = modes.join("|");
    if (mSig !== this._modeSig) {
      this._modeSig = mSig;
      mEl.innerHTML = modes.map((m) =>
        `<button class="pbtn" data-m="${vcEsc(m)}" style="--c:var(--primary-color)"><ha-icon icon="${VC_MODE_ICONS[m] || "mdi:thermostat"}"></ha-icon><span>${vcEsc(vcLabel(this._lang, "m_", m))}</span></button>`).join("");
    }
    mEl.querySelectorAll("button").forEach((btn) => {
      const on = s && s.state === btn.dataset.m;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });

    /* Setpoint */
    const canSet = ok && !isOff && target !== null;
    $("sv").textContent = target !== null ? this._fmt(target) + unit.replace(/^°?/, "°") : "—";
    $("svl").textContent = this._t(ok && s.state === "heat" ? "setpoint_manual" : "setpoint");
    $("minus").disabled = !canSet || target <= b.min;
    $("plus").disabled = !canSet || target >= b.max;

    /* Presets (rebuilt only when the list changes, so focus is kept) */
    const presets = c.show_presets === false ? [] : this._presetList(s), pEl = $("presets");
    pEl.hidden = !presets.length;
    const pSig = JSON.stringify(presets);
    if (pSig !== this._presetSig) {
      this._presetSig = pSig;
      pEl.style.setProperty("--n", String(Math.min(presets.length, 4) || 1));
      pEl.innerHTML = presets.map((p) =>
        `<button class="pbtn" data-p="${vcEsc(p.preset)}" style="--c:${vcEsc(p.color)}"><ha-icon icon="${vcEsc(p.icon)}"></ha-icon><span>${vcEsc(p.name)}</span></button>`).join("");
    }
    pEl.querySelectorAll("button").forEach((btn) => {
      const on = ok && a.preset_mode === btn.dataset.p;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", String(on));
    });

    /* History */
    if (c.show_history !== false) $("hist").innerHTML = this._histHtml(temp, target, unit);
  }

  _renderBattery(el) {
    const c = this._config, s = this._st(c.battery_entity);
    el.hidden = !vcOk(s);
    if (el.hidden) return;
    const lvl = vcNum(s.state);
    const low = lvl !== null ? lvl < (vcNum(c.battery_threshold) ?? 20) : s.state === "on";
    const icon = lvl !== null
      ? (lvl >= 95 ? "mdi:battery" : lvl < 10 ? "mdi:battery-outline" : `mdi:battery-${Math.floor(lvl / 10) * 10}`)
      : (low ? "mdi:battery-alert" : "mdi:battery");
    el.className = "bat" + (low ? " low" : "");
    el.title = low ? this._t("battery_low") : "";
    el.innerHTML = `<ha-icon icon="${icon}"></ha-icon>${lvl !== null ? `<span>${vcEsc(this._fmt(lvl, 0))} %</span>` : ""}`;
  }

  _valvesHtml() {
    const c = this._config;
    const list = (Array.isArray(c.valves) ? c.valves : []).filter((v) => v && v.entity);
    return list.map((v) => {
      const s = this._st(v.entity), ok = vcOk(s), a = (s && s.attributes) || {};
      const t = ok ? vcNum(a.current_temperature) : null, sp = ok ? vcNum(a.temperature) : null;
      const p = ok ? vcNum(a[c.power_attribute]) : null;
      const name = v.name || a.friendly_name || v.entity;
      const temps = !ok ? this._t("unavailable")
        : `${t !== null ? this._fmt(t) + "°" : "—"}${sp !== null ? " → " + this._fmt(sp) + "°" : ""}`;
      const bar = p !== null
        ? `<span class="vp"><i style="width:${Math.max(0, Math.min(100, p))}%"></i></span><span class="vpv">${vcEsc(this._fmt(p, 0))} %</span>`
        : "";
      return `<button class="vrow${ok ? "" : " unavail"}" data-e="${vcEsc(v.entity)}"><ha-icon icon="mdi:radiator"></ha-icon><span class="vn">${vcEsc(name)}</span><span class="vt">${vcEsc(temps)}</span>${bar}</button>`;
    }).join("");
  }

  /* 270° arc gauge, opening from the bottom. Angles in degrees, SVG orientation. */
  _gaugeSvg(temp, target, power, b, col) {
    const cx = 60, cy = 60, START = 135, SWEEP = 270;
    const pt = (r, deg) => {
      const rad = deg * Math.PI / 180;
      return [(cx + r * Math.cos(rad)).toFixed(2), (cy + r * Math.sin(rad)).toFixed(2)];
    };
    const arc = (r, frac) => {
      const f = Math.max(0, Math.min(1, frac));
      if (f <= 0) return "";
      const [x0, y0] = pt(r, START), [x1, y1] = pt(r, START + SWEEP * f);
      return `M ${x0} ${y0} A ${r} ${r} 0 ${SWEEP * f > 180 ? 1 : 0} 1 ${x1} ${y1}`;
    };
    const frac = (v) => (v - b.min) / (b.max - b.min);
    let svg = `<path class="track" d="${arc(48, 1)}"/>`;
    if (temp !== null) svg += `<path class="prog" d="${arc(48, frac(temp))}" stroke="${vcEsc(col)}"/>`;
    if (power !== null) {
      svg += `<path class="track thin" d="${arc(39, 1)}"/>`;
      if (power > 0) svg += `<path class="open" d="${arc(39, power / 100)}"/>`;
    }
    if (target !== null) {
      const [x, y] = pt(48, START + SWEEP * Math.max(0, Math.min(1, frac(target))));
      svg += `<circle class="mark" cx="${x}" cy="${y}" r="5"/><circle class="markdot" cx="${x}" cy="${y}" r="2"/>`;
    }
    return svg;
  }

  /* ---------- history (temperature + setpoint) ---------- */
  _maybeFetchHistory() {
    const c = this._config;
    if (c.show_history === false || this._histBusy || typeof this._hass.callWS !== "function") return;
    const key = [this._activeId(), c.temperature_entity || "", c.history_hours].join("|");
    if (key === this._histKey && Date.now() - this._histAt < 300000) return;
    this._histKey = key;
    this._histAt = Date.now();
    this._fetchHistory(key);
  }

  async _fetchHistory(key) {
    const c = this._config, id = this._activeId(), src = c.temperature_entity;
    const hours = vcNum(c.history_hours) || 24;
    const start = Date.now() - hours * 3600000;
    this._histBusy = true;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        entity_ids: src ? [id, src] : [id],
        minimal_response: false,
        no_attributes: false,
        significant_changes_only: false,
      });
      const series = (rows, get) => (Array.isArray(rows) ? rows : [])
        .map((e) => ({ t: Math.max(start, ((e.lu || e.lc || 0) * 1000)), v: vcNum(get(e)) }))
        .filter((p) => p.v !== null);
      const temp = src ? series(res && res[src], (e) => e.s)
        : series(res && res[id], (e) => e.a && e.a.current_temperature);
      const sp = series(res && res[id], (e) => e.a && e.a.temperature);
      if (key === this._histKey) { this._hist = { start, temp, sp }; this._sig = null; this._update(); }
    } catch (err) {
      console.warn("[" + VC_TAG + "] history unavailable:", err);
      this._hist = null;
    } finally {
      this._histBusy = false;
    }
  }

  _histHtml(temp, target, unit) {
    const hours = vcNum(this._config.history_hours) || 24;
    const head = `<div class="hh">${vcEsc(this._t("history", { h: this._fmt(hours, 0) }))}</div>
      <div class="hv">${temp !== null ? vcEsc(this._fmt(temp)) : "—"}<small>${vcEsc(unit)}</small></div>
      <div class="lg"><span class="lt">${vcEsc(this._t("temperature"))}</span><span class="ls">${vcEsc(this._t("setpoint_l"))}</span></div>`;
    const h = this._hist;
    const now = Date.now();
    const T = h ? h.temp.concat(temp !== null ? [{ t: now, v: temp }] : []) : [];
    const S = h ? h.sp.concat(target !== null ? [{ t: now, v: target }] : []) : [];
    if (T.length < 2) return head + (h ? `<div class="nohist">${vcEsc(this._t("no_history"))}</div>` : "");
    const W = 300, H = 90, P = 6, t0 = h.start, span = Math.max(1, now - t0);
    const vals = T.concat(S).map((p) => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    const x = (t) => ((Math.max(t0, t) - t0) / span * W).toFixed(1);
    const y = (v) => (H - P - (v - lo) / (hi - lo) * (H - 2 * P)).toFixed(1);
    const line = T.map((p, i) => `${i ? "L" : "M"} ${x(p.t)} ${y(p.v)}`).join(" ");
    const area = `${line} L ${x(T[T.length - 1].t)} ${H} L ${x(T[0].t)} ${H} Z`;
    const step = S.length ? `M ${x(S[0].t)} ${y(S[0].v)} ` + S.slice(1).map((p) => `H ${x(p.t)} V ${y(p.v)}`).join(" ") + ` H ${W}` : "";
    return head + `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="vcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b" stop-opacity=".45"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#vcg)" stroke="none"/>
        <path d="${line}" class="lt"/>
        ${step ? `<path d="${step}" class="ls"/>` : ""}
      </svg>
      <span class="ymax">${vcEsc(this._fmt(hi))}</span><span class="ymin">${vcEsc(this._fmt(lo))}</span>
    </div>`;
  }

  _css() {
    return `
      :host { --vc-surface: rgba(127,127,127,0.10); --vc-border: rgba(127,127,127,0.22); --vc-heat: #f97316; }
      ha-card { padding: 12px; border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; color: var(--primary-text-color); }
      button { font: inherit; color: inherit; }
      button:focus-visible, .gauge:focus-visible, .hdr:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      [hidden] { display: none !important; }

      .hdr { display: flex; align-items: center; gap: 10px; padding: 4px 6px 10px; cursor: pointer; border-radius: 10px; }
      .hicon { width: 34px; height: 34px; border-radius: 50%; background: var(--vc-surface); display: flex; align-items: center; justify-content: center; }
      .hicon ha-icon { --mdc-icon-size: 20px; }
      .name { flex: 1; font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bat { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; color: var(--secondary-text-color); }
      .bat ha-icon { --mdc-icon-size: 18px; }
      .bat.low { color: var(--error-color, #ef4444); }

      .panel { background: var(--vc-surface); border: 1px solid var(--vc-border); border-radius: 14px; padding: 12px; }
      .top { display: flex; gap: 14px; align-items: center; }
      .gauge { position: relative; flex: 0 0 132px; width: 132px; height: 132px; cursor: pointer; border-radius: 50%; }
      .gauge svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--gc) 35%, transparent)); }
      .gauge path { fill: none; stroke-linecap: round; }
      .gauge .track { stroke: var(--vc-border); stroke-width: 8; }
      .gauge .track.thin { stroke-width: 3; }
      .gauge .prog { stroke-width: 8; transition: stroke .4s; }
      .gauge .open { stroke: var(--vc-heat); stroke-width: 3; opacity: .85; }
      .gauge .mark { fill: var(--card-background-color, #1c1c1c); stroke: var(--primary-text-color); stroke-width: 2; }
      .gauge .markdot { fill: var(--primary-text-color); }
      .gauge.unavail svg { filter: none; opacity: .5; }
      .gc { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
      .gt { font-size: 28px; font-weight: 700; line-height: 1; }
      .gt sup { font-size: 13px; font-weight: 500; }
      .gs { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
      .gmin, .gmax { position: absolute; bottom: 4px; font-size: 9px; color: var(--secondary-text-color); }
      .gmin { left: 18px; } .gmax { right: 18px; }

      .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
      .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 9px; border-radius: 999px; background: var(--vc-surface); border: 1px solid var(--vc-border); color: var(--secondary-text-color); max-width: 100%; }
      .chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chip ha-icon { --mdc-icon-size: 14px; }
      .chip.state { font-size: 12px; font-weight: 600; color: var(--primary-text-color); }
      .chip.heat { color: var(--vc-heat); border-color: color-mix(in srgb, var(--vc-heat) 45%, transparent); }
      .chip.heat ha-icon { animation: vcflame 1.4s ease-in-out infinite; transform-origin: 50% 90%; }
      .chip.unavail, .chip.off { color: var(--secondary-text-color); font-weight: 500; }
      @keyframes vcflame { 0%,100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.15) rotate(-5deg); } }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .dem { width: 100%; }
      .dl { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-bottom: 4px; }
      .dl b { color: var(--primary-text-color); font-weight: 600; }
      .bar { height: 6px; border-radius: 3px; background: var(--vc-border); overflow: hidden; }
      .bar i { display: block; height: 100%; width: 0; background: var(--vc-heat); border-radius: 3px; transition: width .4s; }
      .ok { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success-color, #22c55e); }
      .ok ha-icon { --mdc-icon-size: 16px; }
      .ok span { color: var(--primary-text-color); }

      .valves { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
      .valves:empty { display: none; }
      .vrow { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border-radius: 8px; background: none; border: 1px solid var(--vc-border); cursor: pointer; font-size: 12px; text-align: left; }
      .vrow ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
      .vrow.unavail { opacity: .55; }
      .vn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vt { color: var(--secondary-text-color); white-space: nowrap; }
      .vp { flex: 0 0 48px; height: 4px; border-radius: 2px; background: var(--vc-border); overflow: hidden; }
      .vp i { display: block; height: 100%; background: var(--vc-heat); }
      .vpv { flex: 0 0 34px; text-align: right; color: var(--secondary-text-color); }

      .set { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
      .stepbtn { flex: 0 0 56px; height: 40px; border-radius: 10px; background: var(--vc-surface); border: 1px solid var(--vc-border); cursor: pointer; display: flex; align-items: center; justify-content: center; touch-action: manipulation; user-select: none; }
      .stepbtn:hover:not(:disabled) { border-color: var(--primary-text-color); }
      .stepbtn:disabled { opacity: .35; cursor: default; }
      .sv { flex: 1; text-align: center; }
      .svv { font-size: 20px; font-weight: 700; }
      .svl { font-size: 11px; color: var(--secondary-text-color); }

      .presets, .modes { display: grid; grid-template-columns: repeat(var(--n, 3), 1fr); gap: 8px; margin-top: 12px; }
      .modes { grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); }
      .pbtn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 6px; border-radius: 10px; background: var(--vc-surface); border: 1px solid var(--vc-border); cursor: pointer; font-size: 12px; font-weight: 600; min-width: 0; }
      .pbtn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pbtn ha-icon { --mdc-icon-size: 16px; flex: none; }
      .pbtn.active { color: var(--c); border-color: color-mix(in srgb, var(--c) 60%, transparent); background: color-mix(in srgb, var(--c) 16%, transparent); }
      .pbtn:disabled { opacity: .35; cursor: default; }

      .hist { margin-top: 12px; padding: 6px 2px 0; }
      .hh { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); }
      .hv { font-size: 28px; font-weight: 300; margin: 4px 0; }
      .hv small { font-size: 14px; margin-left: 2px; color: var(--secondary-text-color); }
      .lg { display: flex; justify-content: center; gap: 18px; font-size: 12px; color: var(--secondary-text-color); margin-bottom: 6px; }
      .lg span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
      .lg .lt::before { background: #f59e0b; } .lg .ls::before { background: #9ca3af; }
      .chart { position: relative; height: 90px; }
      .chart svg { width: 100%; height: 100%; display: block; }
      .chart path.lt { fill: none; stroke: #f59e0b; stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
      .chart path.ls { fill: none; stroke: #9ca3af; stroke-width: 2; vector-effect: non-scaling-stroke; }
      .ymax, .ymin { position: absolute; left: 2px; font-size: 10px; padding: 1px 5px; border-radius: 6px; background: var(--card-background-color, #1c1c1c); color: var(--secondary-text-color); }
      .ymax { top: 0; } .ymin { bottom: 0; }
      .nohist { font-size: 12px; color: var(--secondary-text-color); text-align: center; padding: 12px 0; }

      @media (prefers-reduced-motion: reduce) {
        .chip.heat ha-icon { animation: none; }
        .gauge .prog, .bar i { transition: none; }
      }
    `;
  }
}

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const VC_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const VC_SEC_CSS = `
  .sec { margin-bottom:18px; }
  .sec-tools { display:flex; justify-content:flex-end; gap:4px; margin-bottom:6px; }
  .sec-tools button { background:none; border:none; cursor:pointer; padding:2px 6px;
    border-radius:4px; font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-tools button:hover { color:var(--primary-text-color); }
  .sec-head { width:100%; display:flex; align-items:center; gap:8px; margin:0 0 10px 0;
    padding:0 0 6px 0; background:none; border:none; border-bottom:1px solid var(--divider-color);
    cursor:pointer; font:inherit; text-align:left; color:var(--primary-text-color); }
  .sec-head[aria-expanded="false"] { margin-bottom:0; }
  .sec-head:focus-visible, .sec-tools button:focus-visible, .row-rm:focus-visible, .row-add:focus-visible {
    outline:2px solid var(--primary-color); outline-offset:2px; border-radius:4px; }
  .sec-head .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; }
  .sec-head[aria-expanded="false"] .chev { transform:rotate(-90deg); }
  .sec-title { font-size:15px; font-weight:600; flex:1; }
  .sec-hint { font-size:12px; color:var(--secondary-text-color); margin:-4px 0 10px 0; line-height:1.4; }
  .sec-body[hidden] { display:none; }
  ha-form { display:block; }
  .row { display:flex; gap:6px; align-items:flex-start; padding:8px 0; border-bottom:1px dashed var(--divider-color); }
  .row ha-form { flex:1; min-width:0; }
  .row-rm, .row-add { background:none; border:1px solid var(--divider-color); border-radius:6px; cursor:pointer;
    color:var(--secondary-text-color); font:inherit; font-size:12px; padding:4px 8px; display:inline-flex; align-items:center; gap:4px; }
  .row-rm { border:none; margin-top:8px; }
  .row-rm:hover, .row-add:hover { color:var(--primary-text-color); }
  .row-add { margin-top:8px; }
  @media (prefers-reduced-motion: reduce) { .sec-head .chev { transition:none; } }
`;
const vcSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + vcEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function vcSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    VC_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, VC_SEC_STATE.has(k) ? VC_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const VC_SCHEMAS = {
  gen: [
    { name: "name", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ],
  ent: [
    { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
    { name: "fallback_entity", selector: { entity: { domain: "climate" } } },
    { name: "temperature_entity", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
    { name: "humidity_entity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
    { name: "battery_entity", selector: { entity: { domain: "sensor", device_class: "battery" } } },
  ],
  disp: [
    { name: "show_gauge", selector: { boolean: {} } },
    { name: "show_presets", selector: { boolean: {} } },
    { name: "show_history", selector: { boolean: {} } },
    { name: "history_hours", selector: { number: { min: 1, max: 168, mode: "box" } } },
    { name: "hvac_modes", selector: { boolean: {} } },
    { type: "grid", schema: [
      { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
      { name: "min", selector: { number: { step: 0.5, mode: "box" } } },
      { name: "max", selector: { number: { step: 0.5, mode: "box" } } },
    ] },
  ],
  adv: [
    { type: "grid", schema: [
      { name: "power_attribute", selector: { text: {} } },
      { name: "schedule_attribute", selector: { text: {} } },
    ] },
    { name: "battery_threshold", selector: { number: { min: 0, max: 100, mode: "box", unit_of_measurement: "%" } } },
    { name: "color_scale", selector: { object: {} } },
  ],
  valve: [
    { type: "grid", schema: [
      { name: "entity", selector: { entity: { domain: "climate" } } },
      { name: "name", selector: { text: {} } },
    ] },
  ],
};
/* Preset row: the preset value is a dropdown of the entity's preset_modes (custom values allowed). */
const vcPresetSchema = (modes) => [
  { type: "grid", schema: [
    { name: "preset", selector: { select: { options: modes, custom_value: true, mode: "dropdown" } } },
    { name: "name", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
    { name: "color", selector: { text: {} } },
  ] },
];
/* Drop empty fields so the YAML stays minimal. */
const vcClean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

class ValveControlCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...config }; this._render(); }
  set hass(hass) {
    this._hass = hass;
    if (!this._forms) this._render();
    else this._allForms().forEach((f) => { f.hass = hass; });
  }
  _allForms() {
    return this._forms.concat(Array.from(this.shadowRoot.querySelectorAll(".row ha-form")));
  }
  _commit(cfg) {
    this._config = cfg;
    this._forms.forEach((f) => { f.data = this._config; });
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }

  /* Built once hass is known (UI language); afterwards only data is pushed, so focus is kept. */
  _render() {
    if (!this._config || !this._hass) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const L = vcLang(this._hass), t = (k) => vcEsc(vcT(L, k));
    if (!this._forms) {
      this.shadowRoot.innerHTML = `<style>${VC_SEC_CSS}</style>
        <div class="sec-tools"><button type="button" class="sec-all" data-open="1">${t("expand_all")}</button><button type="button" class="sec-all" data-open="0">${t("collapse_all")}</button></div>
        ${vcSec("gen", vcT(L, "sec_gen"), `<ha-form data-schema="gen"></ha-form>`)}
        ${vcSec("ent", vcT(L, "sec_ent"), `<ha-form data-schema="ent"></ha-form>`)}
        ${vcSec("disp", vcT(L, "sec_disp"), `<ha-form data-schema="disp"></ha-form>`)}
        ${vcSec("presets", vcT(L, "sec_presets"), `<div class="sec-hint">${t("hint_presets")}</div><div class="list" data-list="presets"></div><button type="button" class="row-add" data-add="presets"><ha-icon icon="mdi:plus"></ha-icon>${t("add_preset")}</button>`)}
        ${vcSec("valves", vcT(L, "sec_valves"), `<div class="sec-hint">${t("hint_valves")}</div><div class="list" data-list="valves"></div><button type="button" class="row-add" data-add="valves"><ha-icon icon="mdi:plus"></ha-icon>${t("add_valve")}</button>`)}
        ${vcSec("adv", vcT(L, "sec_adv"), `<div class="sec-hint">${t("hint_adv")}</div><ha-form data-schema="adv"></ha-form>`)}`;
      vcSecWire(this.shadowRoot, this.tagName.toLowerCase());
      this._forms = Array.from(this.shadowRoot.querySelectorAll("ha-form[data-schema]"));
      this._forms.forEach((f) => {
        f.schema = VC_SCHEMAS[f.dataset.schema];
        f.computeLabel = (s) => vcT(L, "l_" + s.name);
        f.addEventListener("value-changed", (e) => this._commit({ ...e.detail.value }));
      });
      this.shadowRoot.querySelectorAll(".row-add").forEach((b) => b.addEventListener("click", () => {
        const key = b.dataset.add;
        this._commit({ ...this._config, [key]: (Array.isArray(this._config[key]) ? this._config[key] : []).concat([{}]) });
        this._renderList(key, true);
      }));
    }
    this._forms.forEach((f) => { f.hass = this._hass; f.data = this._config; });
    this._renderList("presets");
    this._renderList("valves");
  }

  /* Rows are only re-created when their count changes; otherwise data is pushed in place. */
  _renderList(key, force) {
    const box = this.shadowRoot.querySelector(`.list[data-list="${key}"]`);
    const list = Array.isArray(this._config[key]) ? this._config[key] : [];
    const rows = box.querySelectorAll(".row ha-form");
    if (!force && rows.length === list.length) {
      rows.forEach((f, i) => { f.hass = this._hass; f.data = list[i] || {}; });
      return;
    }
    const L = vcLang(this._hass);
    const st = this._hass.states[this._config.entity];
    const modes = (st && Array.isArray(st.attributes.preset_modes) ? st.attributes.preset_modes : [])
      .map((m) => ({ value: m, label: vcLabel(L, "p_", m) }));
    box.innerHTML = "";
    list.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "row";
      const f = document.createElement("ha-form");
      f.hass = this._hass;
      f.schema = key === "presets" ? vcPresetSchema(modes) : VC_SCHEMAS.valve;
      f.data = item || {};
      f.computeLabel = (s) => vcT(L, "r_" + s.name);
      f.addEventListener("value-changed", (e) => {
        const next = (Array.isArray(this._config[key]) ? this._config[key] : []).slice();
        next[i] = vcClean(e.detail.value);
        this._commit({ ...this._config, [key]: next });
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "row-rm";
      rm.setAttribute("aria-label", vcT(L, "remove"));
      rm.title = vcT(L, "remove");
      rm.innerHTML = '<ha-icon icon="mdi:delete-outline"></ha-icon>';
      rm.addEventListener("click", () => {
        const next = (Array.isArray(this._config[key]) ? this._config[key] : []).filter((_, j) => j !== i);
        const cfg = { ...this._config, [key]: next };
        if (!next.length) delete cfg[key]; /* empty presets list = automatic presets */
        this._commit(cfg);
        this._renderList(key, true);
      });
      row.append(f, rm);
      box.appendChild(row);
    });
  }
}

customElements.define(VC_TAG, ValveControlCard);
customElements.define(VC_TAG + "-editor", ValveControlCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: VC_TAG,
  name: "Thermostatic Valve Card",
  description: "Thermostatic radiator valve: gauge, opening, setpoint, presets, room valves and 24 h history.",
  preview: true,
});

console.info(
  `%c VALVE-CONTROL-CARD %c v${VC_VERSION} `,
  "color:#fff;background:#f97316;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
  "color:#f97316;background:#1c1c1c;border-radius:0 4px 4px 0;padding:2px 4px"
);
