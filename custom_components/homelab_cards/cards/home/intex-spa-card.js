/**
 * Intex Spa Card — vanilla JS custom Lovelace card
 * Integration: mathieu-mp/homeassistant-intex-spa (platform "intex_spa")
 *
 * No dependency. Visual editor included.
 *
 *  - Heating button (climate.set_hvac_mode heat/off)
 *  - Stackable animations: rising bubbles (bubbles ON) + steam (heating active)
 *  - Optional buttons: empty entity "" => button removed, grid adapts
 *  - Entities left unset are auto-detected (platform + translation_key /
 *    integration icon, never display names) when a spa device is chosen or
 *    when nothing is configured.
 */

const CARD_VERSION = "2.1.0";

/* Non-entity settings only. Entities are NOT hard-coded here:
   a field emptied in the editor stays empty (hence hidden if optional). */
const DEFAULTS = {
  name: "Spa",
  hvac_heat: "heat",
  hvac_off: "off",
  temp_min: 20,
  temp_max: 40,
  step: 1,
  hold_power: true,
};

const IS_ENTITY_KEYS = ["climate", "current_temp", "target_temp", "filter", "bubbles",
  "jets", "sanitizer", "power", "error", "error_description"];

/* Icons set by the integration itself on its switches (language independent). */
const IS_SWITCH_ICONS = {
  power: "mdi:power-plug-outline", filter: "mdi:air-filter", jets: "mdi:weather-windy",
  bubbles: "mdi:chart-bubble", sanitizer: "mdi:recycle-variant",
};

const SWITCH_BUTTONS = [
  { key: "filter", icon: "mdi:filter", color: "29,158,117" },
  { key: "bubbles", icon: "mdi:chart-bubble", color: "53,138,221" },
  { key: "jets", icon: "mdi:weather-windy", color: "133,183,235" },
  { key: "sanitizer", icon: "mdi:recycle", color: "159,225,203" },
];

/* ---------- i18n ---------- */
const IS_I18N = {
  fr: {
    target: "Cible", setpoint: "Consigne", heating: "Chauffage", heating_to: "Chauffe vers {t}",
    offline: "Hors ligne", st_heat: "Chauffe", st_filter: "Filtration", st_bubbles: "Bulles",
    standby: "En veille", off: "Éteint", error: "Erreur {c}", power: "Power",
    pw_off_hold: "Éteindre (hold)", pw_on_hold: "Allumer (hold)", pw_off: "Éteindre", pw_on: "Allumer",
    sw_filter: "Filtre", sw_bubbles: "Bulles", sw_jets: "Jets", sw_sanitizer: "Sanitizer",
    sec_gen: "Général", sec_ctrl: "Commandes", sec_err: "Erreurs", sec_adv: "Avancé (modes climate)",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    hint_auto: "Choisis un spa : les entités non renseignées sont détectées automatiquement.",
    l_device_id: "Spa (détection auto)",
    l_name: "Nom affiché", l_climate: "Climate (consigne + chauffage)",
    l_current_temp: "Température actuelle", l_target_temp: "Température cible (fallback)",
    l_filter: "Filtre (vide = masqué)", l_bubbles: "Bulles (vide = masqué)",
    l_jets: "Jets (vide = masqué)", l_sanitizer: "Sanitizer (vide = masqué)",
    l_power: "Power (vide = masqué)",
    l_error: "Capteur erreur", l_error_description: "Description erreur",
    l_hvac_heat: "Mode chauffe", l_hvac_off: "Mode arrêt",
    l_hold_power: "Confirmation hold sur Power",
  },
  en: {
    target: "Target", setpoint: "Setpoint", heating: "Heating", heating_to: "Heating to {t}",
    offline: "Offline", st_heat: "Heating", st_filter: "Filtration", st_bubbles: "Bubbles",
    standby: "Standby", off: "Off", error: "Error {c}", power: "Power",
    pw_off_hold: "Turn off (hold)", pw_on_hold: "Turn on (hold)", pw_off: "Turn off", pw_on: "Turn on",
    sw_filter: "Filter", sw_bubbles: "Bubbles", sw_jets: "Jets", sw_sanitizer: "Sanitizer",
    sec_gen: "General", sec_ctrl: "Controls", sec_err: "Errors", sec_adv: "Advanced (climate modes)",
    expand_all: "Expand all", collapse_all: "Collapse all",
    hint_auto: "Pick a spa: entities left empty are detected automatically.",
    l_device_id: "Spa (auto-detection)",
    l_name: "Display name", l_climate: "Climate (setpoint + heating)",
    l_current_temp: "Current temperature", l_target_temp: "Target temperature (fallback)",
    l_filter: "Filter (empty = hidden)", l_bubbles: "Bubbles (empty = hidden)",
    l_jets: "Jets (empty = hidden)", l_sanitizer: "Sanitizer (empty = hidden)",
    l_power: "Power (empty = hidden)",
    l_error: "Error sensor", l_error_description: "Error description",
    l_hvac_heat: "Heat mode", l_hvac_off: "Off mode",
    l_hold_power: "Hold to confirm Power",
  },
};
const isLang = (h) => {
  const l = (h && ((h.locale && h.locale.language) || h.language)) || "en";
  return String(l).toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
};
function isT(lang, k, vars) {
  let s = IS_I18N[lang][k];
  if (s === undefined) s = IS_I18N.en[k] !== undefined ? IS_I18N.en[k] : k;
  return vars ? s.replace(/\{(\w+)\}/g, (_, v) => vars[v]) : s;
}
const isEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- intex_spa auto-detection ---------- */
function isDetect(hass, deviceId) {
  const out = {};
  if (!hass) return out;
  const ents = Object.values(hass.entities || {}).filter((e) => e.platform === "intex_spa" && e.device_id);
  const first = ents.find((e) => e.entity_id.indexOf("climate.") === 0) || ents[0];
  const dev = deviceId || (first && first.device_id);
  if (!dev) return out;
  ents.filter((e) => e.device_id === dev).forEach((e) => {
    const id = e.entity_id, domain = id.split(".")[0];
    const st = hass.states[id];
    const icon = st && st.attributes ? st.attributes.icon : undefined;
    if (domain === "climate") out.climate = out.climate || id;
    else if (domain === "sensor" && (e.translation_key === "error" || e.translation_key === "error_description")) {
      out[e.translation_key] = id;
    } else if (domain === "switch") {
      Object.keys(IS_SWITCH_ICONS).forEach((k) => {
        if (!out[k] && (icon === IS_SWITCH_ICONS[k] || id.slice(-(k.length + 1)) === "_" + k)) out[k] = id;
      });
    }
  });
  /* current/target temperature come from the climate entity (sensors are disabled by default). */
  const d = (hass.devices || {})[dev];
  if (d) out._name = d.name_by_user || d.name;
  return out;
}

class IntexSpaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._holdTimer = null;
    this._built = false;
  }

  setConfig(config) {
    this._user = config;
    this._config = { ...DEFAULTS, ...config };
    /* Explicit keys always win; detection only fills unset keys. */
    this._autoMode = !!config.device_id || !IS_ENTITY_KEYS.some((k) => config[k] !== undefined);
    this._entRef = undefined;
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._lang = isLang(hass);
    if (this._autoMode && hass.entities !== this._entRef) {
      this._entRef = hass.entities;
      const u = this._user, d = isDetect(hass, u.device_id), c = { ...DEFAULTS, ...u };
      IS_ENTITY_KEYS.forEach((k) => { if (u[k] === undefined && d[k]) c[k] = d[k]; });
      if (u.name === undefined && d._name) c.name = d._name;
      this._config = c;
      this._built = false;
    }
    if (!this._built) { this._build(); this._built = true; }
    this._refresh();
  }

  getCardSize() { return 5; }
  static getConfigElement() { return document.createElement("intex-spa-card-editor"); }
  /* Stub filled with the entities of the first detected spa (explicit ids), else bare. */
  static getStubConfig(hass) {
    const d = isDetect(hass), stub = { ...DEFAULTS };
    IS_ENTITY_KEYS.forEach((k) => { if (d[k]) stub[k] = d[k]; });
    if (d._name) stub.name = d._name;
    return stub;
  }

  _t(k, vars) { return isT(this._lang || "en", k, vars); }
  _st(id) { if (!id || !this._hass) return undefined; return this._hass.states[id]; }
  _isOn(id) { const s = this._st(id); return s && s.state === "on"; }
  _isAvail(id) { const s = this._st(id); return s && !["unavailable","unknown",""].includes(s.state) && s.state !== undefined; }
  _num(id) { const s = this._st(id); if (!s) return null; const v = parseFloat(s.state); return Number.isFinite(v) ? v : null; }
  /** An entity is "active" (shown) if the field is set and non-empty. */
  _enabled(key) {
    const id = this._config[key];
    return typeof id === "string" && id.trim() !== "";
  }
  /* Temperature unit: sensor unit, else HA unit system. */
  _unit() {
    const s = this._st(this._config.current_temp);
    const us = this._hass && this._hass.config && this._hass.config.unit_system;
    return (s && s.attributes && s.attributes.unit_of_measurement) || (us && us.temperature) || "°C";
  }

  _toggle(id) { if (!this._isAvail(id)) return; const d = id.split(".")[0]; this._hass.callService(d, "toggle", { entity_id: id }); }

  _setTemp(delta) {
    const c = this._config.climate; const cs = this._st(c);
    if (!cs || !this._isAvail(c)) return;
    const current = parseFloat(cs.attributes.temperature);
    if (!Number.isFinite(current)) return;
    let next = current + delta * this._tstep();
    next = Math.max(this._tmin(), Math.min(this._tmax(), next));
    this._hass.callService("climate", "set_temperature", { entity_id: c, temperature: next });
  }

  /* Bounds/step: from the climate entity when available, else config fallback. */
  _tmin() {
    const cs = this._st(this._config.climate);
    const v = cs && parseFloat(cs.attributes.min_temp);
    return Number.isFinite(v) ? v : this._config.temp_min;
  }
  _tmax() {
    const cs = this._st(this._config.climate);
    const v = cs && parseFloat(cs.attributes.max_temp);
    return Number.isFinite(v) ? v : this._config.temp_max;
  }
  _tstep() {
    const cs = this._st(this._config.climate);
    const v = cs && parseFloat(cs.attributes.target_temp_step);
    return Number.isFinite(v) ? v : this._config.step;
  }

  _toggleHeat() {
    const c = this._config.climate; if (!this._isAvail(c)) return;
    const cs = this._st(c);
    const isHeating = cs.state === this._config.hvac_heat;
    this._hass.callService("climate", "set_hvac_mode", {
      entity_id: c,
      hvac_mode: isHeating ? this._config.hvac_off : this._config.hvac_heat,
    });
  }

  _isHeatingNow() {
    const cs = this._st(this._config.climate);
    if (!cs) return false;
    if (cs.attributes.hvac_action) return cs.attributes.hvac_action === "heating";
    return cs.state === this._config.hvac_heat;
  }

  _powerPress(down) {
    const p = this._config.power;
    if (!this._isAvail(p) && !this._isOn(p)) {
      if (down) this._hass.callService("switch", "turn_on", { entity_id: p });
      return;
    }
    if (!this._config.hold_power) { if (down) this._toggle(p); return; }
    if (down) {
      this._holdTimer = setTimeout(() => {
        this._toggle(p); this._holdTimer = null;
        const btn = this.shadowRoot.getElementById("power-btn");
        if (btn) btn.classList.add("fired");
      }, 800);
    } else {
      if (this._holdTimer) { clearTimeout(this._holdTimer); this._holdTimer = null; }
      const btn = this.shadowRoot.getElementById("power-btn");
      if (btn) btn.classList.remove("fired");
    }
  }

  _build() {
    const root = this.shadowRoot;
    const cfg = this._config;
    const unit = isEsc(this._unit());

    const bubbleCount = 22;
    let bubblesHtml = "";
    for (let i = 0; i < bubbleCount; i++) {
      const left = (Math.random() * 96).toFixed(1);
      const size = (3 + Math.random() * 8).toFixed(1);
      const dur = (1.6 + Math.random() * 2.2).toFixed(2);
      const delay = (Math.random() * 2.5).toFixed(2);
      const alpha = (0.35 + Math.random() * 0.4).toFixed(2);
      bubblesHtml += `<span class="bubble" style="left:${left}%;width:${size}px;height:${size}px;--dur:${dur}s;--delay:${delay}s;--a:${alpha};"></span>`;
    }

    const steamHtml = [
      { l: 25, w: 40, d: 4.0, delay: 0 },
      { l: 50, w: 50, d: 5.0, delay: 1.2 },
      { l: 70, w: 44, d: 4.5, delay: 0.6 },
    ].map((s) => `<span class="steam" style="left:${s.l}%;width:${s.w}px;--dur:${s.d}s;--delay:${s.delay}s;"></span>`).join("");

    root.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        <div class="pool">
          <div class="waves" id="waves">
            <svg class="wave w1" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path d="M0,40 C100,10 150,70 250,40 C350,10 400,60 500,40 C600,10 700,70 800,40 L800,200 L0,200 Z"/>
            </svg>
            <svg class="wave w2" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path d="M0,50 C120,80 180,20 280,50 C380,80 400,30 520,50 C620,80 700,20 800,50 L800,200 L0,200 Z"/>
            </svg>
            <div class="bubble-layer" id="bubble-layer">${bubblesHtml}</div>
          </div>
          <div class="steam-layer" id="steam-layer">${steamHtml}</div>
          <div class="hdr">
            <span class="title"><ha-icon icon="mdi:hot-tub"></ha-icon> <span id="name"></span></span>
            <span class="chip" id="status-chip"></span>
          </div>
          <div class="err" id="err"></div>
          <div class="center">
            <div class="temp"><span id="cur">--</span><span class="unit">${unit}</span></div>
            <div class="target" id="target-line"><ha-icon icon="mdi:target"></ha-icon> ${isEsc(this._t("target"))} <span id="tgt">--</span>${unit}</div>
          </div>
        </div>

        <div class="setrow">
          <button class="stepbtn" id="minus"><ha-icon icon="mdi:minus"></ha-icon></button>
          <div class="setbox">
            <div class="setlbl">${isEsc(this._t("setpoint"))}</div>
            <div class="setval" id="setval">--${unit}</div>
          </div>
          <button class="stepbtn" id="plus"><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>

        <div class="grid" id="switches"></div>
        <div class="grid2" id="grid-power"></div>
      </ha-card>
    `;

    root.getElementById("name").textContent = cfg.name;
    root.getElementById("minus").addEventListener("click", () => this._setTemp(-1));
    root.getElementById("plus").addEventListener("click", () => this._setTemp(1));

    const grid = root.getElementById("switches");

    if (this._enabled("climate")) {
      const heat = document.createElement("button");
      heat.className = "ctrl heat"; heat.id = "btn-heat";
      heat.style.setProperty("--c", "186,117,23");
      heat.innerHTML = `<ha-icon icon="mdi:fire"></ha-icon><div class="clbl">${isEsc(this._t("heating"))}</div>`;
      heat.addEventListener("click", () => this._toggleHeat());
      grid.appendChild(heat);
    }

    SWITCH_BUTTONS.forEach((b) => {
      if (!this._enabled(b.key)) return; // empty entity => no button
      const el = document.createElement("button");
      el.className = "ctrl"; el.id = `sw-${b.key}`;
      el.style.setProperty("--c", b.color);
      el.innerHTML = `<ha-icon icon="${b.icon}"></ha-icon><div class="clbl">${isEsc(this._t("sw_" + b.key))}</div>`;
      el.addEventListener("click", () => this._toggle(cfg[b.key]));
      grid.appendChild(el);
    });

    const gp = root.getElementById("grid-power");
    if (this._enabled("power")) {
      const pbtn = document.createElement("button");
      pbtn.className = "ctrl power"; pbtn.id = "power-btn";
      pbtn.innerHTML = `<ha-icon icon="mdi:power"></ha-icon><div class="clbl" id="power-lbl">${isEsc(this._t("power"))}</div><div class="holdbar"></div>`;
      const dn = (e) => { e.preventDefault(); this._powerPress(true); };
      const up = () => this._powerPress(false);
      pbtn.addEventListener("pointerdown", dn);
      pbtn.addEventListener("pointerup", up);
      pbtn.addEventListener("pointerleave", up);
      pbtn.addEventListener("pointercancel", up);
      gp.appendChild(pbtn);
    }

    const n = grid.children.length;
    grid.style.gridTemplateColumns = `repeat(${Math.min(Math.max(n, 1), 4)}, 1fr)`;
  }

  _refresh() {
    const root = this.shadowRoot;
    // Solid guard: only refresh when the core DOM is fully present.
    const curEl = root.getElementById("cur");
    const tgtEl = root.getElementById("tgt");
    const setvalEl = root.getElementById("setval");
    const tlEl = root.getElementById("target-line");
    const wavesEl = root.getElementById("waves");
    if (!curEl || !tgtEl || !setvalEl || !tlEl || !wavesEl) {
      // DOM not ready (re-entrant render / cache): force a rebuild on next hass.
      this._built = false;
      return;
    }
    const cfg = this._config;
    const unit = this._unit();

    const cs = this._st(cfg.climate);
    let cur = this._num(cfg.current_temp);
    if (cur === null && cs) {
      const v = parseFloat(cs.attributes.current_temperature);
      if (Number.isFinite(v)) cur = v;
    }
    const tgt = cs && Number.isFinite(parseFloat(cs.attributes.temperature))
      ? parseFloat(cs.attributes.temperature) : this._num(cfg.target_temp);

    const online = this._isAvail(cfg.current_temp) || this._isAvail(cfg.climate);
    const heating = online && this._isHeatingNow();
    const bubbling = this._isOn(cfg.bubbles);

    curEl.textContent = cur !== null ? Math.round(cur) : "--";
    tgtEl.textContent = tgt !== null ? Math.round(tgt) : "--";
    setvalEl.textContent = tgt !== null ? `${Math.round(tgt)}${unit}` : `--${unit}`;

    const tl = tlEl;
    if (heating && tgt !== null) {
      tl.innerHTML = `<ha-icon icon="mdi:fire"></ha-icon> ${isEsc(this._t("heating_to", { t: Math.round(tgt) + unit }))}`;
      tl.classList.add("heating");
    } else {
      tl.innerHTML = `<ha-icon icon="mdi:target"></ha-icon> ${isEsc(this._t("target"))} <span>${tgt !== null ? Math.round(tgt) : "--"}</span>${isEsc(unit)}`;
      tl.classList.remove("heating");
    }

    const pool = wavesEl;
    if (cur !== null && online) {
      const tmin = this._tmin(), tmax = this._tmax();
      const pct = Math.max(0.15, Math.min(0.85, (cur - tmin) / (tmax - tmin)));
      pool.style.height = `${(pct * 100).toFixed(0)}%`;
      pool.classList.remove("offline");
    } else {
      pool.style.height = "45%";
      pool.classList.add("offline");
    }

    root.getElementById("bubble-layer").classList.toggle("bubbling", bubbling && online);
    root.getElementById("steam-layer").classList.toggle("steaming", heating);
    pool.classList.toggle("agitated", bubbling && online);

    const chip = root.getElementById("status-chip");
    if (!online) {
      chip.textContent = "● " + this._t("offline"); chip.className = "chip off";
    } else {
      const parts = [];
      if (heating) parts.push(this._t("st_heat"));
      if (this._isOn(cfg.filter)) parts.push(this._t("st_filter"));
      if (bubbling) parts.push(this._t("st_bubbles"));
      if (parts.length) {
        chip.textContent = "● " + parts.join(" · ");
        chip.className = heating ? "chip heat" : "chip on";
      } else if (this._isOn(cfg.power)) {
        chip.textContent = "● " + this._t("standby"); chip.className = "chip idle";
      } else {
        chip.textContent = "○ " + this._t("off"); chip.className = "chip off";
      }
    }

    const errEl = root.getElementById("err");
    const errS = this._st(cfg.error);
    const errDesc = this._st(cfg.error_description);
    const hasErr = errS && !["0","off","none","ok","unavailable","unknown",""].includes(String(errS.state).toLowerCase());
    if (hasErr) {
      errEl.textContent = errDesc && errDesc.state && errDesc.state !== "unavailable"
        ? errDesc.state : this._t("error", { c: errS.state });
      errEl.classList.add("show");
    } else {
      errEl.classList.remove("show");
    }

    const bh = root.getElementById("btn-heat");
    if (bh) {
      bh.classList.toggle("active", cs && cs.state === cfg.hvac_heat);
      bh.classList.toggle("fireactive", heating);
      bh.classList.toggle("disabled", !this._isAvail(cfg.climate));
    }

    SWITCH_BUTTONS.forEach((b) => {
      const el = root.getElementById(`sw-${b.key}`);
      if (!el) return;
      const eid = cfg[b.key];
      el.classList.toggle("active", this._isOn(eid));
      el.classList.toggle("disabled", !this._isAvail(eid));
    });

    const pbtn = root.getElementById("power-btn");
    if (pbtn) {
      const pOn = this._isOn(cfg.power);
      pbtn.classList.toggle("active", pOn);
      pbtn.classList.toggle("disabled", !this._isAvail(cfg.power) && !pOn);
      const plbl = root.getElementById("power-lbl");
      if (plbl) plbl.textContent = this._t(cfg.hold_power
        ? (pOn ? "pw_off_hold" : "pw_on_hold") : (pOn ? "pw_off" : "pw_on"));
    }

    const canSet = this._isAvail(cfg.climate);
    root.getElementById("minus").classList.toggle("disabled", !canSet);
    root.getElementById("plus").classList.toggle("disabled", !canSet);
  }

  _css() {
    return `
      ha-card { padding: 12px; background: var(--card-background-color, #1c1c1c); border-radius: 12px; overflow: hidden; }
      .pool { position: relative; height: 240px; border-radius: 12px; overflow: hidden; background: radial-gradient(120% 100% at 50% 0%, #10303f 0%, #081820 70%); border: 1px solid rgba(53,138,221,0.25); }

      .waves { position: absolute; left: 0; right: 0; bottom: 0; height: 45%; overflow: visible; transition: height 1.2s cubic-bezier(.4,0,.2,1); }
      .waves.offline { filter: grayscale(1) brightness(0.7); }
      .wave { position: absolute; bottom: 0; width: 200%; height: 100%; }
      .wave path { fill: rgba(53,138,221,0.32); }
      .w1 { animation: drift 7s linear infinite; }
      .w2 { animation: drift 5s linear infinite reverse; }
      .w2 path { fill: rgba(29,158,117,0.28); }
      .pool.agitated .w1 { animation-duration: 3.5s; }
      .pool.agitated .w2 { animation-duration: 2.5s; }
      @keyframes drift { from { transform: translateX(0); } to { transform: translateX(-50%); } }

      .bubble-layer { position: absolute; inset: 0; opacity: 0; transition: opacity 0.5s; overflow: hidden; }
      .bubble-layer.bubbling { opacity: 1; }
      .bubble { position: absolute; bottom: 0; border-radius: 50%; background: rgba(210,240,255,var(--a, 0.55)); animation: rise var(--dur, 4s) linear infinite var(--delay, 0s); animation-play-state: paused; }
      .bubble-layer.bubbling .bubble { animation-play-state: running; }
      @keyframes rise {
        0% { transform: translateY(0) scale(0.5); opacity: 0; }
        10% { opacity: 0.9; }
        85% { opacity: 0.85; }
        100% { transform: translateY(-180px) scale(1.15); opacity: 0; }
      }

      .steam-layer { position: absolute; bottom: 0; left: 0; right: 0; height: 55%; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity 0.6s; z-index: 1; }
      .steam-layer.steaming { opacity: 1; }
      .steam { position: absolute; bottom: 0; height: 130px; background: radial-gradient(ellipse at bottom, rgba(255,150,120,0.30), transparent 72%); animation: steam var(--dur, 4.5s) ease-in infinite var(--delay, 0s); animation-play-state: paused; }
      .steam-layer.steaming .steam { animation-play-state: running; }
      @keyframes steam { 0% { transform: translateY(40px) scaleX(0.8); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(-70px) scaleX(1.6); opacity: 0; } }

      .hdr { position: absolute; top: 12px; left: 14px; right: 14px; display: flex; justify-content: space-between; align-items: center; z-index: 3; }
      .title { font-size: 14px; color: #9fe1cb; font-weight: 500; display: flex; align-items: center; gap: 4px; }
      .title ha-icon { --mdc-icon-size: 18px; }
      .chip { font-size: 11px; padding: 3px 9px; border-radius: 20px; background: rgba(120,120,120,0.2); color: #aaa; white-space: nowrap; }
      .chip.on { background: rgba(29,158,117,0.22); color: #5dcaa5; }
      .chip.heat { background: rgba(186,117,23,0.22); color: #efa727; }
      .chip.idle { background: rgba(186,117,23,0.2); color: #efa727; }
      .chip.off { background: rgba(120,120,120,0.2); color: #999; }

      .err { position: absolute; top: 44px; left: 14px; right: 14px; z-index: 4; display: none; font-size: 12px; color: #fff; background: rgba(226,75,74,0.85); padding: 6px 10px; border-radius: 8px; }
      .err.show { display: block; }

      .center { position: absolute; top: 50%; left: 0; right: 0; transform: translateY(-50%); text-align: center; z-index: 3; }
      .temp { font-size: 54px; font-weight: 500; color: #fff; line-height: 1; }
      .temp .unit { font-size: 22px; color: #9fe1cb; margin-left: 2px; }
      .target { font-size: 13px; color: #85b7eb; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 4px; }
      .target ha-icon { --mdc-icon-size: 15px; }
      .target.heating { color: #efa727; }

      .setrow { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
      .stepbtn { flex: 0 0 46px; height: 46px; border-radius: 10px; background: rgba(53,138,221,0.15); border: 0.5px solid rgba(53,138,221,0.4); color: #85b7eb; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .stepbtn:hover { background: rgba(53,138,221,0.28); }
      .stepbtn.disabled { opacity: 0.3; pointer-events: none; }
      .setbox { flex: 1; text-align: center; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 8px; border: 0.5px solid rgba(255,255,255,0.08); }
      .setlbl { font-size: 11px; color: #888; }
      .setval { font-size: 18px; font-weight: 500; color: #fff; }

      .grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 8px; }
      .grid2 { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 8px; }

      .ctrl { position: relative; background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 4px; text-align: center; color: #888; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s; font-family: inherit; }
      .ctrl ha-icon { --mdc-icon-size: 22px; }
      .ctrl .clbl { font-size: 11px; }
      .ctrl:hover { border-color: rgba(255,255,255,0.2); }
      .ctrl.active { background: rgba(var(--c, 53,138,221), 0.18); border-color: rgba(var(--c, 53,138,221), 0.5); color: rgb(var(--c, 53,138,221)); box-shadow: 0 0 14px rgba(var(--c, 53,138,221), 0.25); }
      .ctrl.disabled { opacity: 0.3; pointer-events: none; }

      .heat.fireactive ha-icon { animation: flamewiggle 1.2s ease-in-out infinite; }
      @keyframes flamewiggle { 0%,100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.15) rotate(-4deg); } }

      .power { color: #f09595; }
      .power.active { background: rgba(226,75,74,0.18); border-color: rgba(226,75,74,0.5); color: #f09595; box-shadow: 0 0 14px rgba(226,75,74,0.25); }
      .power .holdbar { position: absolute; bottom: 0; left: 0; height: 3px; width: 0; background: #e24b4a; border-radius: 0 0 10px 10px; }
      .power.fired .holdbar { width: 100%; transition: width 0s; }
      .power:active .holdbar { width: 100%; transition: width 0.8s linear; }
    `;
  }
}

/* ================= EDITOR ================= */

/* ---------- Collapsible sections (open state survives editor re-creation) ---------- */
const IS_SEC_STATE = new Map(); /* `${tagName}:${sectionId}` -> open */
const IS_SEC_CSS = `
  .sec { margin-bottom:18px; }
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
  .sec-title { font-size:15px; font-weight:600; flex:1; }
  .sec-hint { font-size:12px; color:var(--secondary-text-color); margin:-4px 0 10px 0; line-height:1.4; }
  .sec-body[hidden] { display:none; }
  ha-form { display:block; }
`;
const isSec = (id, title, body) =>
  '<div class="sec" data-sec="' + id + '"><button type="button" class="sec-head" aria-controls="sec-' + id + '">' +
  '<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + isEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '">' + body + "</div></div>";
/* First section open by default, the others collapsed. Only toggles `hidden`:
   fields are never re-created, so focus and typed values are kept. */
function isSecWire(root, tag) {
  const secs = root.querySelectorAll(".sec");
  const set = (sec, open) => {
    IS_SEC_STATE.set(tag + ":" + sec.dataset.sec, open);
    sec.querySelector(".sec-head").setAttribute("aria-expanded", String(open));
    sec.querySelector(".sec-body").hidden = !open;
  };
  secs.forEach((sec, i) => {
    const k = tag + ":" + sec.dataset.sec;
    set(sec, IS_SEC_STATE.has(k) ? IS_SEC_STATE.get(k) : i === 0);
    const head = sec.querySelector(".sec-head");
    head.addEventListener("click", () => set(sec, head.getAttribute("aria-expanded") !== "true"));
  });
  root.querySelectorAll(".sec-all").forEach((b) =>
    b.addEventListener("click", () => secs.forEach((s) => set(s, b.dataset.open === "1"))));
}

const IS_SCHEMAS = {
  gen: [
    { name: "name", selector: { text: {} } },
    { name: "device_id", selector: { device: { filter: { integration: "intex_spa" } } } },
    { name: "climate", selector: { entity: { domain: "climate" } } },
    { name: "current_temp", selector: { entity: { domain: "sensor" } } },
    { name: "target_temp", selector: { entity: { domain: "sensor" } } },
  ],
  ctrl: [
    { name: "filter", selector: { entity: { domain: "switch" } } },
    { name: "bubbles", selector: { entity: { domain: "switch" } } },
    { name: "jets", selector: { entity: { domain: "switch" } } },
    { name: "sanitizer", selector: { entity: { domain: "switch" } } },
    { name: "power", selector: { entity: { domain: "switch" } } },
    { name: "hold_power", selector: { boolean: {} } },
  ],
  err: [
    { name: "error", selector: { entity: { domain: "sensor" } } },
    { name: "error_description", selector: { entity: { domain: "sensor" } } },
  ],
  adv: [
    { type: "grid", schema: [
      { name: "hvac_heat", selector: { text: {} } },
      { name: "hvac_off", selector: { text: {} } },
    ]},
  ],
};

class IntexSpaCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...DEFAULTS, ...config }; this._render(); }
  set hass(hass) {
    this._hass = hass;
    if (!this._forms) this._render();
    else this._forms.forEach((f) => { f.hass = hass; });
  }
  /* Built once hass is known, so the UI language is available. */
  _render() {
    if (!this._config || !this._hass) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (!this._forms) {
      const L = isLang(this._hass), t = (k) => isEsc(isT(L, k));
      this.shadowRoot.innerHTML = `<style>${IS_SEC_CSS}</style>
        <div class="sec-tools"><button type="button" class="sec-all" data-open="1">${t("expand_all")}</button><button type="button" class="sec-all" data-open="0">${t("collapse_all")}</button></div>
        ${isSec("gen", isT(L, "sec_gen"), `<div class="sec-hint">${t("hint_auto")}</div><ha-form data-schema="gen"></ha-form>`)}
        ${isSec("ctrl", isT(L, "sec_ctrl"), `<ha-form data-schema="ctrl"></ha-form>`)}
        ${isSec("err", isT(L, "sec_err"), `<ha-form data-schema="err"></ha-form>`)}
        ${isSec("adv", isT(L, "sec_adv"), `<ha-form data-schema="adv"></ha-form>`)}`;
      isSecWire(this.shadowRoot, this.tagName.toLowerCase());
      this._forms = Array.from(this.shadowRoot.querySelectorAll("ha-form"));
      this._forms.forEach((f) => {
        f.schema = IS_SCHEMAS[f.dataset.schema];
        f.computeLabel = (s) => isT(L, "l_" + s.name);
        f.addEventListener("value-changed", (e) => {
          const prev = this._config, next = { ...e.detail.value };
          /* A cleared entity stays "" (= hidden) instead of falling back to auto-detection. */
          IS_ENTITY_KEYS.forEach((k) => { if (prev[k] !== undefined && next[k] === undefined) next[k] = ""; });
          if (!next.device_id) delete next.device_id;
          this._config = next;
          this._render();
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
        });
      });
    }
    /* Every form gets the full, current config so no form emits stale values. */
    this._forms.forEach((f) => { f.hass = this._hass; f.data = this._config; });
  }
}

customElements.define("intex-spa-card", IntexSpaCard);
customElements.define("intex-spa-card-editor", IntexSpaCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "intex-spa-card",
  name: "Intex Spa Card",
  description: "Animated Intex spa card: waves, bubbles, heating steam, hold-to-power.",
  preview: true,
  documentationURL: "https://github.com/mathieu-mp/homeassistant-intex-spa",
});

console.info(
  `%c INTEX-SPA-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#1d9e75;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
  "color:#1d9e75;background:#0a1a24;border-radius:0 4px 4px 0;padding:2px 4px"
);
