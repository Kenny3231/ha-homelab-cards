/*! ha-homelab-cards v1.0.0 — https://github.com/Kenny3231/ha-homelab-cards — MIT */

/* ---- src/cards/home/intex-spa-card.js ---- */
{
/**
 * Intex Spa Card — vanilla JS custom Lovelace card
 * Kenny3231 / HA 2026.8+
 * Deploy: /config/www/perso/intex-spa-card.js
 * Resource: /local/perso/intex-spa-card.js?v2  (type: module)
 *
 * Aucune dépendance. Éditeur visuel inclus.
 * Intégration: mathieu-mp/homeassistant-intex-spa
 *
 * v2 :
 *  - Bouton chauffage (climate.set_hvac_mode heat/off)
 *  - Animations cumulables : bulles qui montent (bubbles ON) + vapeur (chauffe active)
 *  - Jets / Sanitizer masquables : entité vide "" ou absente => bouton retiré, grille auto
 */

const CARD_VERSION = "2.0.0";

/* Réglages non-entité uniquement. Les entités ne sont PAS en dur ici :
   un champ vidé dans l'éditeur reste vide (donc masqué s'il est optionnel). */
const DEFAULTS = {
  name: "Spa",
  hvac_heat: "heat",
  hvac_off: "off",
  temp_min: 20,
  temp_max: 40,
  step: 1,
  hold_power: true,
};

/* Config proposée à l'ajout de la carte (une seule fois). */
const STUB = {
  name: "Spa Terrasse",
  climate: "climate.spa",
  current_temp: "sensor.spa_current_temperature",
  target_temp: "sensor.spa_target_temperature",
  filter: "switch.spa_filter",
  bubbles: "switch.spa_bubbles",
  jets: "switch.spa_jets",
  sanitizer: "switch.spa_sanitizer",
  power: "switch.spa_power",
  error: "sensor.spa_error",
  error_description: "sensor.spa_error_description",
};

const SWITCH_BUTTONS = [
  { key: "filter", label: "Filtre", icon: "mdi:filter", color: "29,158,117" },
  { key: "bubbles", label: "Bulles", icon: "mdi:chart-bubble", color: "53,138,221" },
  { key: "jets", label: "Jets", icon: "mdi:weather-windy", color: "133,183,235" },
  { key: "sanitizer", label: "Sanitizer", icon: "mdi:recycle", color: "159,225,203" },
];

class IntexSpaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._holdTimer = null;
    this._built = false;
  }

  setConfig(config) {
    this._config = { ...DEFAULTS, ...config };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._refresh();
  }

  getCardSize() { return 5; }
  static getConfigElement() { return document.createElement("intex-spa-card-editor"); }
  static getStubConfig() { return { ...DEFAULTS, ...STUB }; }

  _st(id) { if (!id || !this._hass) return undefined; return this._hass.states[id]; }
  _isOn(id) { const s = this._st(id); return s && s.state === "on"; }
  _isAvail(id) { const s = this._st(id); return s && !["unavailable","unknown",""].includes(s.state) && s.state !== undefined; }
  _num(id) { const s = this._st(id); if (!s) return null; const v = parseFloat(s.state); return Number.isFinite(v) ? v : null; }
  /** Une entité est "active" (affichée) si le champ est renseigné et non-vide. */
  _enabled(key) {
    const id = this._config[key];
    return typeof id === "string" && id.trim() !== "";
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

  /* Bornes/pas : depuis climate.spa si dispo (rien en dur), sinon fallback config. */
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
            <div class="temp"><span id="cur">--</span><span class="unit">°C</span></div>
            <div class="target" id="target-line"><ha-icon icon="mdi:target"></ha-icon> Cible <span id="tgt">--</span>°C</div>
          </div>
        </div>

        <div class="setrow">
          <button class="stepbtn" id="minus"><ha-icon icon="mdi:minus"></ha-icon></button>
          <div class="setbox">
            <div class="setlbl">Consigne</div>
            <div class="setval" id="setval">--°C</div>
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
      heat.innerHTML = `<ha-icon icon="mdi:fire"></ha-icon><div class="clbl">Chauffage</div>`;
      heat.addEventListener("click", () => this._toggleHeat());
      grid.appendChild(heat);
    }

    SWITCH_BUTTONS.forEach((b) => {
      if (!this._enabled(b.key)) return; // entité vide => pas d'icône
      const el = document.createElement("button");
      el.className = "ctrl"; el.id = `sw-${b.key}`;
      el.style.setProperty("--c", b.color);
      el.innerHTML = `<ha-icon icon="${b.icon}"></ha-icon><div class="clbl">${b.label}</div>`;
      el.addEventListener("click", () => this._toggle(cfg[b.key]));
      grid.appendChild(el);
    });

    const gp = root.getElementById("grid-power");
    if (this._enabled("power")) {
      const pbtn = document.createElement("button");
      pbtn.className = "ctrl power"; pbtn.id = "power-btn";
      pbtn.innerHTML = `<ha-icon icon="mdi:power"></ha-icon><div class="clbl" id="power-lbl">Power</div><div class="holdbar"></div>`;
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
    // Garde solide : on ne rafraîchit que si le DOM cœur est entièrement présent.
    const curEl = root.getElementById("cur");
    const tgtEl = root.getElementById("tgt");
    const setvalEl = root.getElementById("setval");
    const tlEl = root.getElementById("target-line");
    const wavesEl = root.getElementById("waves");
    if (!curEl || !tgtEl || !setvalEl || !tlEl || !wavesEl) {
      // DOM pas prêt (rendu réentrant / cache) : forcer une reconstruction au prochain hass.
      this._built = false;
      return;
    }
    const cfg = this._config;

    const cur = this._num(cfg.current_temp);
    const cs = this._st(cfg.climate);
    const tgt = cs && Number.isFinite(parseFloat(cs.attributes.temperature))
      ? parseFloat(cs.attributes.temperature) : this._num(cfg.target_temp);

    const online = this._isAvail(cfg.current_temp) || this._isAvail(cfg.climate);
    const heating = online && this._isHeatingNow();
    const bubbling = this._isOn(cfg.bubbles);

    curEl.textContent = cur !== null ? Math.round(cur) : "--";
    tgtEl.textContent = tgt !== null ? Math.round(tgt) : "--";
    setvalEl.textContent = tgt !== null ? `${Math.round(tgt)}°C` : "--°C";

    const tl = tlEl;
    if (heating && tgt !== null) {
      tl.innerHTML = `<ha-icon icon="mdi:fire"></ha-icon> Chauffe vers ${Math.round(tgt)}°C`;
      tl.classList.add("heating");
    } else {
      tl.innerHTML = `<ha-icon icon="mdi:target"></ha-icon> Cible <span>${tgt !== null ? Math.round(tgt) : "--"}</span>°C`;
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
      chip.textContent = "● Hors ligne"; chip.className = "chip off";
    } else {
      const parts = [];
      if (heating) parts.push("Chauffe");
      if (this._isOn(cfg.filter)) parts.push("Filtration");
      if (bubbling) parts.push("Bulles");
      if (parts.length) {
        chip.textContent = "● " + parts.join(" · ");
        chip.className = heating ? "chip heat" : "chip on";
      } else if (this._isOn(cfg.power)) {
        chip.textContent = "● En veille"; chip.className = "chip idle";
      } else {
        chip.textContent = "○ Éteint"; chip.className = "chip off";
      }
    }

    const errEl = root.getElementById("err");
    const errS = this._st(cfg.error);
    const errDesc = this._st(cfg.error_description);
    const hasErr = errS && !["0","off","none","ok","unavailable","unknown",""].includes(String(errS.state).toLowerCase());
    if (hasErr) {
      errEl.textContent = errDesc && errDesc.state && errDesc.state !== "unavailable" ? errDesc.state : `Erreur ${errS.state}`;
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
      if (plbl) plbl.textContent =
        cfg.hold_power ? (pOn ? "Éteindre (hold)" : "Allumer (hold)") : (pOn ? "Éteindre" : "Allumer");
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

class IntexSpaCardEditor extends HTMLElement {
  setConfig(config) { this._config = { ...DEFAULTS, ...config }; this._render(); }
  set hass(hass) { this._hass = hass; if (this._form) this._form.hass = hass; }
  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.addEventListener("value-changed", (e) => {
        this._config = e.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
      });
      this.shadowRoot.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = this._schema();
    this._form.computeLabel = (s) => this._label(s.name);
  }
  _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "climate", selector: { entity: { domain: "climate" } } },
      { name: "current_temp", selector: { entity: { domain: "sensor" } } },
      { name: "target_temp", selector: { entity: { domain: "sensor" } } },
      { name: "filter", selector: { entity: { domain: "switch" } } },
      { name: "bubbles", selector: { entity: { domain: "switch" } } },
      { name: "jets", selector: { entity: { domain: "switch" } } },
      { name: "sanitizer", selector: { entity: { domain: "switch" } } },
      { name: "power", selector: { entity: { domain: "switch" } } },
      { name: "error", selector: { entity: { domain: "sensor" } } },
      { name: "error_description", selector: { entity: { domain: "sensor" } } },
      { name: "hold_power", selector: { boolean: {} } },
      {
        name: "advanced",
        type: "expandable",
        title: "Avancé (modes climate)",
        schema: [
          { name: "hvac", type: "grid", schema: [
            { name: "hvac_heat", selector: { text: {} } },
            { name: "hvac_off", selector: { text: {} } },
          ]},
        ],
      },
    ];
  }
  _label(name) {
    const map = {
      name: "Nom affiché", climate: "Climate (consigne + chauffage)",
      current_temp: "Température actuelle", target_temp: "Température cible (fallback)",
      filter: "Filtre (vide = masqué)", bubbles: "Bulles (vide = masqué)",
      jets: "Jets (vide = masqué)", sanitizer: "Sanitizer (vide = masqué)",
      power: "Power (vide = masqué)",
      error: "Capteur erreur", error_description: "Description erreur",
      hvac_heat: "Mode chauffe", hvac_off: "Mode arrêt",
      hold_power: "Confirmation hold sur Power",
    };
    return map[name] || name;
  }
}

customElements.define("intex-spa-card", IntexSpaCard);
customElements.define("intex-spa-card-editor", IntexSpaCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "intex-spa-card",
  name: "Intex Spa Card",
  description: "Card animée pour spa Intex : vague, bulles, vapeur de chauffe, hold power.",
  preview: true,
  documentationURL: "https://github.com/mathieu-mp/homeassistant-intex-spa",
});

console.info(
  `%c INTEX-SPA-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#1d9e75;font-weight:700;border-radius:4px 0 0 4px;padding:2px 4px",
  "color:#1d9e75;background:#0a1a24;border-radius:0 4px 4px 0;padding:2px 4px"
);
}

/* ---- src/cards/media/perso-apps-card.js ---- */
{
/**
 * perso-apps-card.js
 * Grille de lancement d'applications pour une entité remote (Android TV / Shield).
 *
 * Auteur : Kenny3231
 * Version : 1.0.0
 */

const PAC_VERSION = "1.1.0";

const PAC_DEFAULTS = {
  columns: 4,
  title: "",
  radius: 12,
  show_labels: false,
  haptic: true,
};

function pacFire(node, type, detail) {
  const ev = new Event(type, { bubbles: true, cancelable: false, composed: true });
  ev.detail = detail || {};
  node.dispatchEvent(ev);
  return ev;
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

class PersoAppsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._sigCache = null;
  }

  static getConfigElement() {
    return document.createElement("perso-apps-card-editor");
  }

  static getStubConfig(hass) {
    const remote = Object.keys(hass.states).find((e) => e.startsWith("remote."));
    return {
      type: "custom:perso-apps-card",
      entity: remote || "remote.example",
      columns: 4,
      apps: [
        { name: "Netflix", image: "/local/apps/netflix.webp", activity: "https://www.netflix.com/title" },
      ],
    };
  }

  setConfig(config) {
    if (!config) throw new Error("perso-apps-card : configuration vide.");
    if (!Array.isArray(config.apps) || config.apps.length === 0) {
      throw new Error("perso-apps-card : la liste 'apps' est obligatoire et ne peut pas être vide.");
    }
    const bad = config.apps.find((a) => !a || (!a.activity && !a.package && !a.action));
    if (bad) {
      throw new Error(
        "perso-apps-card : chaque app doit définir 'activity', 'package' ou 'action'."
      );
    }
    if (!config.entity && config.apps.some((a) => a.activity || a.package)) {
      throw new Error(
        "perso-apps-card : 'entity' (domaine remote) est obligatoire dès qu'une app utilise 'activity' ou 'package'."
      );
    }
    this._config = Object.assign({}, PAC_DEFAULTS, config);
    this._built = false;
    this._sigCache = null;
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
  }

  getCardSize() {
    const cols = this._config.columns || 4;
    return Math.ceil(this._config.apps.length / cols) * 2 + (this._config.title ? 1 : 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    const sig = this._sig();
    if (sig !== this._sigCache) {
      this._sigCache = sig;
      this._render();
    }
  }

  _sig() {
    const h = this._hass;
    const c = this._config;
    if (!h) return "";
    const parts = [];
    if (c.entity) {
      const st = h.states[c.entity];
      parts.push(st ? st.state : "missing");
    }
    if (c.state_entity) {
      const st = h.states[c.state_entity];
      if (st) {
        parts.push(
          st.state,
          String(st.attributes.app_id || ""),
          String(st.attributes.source || "")
        );
      } else {
        parts.push("missing");
      }
    }
    return parts.join("|");
  }

  /* -------------------------------------------------------------- */

  _launch(app) {
    const h = this._hass;
    if (!h) return;
    if (this._config.haptic) pacFire(this, "haptic", "light");

    if (app.action) {
      const [domain, service] = String(app.action).split(".");
      if (!domain || !service) return;
      h.callService(domain, service, Object.assign({}, app.data || {}), app.target || undefined);
      return;
    }
    const data = { entity_id: this._config.entity };
    if (app.activity) data.activity = app.activity;
    else if (app.package) data.activity = app.package;
    h.callService("remote", "turn_on", data);
  }

  _isActive(app) {
    const c = this._config;
    if (!c.state_entity) return false;
    const st = this._hass && this._hass.states[c.state_entity];
    if (!st) return false;
    const needle = (app.match || app.package || app.activity || "").toLowerCase();
    if (!needle) return false;
    const hay = [
      st.attributes.app_id,
      st.attributes.app_name,
      st.attributes.source,
      st.state,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle) || needle.includes(hay);
  }

  /* -------------------------------------------------------------- */

  _build() {
    const c = this._config;
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = PersoAppsCard.styles;
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.className = "pac";
    root.appendChild(card);

    const body = document.createElement("div");
    body.className = "body";
    card.appendChild(body);

    if (c.title) {
      const h = document.createElement("div");
      h.className = "title";
      h.textContent = c.title;
      body.appendChild(h);
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    grid.style.gridTemplateColumns = `repeat(${c.columns}, minmax(0, 1fr))`;
    body.appendChild(grid);

    this._tiles = [];
    c.apps.forEach((app) => {
      const wrap = document.createElement("div");
      wrap.className = "wrap";

      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.style.borderRadius = c.radius + "px";
      tile.title = app.name || "";

      const mkFallback = () => {
        const fb = document.createElement("span");
        fb.className = "fallback";
        fb.textContent = (app.name || "?").slice(0, 10);
        return fb;
      };

      if (app.image) {
        const img = document.createElement("img");
        img.src = app.image;
        img.alt = app.name || "";
        img.loading = "lazy";
        img.addEventListener("error", () => {
          if (img.parentNode === tile) tile.removeChild(img);
          if (!tile.querySelector(".fallback")) tile.appendChild(mkFallback());
        });
        tile.appendChild(img);
      } else {
        tile.appendChild(mkFallback());
      }
      if (app.background) tile.style.background = app.background;

      tile.addEventListener("click", () => this._launch(app));
      wrap.appendChild(tile);

      if (c.show_labels) {
        const lab = document.createElement("span");
        lab.className = "label";
        lab.textContent = app.name || "";
        wrap.appendChild(lab);
      }

      grid.appendChild(wrap);
      this._tiles.push({ el: tile, app });
    });

    this._built = true;
  }

  _render() {
    const c = this._config;
    if (!this._tiles) return;
    const st = c.entity && this._hass ? this._hass.states[c.entity] : null;
    const unavailable = c.entity ? !st || st.state === "unavailable" : false;
    const card = this.shadowRoot.querySelector(".pac");
    if (card) card.classList.toggle("unavailable", unavailable);

    this._tiles.forEach(({ el, app }) => {
      el.classList.toggle("active", this._isActive(app));
    });
  }
}

PersoAppsCard.styles = `
:host { display: block; }

ha-card.pac {
  background: var(--ha-card-background, var(--card-background-color, #1c1d21));
  border-radius: var(--ha-card-border-radius, 14px);
  overflow: hidden;
}
ha-card.pac.unavailable { opacity: .45; pointer-events: none; }

.body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

.title {
  font-size: 12px;
  color: var(--secondary-text-color, #9aa0ab);
  letter-spacing: .01em;
}

.grid { display: grid; gap: 9px; }

.wrap { display: flex; flex-direction: column; gap: 5px; min-width: 0; }

.tile {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: #0f1013;
  box-shadow: 0 2px 8px rgba(0,0,0,.35);
  transition: transform .1s ease, box-shadow .15s ease;
  -webkit-tap-highlight-color: transparent;
}
.tile img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.tile .fallback {
  display: grid; place-items: center;
  width: 100%; height: 100%;
  font-size: 11px; font-weight: 700; color: #dfe4ec;
  padding: 4px; text-align: center; line-height: 1.15;
}
.tile:active { transform: scale(.94); }
.tile.active {
  box-shadow: 0 0 0 2px var(--primary-color, #4a9eff), 0 4px 14px rgba(74,158,255,.3);
}

.label {
  font-size: 11px;
  color: var(--secondary-text-color, #9aa0ab);
  text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

@media (hover: hover) {
  .tile:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(0,0,0,.45); }
}
`;

/* ------------------------------------------------------------------ */
/* Éditeur                                                             */
/* ------------------------------------------------------------------ */

class PersoAppsCardEditor extends HTMLElement {
  constructor() {
    super();
    this._built = false;
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!Array.isArray(this._config.apps)) this._config.apps = [];
    if (!this._built) this._build();
    this._fill();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._topForm) this._topForm.hass = hass;
  }

  _emit() {
    const cfg = JSON.parse(JSON.stringify(this._config));
    cfg.apps = cfg.apps.map((a) => {
      const o = {};
      ["name", "image", "activity", "package", "match", "background", "action"].forEach((k) => {
        if (a[k]) o[k] = a[k];
      });
      if (a.data) o.data = a.data;
      if (a.target) o.target = a.target;
      return o;
    });
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: cfg },
        bubbles: true,
        composed: true,
      })
    );
  }

  _topSchema() {
    return [
      { name: "entity", selector: { entity: { filter: { domain: ["remote"] } } } },
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "columns", selector: { number: { min: 2, max: 8, step: 1, mode: "box" } } },
          { name: "radius", selector: { number: { min: 0, max: 40, step: 1, mode: "box" } } },
        ],
      },
      {
        name: "state_entity",
        selector: { entity: { filter: { domain: ["media_player"] } } },
      },
      { name: "show_labels", selector: { boolean: {} } },
    ];
  }

  _label(schema) {
    const map = {
      entity: "Entité remote",
      title: "Titre (laisser vide pour masquer)",
      columns: "Colonnes",
      radius: "Arrondi (px)",
      state_entity: "Lecteur pour surligner l'app active (optionnel)",
      show_labels: "Afficher les noms sous les tuiles",
    };
    return map[schema.name] || schema.name;
  }

  _build() {
    this.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      .pac-ed-apps { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
      .pac-ed-h { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
      .pac-ed-row {
        border: 1px solid var(--divider-color); border-radius: 10px;
        padding: 10px; display: flex; flex-direction: column; gap: 8px;
      }
      .pac-ed-line { display: flex; gap: 8px; align-items: center; }
      .pac-ed-line ha-textfield { flex: 1; }
      .pac-ed-tools { display: flex; gap: 2px; }
      .pac-ed-tools ha-icon-button { --mdc-icon-button-size: 34px; --mdc-icon-size: 18px; }
      .pac-ed-add {
        margin-top: 4px; align-self: flex-start;
        background: var(--primary-color); color: var(--text-primary-color, #fff);
        border: none; border-radius: 8px; padding: 8px 14px;
        font-size: 13px; cursor: pointer;
      }
      .pac-ed-idx { font-size: 12px; color: var(--secondary-text-color); min-width: 18px; }
    `;
    this.appendChild(style);

    this._topForm = document.createElement("ha-form");
    this._topForm.computeLabel = (s) => this._label(s);
    this._topForm.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const v = Object.assign({}, ev.detail.value);
      Object.keys(v).forEach((k) => {
        if (v[k] === "" || v[k] === undefined) delete v[k];
      });
      const apps = this._config.apps;
      this._config = Object.assign({}, v, { apps });
      this._emit();
    });
    if (this._hass) this._topForm.hass = this._hass;
    this.appendChild(this._topForm);

    this._appsBox = document.createElement("div");
    this._appsBox.className = "pac-ed-apps";
    this.appendChild(this._appsBox);

    const add = document.createElement("button");
    add.className = "pac-ed-add";
    add.type = "button";
    add.textContent = "+ Ajouter une application";
    add.addEventListener("click", () => {
      this._config.apps = this._config.apps.concat([{ name: "", image: "", activity: "" }]);
      this._fillApps();
      this._emit();
    });
    this.appendChild(add);

    this._built = true;
  }

  _fill() {
    if (this._topForm) {
      const top = Object.assign({}, this._config);
      delete top.apps;
      delete top.type;
      this._topForm.data = top;
      this._topForm.schema = this._topSchema();
    }
    this._fillApps();
  }

  _mkField(label, value, onChange) {
    const f = document.createElement("ha-textfield");
    f.label = label;
    f.value = value || "";
    let t = null;
    f.addEventListener("input", (ev) => {
      const val = ev.target.value;
      if (t) clearTimeout(t);
      t = setTimeout(() => onChange(val), 350);
    });
    f.addEventListener("change", (ev) => {
      if (t) clearTimeout(t);
      onChange(ev.target.value);
    });
    return f;
  }

  _fillApps() {
    if (!this._appsBox) return;
    this._appsBox.innerHTML = "";

    const h = document.createElement("div");
    h.className = "pac-ed-h";
    h.textContent = "Applications";
    this._appsBox.appendChild(h);

    this._config.apps.forEach((app, i) => {
      const row = document.createElement("div");
      row.className = "pac-ed-row";

      const line1 = document.createElement("div");
      line1.className = "pac-ed-line";

      const idx = document.createElement("span");
      idx.className = "pac-ed-idx";
      idx.textContent = String(i + 1);
      line1.appendChild(idx);

      line1.appendChild(
        this._mkField("Nom", app.name, (v) => {
          this._config.apps[i].name = v;
          this._emit();
        })
      );

      const tools = document.createElement("div");
      tools.className = "pac-ed-tools";

      const mkBtn = (icon, fn, disabled) => {
        const b = document.createElement("ha-icon-button");
        b.disabled = !!disabled;
        const ic = document.createElement("ha-icon");
        ic.icon = icon;
        b.appendChild(ic);
        b.addEventListener("click", fn);
        return b;
      };

      tools.appendChild(
        mkBtn("mdi:arrow-up", () => {
          if (i === 0) return;
          const a = this._config.apps;
          [a[i - 1], a[i]] = [a[i], a[i - 1]];
          this._fillApps();
          this._emit();
        }, i === 0)
      );
      tools.appendChild(
        mkBtn("mdi:arrow-down", () => {
          const a = this._config.apps;
          if (i >= a.length - 1) return;
          [a[i + 1], a[i]] = [a[i], a[i + 1]];
          this._fillApps();
          this._emit();
        }, i >= this._config.apps.length - 1)
      );
      tools.appendChild(
        mkBtn("mdi:delete", () => {
          this._config.apps.splice(i, 1);
          this._fillApps();
          this._emit();
        })
      );

      line1.appendChild(tools);
      row.appendChild(line1);

      const line2 = document.createElement("div");
      line2.className = "pac-ed-line";
      line2.appendChild(
        this._mkField("Image (/local/apps/...)", app.image, (v) => {
          this._config.apps[i].image = v;
          this._emit();
        })
      );
      row.appendChild(line2);

      const line3 = document.createElement("div");
      line3.className = "pac-ed-line";
      line3.appendChild(
        this._mkField("Activity / package", app.activity || app.package, (v) => {
          this._config.apps[i].activity = v;
          delete this._config.apps[i].package;
          this._emit();
        })
      );
      row.appendChild(line3);

      this._appsBox.appendChild(row);
    });
  }
}

/* ------------------------------------------------------------------ */

if (!customElements.get("perso-apps-card")) {
  customElements.define("perso-apps-card", PersoAppsCard);
}
if (!customElements.get("perso-apps-card-editor")) {
  customElements.define("perso-apps-card-editor", PersoAppsCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "perso-apps-card",
  name: "Perso — Applications",
  description: "Grille de lancement d'applications pour une entité remote.",
  preview: true,
});

console.info(
  `%c PERSO-APPS-CARD %c ${PAC_VERSION} `,
  "color:#0b0c0e;background:#8e9bb0;font-weight:700;border-radius:3px 0 0 3px",
  "color:#dfe4ec;background:#2c2f37;border-radius:0 3px 3px 0"
);
}

/* ---- src/cards/media/perso-remote-card.js ---- */
{
/**
 * perso-remote-card.js
 * Télécommande "physique" pour Home Assistant.
 * D-pad circulaire à quadrants, touches en relief, volume déporté sur un media_player.
 *
 * Auteur : Kenny3231
 * Version : 1.0.0
 */

const PRC_VERSION = "1.0.0";

/* ------------------------------------------------------------------ */
/* Définition des touches                                              */
/* ------------------------------------------------------------------ */

const PRC_KEYS = {
  up:        { cmd: "DPAD_UP",        repeat: true },
  down:      { cmd: "DPAD_DOWN",      repeat: true },
  left:      { cmd: "DPAD_LEFT",      repeat: true },
  right:     { cmd: "DPAD_RIGHT",     repeat: true },
  center:    { cmd: "DPAD_CENTER",    longPress: true },
  back:      { cmd: "BACK",           longPress: true },
  home:      { cmd: "HOME",           longPress: true },
  menu:      { cmd: "MENU",           longPress: true },
  prev:      { cmd: "MEDIA_PREVIOUS", holdCmd: "MEDIA_REWIND" },
  playpause: { cmd: "MEDIA_PLAY_PAUSE", holdCmd: "MEDIA_STOP" },
  next:      { cmd: "MEDIA_NEXT",     holdCmd: "MEDIA_FAST_FORWARD" },
};

const PRC_DEFAULTS = {
  name: "",
  hold_secs: 0.5,
  repeat_delay: 450,
  repeat_interval: 220,
  show_nav: true,
  show_transport: true,
  haptic: true,
};

function prcFire(node, type, detail) {
  const ev = new Event(type, { bubbles: true, cancelable: false, composed: true });
  ev.detail = detail || {};
  node.dispatchEvent(ev);
  return ev;
}

function prcHaptic(node, kind) {
  prcFire(node, "haptic", kind || "light");
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

class PersoRemoteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._sigCache = null;
    this._timers = { hold: null, repeat: null };
    this._didRepeat = false;
    this._didLong = false;
  }

  static getConfigElement() {
    return document.createElement("perso-remote-card-editor");
  }

  static getStubConfig(hass) {
    const remote = Object.keys(hass.states).find((e) => e.startsWith("remote."));
    return {
      type: "custom:perso-remote-card",
      entity: remote || "remote.example",
      name: "",
      show_nav: true,
      show_transport: true,
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("perso-remote-card : la clé 'entity' (domaine remote) est obligatoire.");
    }
    if (config.entity.split(".")[0] !== "remote") {
      throw new Error("perso-remote-card : 'entity' doit être une entité du domaine remote.");
    }
    this._config = Object.assign({}, PRC_DEFAULTS, config);
    this._commands = Object.assign({}, config.commands || {});
    this._built = false;
    this._sigCache = null;
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
  }

  getCardSize() {
    let n = 6;
    if (this._config && this._config.show_nav) n += 1;
    if (this._config && this._config.show_transport) n += 1;
    return n;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    const sig = this._sig();
    if (sig !== this._sigCache) {
      this._sigCache = sig;
      this._render();
    }
  }

  /* -------------------------------------------------------------- */

  _sig() {
    const h = this._hass;
    if (!h) return "";
    const c = this._config;
    const parts = [];
    const st = h.states[c.entity];
    parts.push(st ? st.state : "missing");
    if (c.power_entity) {
      const p = h.states[c.power_entity];
      parts.push(p ? p.state : "missing");
    }
    if (c.volume_entity) {
      const v = h.states[c.volume_entity];
      if (v) {
        parts.push(
          v.state,
          String(v.attributes.volume_level),
          String(v.attributes.is_volume_muted)
        );
      } else {
        parts.push("missing");
      }
    }
    return parts.join("|");
  }

  /* -------------------------------------------------------------- */

  _cmd(key) {
    const def = PRC_KEYS[key] || {};
    return this._commands[key] || def.cmd;
  }

  _send(command, holdSecs) {
    if (!this._hass || !command) return;
    const data = { entity_id: this._config.entity, command };
    if (holdSecs) data.hold_secs = holdSecs;
    this._hass.callService("remote", "send_command", data);
  }

  _bindKey(el, key) {
    if (!el) return;
    const def = PRC_KEYS[key] || {};
    const cfg = this._config;

    const clear = () => {
      if (this._timers.hold) { clearTimeout(this._timers.hold); this._timers.hold = null; }
      if (this._timers.repeat) { clearInterval(this._timers.repeat); this._timers.repeat = null; }
    };

    const down = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this._didRepeat = false;
      this._didLong = false;
      el.classList.add("pressed");
      if (def.repeat) {
        this._timers.hold = setTimeout(() => {
          this._didRepeat = true;
          this._send(this._cmd(key));
          this._timers.repeat = setInterval(() => {
            this._send(this._cmd(key));
          }, cfg.repeat_interval);
        }, cfg.repeat_delay);
      } else if (def.longPress || def.holdCmd) {
        this._timers.hold = setTimeout(() => {
          this._didLong = true;
          if (cfg.haptic) prcHaptic(this, "medium");
          if (def.holdCmd) {
            this._send(this._commands[key + "_hold"] || def.holdCmd);
          } else {
            this._send(this._cmd(key), cfg.hold_secs);
          }
        }, 600);
      }
    };

    const up = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      el.classList.remove("pressed");
      clear();
      if (this._didRepeat || this._didLong) {
        this._didRepeat = false;
        this._didLong = false;
        return;
      }
      if (cfg.haptic) prcHaptic(this, "light");
      this._send(this._cmd(key));
    };

    const cancel = () => {
      el.classList.remove("pressed");
      clear();
      this._didRepeat = false;
      this._didLong = false;
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* -------------------------------------------------------------- */

  _power() {
    const c = this._config;
    const target = c.power_entity || c.entity;
    const domain = target.split(".")[0];
    if (c.haptic) prcHaptic(this, "heavy");

    if (domain === "select" || domain === "input_select") {
      const st = this._hass.states[target];
      const off = c.power_off_option || "power_off";
      const opts = (st && st.attributes.options) || [];
      if (st && st.state !== off && opts.includes(off)) {
        this._hass.callService(domain, "select_option", { entity_id: target, option: off });
      } else if (c.power_on_option && opts.includes(c.power_on_option)) {
        this._hass.callService(domain, "select_option", { entity_id: target, option: c.power_on_option });
      }
      return;
    }
    if (domain === "media_player") {
      this._hass.callService("media_player", "toggle", { entity_id: target });
      return;
    }
    this._hass.callService("remote", "toggle", { entity_id: target });
  }

  _isPoweredOff() {
    const c = this._config;
    const target = c.power_entity || c.entity;
    const st = this._hass && this._hass.states[target];
    if (!st) return true;
    const domain = target.split(".")[0];
    if (domain === "select" || domain === "input_select") {
      return st.state === (c.power_off_option || "power_off");
    }
    return st.state === "off" || st.state === "unavailable" || st.state === "standby";
  }

  _vol(action) {
    const c = this._config;
    if (!c.volume_entity || !this._hass) return;
    if (c.haptic) prcHaptic(this, "light");
    if (action === "mute") {
      const st = this._hass.states[c.volume_entity];
      const muted = st ? !!st.attributes.is_volume_muted : false;
      this._hass.callService("media_player", "volume_mute", {
        entity_id: c.volume_entity,
        is_volume_muted: !muted,
      });
    } else {
      this._hass.callService(
        "media_player",
        action === "up" ? "volume_up" : "volume_down",
        { entity_id: c.volume_entity }
      );
    }
  }

  _bindVolume(el, action) {
    if (!el) return;
    const cfg = this._config;
    const clear = () => {
      if (this._timers.hold) { clearTimeout(this._timers.hold); this._timers.hold = null; }
      if (this._timers.repeat) { clearInterval(this._timers.repeat); this._timers.repeat = null; }
    };
    if (action === "mute") {
      el.addEventListener("click", () => this._vol("mute"));
      return;
    }
    el.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      el.classList.add("pressed");
      this._vol(action);
      this._timers.hold = setTimeout(() => {
        this._timers.repeat = setInterval(() => this._vol(action), 300);
      }, cfg.repeat_delay);
    });
    const stop = () => { el.classList.remove("pressed"); clear(); };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointerleave", stop);
    el.addEventListener("pointercancel", stop);
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    prcFire(this, "hass-more-info", { entityId });
  }

  /* -------------------------------------------------------------- */

  _build() {
    const c = this._config;
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = PersoRemoteCard.styles;
    root.appendChild(style);

    const card = document.createElement("ha-card");
    card.className = "prc";
    root.appendChild(card);

    const body = document.createElement("div");
    body.className = "body";
    card.appendChild(body);

    /* --- entête --- */
    const head = document.createElement("div");
    head.className = "head";
    head.innerHTML = `
      <span class="brand"></span>
      <button class="power" type="button" title="Marche / Arrêt">
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    `;
    body.appendChild(head);
    this._el = { brand: head.querySelector(".brand"), power: head.querySelector(".power") };
    this._el.power.addEventListener("click", () => this._power());
    this._el.brand.addEventListener("click", () => this._moreInfo(c.entity));

    /* --- D-pad --- */
    const ring = document.createElement("div");
    ring.className = "ring";
    ring.innerHTML = `
      <div class="quad q-up"    data-key="up"></div>
      <div class="quad q-right" data-key="right"></div>
      <div class="quad q-down"  data-key="down"></div>
      <div class="quad q-left"  data-key="left"></div>
      <div class="glyph g-up"><ha-icon icon="mdi:chevron-up"></ha-icon></div>
      <div class="glyph g-right"><ha-icon icon="mdi:chevron-right"></ha-icon></div>
      <div class="glyph g-down"><ha-icon icon="mdi:chevron-down"></ha-icon></div>
      <div class="glyph g-left"><ha-icon icon="mdi:chevron-left"></ha-icon></div>
      <div class="ok" data-key="center"><span>OK</span></div>
    `;
    body.appendChild(ring);
    ring.querySelectorAll("[data-key]").forEach((el) => {
      this._bindKey(el, el.dataset.key);
    });

    /* --- rangée navigation --- */
    if (c.show_nav) {
      const nav = document.createElement("div");
      nav.className = "row";
      nav.innerHTML = `
        <button class="key" type="button" data-key="back"><ha-icon icon="mdi:arrow-u-left-top"></ha-icon></button>
        <button class="key" type="button" data-key="home"><ha-icon icon="mdi:home-variant"></ha-icon></button>
        <button class="key" type="button" data-key="menu"><ha-icon icon="mdi:menu"></ha-icon></button>
      `;
      body.appendChild(nav);
      nav.querySelectorAll("[data-key]").forEach((el) => this._bindKey(el, el.dataset.key));
    }

    /* --- rangée transport --- */
    if (c.show_transport) {
      const tr = document.createElement("div");
      tr.className = "row";
      tr.innerHTML = `
        <button class="key" type="button" data-key="prev"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
        <button class="key" type="button" data-key="playpause"><ha-icon icon="mdi:play-pause"></ha-icon></button>
        <button class="key" type="button" data-key="next"><ha-icon icon="mdi:skip-next"></ha-icon></button>
      `;
      body.appendChild(tr);
      tr.querySelectorAll("[data-key]").forEach((el) => this._bindKey(el, el.dataset.key));
    }

    /* --- barre volume --- */
    if (c.volume_entity) {
      const vol = document.createElement("div");
      vol.className = "vol";
      vol.innerHTML = `
        <button class="vkey mute" type="button"><ha-icon icon="mdi:volume-high"></ha-icon></button>
        <span class="vlabel"></span>
        <div class="vpair">
          <button class="vkey vdown" type="button"><ha-icon icon="mdi:minus"></ha-icon></button>
          <button class="vkey vup" type="button"><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      `;
      body.appendChild(vol);
      this._el.mute = vol.querySelector(".mute");
      this._el.muteIcon = vol.querySelector(".mute ha-icon");
      this._el.vlabel = vol.querySelector(".vlabel");
      this._bindVolume(this._el.mute, "mute");
      this._bindVolume(vol.querySelector(".vdown"), "down");
      this._bindVolume(vol.querySelector(".vup"), "up");
      this._el.mute.addEventListener("pointerdown", (e) => e.preventDefault());
    }

    this._built = true;
  }

  /* -------------------------------------------------------------- */

  _render() {
    const c = this._config;
    const h = this._hass;
    if (!h || !this._el) return;

    const st = h.states[c.entity];
    const label =
      c.name || (st && st.attributes.friendly_name) || c.entity.split(".")[1];
    this._el.brand.textContent = label;

    const unavailable = !st || st.state === "unavailable";
    this.shadowRoot.querySelector(".prc").classList.toggle("unavailable", unavailable);

    const off = this._isPoweredOff();
    this._el.power.classList.toggle("on", !off);

    if (c.volume_entity && this._el.vlabel) {
      const v = h.states[c.volume_entity];
      if (!v) {
        this._el.vlabel.textContent = "indisponible";
        this._el.muteIcon.setAttribute("icon", "mdi:volume-off");
      } else {
        const muted = !!v.attributes.is_volume_muted;
        const lvl = v.attributes.volume_level;
        this._el.muteIcon.setAttribute(
          "icon",
          muted ? "mdi:volume-off" : "mdi:volume-high"
        );
        this._el.mute.classList.toggle("muted", muted);
        this._el.vlabel.textContent = muted
          ? "Coupé"
          : typeof lvl === "number"
          ? Math.round(lvl * 100) + " %"
          : "Volume";
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

PersoRemoteCard.styles = `
:host { display: block; }

ha-card.prc {
  --prc-body-1: #2a2c33;
  --prc-body-2: #16171b;
  --prc-key: #2c2f37;
  --prc-key-hi: rgba(255,255,255,.06);
  --prc-glyph: #8e9bb0;
  --prc-glyph-hi: #dfe4ec;
  --prc-edge: #3a3e48;
  background: linear-gradient(178deg, var(--prc-body-1) 0%, var(--prc-body-2) 100%);
  border: 1px solid var(--prc-edge);
  border-radius: 30px;
  box-shadow: 0 22px 46px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.07);
  overflow: hidden;
}
ha-card.prc.unavailable { opacity: .45; pointer-events: none; }

.body {
  padding: 18px 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 340px;
  margin: 0 auto;
}

/* --- entête --- */
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.brand {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: .06em;
  color: #93a0b4;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.power {
  flex: 0 0 38px; width: 38px; height: 38px;
  border: none; border-radius: 50%;
  background: var(--prc-key);
  color: #ff6b6b;
  display: grid; place-items: center;
  cursor: pointer;
  box-shadow: inset 0 1px 0 var(--prc-key-hi), 0 3px 8px rgba(0,0,0,.4);
  transition: transform .08s ease, color .15s ease, box-shadow .15s ease;
}
.power ha-icon { --mdc-icon-size: 20px; }
.power.on { color: #4ade80; box-shadow: inset 0 1px 0 var(--prc-key-hi), 0 0 14px rgba(74,222,128,.28); }
.power:active { transform: scale(.93); }

/* --- D-pad --- */
.ring {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 236px;
  margin: 2px auto 4px;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #363a44 0%, #1c1e23 74%);
  box-shadow:
    inset 0 2px 3px rgba(255,255,255,.08),
    inset 0 -3px 8px rgba(0,0,0,.5),
    0 8px 20px rgba(0,0,0,.45);
  touch-action: none;
}
.quad {
  position: absolute; inset: 0;
  cursor: pointer;
  transition: background .12s ease;
}
.q-up    { clip-path: polygon(0 0, 100% 0, 50% 50%); }
.q-right { clip-path: polygon(100% 0, 100% 100%, 50% 50%); }
.q-down  { clip-path: polygon(100% 100%, 0 100%, 50% 50%); }
.q-left  { clip-path: polygon(0 100%, 0 0, 50% 50%); }
.quad.pressed { background: rgba(120,160,220,.18); }

.glyph {
  position: absolute;
  color: var(--prc-glyph);
  pointer-events: none;
  display: grid; place-items: center;
}
.glyph ha-icon { --mdc-icon-size: 26px; }
.g-up    { top: 8px;  left: 50%; transform: translateX(-50%); }
.g-down  { bottom: 8px; left: 50%; transform: translateX(-50%); }
.g-left  { left: 8px;  top: 50%; transform: translateY(-50%); }
.g-right { right: 8px; top: 50%; transform: translateY(-50%); }

.ok {
  position: absolute; inset: 30%;
  border-radius: 50%;
  background: linear-gradient(180deg, #434855 0%, #292c34 100%);
  display: grid; place-items: center;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    0 5px 12px rgba(0,0,0,.45);
  transition: transform .08s ease, box-shadow .12s ease;
}
.ok span {
  font-size: 13px; font-weight: 500; letter-spacing: .08em;
  color: var(--prc-glyph-hi);
}
.ok.pressed { transform: scale(.94); box-shadow: inset 0 2px 6px rgba(0,0,0,.55); }

/* --- rangées de touches --- */
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.key {
  height: 46px;
  border: none; border-radius: 14px;
  background: var(--prc-key);
  color: var(--prc-glyph);
  display: grid; place-items: center;
  cursor: pointer;
  box-shadow: inset 0 1px 0 var(--prc-key-hi), 0 3px 7px rgba(0,0,0,.35);
  transition: transform .08s ease, background .12s ease, color .12s ease;
  touch-action: none;
}
.key ha-icon { --mdc-icon-size: 22px; }
.key.pressed {
  transform: scale(.95);
  background: #363a44;
  color: var(--prc-glyph-hi);
  box-shadow: inset 0 2px 5px rgba(0,0,0,.5);
}

/* --- volume --- */
.vol {
  display: flex; align-items: center; gap: 10px;
  height: 46px; padding: 0 8px 0 12px;
  border-radius: 14px;
  background: var(--prc-key);
  box-shadow: inset 0 1px 0 var(--prc-key-hi), 0 3px 7px rgba(0,0,0,.35);
}
.vlabel {
  flex: 1; text-align: center;
  font-size: 12.5px; color: #7f8b9e;
  font-variant-numeric: tabular-nums;
}
.vpair { display: flex; gap: 6px; }
.vkey {
  border: none; background: transparent;
  color: var(--prc-glyph);
  width: 34px; height: 34px; border-radius: 10px;
  display: grid; place-items: center; cursor: pointer;
  transition: transform .08s ease, background .12s ease, color .12s ease;
  touch-action: none;
}
.vkey ha-icon { --mdc-icon-size: 20px; }
.vkey.pressed { transform: scale(.92); background: rgba(255,255,255,.07); color: var(--prc-glyph-hi); }
.vkey.mute.muted { color: #ff6b6b; }

@media (max-width: 420px) {
  .body { padding: 16px 14px 18px; }
  .ring { max-width: 200px; }
}
`;

/* ------------------------------------------------------------------ */
/* Éditeur                                                             */
/* ------------------------------------------------------------------ */

class PersoRemoteCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  _schema() {
    const isSelect =
      this._config &&
      this._config.power_entity &&
      ["select", "input_select"].includes(this._config.power_entity.split(".")[0]);

    return [
      {
        name: "entity",
        required: true,
        selector: { entity: { filter: { domain: ["remote"] } } },
      },
      { name: "name", selector: { text: {} } },
      {
        name: "power_entity",
        selector: {
          entity: { filter: { domain: ["select", "input_select", "media_player", "remote"] } },
        },
      },
      ...(isSelect
        ? [
            { name: "power_off_option", selector: { text: {} } },
            { name: "power_on_option", selector: { text: {} } },
          ]
        : []),
      {
        name: "volume_entity",
        selector: { entity: { filter: { domain: ["media_player"] } } },
      },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "show_nav", selector: { boolean: {} } },
          { name: "show_transport", selector: { boolean: {} } },
          { name: "haptic", selector: { boolean: {} } },
        ],
      },
      { name: "hold_secs", selector: { number: { min: 0.1, max: 3, step: 0.1, mode: "box" } } },
    ];
  }

  _label(schema) {
    const map = {
      entity: "Entité remote (obligatoire)",
      name: "Nom affiché",
      power_entity: "Entité pilotée par le bouton marche/arrêt",
      power_off_option: "Option « éteint » du select",
      power_on_option: "Option « allumé » du select",
      volume_entity: "Lecteur pour le volume (laisser vide pour masquer)",
      show_nav: "Rangée retour / accueil / menu",
      show_transport: "Rangée lecture",
      haptic: "Retour haptique",
      hold_secs: "Durée d'appui long (s)",
    };
    return map[schema.name] || schema.name;
  }

  _render() {
    if (!this._config) return;
    if (!this._form) {
      this.innerHTML = "";
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => this._label(s);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const value = Object.assign({}, ev.detail.value);
        Object.keys(value).forEach((k) => {
          if (value[k] === "" || value[k] === undefined) delete value[k];
        });
        this._config = value;
        this._form.schema = this._schema();
        const out = new CustomEvent("config-changed", {
          detail: { config: value },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(out);
      });
      this.appendChild(this._form);
      if (this._hass) this._form.hass = this._hass;
    }
    this._form.data = this._config;
    this._form.schema = this._schema();
  }
}

/* ------------------------------------------------------------------ */

if (!customElements.get("perso-remote-card")) {
  customElements.define("perso-remote-card", PersoRemoteCard);
}
if (!customElements.get("perso-remote-card-editor")) {
  customElements.define("perso-remote-card-editor", PersoRemoteCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "perso-remote-card",
  name: "Perso — Télécommande",
  description: "Télécommande physique avec D-pad circulaire pour une entité remote.",
  preview: true,
});

console.info(
  `%c PERSO-REMOTE-CARD %c ${PRC_VERSION} `,
  "color:#0b0c0e;background:#8e9bb0;font-weight:700;border-radius:3px 0 0 3px",
  "color:#dfe4ec;background:#2c2f37;border-radius:0 3px 3px 0"
);
}

/* ---- src/cards/media/transmission-card.js ---- */
{
/**
 * Transmission Status Card — custom Lovelace card (vanilla JS, zéro dépendance HACS)
 * Version 1.0.0
 *
 * Installation :
 *  1. Copier ce fichier dans  config/www/perso/transmission-card.js
 *  2. Settings → Dashboards → (menu ⋮) → Resources → Add resource
 *       URL : /local/perso/transmission-card.js?v=1
 *       Type : JavaScript Module
 *  3. Vider le cache navigateur (Ctrl+Shift+R)
 *
 * Particularité : lit l'attribut `torrent_info` des sensors *_torrents de
 * l'intégration Transmission pour afficher la vraie liste des torrents.
 *
 * Voir le bloc EXEMPLE DE CONFIG en bas de fichier.
 */

const TR_CARD_VERSION = "1.0.1";

class TransmissionStatusCard extends HTMLElement {
  /* ================= CONFIG ================= */
  setConfig(config) {
    if (!config.power_entity) {
      throw new Error("La clé 'power_entity' est requise (switch Transmission).");
    }
    this._config = {
      title: config.title || "Transmission",
      power_entity: config.power_entity,
      turtle_entity: config.turtle_entity || null,
      status_entity: config.status_entity || null,
      color_down: config.color_down || "#378ADD",
      color_up: config.color_up || "#1D9E75",
      color_idle: config.color_idle || "#8a8a86",
      color_off: config.color_off || "#E24B4A",
      speeds: config.speeds || null,
      torrents: config.torrents || null,
      counters: config.counters || [],
      ring: config.ring || null,
      stats: config.stats || [],
      actions_label: config.actions_label || null,
      actions: config.actions || [],
    };
    this._built = false;
    this._history = null;
    this._historyFetchedAt = 0;
  }

  /* ================= CYCLE DE VIE ================= */
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;

    if (!this._built) {
      this._build();
      this._built = true;
    }

    const sig = this._stateSignature(hass);
    if (sig !== this._lastSignature) {
      this._lastSignature = sig;
      this._render();
    }

    if (this._config.speeds && this._config.speeds.sparkline) {
      const age = Date.now() - this._historyFetchedAt;
      if (first || age > 300000) this._fetchHistory();
    }
  }

  _watchedEntities() {
    const c = this._config;
    const ids = [c.power_entity];
    if (c.turtle_entity) ids.push(c.turtle_entity);
    if (c.status_entity) ids.push(c.status_entity);
    if (c.speeds) {
      if (c.speeds.download) ids.push(c.speeds.download);
      if (c.speeds.upload) ids.push(c.speeds.upload);
    }
    if (c.torrents && c.torrents.source) ids.push(c.torrents.source);
    c.counters.forEach((x) => x.entity && ids.push(x.entity));
    if (c.ring && c.ring.entity) ids.push(c.ring.entity);
    c.stats.forEach((x) => x.entity && ids.push(x.entity));
    return [...new Set(ids)];
  }

  _stateSignature(hass) {
    const c = this._config;
    let sig = this._watchedEntities()
      .map((id) => id + ":" + (hass.states[id] ? hass.states[id].state : "∅"))
      .join("|");
    // La liste des torrents vit dans un attribut : il faut la surveiller aussi
    if (c.torrents && c.torrents.source) {
      const st = hass.states[c.torrents.source];
      const info = st && st.attributes ? st.attributes.torrent_info : null;
      sig += "|TI:" + (info ? JSON.stringify(info).length + ":" + Object.keys(info).join(",") : "0");
    }
    return sig;
  }

  /* ================= HISTORIQUE (double sparkline) ================= */
  async _fetchHistory() {
    const sp = this._config.speeds;
    if (!sp || (!sp.download && !sp.upload)) return;
    const hours = sp.hours || 6;
    const start = new Date(Date.now() - hours * 3600000).toISOString();
    const list = [sp.download, sp.upload].filter(Boolean);
    const url =
      "history/period/" + start +
      "?filter_entity_id=" + encodeURIComponent(list.join(",")) +
      "&minimal_response&no_attributes&significant_changes_only=0";

    try {
      const res = await this._hass.callApi("GET", url);
      const out = {};
      if (Array.isArray(res)) {
        res.forEach((series) => {
          if (!series || !series.length) return;
          const id = series[0].entity_id;
          const pts = series.map((p) => parseFloat(p.state)).filter((v) => !isNaN(v));
          if (id && pts.length > 1) out[id] = pts;
        });
      }
      this._history = Object.keys(out).length ? out : null;
      this._historyFetchedAt = Date.now();
      this._render();
    } catch (err) {
      console.warn("[transmission-status-card] Historique indisponible :", err);
      this._history = null;
      this._historyFetchedAt = Date.now();
    }
  }

  /* ================= SQUELETTE DOM ================= */
  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          border-radius: 14px; padding: 0; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          background: var(--card-background-color, #181a1b);
          transition: border-color .3s ease, box-shadow .3s ease;
        }

        /* --- En-tête --- */
        .header {
          padding: 16px 16px 0 16px;
          display: flex; align-items: center; gap: 12px;
        }
        .avatar { position: relative; width: 48px; height: 48px; flex-shrink: 0; cursor: pointer; }
        .avatar .disc {
          position: absolute; inset: 0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background .3s ease;
        }
        .avatar ha-icon { --mdc-icon-size: 25px; transition: color .3s ease; }
        .htext { flex: 1; min-width: 0; }
        .htitle {
          font-size: 16px; font-weight: 600; letter-spacing: -0.2px;
          color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hsub { display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
        .hstate { font-size: 12px; font-weight: 600; transition: color .3s ease; }
        .hsep { color: var(--disabled-text-color); font-size: 11px; }
        .hmeta { font-size: 11px; color: var(--secondary-text-color); }
        .hbtns { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .turtle {
          width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background .25s ease;
        }
        .turtle ha-icon { --mdc-icon-size: 19px; transition: color .25s ease; }
        .toggle {
          width: 44px; height: 25px; border-radius: 13px; position: relative;
          cursor: pointer; flex-shrink: 0; transition: background .3s ease;
        }
        .knob {
          width: 19px; height: 19px; border-radius: 50%; background: #fff;
          position: absolute; top: 3px; transition: left .25s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,.35);
        }

        /* --- Vitesses --- */
        .speeds { padding: 16px 16px 10px 16px; }
        .speed-row { display: flex; gap: 10px; margin-bottom: 8px; }
        .speed {
          flex: 1; display: flex; align-items: center; gap: 9px;
          cursor: pointer; min-width: 0;
        }
        .speed .sic {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .speed .sic ha-icon { --mdc-icon-size: 17px; }
        .speed .sbody { min-width: 0; }
        .speed .sval {
          font-size: 20px; font-weight: 700; letter-spacing: -0.4px;
          color: var(--primary-text-color); line-height: 1.15;
          white-space: nowrap;
        }
        .speed .sval em { font-size: 11px; font-weight: 500; font-style: normal;
                          color: var(--secondary-text-color); margin-left: 2px; }
        .speed .slbl { font-size: 10px; color: var(--disabled-text-color); }
        .spark { width: 100%; height: 40px; display: block; margin-top: 2px; }

        /* --- Compteurs --- */
        .counters { padding: 0 16px 12px 16px; display: flex; gap: 6px; flex-wrap: wrap; }
        .cnt {
          flex: 1; min-width: 58px; text-align: center;
          background: rgba(255,255,255,0.035); border-radius: 9px;
          padding: 9px 6px; cursor: pointer; transition: background .2s ease;
        }
        .cnt:hover { background: rgba(255,255,255,0.07); }
        .cnt .cv { font-size: 16px; font-weight: 700; }
        .cnt .cn { font-size: 9.5px; color: var(--disabled-text-color); margin-top: 2px; }

        /* --- Liste des torrents --- */
        .tlist { padding: 0 16px 12px 16px; }
        .tlist-head {
          display: flex; align-items: center; gap: 6px;
          margin-bottom: 8px;
        }
        .tlist-head ha-icon { --mdc-icon-size: 13px; color: var(--disabled-text-color); }
        .tlist-head span { font-size: 10.5px; color: var(--disabled-text-color); letter-spacing: .3px; flex: 1; }
        .tor {
          background: rgba(255,255,255,0.035); border-radius: 9px;
          padding: 9px 11px; margin-bottom: 6px;
        }
        .tor-top {
          display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;
        }
        .tor-name {
          flex: 1; min-width: 0; font-size: 12px; font-weight: 500;
          color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tor-pct { font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .tor-track {
          height: 4px; border-radius: 2px; overflow: hidden;
          background: rgba(255,255,255,0.09);
        }
        .tor-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
        .tor-foot {
          display: flex; gap: 10px; margin-top: 5px;
          font-size: 10px; color: var(--disabled-text-color);
        }
        .tor-foot .sp { flex: 1; }
        .tempty {
          font-size: 11px; color: var(--disabled-text-color);
          font-style: italic; padding: 6px 0;
        }

        /* --- Ratio + stats --- */
        .midrow { padding: 0 16px 12px 16px; display: flex; gap: 10px; align-items: stretch; }
        .ringbox {
          background: rgba(255,255,255,0.035); border-radius: 11px;
          padding: 10px 12px; display: flex; align-items: center; gap: 10px;
          cursor: pointer; flex-shrink: 0;
        }
        .ringbox svg { width: 54px; height: 54px; flex-shrink: 0; }
        .ringbox .rl { font-size: 10.5px; color: var(--secondary-text-color); }
        .ringbox .rv { font-size: 14px; font-weight: 700; color: var(--primary-text-color); margin-top: 2px; }
        .statsbox { flex: 1; display: grid; gap: 6px; }
        .stat {
          background: rgba(255,255,255,0.035); border-radius: 9px;
          padding: 7px 10px; cursor: pointer;
          display: flex; align-items: center; gap: 8px;
          transition: background .2s ease;
        }
        .stat:hover { background: rgba(255,255,255,0.07); }
        .stat ha-icon { --mdc-icon-size: 15px; flex-shrink: 0; }
        .stat .sn { font-size: 10.5px; color: var(--secondary-text-color); flex: 1; }
        .stat .sv { font-size: 12.5px; font-weight: 600; color: var(--primary-text-color); }

        /* --- Actions --- */
        .footer {
          padding: 11px 16px 14px 16px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.015);
        }
        .footer-label { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
        .footer-label ha-icon { --mdc-icon-size: 13px; color: var(--disabled-text-color); }
        .footer-label span { font-size: 10.5px; color: var(--disabled-text-color); letter-spacing: .3px; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .action {
          flex: 1; min-width: 50px;
          display: flex; align-items: center; justify-content: center; gap: 5px;
          padding: 8px 6px; border-radius: 8px; cursor: pointer;
          background: rgba(255,255,255,0.045);
          font-size: 12px; font-weight: 600; color: var(--primary-text-color);
          transition: background .2s ease, transform .1s ease;
          user-select: none;
        }
        .action:hover { background: rgba(255,255,255,0.1); }
        .action:active { transform: scale(0.95); }
        .action ha-icon { --mdc-icon-size: 14px; }
        .action.fired { background: rgba(29,158,117,0.25); }
        .hidden { display: none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="avatar"><div class="disc"><ha-icon></ha-icon></div></div>
          <div class="htext">
            <div class="htitle"></div>
            <div class="hsub">
              <span class="hstate"></span>
              <span class="hsep hidden">·</span>
              <span class="hmeta hidden"></span>
            </div>
          </div>
          <div class="hbtns">
            <div class="turtle hidden"><ha-icon icon="mdi:tortoise"></ha-icon></div>
            <div class="toggle"><div class="knob"></div></div>
          </div>
        </div>

        <div class="speeds hidden">
          <div class="speed-row">
            <div class="speed sp-down">
              <div class="sic"><ha-icon icon="mdi:download"></ha-icon></div>
              <div class="sbody"><div class="sval"></div><div class="slbl">Téléchargement</div></div>
            </div>
            <div class="speed sp-up">
              <div class="sic"><ha-icon icon="mdi:upload"></ha-icon></div>
              <div class="sbody"><div class="sval"></div><div class="slbl">Téléversement</div></div>
            </div>
          </div>
          <svg class="spark hidden" viewBox="0 0 340 40" preserveAspectRatio="none">
            <path class="sk-down-area" fill="none"></path>
            <path class="sk-down" fill="none" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
            <path class="sk-up" fill="none" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
          </svg>
        </div>

        <div class="counters hidden"></div>
        <div class="tlist hidden">
          <div class="tlist-head"><ha-icon icon="mdi:format-list-bulleted"></ha-icon><span></span></div>
          <div class="tlist-body"></div>
        </div>
        <div class="midrow hidden">
          <div class="ringbox hidden">
            <svg viewBox="0 0 42 42">
              <circle class="rbg" cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4.5"></circle>
              <circle class="rfg" cx="21" cy="21" r="17" fill="none" stroke-width="4.5"
                      stroke-linecap="round" transform="rotate(-90 21 21)"></circle>
              <text class="rtx" x="21" y="24" text-anchor="middle"
                    style="font-size:9.5px;font-weight:700;fill:var(--primary-text-color)"></text>
            </svg>
            <div><div class="rl"></div><div class="rv"></div></div>
          </div>
          <div class="statsbox"></div>
        </div>

        <div class="footer hidden">
          <div class="footer-label hidden"><ha-icon icon="mdi:cog-outline"></ha-icon><span></span></div>
          <div class="actions"></div>
        </div>
      </ha-card>
    `;

    const r = this.shadowRoot;
    r.querySelector(".toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      this._hass.callService("switch", "toggle", { entity_id: this._config.power_entity });
    });
    r.querySelector(".turtle").addEventListener("click", (e) => {
      e.stopPropagation();
      if (this._config.turtle_entity) {
        this._hass.callService("switch", "toggle", { entity_id: this._config.turtle_entity });
      }
    });
    r.querySelector(".avatar").addEventListener("click", () => {
      this._fireMoreInfo(this._config.status_entity || this._config.power_entity);
    });
  }

  /* ================= RENDU ================= */
  _render() {
    const hass = this._hass;
    const c = this._config;
    const r = this.shadowRoot;

    const powerOn = hass.states[c.power_entity] && hass.states[c.power_entity].state === "on";
    const dl = c.speeds && c.speeds.download ? this._num(hass.states[c.speeds.download]) : 0;
    const ul = c.speeds && c.speeds.upload ? this._num(hass.states[c.speeds.upload]) : 0;

    /* Couleur d'accent déduite de l'activité (indépendant de la langue) */
    let accent;
    if (!powerOn) accent = c.color_off;
    else if (dl > 0) accent = c.color_down;
    else if (ul > 0) accent = c.color_up;
    else accent = c.color_idle;

    let iconName;
    if (!powerOn) iconName = "mdi:cloud-off-outline";
    else if (dl > 0) iconName = "mdi:cloud-download";
    else if (ul > 0) iconName = "mdi:cloud-upload";
    else iconName = "mdi:cloud-outline";

    const card = r.querySelector("ha-card");
    card.style.borderColor = this._rgba(accent, 0.3);
    card.style.boxShadow = "0 0 26px " + this._rgba(accent, 0.11);

    /* --- En-tête --- */
    const disc = r.querySelector(".disc");
    const ic = disc.querySelector("ha-icon");
    disc.style.background = this._rgba(accent, 0.14);
    ic.setAttribute("icon", iconName);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    const hstate = r.querySelector(".hstate");
    if (c.status_entity && hass.states[c.status_entity]) {
      hstate.textContent = hass.states[c.status_entity].state;
    } else {
      hstate.textContent = powerOn ? "Actif" : "Arrêté";
    }
    hstate.style.color = accent;

    const sep = r.querySelector(".hsep");
    const meta = r.querySelector(".hmeta");
    const totalCnt = c.counters.length ? hass.states[c.counters[0].entity] : null;
    if (totalCnt) {
      meta.textContent = this._fmt(totalCnt.state) + " " + (c.counters[0].name || "torrents").toLowerCase();
      sep.classList.remove("hidden");
      meta.classList.remove("hidden");
    } else {
      sep.classList.add("hidden");
      meta.classList.add("hidden");
    }

    /* Mode tortue */
    const turtle = r.querySelector(".turtle");
    if (c.turtle_entity) {
      turtle.classList.remove("hidden");
      const tOn = hass.states[c.turtle_entity] && hass.states[c.turtle_entity].state === "on";
      turtle.style.background = tOn ? this._rgba("#BA7517", 0.18) : "rgba(255,255,255,0.045)";
      turtle.querySelector("ha-icon").style.color = tOn ? "#BA7517" : "var(--disabled-text-color)";
      turtle.title = tOn ? "Mode tortue actif" : "Mode tortue inactif";
    } else {
      turtle.classList.add("hidden");
    }

    const toggle = r.querySelector(".toggle");
    toggle.style.background = powerOn ? accent : "rgba(255,255,255,0.2)";
    r.querySelector(".knob").style.left = powerOn ? "22px" : "3px";

    /* --- Vitesses --- */
    const speeds = r.querySelector(".speeds");
    if (c.speeds && (c.speeds.download || c.speeds.upload)) {
      speeds.classList.remove("hidden");
      this._paintSpeed(".sp-down", c.speeds.download, c.color_down, dl);
      this._paintSpeed(".sp-up", c.speeds.upload, c.color_up, ul);
      this._renderSpark();
    } else {
      speeds.classList.add("hidden");
    }

    /* --- Compteurs --- */
    const counters = r.querySelector(".counters");
    if (c.counters.length) {
      counters.classList.remove("hidden");
      counters.innerHTML = "";
      c.counters.forEach((x) => {
        const st = hass.states[x.entity];
        const el = document.createElement("div");
        el.className = "cnt";
        el.innerHTML =
          '<div class="cv" style="color:' + (x.color || "var(--primary-text-color)") + '">' +
          (st ? this._fmt(st.state) : "—") + "</div>" +
          '<div class="cn">' + (x.name || (st && st.attributes.friendly_name) || x.entity) + "</div>";
        el.addEventListener("click", () => this._fireMoreInfo(x.entity));
        counters.appendChild(el);
      });
    } else {
      counters.classList.add("hidden");
    }

    /* --- Liste des torrents --- */
    this._renderTorrents();

    /* --- Ratio + stats --- */
    const midrow = r.querySelector(".midrow");
    const hasRing = !!(c.ring && c.ring.entity);
    const hasStats = c.stats.length > 0;
    midrow.classList.toggle("hidden", !hasRing && !hasStats);

    const ringbox = r.querySelector(".ringbox");
    if (hasRing) {
      ringbox.classList.remove("hidden");
      const st = hass.states[c.ring.entity];
      const val = st ? parseFloat(st.state) : NaN;
      const max = c.ring.max || 2;
      const frac = isNaN(val) ? 0 : Math.min(Math.max(val / max, 0), 1);
      const color = c.ring.color || c.color_up;
      const fg = ringbox.querySelector(".rfg");
      fg.setAttribute("stroke", color);
      fg.setAttribute("stroke-dasharray", (frac * 106.8).toFixed(1) + ",106.8");
      ringbox.querySelector(".rtx").textContent = isNaN(val)
        ? "—"
        : val.toFixed(2).replace(".", ",");
      ringbox.querySelector(".rl").textContent = c.ring.label || "Ratio";
      ringbox.querySelector(".rv").textContent =
        c.ring.sub || "cible " + String(max).replace(".", ",");
      ringbox.onclick = () => this._fireMoreInfo(c.ring.entity);
    } else {
      ringbox.classList.add("hidden");
    }

    const statsbox = r.querySelector(".statsbox");
    statsbox.innerHTML = "";
    c.stats.forEach((s) => {
      const st = hass.states[s.entity];
      const unit = st && st.attributes ? st.attributes.unit_of_measurement : "";
      const el = document.createElement("div");
      el.className = "stat";
      el.innerHTML =
        (s.icon ? '<ha-icon icon="' + s.icon + '" style="color:' + (s.color || "var(--secondary-text-color)") + '"></ha-icon>' : "") +
        '<span class="sn">' + (s.name || (st && st.attributes.friendly_name) || s.entity) + "</span>" +
        '<span class="sv">' + (st ? this._fmt(st.state) + (unit ? " " + unit : "") : "—") + "</span>";
      el.addEventListener("click", () => this._fireMoreInfo(s.entity));
      statsbox.appendChild(el);
    });

    /* --- Actions --- */
    const footer = r.querySelector(".footer");
    if (c.actions.length) {
      footer.classList.remove("hidden");
      const fl = r.querySelector(".footer-label");
      fl.classList.toggle("hidden", !c.actions_label);
      if (c.actions_label) fl.querySelector("span").textContent = c.actions_label;

      const actions = r.querySelector(".actions");
      actions.innerHTML = "";
      c.actions.forEach((a) => {
        const el = document.createElement("div");
        el.className = "action";
        el.innerHTML =
          (a.icon ? '<ha-icon icon="' + a.icon + '" style="color:' + (a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + a.name + "</span>";
        el.addEventListener("click", () => {
          if (a.perform_action || a.service) {
            const full = a.perform_action || a.service;
            const parts = full.split(".");
            const data = Object.assign({}, a.data || {});
            if (a.entity) data.entity_id = a.entity;
            this._hass.callService(parts[0], parts[1], data);
          } else if (a.entity) {
            const domain = a.entity.split(".")[0];
            const svc = domain === "button" ? "press" : domain === "switch" ? "toggle" : "turn_on";
            this._hass.callService(domain, svc, { entity_id: a.entity });
          }
          el.classList.add("fired");
          setTimeout(() => el.classList.remove("fired"), 600);
        });
        actions.appendChild(el);
      });
    } else {
      footer.classList.add("hidden");
    }
  }

  _paintSpeed(sel, entityId, color, value) {
    const r = this.shadowRoot;
    const box = r.querySelector(sel);
    if (!entityId) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    const st = this._hass.states[entityId];
    const unit = st && st.attributes ? st.attributes.unit_of_measurement || "" : "";
    const active = value > 0;
    box.querySelector(".sic").style.background = this._rgba(color, active ? 0.16 : 0.07);
    box.querySelector(".sic ha-icon").style.color = active ? color : "var(--disabled-text-color)";
    box.querySelector(".sval").innerHTML =
      (st ? this._fmt(st.state) : "—") + (unit ? "<em>" + unit + "</em>" : "");
    box.onclick = () => this._fireMoreInfo(entityId);
  }

  /* --- Double sparkline (download + upload) --- */
  _renderSpark() {
    const r = this.shadowRoot;
    const svg = r.querySelector(".spark");
    const c = this._config;
    const h = this._history;

    if (!c.speeds.sparkline || !h) {
      svg.classList.add("hidden");
      return;
    }
    const dlPts = c.speeds.download ? h[c.speeds.download] : null;
    const ulPts = c.speeds.upload ? h[c.speeds.upload] : null;
    if (!dlPts && !ulPts) {
      svg.classList.add("hidden");
      return;
    }
    svg.classList.remove("hidden");

    const W = 340, H = 40, PAD = 3;
    // Échelle commune aux deux courbes pour que la comparaison soit honnête
    const all = [].concat(dlPts || [], ulPts || []);
    const max = Math.max.apply(null, all) || 1;

    const toPath = (pts) => {
      if (!pts || pts.length < 2) return null;
      const stepX = W / (pts.length - 1);
      return pts
        .map((v, i) => {
          const x = i * stepX;
          const y = H - PAD - (v / max) * (H - PAD * 2);
          return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
        })
        .join(" ");
    };

    const dPath = toPath(dlPts);
    const uPath = toPath(ulPts);

    const dEl = r.querySelector(".sk-down");
    const dAreaEl = r.querySelector(".sk-down-area");
    const uEl = r.querySelector(".sk-up");

    if (dPath) {
      dEl.setAttribute("d", dPath);
      dEl.setAttribute("stroke", c.color_down);
      dAreaEl.setAttribute("d", dPath + " L" + W + "," + H + " L0," + H + " Z");
      dAreaEl.setAttribute("fill", this._rgba(c.color_down, 0.13));
    } else {
      dEl.removeAttribute("d");
      dAreaEl.removeAttribute("d");
    }
    if (uPath) {
      uEl.setAttribute("d", uPath);
      uEl.setAttribute("stroke", c.color_up);
    } else {
      uEl.removeAttribute("d");
    }
  }

  /* --- Liste des torrents depuis l'attribut torrent_info --- */
  _renderTorrents() {
    const r = this.shadowRoot;
    const c = this._config;
    const box = r.querySelector(".tlist");

    if (!c.torrents || !c.torrents.source) {
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");

    const st = this._hass.states[c.torrents.source];
    const info = st && st.attributes ? st.attributes.torrent_info : null;
    const body = r.querySelector(".tlist-body");
    const head = r.querySelector(".tlist-head span");
    head.textContent = c.torrents.label || "Torrents";
    body.innerHTML = "";

    if (!info || !Object.keys(info).length) {
      const e = document.createElement("div");
      e.className = "tempty";
      e.textContent = "Aucun torrent dans cet état.";
      body.appendChild(e);
      return;
    }

    let items = Object.keys(info).map((name) => {
      const d = info[name] || {};
      let pct = parseFloat(d.percent_done);
      if (isNaN(pct)) pct = 0;
      // L'intégration peut renvoyer 0-1 ou 0-100 selon la version
      const scale = c.torrents.percent_scale || "auto";
      if (scale === "fraction" || (scale === "auto" && pct > 0 && pct <= 1)) pct *= 100;
      return {
        name: name,
        pct: Math.min(Math.max(pct, 0), 100),
        ratio: parseFloat(d.ratio),
        eta: d.eta,
        status: d.status,
      };
    });

    const sort = c.torrents.sort || "progress";
    if (sort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "ratio") {
      items.sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
    } else {
      // Incomplets d'abord (les plus avancés en tête), puis les terminés
      items.sort((a, b) => {
        const ai = a.pct >= 100 ? 1 : 0;
        const bi = b.pct >= 100 ? 1 : 0;
        if (ai !== bi) return ai - bi;
        return b.pct - a.pct;
      });
    }

    const max = c.torrents.max_items || 5;
    const shown = items.slice(0, max);

    shown.forEach((t) => {
      const done = t.pct >= 100;
      const color = done ? c.color_up : c.color_down;
      const el = document.createElement("div");
      el.className = "tor";
      const bits = [];
      if (!isNaN(t.ratio)) bits.push("ratio " + t.ratio.toFixed(2).replace(".", ","));
      const eta = this._eta(t.eta, done);
      if (eta) bits.push(eta);
      if (t.status) bits.push(String(t.status));

      el.innerHTML =
        '<div class="tor-top">' +
          '<span class="tor-name">' + this._esc(t.name) + "</span>" +
          '<span class="tor-pct" style="color:' + color + '">' +
            t.pct.toFixed(0) + "%</span>" +
        "</div>" +
        '<div class="tor-track"><div class="tor-fill" style="width:' +
          t.pct.toFixed(1) + "%;background:" + color + '"></div></div>' +
        (bits.length ? '<div class="tor-foot"><span class="sp">' + bits.join(" · ") + "</span></div>" : "");
      body.appendChild(el);
    });

    if (items.length > shown.length) {
      const more = document.createElement("div");
      more.className = "tempty";
      more.textContent = "+ " + (items.length - shown.length) + " autre(s)";
      body.appendChild(more);
    }
  }

  /* ================= HELPERS ================= */
  _eta(raw, done) {
    if (done) return null;
    if (raw === undefined || raw === null || raw === "") return null;
    // Peut arriver en secondes (nombre) ou en chaîne "0:23:45"
    const n = parseFloat(raw);
    if (!isNaN(n) && String(raw).indexOf(":") === -1) {
      if (n <= 0 || n > 31536000) return null; // inconnu / absurde
      const h = Math.floor(n / 3600);
      const m = Math.floor((n % 3600) / 60);
      if (h > 24) return Math.floor(h / 24) + " j restants";
      if (h > 0) return h + " h " + m + " min restantes";
      return m + " min restantes";
    }
    const s = String(raw);
    if (s.indexOf("-") === 0 || s.toLowerCase().indexOf("unknown") !== -1) return null;
    return s + " restantes";
  }

  _num(stateObj) {
    if (!stateObj) return 0;
    const n = parseFloat(stateObj.state);
    return isNaN(n) ? 0 : n;
  }

  _fmt(state) {
    const n = parseFloat(state);
    if (isNaN(n)) return state;
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
  }

  _esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  _rgba(color, a) {
    if (color.indexOf("var(") === 0 || color.indexOf("rgb") === 0) return color;
    const h = color.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    let size = 2;
    if (c.speeds) size += 2;
    if (c.counters.length) size += 1;
    if (c.torrents) size += Math.min(c.torrents.max_items || 5, 5);
    if (c.ring || c.stats.length) size += 2;
    if (c.actions.length) size += 1;
    return size;
  }

  static getStubConfig() {
    return {
      type: "custom:transmission-status-card",
      title: "Transmission",
      power_entity: "switch.example",
    };
  }

  static getConfigElement() {
    return document.createElement("transmission-status-card-editor");
  }
}

customElements.define("transmission-status-card", TransmissionStatusCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "transmission-status-card",
  name: "Transmission Status Card",
  description: "Carte Transmission avec liste de torrents, vitesses et mode tortue.",
});

console.info(
  "%c TRANSMISSION-STATUS-CARD %c v" + TR_CARD_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700",
  "color:#378ADD;background:#222"
);

/* ============================================================
   ÉDITEUR VISUEL — transmission-status-card-editor
   ============================================================ */

const TRL = {
  title: "Titre",
  power_entity: "Switch Transmission (requis)",
  turtle_entity: "Switch mode tortue",
  status_entity: "Capteur de statut",
  download: "Vitesse de téléchargement",
  upload: "Vitesse de téléversement",
  sparkline: "Afficher les courbes",
  hours: "Fenêtre historique (heures)",
  source: "Capteur source (attribut torrent_info)",
  label: "Titre de la liste",
  max_items: "Nombre de torrents affichés",
  sort: "Tri",
  percent_scale: "Échelle du pourcentage",
  entity: "Entité",
  name: "Nom affiché",
  icon: "Icône",
  max: "Valeur cible (anneau plein)",
  sub: "Texte sous le ratio",
  actions_label: "Titre de la zone d'actions",
  perform_action: "Action à exécuter (ex. transmission.start_torrent)",
};

const TR_SCHEMA_GENERAL = [
  { name: "title", selector: { text: {} } },
  { name: "power_entity", required: true, selector: { entity: { filter: { domain: ["switch"] } } } },
  {
    type: "grid",
    schema: [
      { name: "turtle_entity", selector: { entity: { filter: { domain: ["switch"] } } } },
      { name: "status_entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
    ],
  },
];

const TR_SCHEMA_SPEEDS = [
  {
    type: "grid",
    schema: [
      { name: "download", selector: { entity: { filter: { domain: ["sensor"] } } } },
      { name: "upload", selector: { entity: { filter: { domain: ["sensor"] } } } },
    ],
  },
  { name: "sparkline", selector: { boolean: {} } },
  {
    name: "hours",
    visible: { field: "sparkline", value: true },
    selector: { number: { min: 1, max: 168, mode: "box" } },
  },
];

const TR_SCHEMA_TORRENTS = [
  { name: "source", selector: { entity: { filter: { domain: ["sensor"] } } } },
  {
    type: "grid",
    schema: [
      { name: "label", selector: { text: {} } },
      { name: "max_items", selector: { number: { min: 1, max: 20, mode: "box" } } },
    ],
  },
  {
    type: "grid",
    schema: [
      {
        name: "sort",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "progress", label: "Progression (incomplets d'abord)" },
              { value: "name", label: "Nom" },
              { value: "ratio", label: "Ratio" },
            ],
          },
        },
      },
      {
        name: "percent_scale",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Auto (détection)" },
              { value: "percent", label: "Déjà en % (0-100)" },
              { value: "fraction", label: "Fraction (0-1)" },
            ],
          },
        },
      },
    ],
  },
];

const TR_SCHEMA_RING = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  {
    type: "grid",
    schema: [
      { name: "label", selector: { text: {} } },
      { name: "max", selector: { number: { min: 0.1, max: 20, step: 0.1, mode: "box" } } },
    ],
  },
  { name: "sub", selector: { text: {} } },
];

const TR_SCHEMA_COUNTER = [
  {
    type: "grid",
    schema: [
      { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
      { name: "name", selector: { text: {} } },
    ],
  },
];

const TR_SCHEMA_STAT = [
  {
    type: "grid",
    schema: [
      { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
      { name: "name", selector: { text: {} } },
    ],
  },
  { name: "icon", selector: { icon: {} } },
];

const TR_SCHEMA_ACTION = [
  {
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "entity", selector: { entity: { filter: { domain: ["switch", "button", "script", "scene"] } } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "icon", selector: { icon: {} } },
      { name: "perform_action", selector: { text: {} } },
    ],
  },
];

class TransmissionStatusCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!this._built) {
      this._build();
      this._built = true;
    }
    this._update();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._built) return;
    // Un _update() complet à chaque changement d'état réinitialiserait les
    // champs en cours d'édition (notamment le sélecteur de couleur ouvert).
    if (first) this._update();
    else this._refreshHass();
  }

  /* Ne propage que hass aux formulaires, sans toucher aux valeurs saisies */
  _refreshHass() {
    this.shadowRoot.querySelectorAll("ha-form").forEach((f) => {
      f.hass = this._hass;
    });
  }

  /* N'écrase jamais un champ couleur qui a le focus */
  _setColor(sel, value) {
    const el = this.shadowRoot.querySelector(sel);
    if (!el) return;
    if (this.shadowRoot.activeElement === el) return;
    if (el.value !== value) el.value = value;
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _computeLabel(s) {
    return TRL[s.name] || s.name;
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom: 18px; }
        .sec-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 10px; padding-bottom: 6px;
          border-bottom: 1px solid var(--divider-color);
        }
        .sec-title { font-size: 15px; font-weight: 600; color: var(--primary-text-color); flex: 1; }
        .sec-hint {
          font-size: 12px; color: var(--secondary-text-color);
          margin: -4px 0 10px 0; line-height: 1.4;
        }
        .colors { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
        .color-field { display: flex; align-items: center; gap: 8px; }
        .color-field label { font-size: 13px; color: var(--primary-text-color); }
        .color-field input[type="color"] {
          width: 42px; height: 30px; padding: 0; border: none;
          border-radius: 6px; cursor: pointer; background: none;
        }
        .row {
          border: 1px solid var(--divider-color);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
          background: var(--secondary-background-color);
        }
        .row-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .row-num { font-size: 12px; font-weight: 600; flex: 1; color: var(--secondary-text-color); }
        .row-btns { display: flex; gap: 2px; }
        .iconbtn { --mdc-icon-button-size: 32px; --mdc-icon-size: 18px; color: var(--secondary-text-color); }
        .iconbtn.del { color: var(--error-color, #e24b4a); }
        .addbtn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; cursor: pointer;
          background: var(--secondary-background-color);
          border: 1px dashed var(--divider-color);
          font-size: 13px; color: var(--primary-text-color);
          user-select: none; transition: background .2s ease;
        }
        .addbtn:hover { background: var(--divider-color); }
        .empty {
          font-size: 12px; color: var(--secondary-text-color);
          font-style: italic; margin-bottom: 10px;
        }
      </style>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-general"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-down"><label>Téléchargement</label></div>
          <div class="color-field"><input type="color" class="c-up"><label>Téléversement</label></div>
          <div class="color-field"><input type="color" class="c-idle"><label>Inactif</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Arrêté</label></div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">Vitesses</span>
          <ha-switch class="sw-speeds"></ha-switch>
        </div>
        <div class="sec-hint">Vitesses actuelles avec courbes superposées. Échelle commune aux deux pour comparer honnêtement.</div>
        <ha-form class="f-speeds"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">Liste des torrents</span>
          <ha-switch class="sw-torrents"></ha-switch>
        </div>
        <div class="sec-hint">Lit l'attribut <code>torrent_info</code>. Choisis le capteur selon les torrents voulus : total, actifs, terminés…</div>
        <ha-form class="f-torrents"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Compteurs</span></div>
        <div class="sec-hint">Petite rangée. Le premier sert aussi au sous-titre de l'en-tête.</div>
        <div class="rows-counters"></div>
        <div class="addbtn add-counter"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un compteur</span></div>
      </div>

      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">Anneau ratio</span>
          <ha-switch class="sw-ring"></ha-switch>
        </div>
        <ha-form class="f-ring"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Statistiques</span></div>
        <div class="sec-hint">Lignes à droite de l'anneau. Session, total, ratio…</div>
        <div class="rows-stats"></div>
        <div class="addbtn add-stat"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une stat</span></div>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">Laisse "Action à exécuter" vide pour un simple toggle/press de l'entité.</div>
        <ha-form class="f-actions-label"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une action</span></div>
      </div>
    `;

    const r = this.shadowRoot;

    const wire = (sel, schema, handler) => {
      const f = r.querySelector(sel);
      f.schema = schema;
      f.computeLabel = this._computeLabel;
      f.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        handler(e.detail.value);
        this._emit();
      });
      return f;
    };

    wire(".f-general", TR_SCHEMA_GENERAL, (v) => {
      Object.assign(this._config, v);
      this._clean();
    });

    wire(".f-speeds", TR_SCHEMA_SPEEDS, (v) => {
      this._config.speeds = Object.assign({}, this._config.speeds, v);
    });

    wire(".f-torrents", TR_SCHEMA_TORRENTS, (v) => {
      this._config.torrents = Object.assign({}, this._config.torrents, v);
    });

    wire(".f-ring", TR_SCHEMA_RING, (v) => {
      const keep = this._config.ring ? this._config.ring.color : undefined;
      this._config.ring = Object.assign({}, this._config.ring, v);
      if (keep) this._config.ring.color = keep;
    });

    wire(".f-actions-label", [{ name: "actions_label", selector: { text: {} } }], (v) => {
      Object.assign(this._config, v);
      this._clean();
    });

    /* Couleurs */
    const colorMap = {
      ".c-down": "color_down",
      ".c-up": "color_up",
      ".c-idle": "color_idle",
      ".c-off": "color_off",
    };
    Object.keys(colorMap).forEach((sel) => {
      const el = r.querySelector(sel);
      const apply = (v) => {
        this._config[colorMap[sel]] = v;
        this._emit();
      };
      // "input" pendant le glissement (débounce), "change" à la validation
      let t = null;
      el.addEventListener("input", (e) => {
        const v = e.target.value;
        clearTimeout(t);
        t = setTimeout(() => apply(v), 200);
      });
      el.addEventListener("change", (e) => {
        clearTimeout(t);
        apply(e.target.value);
      });
    });

    /* Interrupteurs de section */
    r.querySelector(".sw-speeds").addEventListener("change", (e) => {
      if (e.target.checked) {
        this._config.speeds = this._config.speeds || { sparkline: true, hours: 6 };
      } else delete this._config.speeds;
      this._emit();
      this._update();
    });
    r.querySelector(".sw-torrents").addEventListener("change", (e) => {
      if (e.target.checked) {
        this._config.torrents = this._config.torrents || {
          max_items: 5, sort: "progress", percent_scale: "auto",
        };
      } else delete this._config.torrents;
      this._emit();
      this._update();
    });
    r.querySelector(".sw-ring").addEventListener("change", (e) => {
      if (e.target.checked) {
        this._config.ring = this._config.ring || { label: "Ratio", max: 2 };
      } else delete this._config.ring;
      this._emit();
      this._update();
    });

    /* Ajouts */
    r.querySelector(".add-counter").addEventListener("click", () => {
      this._config.counters = (this._config.counters || []).concat([{ entity: "", name: "" }]);
      this._emit();
      this._update(true);
    });
    r.querySelector(".add-stat").addEventListener("click", () => {
      this._config.stats = (this._config.stats || []).concat([{ entity: "", name: "" }]);
      this._emit();
      this._update(true);
    });
    r.querySelector(".add-action").addEventListener("click", () => {
      this._config.actions = (this._config.actions || []).concat([{ name: "", entity: "" }]);
      this._emit();
      this._update(true);
    });
  }

  _clean() {
    ["title", "turtle_entity", "status_entity", "actions_label"].forEach((k) => {
      if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
    });
  }

  _update(forceRows) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot;
    const c = this._config;

    const fg = r.querySelector(".f-general");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "",
      power_entity: c.power_entity || "",
      turtle_entity: c.turtle_entity || "",
      status_entity: c.status_entity || "",
    };

    this._setColor(".c-down", c.color_down || "#378ADD");
    this._setColor(".c-up", c.color_up || "#1D9E75");
    this._setColor(".c-idle", c.color_idle || "#8a8a86");
    this._setColor(".c-off", c.color_off || "#E24B4A");

    const hasSpeeds = !!c.speeds;
    r.querySelector(".sw-speeds").checked = hasSpeeds;
    const fs = r.querySelector(".f-speeds");
    fs.style.display = hasSpeeds ? "" : "none";
    if (hasSpeeds) {
      fs.hass = this._hass;
      fs.data = {
        download: c.speeds.download || "",
        upload: c.speeds.upload || "",
        sparkline: c.speeds.sparkline !== false,
        hours: c.speeds.hours || 6,
      };
    }

    const hasTor = !!c.torrents;
    r.querySelector(".sw-torrents").checked = hasTor;
    const ft = r.querySelector(".f-torrents");
    ft.style.display = hasTor ? "" : "none";
    if (hasTor) {
      ft.hass = this._hass;
      ft.data = {
        source: c.torrents.source || "",
        label: c.torrents.label || "",
        max_items: c.torrents.max_items || 5,
        sort: c.torrents.sort || "progress",
        percent_scale: c.torrents.percent_scale || "auto",
      };
    }

    const hasRing = !!c.ring;
    r.querySelector(".sw-ring").checked = hasRing;
    const fr = r.querySelector(".f-ring");
    fr.style.display = hasRing ? "" : "none";
    if (hasRing) {
      fr.hass = this._hass;
      fr.data = {
        entity: c.ring.entity || "",
        label: c.ring.label || "Ratio",
        max: c.ring.max || 2,
        sub: c.ring.sub || "",
      };
    }

    const fal = r.querySelector(".f-actions-label");
    fal.hass = this._hass;
    fal.data = { actions_label: c.actions_label || "" };

    this._syncRows("counters", ".rows-counters", TR_SCHEMA_COUNTER, forceRows);
    this._syncRows("stats", ".rows-stats", TR_SCHEMA_STAT, forceRows);
    this._syncRows("actions", ".rows-actions", TR_SCHEMA_ACTION, forceRows);
  }

  _syncRows(key, selector, schema, force) {
    const container = this.shadowRoot.querySelector(selector);
    const list = this._config[key] || [];
    const existing = container.querySelectorAll(".row");

    if (force || existing.length !== list.length) {
      container.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "Aucun élément. Utilise le bouton ci-dessous.";
        container.appendChild(e);
      }
      list.forEach((item, i) => {
        container.appendChild(this._buildRow(key, schema, item, i, list.length));
      });
    } else {
      existing.forEach((row, i) => {
        const form = row.querySelector("ha-form");
        form.hass = this._hass;
        form.data = Object.assign({}, list[i]);
      });
    }
  }

  _buildRow(key, schema, item, index, total) {
    const row = document.createElement("div");
    row.className = "row";

    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = "#" + (index + 1);
    head.appendChild(num);

    const btns = document.createElement("div");
    btns.className = "row-btns";
    const mkBtn = (icon, cls, handler, disabled) => {
      const b = document.createElement("ha-icon-button");
      b.className = "iconbtn " + cls;
      b.disabled = !!disabled;
      const ic = document.createElement("ha-icon");
      ic.setAttribute("icon", icon);
      b.appendChild(ic);
      b.addEventListener("click", handler);
      return b;
    };
    btns.appendChild(mkBtn("mdi:arrow-up", "up", () => this._move(key, index, -1), index === 0));
    btns.appendChild(mkBtn("mdi:arrow-down", "down", () => this._move(key, index, 1), index === total - 1));
    btns.appendChild(mkBtn("mdi:delete-outline", "del", () => {
      this._config[key] = this._config[key].filter((_, i) => i !== index);
      if (!this._config[key].length) delete this._config[key];
      this._emit();
      this._update(true);
    }));
    head.appendChild(btns);
    row.appendChild(head);

    const form = document.createElement("ha-form");
    form.schema = schema;
    form.computeLabel = this._computeLabel;
    form.hass = this._hass;
    form.data = Object.assign({}, item);
    form.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const list = (this._config[key] || []).slice();
      const merged = Object.assign({}, list[index], e.detail.value);
      Object.keys(merged).forEach((k) => {
        if (merged[k] === "" || merged[k] === undefined) delete merged[k];
      });
      if (list[index] && list[index].color) merged.color = list[index].color;
      list[index] = merged;
      this._config[key] = list;
      this._emit();
    });
    row.appendChild(form);

    const cf = document.createElement("div");
    cf.className = "color-field";
    cf.style.marginTop = "8px";
    const ci = document.createElement("input");
    ci.type = "color";
    ci.value = item.color || "#378ADD";
    const applyRowColor = (v) => {
      const list = (this._config[key] || []).slice();
      list[index] = Object.assign({}, list[index], { color: v });
      this._config[key] = list;
      this._emit();
    };
    let rt = null;
    ci.addEventListener("input", (e) => {
      const v = e.target.value;
      clearTimeout(rt);
      rt = setTimeout(() => applyRowColor(v), 200);
    });
    ci.addEventListener("change", (e) => {
      clearTimeout(rt);
      applyRowColor(e.target.value);
    });
    const cl = document.createElement("label");
    cl.textContent = "Couleur";
    cf.appendChild(ci);
    cf.appendChild(cl);
    row.appendChild(cf);

    return row;
  }

  _move(key, index, dir) {
    const list = (this._config[key] || []).slice();
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const tmp = list[index];
    list[index] = list[target];
    list[target] = tmp;
    this._config[key] = list;
    this._emit();
    this._update(true);
  }
}

customElements.define("transmission-status-card-editor", TransmissionStatusCardEditor);
}

/* ---- src/cards/network/dns-card.js ---- */
{
/**
 * DNS Status Card — custom Lovelace card (vanilla JS, zéro dépendance HACS)
 * Version 2 : sparkline historique + sections entièrement configurables
 *
 * Installation :
 *  1. Copier ce fichier dans  config/www/dns-card.js
 *  2. Settings → Dashboards → (menu ⋮) → Resources → Add resource
 *       URL : /local/dns-card.js
 *       Type : JavaScript Module
 *  3. Vider le cache navigateur (Ctrl+Shift+R)
 *
 * TOUTES les sections sont optionnelles : retire une clé du YAML, le bloc disparaît.
 * Voir le bloc EXEMPLE DE CONFIG en bas de fichier.
 */

const DNS_CARD_VERSION = "2.1.1";

class DnsStatusCard extends HTMLElement {
  /* ================= CONFIG ================= */
  setConfig(config) {
    if (!config.power_entity) {
      throw new Error("La clé 'power_entity' est requise (switch de protection).");
    }
    this._config = {
      title: config.title || "DNS",
      power_entity: config.power_entity,
      accent: config.accent || "#1D9E75",
      accent_off: config.accent_off || "#E24B4A",
      icon_on: config.icon_on || "mdi:shield-check",
      icon_off: config.icon_off || "mdi:shield-off",
      state_on: config.state_on || "Protection active",
      state_off: config.state_off || "Protection désactivée",
      state_paused: config.state_paused || "Désactivé (temporaire)",
      status_dot: config.status_dot !== false,
      subtitle_entity: config.subtitle_entity || null,
      subtitle_suffix: config.subtitle_suffix || "",
      hero: config.hero || null,
      panels: config.panels || [],
      secondary: config.secondary || [],
      actions_label: config.actions_label || null,
      actions: config.actions || [],
    };
    this._built = false;
    this._history = null;
    this._historyFetchedAt = 0;
  }

  /* ================= CYCLE DE VIE ================= */
  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;

    if (!this._built) {
      this._build();
      this._built = true;
    }

    // Re-render seulement si un état surveillé a changé
    const sig = this._stateSignature(hass);
    if (sig !== this._lastSignature) {
      this._lastSignature = sig;
      this._render();
    }

    // Historique : au premier chargement puis toutes les 5 minutes
    if (this._config.hero && this._config.hero.sparkline) {
      const age = Date.now() - this._historyFetchedAt;
      if (first || age > 300000) {
        this._fetchHistory();
      }
    }
  }

  _watchedEntities() {
    const c = this._config;
    const ids = [c.power_entity];
    if (c.subtitle_entity) ids.push(c.subtitle_entity);
    if (c.hero && c.hero.entity) ids.push(c.hero.entity);
    c.panels.forEach((p) => {
      if (p.entity) ids.push(p.entity);
      if (p.ratio_of) ids.push(p.ratio_of);
    });
    c.secondary.forEach((s) => s.entity && ids.push(s.entity));
    return [...new Set(ids)];
  }

  _stateSignature(hass) {
    return this._watchedEntities()
      .map((id) => id + ":" + (hass.states[id] ? hass.states[id].state : "∅"))
      .join("|");
  }

  /* ================= HISTORIQUE (sparkline) ================= */
  async _fetchHistory() {
    const hero = this._config.hero;
    if (!hero || !hero.entity) return;
    const hours = hero.hours || 24;
    const start = new Date(Date.now() - hours * 3600000).toISOString();
    const url =
      "history/period/" + start +
      "?filter_entity_id=" + encodeURIComponent(hero.entity) +
      "&minimal_response&no_attributes&significant_changes_only=0";

    try {
      const res = await this._hass.callApi("GET", url);
      const series = Array.isArray(res) && res[0] ? res[0] : [];
      const points = series
        .map((p) => parseFloat(p.state))
        .filter((v) => !isNaN(v));
      this._history = points.length > 1 ? points : null;
      this._historyFetchedAt = Date.now();
      this._render();
    } catch (err) {
      console.warn("[dns-status-card] Historique indisponible :", err);
      this._history = null;
      this._historyFetchedAt = Date.now();
    }
  }

  /* ================= SQUELETTE DOM ================= */
  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          border-radius: 14px; padding: 0; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          background: var(--card-background-color, #181a1b);
          transition: border-color .3s ease, box-shadow .3s ease;
        }

        /* --- En-tête --- */
        .header {
          padding: 18px 18px 0 18px;
          display: flex; align-items: center; gap: 13px;
          cursor: pointer;
        }
        .avatar { position: relative; width: 50px; height: 50px; flex-shrink: 0; }
        .avatar .disc {
          position: absolute; inset: 0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          transition: background .3s ease;
        }
        .avatar ha-icon { --mdc-icon-size: 26px; transition: color .3s ease; }
        .dot {
          position: absolute; top: 1px; right: 1px;
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid var(--card-background-color, #181a1b);
          transition: background .3s ease;
        }
        .htext { flex: 1; min-width: 0; }
        .htitle {
          font-size: 16px; font-weight: 600; letter-spacing: -0.2px;
          color: var(--primary-text-color);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hsub { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
        .hstate { font-size: 12px; font-weight: 600; transition: color .3s ease; }
        .hsep { color: var(--disabled-text-color); font-size: 11px; }
        .hmeta { font-size: 11px; color: var(--secondary-text-color); }
        .toggle {
          width: 44px; height: 25px; border-radius: 13px; position: relative;
          cursor: pointer; flex-shrink: 0; transition: background .3s ease;
        }
        .knob {
          width: 19px; height: 19px; border-radius: 50%; background: #fff;
          position: absolute; top: 3px; transition: left .25s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,.35);
        }

        /* --- Héros + sparkline --- */
        .hero { padding: 16px 18px 12px 18px; cursor: pointer; }
        .hero-top {
          display: flex; align-items: flex-end;
          justify-content: space-between; margin-bottom: 6px; gap: 10px;
        }
        .hero-label { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 1px; }
        .hero-value {
          font-size: 26px; font-weight: 700; line-height: 1.1;
          letter-spacing: -0.5px; color: var(--primary-text-color);
        }
        .delta {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 20px; flex-shrink: 0;
        }
        .delta ha-icon { --mdc-icon-size: 13px; }
        .delta span { font-size: 11px; font-weight: 600; }
        .spark { width: 100%; height: 46px; display: block; }

        /* --- Panneaux --- */
        .panels { padding: 0 18px 14px 18px; display: grid; gap: 10px; }
        .panel {
          background: rgba(255,255,255,0.035); border-radius: 11px;
          padding: 13px 14px; cursor: pointer; transition: background .2s ease;
        }
        .panel:hover { background: rgba(255,255,255,0.07); }
        .panel-head { display: flex; align-items: center; gap: 6px; margin-bottom: 9px; }
        .panel-head ha-icon { --mdc-icon-size: 15px; }
        .panel-head span { font-size: 11px; color: var(--secondary-text-color); }
        .panel-value {
          font-size: 19px; font-weight: 700; letter-spacing: -0.3px;
          color: var(--primary-text-color);
        }
        .track {
          margin-top: 9px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.08); overflow: hidden;
        }
        .fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
        .panel-foot { font-size: 10px; color: var(--disabled-text-color); margin-top: 5px; }
        .panel.ring { display: flex; align-items: center; gap: 12px; }
        .panel.ring svg { width: 56px; height: 56px; flex-shrink: 0; }
        .ring-side { min-width: 0; }
        .ring-side .rl { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 3px; }
        .ring-side .rv { font-size: 13px; font-weight: 600; color: var(--primary-text-color); }
        .ring-side .rs { font-size: 10px; color: var(--disabled-text-color); margin-top: 3px; }

        /* --- Stats secondaires --- */
        .secondary { padding: 0 18px 14px 18px; display: flex; gap: 6px; flex-wrap: wrap; }
        .sec {
          flex: 1; min-width: 62px; text-align: center;
          background: rgba(255,255,255,0.035); border-radius: 9px;
          padding: 9px 6px; cursor: pointer; transition: background .2s ease;
        }
        .sec:hover { background: rgba(255,255,255,0.07); }
        .sec .sv { font-size: 15px; font-weight: 600; }
        .sec .sn { font-size: 9.5px; color: var(--disabled-text-color); margin-top: 2px; }

        /* --- Actions --- */
        .footer {
          padding: 12px 18px 15px 18px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.015);
        }
        .footer-label { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; }
        .footer-label ha-icon { --mdc-icon-size: 13px; color: var(--disabled-text-color); }
        .footer-label span { font-size: 10.5px; color: var(--disabled-text-color); letter-spacing: .3px; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .action {
          flex: 1; min-width: 50px; text-align: center;
          display: flex; align-items: center; justify-content: center; gap: 5px;
          padding: 8px 4px; border-radius: 8px; cursor: pointer;
          background: rgba(255,255,255,0.045);
          font-size: 12px; font-weight: 600; color: var(--primary-text-color);
          transition: background .2s ease, transform .1s ease;
          user-select: none;
        }
        .action:hover { background: rgba(255,255,255,0.1); }
        .action:active { transform: scale(0.95); }
        .action ha-icon { --mdc-icon-size: 14px; }
        .action.fired { background: rgba(29,158,117,0.25); }
        .hidden { display: none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="avatar">
            <div class="disc"><ha-icon></ha-icon></div>
            <div class="dot"></div>
          </div>
          <div class="htext">
            <div class="htitle"></div>
            <div class="hsub">
              <span class="hstate"></span>
              <span class="hsep hidden">·</span>
              <span class="hmeta hidden"></span>
            </div>
          </div>
          <div class="toggle"><div class="knob"></div></div>
        </div>

        <div class="hero hidden">
          <div class="hero-top">
            <div>
              <div class="hero-label"></div>
              <div class="hero-value"></div>
            </div>
            <div class="delta hidden"><ha-icon></ha-icon><span></span></div>
          </div>
          <svg class="spark hidden" viewBox="0 0 340 46" preserveAspectRatio="none">
            <path class="spark-area" fill="none"></path>
            <path class="spark-line" fill="none" stroke-width="1.8"
                  stroke-linejoin="round" stroke-linecap="round"></path>
            <circle class="spark-head" r="2.8"></circle>
          </svg>
        </div>

        <div class="panels hidden"></div>
        <div class="secondary hidden"></div>
        <div class="footer hidden">
          <div class="footer-label hidden"><ha-icon icon="mdi:pause-circle-outline"></ha-icon><span></span></div>
          <div class="actions"></div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelector(".toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      this._hass.callService("switch", "toggle", { entity_id: this._config.power_entity });
    });
    this.shadowRoot.querySelector(".header").addEventListener("click", () => {
      this._fireMoreInfo(this._config.power_entity);
    });
  }

  /* ================= RENDU ================= */
  _render() {
    const hass = this._hass;
    const c = this._config;
    const root = this.shadowRoot;
    const powerState = hass.states[c.power_entity];
    const on = powerState && powerState.state === "on";
    const accent = on ? c.accent : c.accent_off;

    /* --- Card : halo + bordure réactifs --- */
    const card = root.querySelector("ha-card");
    card.style.borderColor = this._rgba(accent, 0.3);
    card.style.boxShadow = "0 0 28px " + this._rgba(accent, 0.12);

    /* --- En-tête --- */
    const disc = root.querySelector(".disc");
    const icon = disc.querySelector("ha-icon");
    disc.style.background = this._rgba(accent, 0.14);
    icon.setAttribute("icon", on ? c.icon_on : c.icon_off);
    icon.style.color = accent;

    const dot = root.querySelector(".dot");
    dot.classList.toggle("hidden", !c.status_dot);
    dot.style.background = accent;

    root.querySelector(".htitle").textContent = c.title;

    const hstate = root.querySelector(".hstate");
    const until = powerState && powerState.attributes
      ? powerState.attributes.temporary_disable_until
      : null;
    hstate.textContent = on ? c.state_on : until ? c.state_paused : c.state_off;
    hstate.style.color = accent;

    const sep = root.querySelector(".hsep");
    const meta = root.querySelector(".hmeta");
    if (c.subtitle_entity) {
      const st = hass.states[c.subtitle_entity];
      const txt = st ? (this._fmt(st.state) + " " + c.subtitle_suffix).trim() : "";
      meta.textContent = txt;
      sep.classList.toggle("hidden", !txt);
      meta.classList.toggle("hidden", !txt);
    } else {
      sep.classList.add("hidden");
      meta.classList.add("hidden");
    }

    const toggle = root.querySelector(".toggle");
    toggle.style.background = on ? accent : "rgba(255,255,255,0.2)";
    root.querySelector(".knob").style.left = on ? "22px" : "3px";

    /* --- Héros --- */
    const hero = root.querySelector(".hero");
    if (c.hero && c.hero.entity) {
      hero.classList.remove("hidden");
      const st = hass.states[c.hero.entity];
      root.querySelector(".hero-label").textContent =
        c.hero.label || (st && st.attributes.friendly_name) || c.hero.entity;
      root.querySelector(".hero-value").textContent = st ? this._fmt(st.state) : "—";
      hero.onclick = () => this._fireMoreInfo(c.hero.entity);
      this._renderSpark(c.hero);
    } else {
      hero.classList.add("hidden");
    }

    /* --- Panneaux --- */
    const panels = root.querySelector(".panels");
    if (c.panels.length) {
      panels.classList.remove("hidden");
      panels.style.gridTemplateColumns = "repeat(" + Math.min(c.panels.length, 2) + ", 1fr)";
      panels.innerHTML = "";
      c.panels.forEach((p) => panels.appendChild(this._buildPanel(p)));
    } else {
      panels.classList.add("hidden");
    }

    /* --- Stats secondaires --- */
    const sec = root.querySelector(".secondary");
    if (c.secondary.length) {
      sec.classList.remove("hidden");
      sec.innerHTML = "";
      c.secondary.forEach((s) => {
        const st = hass.states[s.entity];
        const el = document.createElement("div");
        el.className = "sec";
        el.innerHTML =
          '<div class="sv" style="color:' + (s.color || "var(--primary-text-color)") + '">' +
          (st ? this._fmt(st.state) : "—") + "</div>" +
          '<div class="sn">' + (s.name || (st && st.attributes.friendly_name) || s.entity) + "</div>";
        el.addEventListener("click", () => this._fireMoreInfo(s.entity));
        sec.appendChild(el);
      });
    } else {
      sec.classList.add("hidden");
    }

    /* --- Actions --- */
    const footer = root.querySelector(".footer");
    if (c.actions.length) {
      footer.classList.remove("hidden");
      const fl = root.querySelector(".footer-label");
      fl.classList.toggle("hidden", !c.actions_label);
      if (c.actions_label) fl.querySelector("span").textContent = c.actions_label;

      const actions = root.querySelector(".actions");
      actions.innerHTML = "";
      c.actions.forEach((a) => {
        const el = document.createElement("div");
        el.className = "action";
        el.innerHTML =
          (a.icon
            ? '<ha-icon icon="' + a.icon + '" style="color:' + (a.color || "inherit") + '"></ha-icon>'
            : "") +
          "<span>" + a.name + "</span>";
        el.addEventListener("click", () => {
          const domain = a.entity.split(".")[0];
          const service =
            a.service ||
            (domain === "button" ? "press" : domain === "switch" ? "toggle" : "turn_on");
          this._hass.callService(domain, service, { entity_id: a.entity });
          el.classList.add("fired");
          setTimeout(() => el.classList.remove("fired"), 600);
        });
        actions.appendChild(el);
      });
    } else {
      footer.classList.add("hidden");
    }
  }

  /* --- Panneau (bar ou ring) --- */
  _buildPanel(p) {
    const hass = this._hass;
    const st = hass.states[p.entity];
    const val = st ? parseFloat(st.state) : NaN;
    const color = p.color || "var(--primary-color)";
    const el = document.createElement("div");

    let pct = null;
    if (p.ratio_of) {
      const denState = hass.states[p.ratio_of];
      const den = denState ? parseFloat(denState.state) : NaN;
      if (den && !isNaN(val)) pct = (val / den) * 100;
    }

    const label = p.name || (st && st.attributes.friendly_name) || p.entity;

    if (p.type === "ring") {
      const shown = pct !== null ? pct : 0;
      const dash = Math.min(Math.max(shown, 0), 100) * 1.068; // circonférence r=17 ≈ 106.8
      el.className = "panel ring";
      el.innerHTML =
        '<svg viewBox="0 0 42 42">' +
          '<circle cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4.5"></circle>' +
          '<circle cx="21" cy="21" r="17" fill="none" stroke="' + color + '" stroke-width="4.5" ' +
                  'stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ',106.8" ' +
                  'transform="rotate(-90 21 21)"></circle>' +
          '<text x="21" y="' + (p.ring_label ? "19.5" : "24") + '" text-anchor="middle" ' +
                'style="font-size:9.5px;font-weight:700;fill:var(--primary-text-color)">' +
            (pct !== null ? pct.toFixed(1).replace(".", ",") : "—") +
          "</text>" +
          (p.ring_label
            ? '<text x="21" y="27" text-anchor="middle" ' +
              'style="font-size:5.5px;fill:var(--secondary-text-color)">' + p.ring_label + "</text>"
            : "") +
        "</svg>" +
        '<div class="ring-side">' +
          '<div class="rl">' + label + "</div>" +
          '<div class="rv">' + (st ? this._fmt(st.state) : "—") + "</div>" +
          (p.unit ? '<div class="rs">' + p.unit + "</div>" : "") +
        "</div>";
    } else {
      el.className = "panel";
      el.innerHTML =
        '<div class="panel-head">' +
          (p.icon ? '<ha-icon icon="' + p.icon + '" style="color:' + color + '"></ha-icon>' : "") +
          "<span>" + label + "</span>" +
        "</div>" +
        '<div class="panel-value">' + (st ? this._fmt(st.state) : "—") + "</div>" +
        (pct !== null
          ? '<div class="track"><div class="fill" style="width:' +
            Math.min(pct, 100).toFixed(1) + "%;background:" + color + '"></div></div>' +
            '<div class="panel-foot">' + pct.toFixed(1).replace(".", ",") +
            " % " + (p.foot || "du total") + "</div>"
          : p.foot
            ? '<div class="panel-foot">' + p.foot + "</div>"
            : "");
    }

    el.addEventListener("click", () => this._fireMoreInfo(p.entity));
    return el;
  }

  /* --- Sparkline SVG à partir de l'historique --- */
  _renderSpark(hero) {
    const root = this.shadowRoot;
    const svg = root.querySelector(".spark");
    const delta = root.querySelector(".delta");
    const pts = this._history;

    if (!hero.sparkline || !pts || pts.length < 2) {
      svg.classList.add("hidden");
      delta.classList.add("hidden");
      return;
    }
    svg.classList.remove("hidden");

    const color = hero.color || "#378ADD";
    const W = 340, H = 46, PAD = 4;
    const min = Math.min.apply(null, pts);
    const max = Math.max.apply(null, pts);
    const span = max - min || 1;
    const stepX = W / (pts.length - 1);

    const coords = pts.map((v, i) => {
      const x = i * stepX;
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
      return [x, y];
    });

    const line = coords
      .map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1))
      .join(" ");
    const area = line + " L" + W + "," + H + " L0," + H + " Z";

    const lineEl = root.querySelector(".spark-line");
    lineEl.setAttribute("d", line);
    lineEl.setAttribute("stroke", color);
    const areaEl = root.querySelector(".spark-area");
    areaEl.setAttribute("d", area);
    areaEl.setAttribute("fill", this._rgba(color, 0.14));

    const head = root.querySelector(".spark-head");
    const last = coords[coords.length - 1];
    head.setAttribute("cx", last[0].toFixed(1));
    head.setAttribute("cy", last[1].toFixed(1));
    head.setAttribute("fill", color);

    /* Badge delta */
    if (hero.delta === false) {
      delta.classList.add("hidden");
      return;
    }
    const first = pts[0];
    const lastVal = pts[pts.length - 1];
    if (!first) {
      delta.classList.add("hidden");
      return;
    }
    const pct = ((lastVal - first) / Math.abs(first)) * 100;
    const up = pct >= 0;
    const dColor = up ? this._config.accent : "#8a8a86";
    delta.classList.remove("hidden");
    delta.style.background = this._rgba(dColor, 0.12);
    const dIcon = delta.querySelector("ha-icon");
    dIcon.setAttribute("icon", up ? "mdi:trending-up" : "mdi:trending-down");
    dIcon.style.color = dColor;
    const dSpan = delta.querySelector("span");
    dSpan.textContent = (up ? "+" : "") + pct.toFixed(1).replace(".", ",") + " %";
    dSpan.style.color = dColor;
  }

  /* ================= HELPERS ================= */
  _fmt(state) {
    const n = parseFloat(state);
    if (isNaN(n)) return state;
    return n.toLocaleString("fr-FR");
  }

  _rgba(color, a) {
    if (color.indexOf("var(") === 0 || color.indexOf("rgb") === 0) return color;
    const h = color.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  _fireMoreInfo(entityId) {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    let size = 2;
    if (c.hero) size += 2;
    if (c.panels.length) size += 1;
    if (c.secondary.length) size += 1;
    if (c.actions.length) size += 1;
    return size;
  }

  static getStubConfig() {
    return {
      type: "custom:dns-status-card",
      title: "DNS",
      power_entity: "switch.example",
    };
  }

  /* Active l'éditeur visuel dans l'interface Lovelace */
  static getConfigElement() {
    return document.createElement("dns-status-card-editor");
  }
}

customElements.define("dns-status-card", DnsStatusCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "dns-status-card",
  name: "DNS Status Card",
  description: "Carte DNS configurable avec sparkline (Technitium, AdGuard, Pi-hole…).",
});

console.info(
  "%c DNS-STATUS-CARD %c v" + DNS_CARD_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700",
  "color:#1D9E75;background:#222"
);

/* ============================================================
   EXEMPLE DE CONFIG COMPLET (à coller dans une card Manual)

type: custom:dns-status-card
title: Technitium DNS
power_entity: switch.enable_ad_blocking_dnsinterne
accent: "#1D9E75"
accent_off: "#E24B4A"
status_dot: true
subtitle_entity: sensor.dnsinterne_technitiumdns_clients_dnsinterne
subtitle_suffix: clients

hero:
  entity: sensor.dnsinterne_technitiumdns_total_queries_dnsinterne
  label: Requêtes · 24h
  color: "#378ADD"
  sparkline: true
  hours: 24
  delta: true

panels:
  - type: bar
    entity: sensor.dnsinterne_technitiumdns_blocked_queries_dnsinterne
    name: Bloquées
    icon: mdi:shield-off
    color: "#E24B4A"
    ratio_of: sensor.dnsinterne_technitiumdns_total_queries_dnsinterne
    foot: du trafic
  - type: ring
    entity: sensor.dnsinterne_technitiumdns_total_cached_dnsinterne
    name: Cache hit
    color: "#1D9E75"
    ratio_of: sensor.dnsinterne_technitiumdns_total_queries_dnsinterne
    ring_label: CACHE
    unit: réponses

secondary:
  - entity: sensor.dnsinterne_technitiumdns_total_no_error_dnsinterne
    name: NoError
  - entity: sensor.dnsinterne_technitiumdns_total_nx_domain_dnsinterne
    name: NXDomain
    color: "#BA7517"
  - entity: sensor.dnsinterne_technitiumdns_total_server_failure_dnsinterne
    name: SrvFail
    color: "#E24B4A"
  - entity: sensor.dnsinterne_technitiumdns_total_recursive_dnsinterne
    name: Récursif
    color: "#7F77DD"

actions_label: Suspendre la protection
actions:
  - name: 5m
    entity: button.disable_ad_blocking_for_5_minutes_dnsinterne
  - name: 10m
    entity: button.disable_ad_blocking_for_10_minutes_dnsinterne
  - name: 30m
    entity: button.disable_ad_blocking_for_30_minutes_dnsinterne
  - name: 1h
    entity: button.disable_ad_blocking_for_60_minutes_dnsinterne
  - name: 1j
    entity: button.disable_ad_blocking_for_1_day_dnsinterne

   ============================================================ */

/* ============================================================
   ÉDITEUR VISUEL — dns-status-card-editor
   Utilise <ha-form> (natif HA) pour les sélecteurs d'entités,
   d'icônes et les champs texte. Aucune dépendance externe.
   ============================================================ */

const L = {
  title: "Titre",
  power_entity: "Switch de protection (requis)",
  subtitle_entity: "Entité du sous-titre",
  subtitle_suffix: "Suffixe du sous-titre",
  status_dot: "Pastille d'état sur l'icône",
  icon_on: "Icône (protection active)",
  icon_off: "Icône (protection coupée)",
  state_on: "Texte (protection active)",
  state_off: "Texte (protection coupée)",
  state_paused: "Texte (pause temporaire)",
  entity: "Entité",
  label: "Libellé",
  sparkline: "Afficher la courbe historique",
  delta: "Afficher l'évolution en %",
  hours: "Fenêtre historique (heures)",
  type: "Type de panneau",
  name: "Nom affiché",
  icon: "Icône",
  ratio_of: "Entité dénominateur (pour le %)",
  foot: "Texte sous la barre",
  ring_label: "Mot dans l'anneau",
  unit: "Unité",
  actions_label: "Titre de la zone d'actions",
  service: "Service forcé (optionnel)",
};

const SCHEMA_GENERAL = [
  { name: "title", selector: { text: {} } },
  { name: "power_entity", required: true, selector: { entity: { filter: { domain: ["switch", "input_boolean"] } } } },
  {
    type: "grid",
    schema: [
      { name: "subtitle_entity", selector: { entity: { filter: { domain: ["sensor", "counter"] } } } },
      { name: "subtitle_suffix", selector: { text: {} } },
    ],
  },
  { name: "status_dot", selector: { boolean: {} } },
];

const SCHEMA_APPEARANCE = [
  {
    type: "grid",
    schema: [
      { name: "icon_on", selector: { icon: {} } },
      { name: "icon_off", selector: { icon: {} } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "state_on", selector: { text: {} } },
      { name: "state_off", selector: { text: {} } },
    ],
  },
  { name: "state_paused", selector: { text: {} } },
];

const SCHEMA_HERO = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor", "counter"] } } } },
  { name: "label", selector: { text: {} } },
  {
    type: "grid",
    schema: [
      { name: "sparkline", selector: { boolean: {} } },
      {
        name: "delta",
        visible: { field: "sparkline", value: true },
        selector: { boolean: {} },
      },
    ],
  },
  {
    name: "hours",
    visible: { field: "sparkline", value: true },
    selector: { number: { min: 1, max: 168, mode: "box" } },
  },
];

const SCHEMA_PANEL = [
  {
    type: "grid",
    schema: [
      {
        name: "type",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "bar", label: "Barre de progression" },
              { value: "ring", label: "Anneau" },
            ],
          },
        },
      },
      { name: "entity", selector: { entity: { filter: { domain: ["sensor", "counter"] } } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  { name: "ratio_of", selector: { entity: { filter: { domain: ["sensor", "counter"] } } } },
  {
    name: "foot",
    visible: { field: "type", operator: "not_eq", value: "ring" },
    selector: { text: {} },
  },
  {
    type: "grid",
    schema: [
      {
        name: "ring_label",
        visible: { field: "type", value: "ring" },
        selector: { text: {} },
      },
      {
        name: "unit",
        visible: { field: "type", value: "ring" },
        selector: { text: {} },
      },
    ],
  },
];

const SCHEMA_SECONDARY = [
  {
    type: "grid",
    schema: [
      { name: "entity", selector: { entity: { filter: { domain: ["sensor", "counter"] } } } },
      { name: "name", selector: { text: {} } },
    ],
  },
];

const SCHEMA_ACTION = [
  {
    type: "grid",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "entity", selector: { entity: { filter: { domain: ["button", "switch", "script", "scene"] } } } },
    ],
  },
  {
    type: "grid",
    schema: [
      { name: "icon", selector: { icon: {} } },
      { name: "service", selector: { text: {} } },
    ],
  },
];

class DnsStatusCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!this._built) {
      this._build();
      this._built = true;
    }
    this._update();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._built) return;
    // Un _update() complet à chaque changement d'état réinitialiserait les
    // champs en cours d'édition (notamment le sélecteur de couleur ouvert).
    if (first) this._update();
    else this._refreshHass();
  }

  /* Ne propage que hass aux formulaires, sans toucher aux valeurs saisies */
  _refreshHass() {
    this.shadowRoot.querySelectorAll("ha-form").forEach((f) => {
      f.hass = this._hass;
    });
  }

  /* N'écrase jamais un champ couleur qui a le focus */
  _setColor(sel, value) {
    const el = this.shadowRoot.querySelector(sel);
    if (!el) return;
    if (this.shadowRoot.activeElement === el) return;
    if (el.value !== value) el.value = value;
  }

  /* ---------- Émission de la config vers Lovelace ---------- */
  _emit() {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _computeLabel(s) {
    return L[s.name] || s.name;
  }

  /* ---------- Construction du squelette (une seule fois) ---------- */
  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .sec { margin-bottom: 18px; }
        .sec-head {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 10px; padding-bottom: 6px;
          border-bottom: 1px solid var(--divider-color);
        }
        .sec-title {
          font-size: 15px; font-weight: 600;
          color: var(--primary-text-color); flex: 1;
        }
        .sec-hint {
          font-size: 12px; color: var(--secondary-text-color);
          margin: -4px 0 10px 0; line-height: 1.4;
        }
        .colors { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
        .color-field { display: flex; align-items: center; gap: 8px; }
        .color-field label { font-size: 13px; color: var(--primary-text-color); }
        .color-field input[type="color"] {
          width: 42px; height: 30px; padding: 0; border: none;
          border-radius: 6px; cursor: pointer; background: none;
        }
        .row {
          border: 1px solid var(--divider-color);
          border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
          background: var(--secondary-background-color);
        }
        .row-head {
          display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
        }
        .row-num {
          font-size: 12px; font-weight: 600; flex: 1;
          color: var(--secondary-text-color);
        }
        .row-btns { display: flex; gap: 2px; }
        .iconbtn {
          --mdc-icon-button-size: 32px; --mdc-icon-size: 18px;
          color: var(--secondary-text-color);
        }
        .iconbtn.del { color: var(--error-color, #e24b4a); }
        .addbtn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; cursor: pointer;
          background: var(--secondary-background-color);
          border: 1px dashed var(--divider-color);
          font-size: 13px; color: var(--primary-text-color);
          user-select: none; transition: background .2s ease;
        }
        .addbtn:hover { background: var(--divider-color); }
        .empty {
          font-size: 12px; color: var(--secondary-text-color);
          font-style: italic; margin-bottom: 10px;
        }
        ha-formfield { display: block; margin-bottom: 8px; }
      </style>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-general"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field">
            <input type="color" class="c-accent">
            <label>Protection active</label>
          </div>
          <div class="color-field">
            <input type="color" class="c-accent-off">
            <label>Protection coupée</label>
          </div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Textes et icônes</span></div>
        <ha-form class="f-appearance"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head">
          <span class="sec-title">Bloc principal</span>
          <ha-switch class="sw-hero"></ha-switch>
        </div>
        <div class="sec-hint">Grand chiffre avec courbe historique. Nécessite que le recorder conserve l'entité.</div>
        <ha-form class="f-hero"></ha-form>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Panneaux</span></div>
        <div class="sec-hint">Maximum 2 recommandés (affichés côte à côte). Le dénominateur sert à calculer le pourcentage.</div>
        <div class="rows-panels"></div>
        <div class="addbtn add-panel"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un panneau</span></div>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Stats secondaires</span></div>
        <div class="sec-hint">Petite rangée en bas. 3 à 5 conseillés pour rester lisible sur mobile.</div>
        <div class="rows-secondary"></div>
        <div class="addbtn add-secondary"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une stat</span></div>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">Boutons du bas. Le service est déduit du domaine (button → press, switch → toggle).</div>
        <ha-form class="f-actions-label"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une action</span></div>
      </div>
    `;

    const r = this.shadowRoot;

    /* --- Formulaire général --- */
    const fGeneral = r.querySelector(".f-general");
    fGeneral.schema = SCHEMA_GENERAL;
    fGeneral.computeLabel = this._computeLabel;
    fGeneral.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      this._cleanEmpty();
      this._emit();
    });

    /* --- Formulaire apparence --- */
    const fApp = r.querySelector(".f-appearance");
    fApp.schema = SCHEMA_APPEARANCE;
    fApp.computeLabel = this._computeLabel;
    fApp.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      this._cleanEmpty();
      this._emit();
    });

    /* --- Couleurs --- */
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => {
        this._config[key] = v;
        this._emit();
      };
      let t = null;
      el.addEventListener("input", (e) => {
        const v = e.target.value;
        clearTimeout(t);
        t = setTimeout(() => apply(v), 200);
      });
      el.addEventListener("change", (e) => {
        clearTimeout(t);
        apply(e.target.value);
      });
    };
    bindColor(".c-accent", "accent");
    bindColor(".c-accent-off", "accent_off");

    /* --- Bloc héros --- */
    const swHero = r.querySelector(".sw-hero");
    swHero.addEventListener("change", (e) => {
      if (e.target.checked) {
        this._config.hero = this._config.hero || { sparkline: true, hours: 24, delta: true };
      } else {
        delete this._config.hero;
      }
      this._emit();
      this._update();
    });

    const fHero = r.querySelector(".f-hero");
    fHero.schema = SCHEMA_HERO;
    fHero.computeLabel = this._computeLabel;
    fHero.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const prevColor = this._config.hero ? this._config.hero.color : undefined;
      this._config.hero = Object.assign({}, this._config.hero, e.detail.value);
      if (prevColor) this._config.hero.color = prevColor;
      this._emit();
    });

    /* --- Titre de la zone d'actions --- */
    const fAL = r.querySelector(".f-actions-label");
    fAL.schema = [{ name: "actions_label", selector: { text: {} } }];
    fAL.computeLabel = this._computeLabel;
    fAL.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      this._cleanEmpty();
      this._emit();
    });

    /* --- Boutons d'ajout --- */
    r.querySelector(".add-panel").addEventListener("click", () => {
      this._config.panels = (this._config.panels || []).concat([
        { type: "bar", entity: "", name: "" },
      ]);
      this._emit();
      this._update(true);
    });
    r.querySelector(".add-secondary").addEventListener("click", () => {
      this._config.secondary = (this._config.secondary || []).concat([{ entity: "", name: "" }]);
      this._emit();
      this._update(true);
    });
    r.querySelector(".add-action").addEventListener("click", () => {
      this._config.actions = (this._config.actions || []).concat([{ name: "", entity: "" }]);
      this._emit();
      this._update(true);
    });
  }

  /* Retire les clés vides pour garder un YAML propre */
  _cleanEmpty() {
    ["title", "subtitle_entity", "subtitle_suffix", "actions_label",
     "icon_on", "icon_off", "state_on", "state_off", "state_paused"].forEach((k) => {
      if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
    });
  }

  /* ---------- Mise à jour (sans détruire le focus) ---------- */
  _update(forceRows) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot;
    const c = this._config;

    /* Général */
    const fGeneral = r.querySelector(".f-general");
    fGeneral.hass = this._hass;
    fGeneral.data = {
      title: c.title || "",
      power_entity: c.power_entity || "",
      subtitle_entity: c.subtitle_entity || "",
      subtitle_suffix: c.subtitle_suffix || "",
      status_dot: c.status_dot !== false,
    };

    /* Apparence */
    const fApp = r.querySelector(".f-appearance");
    fApp.hass = this._hass;
    fApp.data = {
      icon_on: c.icon_on || "mdi:shield-check",
      icon_off: c.icon_off || "mdi:shield-off",
      state_on: c.state_on || "Protection active",
      state_off: c.state_off || "Protection désactivée",
      state_paused: c.state_paused || "Désactivé (temporaire)",
    };

    /* Couleurs */
    this._setColor(".c-accent", c.accent || "#1D9E75");
    this._setColor(".c-accent-off", c.accent_off || "#E24B4A");

    /* Héros */
    const hasHero = !!c.hero;
    r.querySelector(".sw-hero").checked = hasHero;
    const fHero = r.querySelector(".f-hero");
    fHero.style.display = hasHero ? "" : "none";
    if (hasHero) {
      fHero.hass = this._hass;
      fHero.data = {
        entity: c.hero.entity || "",
        label: c.hero.label || "",
        sparkline: c.hero.sparkline !== false,
        delta: c.hero.delta !== false,
        hours: c.hero.hours || 24,
      };
    }

    /* Titre zone actions */
    const fAL = r.querySelector(".f-actions-label");
    fAL.hass = this._hass;
    fAL.data = { actions_label: c.actions_label || "" };

    /* Listes répétables */
    this._syncRows("panels", ".rows-panels", SCHEMA_PANEL, forceRows);
    this._syncRows("secondary", ".rows-secondary", SCHEMA_SECONDARY, forceRows);
    this._syncRows("actions", ".rows-actions", SCHEMA_ACTION, forceRows);
  }

  /* Reconstruit les lignes seulement si le nombre a changé,
     sinon met juste à jour les données (préserve le focus) */
  _syncRows(key, selector, schema, force) {
    const container = this.shadowRoot.querySelector(selector);
    const list = this._config[key] || [];
    const existing = container.querySelectorAll(".row");

    if (force || existing.length !== list.length) {
      container.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "Aucun élément. Utilise le bouton ci-dessous.";
        container.appendChild(e);
      }
      list.forEach((item, i) => {
        container.appendChild(this._buildRow(key, schema, item, i, list.length));
      });
    } else {
      existing.forEach((row, i) => {
        const form = row.querySelector("ha-form");
        form.hass = this._hass;
        form.data = Object.assign({}, list[i]);
      });
    }
  }

  _buildRow(key, schema, item, index, total) {
    const row = document.createElement("div");
    row.className = "row";

    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = "#" + (index + 1);
    head.appendChild(num);

    const btns = document.createElement("div");
    btns.className = "row-btns";

    const mkBtn = (icon, cls, handler, disabled) => {
      const b = document.createElement("ha-icon-button");
      b.className = "iconbtn " + cls;
      b.disabled = !!disabled;
      const ic = document.createElement("ha-icon");
      ic.setAttribute("icon", icon);
      b.appendChild(ic);
      b.addEventListener("click", handler);
      return b;
    };

    btns.appendChild(
      mkBtn("mdi:arrow-up", "up", () => this._move(key, index, -1), index === 0)
    );
    btns.appendChild(
      mkBtn("mdi:arrow-down", "down", () => this._move(key, index, 1), index === total - 1)
    );
    btns.appendChild(
      mkBtn("mdi:delete-outline", "del", () => {
        this._config[key] = this._config[key].filter((_, i) => i !== index);
        if (!this._config[key].length) delete this._config[key];
        this._emit();
        this._update(true);
      })
    );
    head.appendChild(btns);
    row.appendChild(head);

    const form = document.createElement("ha-form");
    form.schema = schema;
    form.computeLabel = this._computeLabel;
    form.hass = this._hass;
    form.data = Object.assign({}, item);
    form.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const list = (this._config[key] || []).slice();
      const merged = Object.assign({}, list[index], e.detail.value);
      Object.keys(merged).forEach((k) => {
        if (merged[k] === "" || merged[k] === undefined) delete merged[k];
      });
      // Conserve la couleur (gérée hors ha-form)
      if (list[index] && list[index].color) merged.color = list[index].color;
      list[index] = merged;
      this._config[key] = list;
      this._emit();
    });
    row.appendChild(form);

    /* Sélecteur de couleur pour la ligne */
    const cf = document.createElement("div");
    cf.className = "color-field";
    cf.style.marginTop = "8px";
    const ci = document.createElement("input");
    ci.type = "color";
    ci.value = item.color || (key === "panels" ? "#378ADD" : "#8a8a86");
    const applyRowColor = (v) => {
      const list = (this._config[key] || []).slice();
      list[index] = Object.assign({}, list[index], { color: v });
      this._config[key] = list;
      this._emit();
    };
    let rt = null;
    ci.addEventListener("input", (e) => {
      const v = e.target.value;
      clearTimeout(rt);
      rt = setTimeout(() => applyRowColor(v), 200);
    });
    ci.addEventListener("change", (e) => {
      clearTimeout(rt);
      applyRowColor(e.target.value);
    });
    const cl = document.createElement("label");
    cl.textContent = "Couleur";
    cf.appendChild(ci);
    cf.appendChild(cl);
    row.appendChild(cf);

    return row;
  }

  _move(key, index, dir) {
    const list = (this._config[key] || []).slice();
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const tmp = list[index];
    list[index] = list[target];
    list[target] = tmp;
    this._config[key] = list;
    this._emit();
    this._update(true);
  }
}

customElements.define("dns-status-card-editor", DnsStatusCardEditor);
}

/* ---- src/cards/network/unifi-ap-card.js ---- */
{
/**
 * UniFi AP Card — bornes WiFi (multi-AP dans une seule carte)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/unifi-ap-card.js
 *  2. Resources → /local/perso/unifi-ap-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const UAP_VERSION = "1.1.1";

const aRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const aFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const aUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const aEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aOnline = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

class UnifiApCard extends HTMLElement {
  setConfig(config) {
    if (!config.aps || !config.aps.length) {
      throw new Error("La clé 'aps' est requise (au moins une borne).");
    }
    this._config = {
      title: config.title || "Bornes WiFi",
      icon: config.icon || "mdi:wifi",
      accent: config.accent || "#7F77DD",
      color_ok: config.color_ok || "#1D9E75",
      color_ko: config.color_ko || "#E24B4A",
      color_rx: config.color_rx || "#378ADD",
      color_tx: config.color_tx || "#1D9E75",
      show_system: config.show_system !== false,
      aps: config.aps,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.aps.forEach((a) => {
      ["state", "clients", "rx", "tx", "cpu", "memory", "uptime", "update"].forEach((k) => {
        if (a[k]) ids.push(a[k]);
      });
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _build() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { border-radius:14px; padding:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.07);
          background:var(--card-background-color,#181a1b);
          transition:border-color .3s ease; }
        .header { padding:15px 15px 12px 15px; display:flex; align-items:center; gap:12px; }
        .disc { width:42px; height:42px; border-radius:50%; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; }
        .disc ha-icon { --mdc-icon-size:22px; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color); }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:7px; }
        .ap { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; }
        .ap:hover { background:rgba(255,255,255,0.07); }
        .ap-top { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .ap-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ap-cli { font-size:12px; font-weight:700; }
        .ap-top ha-icon { --mdc-icon-size:13px; color:var(--disabled-text-color); }
        .ap-foot { display:flex; gap:14px; font-size:10px;
          color:var(--disabled-text-color); align-items:center; }
        .ap-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .ap-foot .sys { flex:1; text-align:right; }
        .ap-up { display:flex; align-items:center; gap:5px; margin-top:6px;
          padding-top:6px; border-top:1px solid rgba(255,255,255,0.05);
          font-size:10px; color:var(--disabled-text-color); }
        .ap-up ha-icon { --mdc-icon-size:11px; }
        .ap-off { opacity:.5; }
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

    const disc = r.querySelector(".disc");
    disc.style.background = aRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;

    r.querySelector("ha-card").style.borderColor = aRgba(c.accent, 0.28);
    r.querySelector(".htitle").textContent = c.title;

    /* Total clients toutes bornes */
    let total = 0, hasTotal = false;
    c.aps.forEach((a) => {
      if (a.clients && hass.states[a.clients]) {
        const n = parseFloat(hass.states[a.clients].state);
        if (!isNaN(n)) { total += n; hasTotal = true; }
      }
    });
    r.querySelector(".hsub").textContent =
      c.aps.length + " borne" + (c.aps.length > 1 ? "s" : "") +
      (hasTotal ? " · " + total.toLocaleString("fr-FR") + " clients" : "");

    /* Lignes */
    const list = r.querySelector(".list");
    list.innerHTML = "";
    c.aps.forEach((a) => {
      const stState = a.state ? hass.states[a.state] : null;
      const on = a.state ? aOnline(stState) : true;
      const el = document.createElement("div");
      el.className = "ap" + (on === false ? " ap-off" : "");

      const cliSt = a.clients ? hass.states[a.clients] : null;
      const rxSt = a.rx ? hass.states[a.rx] : null;
      const txSt = a.tx ? hass.states[a.tx] : null;
      const cpuSt = a.cpu ? hass.states[a.cpu] : null;
      const memSt = a.memory ? hass.states[a.memory] : null;

      const foot = [];
      if (rxSt) foot.push('<span><ha-icon icon="mdi:arrow-down" style="color:' + c.color_rx +
        '"></ha-icon> ' + aFmt(rxSt) + " " + aEsc(aUnit(rxSt)) + "</span>");
      if (txSt) foot.push('<span><ha-icon icon="mdi:arrow-up" style="color:' + c.color_tx +
        '"></ha-icon> ' + aFmt(txSt) + " " + aEsc(aUnit(txSt)) + "</span>");

      const sysBits = [];
      if (c.show_system && cpuSt) sysBits.push("CPU " + aFmt(cpuSt, 0) + aEsc(aUnit(cpuSt)));
      if (c.show_system && memSt) sysBits.push("RAM " + aFmt(memSt, 0) + aEsc(aUnit(memSt)));
      if (sysBits.length) foot.push('<span class="sys">' + sysBits.join(" · ") + "</span>");

      /* L'uptime a sa propre ligne : il ne doit jamais être écrasé par CPU/RAM */
      const upSt = a.uptime ? hass.states[a.uptime] : null;
      const upLine = upSt
        ? '<div class="ap-up"><ha-icon icon="mdi:clock-outline"></ha-icon>' +
          "<span>Actif depuis " + aEsc(upSt.state) + "</span></div>"
        : "";

      el.innerHTML =
        '<div class="ap-top">' +
          '<span class="dot" style="background:' + (on === false ? c.color_ko : c.color_ok) + '"></span>' +
          '<span class="ap-name">' + aEsc(a.name || (stState && stState.attributes.friendly_name) || "Borne") + "</span>" +
          (cliSt ? '<span class="ap-cli" style="color:' + c.accent + '">' + aFmt(cliSt, 0) + "</span>" +
                   '<ha-icon icon="mdi:account-multiple"></ha-icon>' : "") +
        "</div>" +
        (foot.length ? '<div class="ap-foot">' + foot.join("") + "</div>" : "") +
        upLine;

      el.addEventListener("click", () =>
        this._more(a.more_info || a.clients || a.state));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.aps.length; }
  static getStubConfig() {
    return { type: "custom:unifi-ap-card", title: "Bornes WiFi", aps: [{ name: "Borne 1" }] };
  }
  static getConfigElement() { return document.createElement("unifi-ap-card-editor"); }
}
customElements.define("unifi-ap-card", UnifiApCard);

/* ================= ÉDITEUR ================= */
const UAP_L = {
  title: "Titre", icon: "Icône", show_system: "Afficher CPU / RAM",
  name: "Nom de la borne", state: "Capteur d'état", clients: "Nombre de clients",
  rx: "Réception", tx: "Émission", cpu: "Processeur", memory: "Mémoire",
  uptime: "Temps de fonctionnement", more_info: "Entité au clic (optionnel)",
};
const UAP_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "show_system", selector: { boolean: {} } },
];
const UAP_S_AP = [
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "state", selector: { entity: { filter: { domain: ["sensor", "binary_sensor", "device_tracker"] } } } },
    { name: "clients", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "cpu", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "memory", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { name: "uptime", selector: { entity: { filter: { domain: ["sensor"] } } } },
];

class UnifiApCardEditor extends HTMLElement {
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
  _label(s) { return UAP_L[s.name] || s.name; }

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
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
          <div class="color-field"><input type="color" class="c-ok"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-ko"><label>Hors ligne</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Bornes</span></div>
        <div class="sec-hint">Une ligne par borne. Laisse un champ vide s'il n'existe pas chez toi.</div>
        <div class="rows-aps"></div>
        <div class="addbtn add-ap"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une borne</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = UAP_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-accent", "accent");
    bindColor(".c-ok", "color_ok");
    bindColor(".c-ko", "color_ko");
    r.querySelector(".add-ap").addEventListener("click", () => {
      this._config.aps = (this._config.aps || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:wifi",
      show_system: c.show_system !== false,
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");
    this._setColor(".c-ok", c.color_ok || "#1D9E75");
    this._setColor(".c-ko", c.color_ko || "#E24B4A");

    const box = r.querySelector(".rows-aps");
    const list = c.aps || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucune borne.";
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
    num.textContent = item.name ? item.name : "Borne #" + (index + 1);
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
      this._config.aps = this._config.aps.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = UAP_S_AP; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.aps || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      l[index] = m; this._config.aps = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.aps || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.aps = l; this._emit(); this._update(true);
  }
}
customElements.define("unifi-ap-card-editor", UnifiApCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-ap-card",
  name: "UniFi AP Card",
  description: "Bornes WiFi UniFi : clients, trafic, CPU/RAM par borne.",
});
console.info("%c UNIFI-AP-CARD %c v" + UAP_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-ap-card
title: Bornes WiFi
icon: mdi:wifi
accent: "#7F77DD"
show_system: true
aps:
  - name: U7 Pro Bureau
    state: sensor.u7_pro_state
    clients: sensor.u7_pro_clients
    rx: sensor.u7_pro_bureau_reception
    tx: sensor.u7_pro_bureau_emission
    cpu: sensor.u7_pro_bureau_cpu_utilization
    memory: sensor.u7_pro_bureau_memory_utilization
    uptime: sensor.u7_pro_uptime
  - name: U7 Pro Wall Salon
    state: sensor.u7_pro_wall_state
    clients: sensor.u7_pro_wall_clients
    cpu: sensor.u7_pro_wall_salon_cpu_utilization
    memory: sensor.u7_pro_wall_salon_memory_utilization
    uptime: sensor.u7_pro_wall_uptime
============================================================ */

}

/* ---- src/cards/network/unifi-clients-card.js ---- */
{
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

}

/* ---- src/cards/network/unifi-gateway-card.js ---- */
{
/**
 * UniFi Gateway Card — custom Lovelace card (vanilla JS, zéro dépendance)
 * Version 1.0.0 — pour UCG / UDM / USG
 *
 * Installation :
 *  1. config/www/perso/unifi-gateway-card.js
 *  2. Resources → /local/perso/unifi-gateway-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 *
 * Config exemple en bas de fichier.
 */

const UGW_VERSION = "1.2.0";

/* ---------- Helpers partagés ---------- */
const uRgba = (color, a) => {
  if (!color || color.indexOf("var(") === 0 || color.indexOf("rgb") === 0) return color;
  const h = color.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const uNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const uFmt = (st, digits) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits === undefined ? 2 : digits });
};
const uUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const uEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uOnline = (st) => {
  if (!st) return false;
  const s = String(st.state).toLowerCase();
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

/* Formate une vitesse de liaison (Mbit/s) en libellé court : 2500 → "2,5G" */
function ugwLinkLabel(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "" || s === "0" || s === "none") return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return String(raw);
  if (n <= 0) return null;
  if (n >= 1000) {
    const g = n / 1000;
    return (g % 1 === 0 ? g.toFixed(0) : g.toFixed(1).replace(".", ",")) + "G";
  }
  return n.toFixed(0) + "M";
}

class UnifiGatewayCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Passerelle",
      icon: config.icon || "mdi:router-network",
      accent: config.accent || "#378ADD",
      accent_off: config.accent_off || "#E24B4A",
      state_entity: config.state_entity || null,
      clients_entity: config.clients_entity || null,
      uptime_entity: config.uptime_entity || null,
      update_entity: config.update_entity || null,
      wan: config.wan || [],
      latency: config.latency || [],
      latency_max: config.latency_max || 50,
      latency_warn: config.latency_warn || 30,
      latency_label: config.latency_label || "Latence WAN",
      columns: config.columns || 5,
      ports_label: config.ports_label || "PORTS",
      speed_colors: config.speed_colors || {},
      ports: config.ports || [],
      system: config.system || [],
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const c = this._config;
    const ids = [];
    [c.state_entity, c.clients_entity, c.uptime_entity, c.update_entity].forEach((x) => x && ids.push(x));
    c.wan.forEach((w) => { if (w.download) ids.push(w.download); if (w.upload) ids.push(w.upload); });
    c.latency.forEach((l) => l.entity && ids.push(l.entity));
    c.ports.forEach((p) => { ["link_speed", "rx", "tx"].forEach((k) => p[k] && ids.push(p[k])); });
    c.system.forEach((s) => s.entity && ids.push(s.entity));
    return [...new Set(ids)];
  }

  _sig(hass) {
    return this._ids().map((id) => id + ":" + (hass.states[id] ? hass.states[id].state : "∅")).join("|");
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
        .badge { padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600; flex-shrink:0; }
        .subline { padding:8px 15px 0 15px; display:flex; align-items:center; gap:6px;
          font-size:10.5px; color:var(--disabled-text-color); cursor:pointer; }
        .subline ha-icon { --mdc-icon-size:12px; }
        .wan { padding:14px 15px 10px 15px; display:grid; gap:9px; }
        .wanbox { background:rgba(255,255,255,0.035); border-radius:10px; padding:10px 12px; cursor:pointer;
          transition:background .2s ease; }
        .wanbox:hover { background:rgba(255,255,255,0.07); }
        .wanhead { display:flex; align-items:center; gap:5px; margin-bottom:6px; }
        .wanhead ha-icon { --mdc-icon-size:13px; }
        .wanhead span { font-size:10px; color:var(--secondary-text-color); }
        .wanval { font-size:19px; font-weight:700; color:var(--primary-text-color); letter-spacing:-.3px; }
        .wanval em { font-size:10px; font-weight:500; font-style:normal;
          color:var(--secondary-text-color); margin-left:2px; }
        .ports { padding:0 15px 12px 15px; display:grid; gap:6px; }
        .port { border-radius:8px; padding:9px 3px; text-align:center; cursor:pointer;
          transition:transform .1s ease, background .2s ease; }
        .port:active { transform:scale(.95); }
        .port .pn { font-size:9px; color:var(--disabled-text-color); }
        .port ha-icon { --mdc-icon-size:15px; margin:3px 0; display:block; }
        .port .ps { font-size:9.5px; font-weight:600; }
        .sect { padding:0 15px 12px 15px; }
        .sect-lbl { font-size:10px; color:var(--disabled-text-color); margin-bottom:7px; letter-spacing:.3px; }
        .lat { display:flex; align-items:center; gap:9px; margin-bottom:6px; cursor:pointer; }
        .lat-n { font-size:10.5px; color:var(--secondary-text-color); width:68px; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .lat-t { flex:1; height:5px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .lat-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .lat-v { font-size:11px; font-weight:600; color:var(--primary-text-color);
          width:48px; text-align:right; flex-shrink:0; }
        .sys { padding:0 15px 14px 15px; display:flex; gap:7px; }
        .sysbox { flex:1; background:rgba(255,255,255,0.035); border-radius:9px; padding:8px 6px;
          text-align:center; cursor:pointer; transition:background .2s ease; }
        .sysbox:hover { background:rgba(255,255,255,0.07); }
        .sysbox .v { font-size:15px; font-weight:700; }
        .sysbox .n { font-size:9.5px; color:var(--disabled-text-color); margin-top:2px; }
        .hidden { display:none !important; }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div class="htext"><div class="htitle"></div><div class="hsub"></div></div>
          <div class="badge hidden"></div>
        </div>
        <div class="subline hidden"><ha-icon icon="mdi:clock-outline"></ha-icon><span></span></div>
        <div class="wan hidden"></div>
        <div class="sect ports-sect hidden"><div class="sect-lbl"></div></div>
        <div class="ports hidden"></div>
        <div class="sect lat-sect hidden"><div class="sect-lbl"></div><div class="lat-body"></div></div>
        <div class="sys hidden"></div>
      </ha-card>`;
    this.shadowRoot.querySelector(".header").addEventListener("click", () => {
      this._more(this._config.state_entity || this._config.clients_entity);
    });
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const stateSt = c.state_entity ? hass.states[c.state_entity] : null;
    const online = c.state_entity ? uOnline(stateSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = uRgba(accent, 0.3);
    card.style.boxShadow = "0 0 24px " + uRgba(accent, 0.1);

    const disc = r.querySelector(".disc");
    disc.style.background = uRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    /* Sous-titre : état · uptime · clients */
    const bits = [];
    if (stateSt) bits.push('<b style="color:' + accent + '">' + uEsc(stateSt.state) + "</b>");
    else bits.push('<b style="color:' + accent + '">' + (online ? "En ligne" : "Hors ligne") + "</b>");
    if (c.clients_entity && hass.states[c.clients_entity]) {
      bits.push(uFmt(hass.states[c.clients_entity], 0) + " clients");
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    /* Uptime sur sa propre ligne */
    const sub = r.querySelector(".subline");
    const upSt = c.uptime_entity ? hass.states[c.uptime_entity] : null;
    if (upSt) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Actif depuis " + upSt.state;
      sub.onclick = () => this._more(c.uptime_entity);
    } else sub.classList.add("hidden");

    /* Badge firmware */
    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ dispo" : "À jour";
      badge.style.background = uRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* WAN */
    const wanEl = r.querySelector(".wan");
    const wanBoxes = [];
    c.wan.forEach((w) => {
      if (w.download) wanBoxes.push({ e: w.download, n: (w.name || "WAN") + " ↓", i: "mdi:arrow-down", col: c.accent });
      if (w.upload) wanBoxes.push({ e: w.upload, n: (w.name || "WAN") + " ↑", i: "mdi:arrow-up", col: "#1D9E75" });
    });
    if (wanBoxes.length) {
      wanEl.classList.remove("hidden");
      wanEl.style.gridTemplateColumns = "repeat(" + Math.min(wanBoxes.length, 2) + ",1fr)";
      wanEl.innerHTML = "";
      wanBoxes.forEach((b) => {
        const st = hass.states[b.e];
        const d = document.createElement("div");
        d.className = "wanbox";
        d.innerHTML =
          '<div class="wanhead"><ha-icon icon="' + b.i + '" style="color:' + b.col + '"></ha-icon>' +
          "<span>" + uEsc(b.n) + "</span></div>" +
          '<div class="wanval">' + uFmt(st) + (uUnit(st) ? "<em>" + uEsc(uUnit(st)) + "</em>" : "") + "</div>";
        d.addEventListener("click", () => this._more(b.e));
        wanEl.appendChild(d);
      });
    } else wanEl.classList.add("hidden");

    /* Ports */
    const portsSect = r.querySelector(".ports-sect");
    const grid = r.querySelector(".ports");
    if (c.ports.length) {
      portsSect.classList.remove("hidden");
      grid.classList.remove("hidden");
      grid.style.gridTemplateColumns = "repeat(" + c.columns + ",1fr)";
      grid.innerHTML = "";

      let activePorts = 0;
      const portData = c.ports.map((p) => {
        const lsSt = p.link_speed ? hass.states[p.link_speed] : null;
        const label = lsSt ? ugwLinkLabel(lsSt.state) : null;
        const mbits = lsSt ? parseFloat(lsSt.state) : NaN;
        const up = label !== null;
        if (up) activePorts++;
        return { p: p, label: label, up: up,
                 color: up ? this._portColor(isNaN(mbits) ? 1000 : mbits) : null };
      });

      portsSect.querySelector(".sect-lbl").textContent =
        (c.ports_label || "PORTS") + " · " + activePorts + "/" + c.ports.length + " actifs";

      portData.forEach((d, i) => {
        const el = document.createElement("div");
        el.className = "port";
        const col = d.color || "#4a4a48";
        el.style.background = d.up ? uRgba(col, 0.1) : "rgba(255,255,255,0.03)";
        el.style.border = "1px solid " + (d.up ? uRgba(col, 0.25) : "rgba(255,255,255,0.06)");

        const tips = [];
        if (d.p.rx && hass.states[d.p.rx]) {
          tips.push("↓ " + uFmt(hass.states[d.p.rx]) + " " + uUnit(hass.states[d.p.rx]));
        }
        if (d.p.tx && hass.states[d.p.tx]) {
          tips.push("↑ " + uFmt(hass.states[d.p.tx]) + " " + uUnit(hass.states[d.p.tx]));
        }
        el.title = (d.p.name || "Port " + (i + 1)) + (tips.length ? "\n" + tips.join("\n") : "");

        el.innerHTML =
          '<div class="pn">' + uEsc(d.p.name || "P" + (i + 1)) + "</div>" +
          '<ha-icon icon="' + (d.up ? "mdi:lan-connect" : "mdi:lan-disconnect") +
            '" style="color:' + col + '"></ha-icon>' +
          '<div class="ps" style="color:' + col + '">' + (d.label || "—") + "</div>";
        el.addEventListener("click", () => this._more(d.p.link_speed || d.p.rx || d.p.tx));
        grid.appendChild(el);
      });
    } else {
      portsSect.classList.add("hidden");
      grid.classList.add("hidden");
    }

    /* Latences */
    const latSect = r.querySelector(".lat-sect");
    if (c.latency.length) {
      latSect.classList.remove("hidden");
      latSect.querySelector(".sect-lbl").textContent = c.latency_label;
      const body = r.querySelector(".lat-body");
      body.innerHTML = "";
      c.latency.forEach((l) => {
        const st = hass.states[l.entity];
        const v = uNum(st);
        const pct = isNaN(v) ? 0 : Math.min((v / c.latency_max) * 100, 100);
        const col = isNaN(v) ? "#4a4a48" : v >= c.latency_warn ? "#BA7517" : "#1D9E75";
        const d = document.createElement("div");
        d.className = "lat";
        d.innerHTML =
          '<span class="lat-n">' + uEsc(l.name || (st && st.attributes.friendly_name) || l.entity) + "</span>" +
          '<span class="lat-t"><span class="lat-f" style="display:block;width:' + pct.toFixed(1) +
            "%;background:" + col + '"></span></span>' +
          '<span class="lat-v">' + (isNaN(v) ? "—" : uFmt(st, 0) + " " + (uUnit(st) || "ms")) + "</span>";
        d.addEventListener("click", () => this._more(l.entity));
        body.appendChild(d);
      });
    } else latSect.classList.add("hidden");

    /* Système */
    const sys = r.querySelector(".sys");
    if (c.system.length) {
      sys.classList.remove("hidden");
      sys.innerHTML = "";
      c.system.forEach((s) => {
        const st = hass.states[s.entity];
        const d = document.createElement("div");
        d.className = "sysbox";
        d.innerHTML =
          '<div class="v" style="color:' + (s.color || "var(--primary-text-color)") + '">' +
            uFmt(st, s.digits === undefined ? 0 : s.digits) + uEsc(uUnit(st)) + "</div>" +
          '<div class="n">' + uEsc(s.name || (st && st.attributes.friendly_name) || s.entity) + "</div>";
        d.addEventListener("click", () => this._more(s.entity));
        sys.appendChild(d);
      });
    } else sys.classList.add("hidden");
  }

  /* Couleur d'un port selon sa vitesse de liaison */
  _portColor(mbits) {
    const custom = this._config.speed_colors;
    if (mbits === null) return null;
    if (custom[String(mbits)]) return custom[String(mbits)];
    if (mbits >= 10000) return "#BA7517";
    if (mbits >= 2500) return "#1D9E75";
    if (mbits >= 1000) return "#378ADD";
    return "#7F77DD";
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() {
    const c = this._config;
    return 2 + (c.wan.length ? 2 : 0) +
      (c.ports.length ? Math.ceil(c.ports.length / c.columns) + 1 : 0) +
      (c.latency.length ? 2 : 0) + (c.system.length ? 1 : 0);
  }

  static getStubConfig() {
    return { type: "custom:unifi-gateway-card", title: "Passerelle" };
  }
  static getConfigElement() {
    return document.createElement("unifi-gateway-card-editor");
  }
}
customElements.define("unifi-gateway-card", UnifiGatewayCard);

/* ================= ÉDITEUR ================= */
const UGW_L = {
  title: "Titre", icon: "Icône", state_entity: "Capteur d'état",
  clients_entity: "Nombre de clients", uptime_entity: "Temps de fonctionnement",
  update_entity: "Entité de mise à jour", latency_label: "Titre de la section latence",
  latency_max: "Latence max de l'échelle (ms)", latency_warn: "Seuil d'alerte (ms)",
  name: "Nom affiché", download: "Descendant (download)", upload: "Montant (upload)",
  entity: "Entité", digits: "Décimales",
  columns: "Colonnes dans la grille", ports_label: "Titre de la section ports",
  link_speed: "Vitesse de liaison", rx: "Réception", tx: "Émission",
};

const UGW_S_GENERAL = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "state_entity", selector: { entity: { filter: { domain: ["sensor", "binary_sensor", "device_tracker"] } } } },
    { name: "clients_entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
  { type: "grid", schema: [
    { name: "uptime_entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "update_entity", selector: { entity: { filter: { domain: ["update"] } } } },
  ]},
];
const UGW_S_LATOPT = [
  { name: "latency_label", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "latency_max", selector: { number: { min: 5, max: 500, mode: "box" } } },
    { name: "latency_warn", selector: { number: { min: 1, max: 500, mode: "box" } } },
  ]},
];
const UGW_S_WAN = [
  { name: "name", selector: { text: {} } },
  { type: "grid", schema: [
    { name: "download", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "upload", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const UGW_S_LAT = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { name: "name", selector: { text: {} } },
];
const UGW_S_PORTOPT = [
  { type: "grid", schema: [
    { name: "ports_label", selector: { text: {} } },
    { name: "columns", selector: { number: { min: 2, max: 12, mode: "box" } } },
  ]},
];
const UGW_S_PORT = [
  { name: "name", selector: { text: {} } },
  { name: "link_speed", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { type: "grid", schema: [
    { name: "rx", selector: { entity: { filter: { domain: ["sensor"] } } } },
    { name: "tx", selector: { entity: { filter: { domain: ["sensor"] } } } },
  ]},
];
const UGW_S_SYS = [
  { name: "entity", selector: { entity: { filter: { domain: ["sensor"] } } } },
  { name: "name", selector: { text: {} } },
  { name: "digits", selector: { number: { min: 0, max: 3, mode: "box" } } },
];

class UnifiGatewayCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    const first = !this._hass;
    this._hass = h;
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
  _label(s) { return UGW_L[s.name] || s.name; }

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
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Hors ligne</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Liens WAN</span></div>
        <div class="sec-hint">Un bloc par lien (fibre, 4G…). Descendant et montant s'affichent côte à côte.</div>
        <div class="rows-wan"></div>
        <div class="addbtn add-wan"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un lien WAN</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Ports</span></div>
        <div class="sec-hint">Grille colorée par vitesse : 10G ambre, 2.5G vert, 1G bleu, en dessous violet. Un port sans vitesse de liaison s'affiche déconnecté. Survole un port pour voir son trafic.</div>
        <ha-form class="f-portopt"></ha-form>
        <div class="rows-ports"></div>
        <div class="addbtn add-port"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un port</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Latences</span></div>
        <div class="sec-hint">Barres comparatives. L'échelle commune rend la comparaison honnête.</div>
        <ha-form class="f-latopt"></ha-form>
        <div class="rows-lat"></div>
        <div class="addbtn add-lat"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une latence</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Système</span></div>
        <div class="sec-hint">CPU, mémoire, température… Rangée du bas.</div>
        <div class="rows-sys"></div>
        <div class="addbtn add-sys"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une mesure</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", UGW_S_GENERAL, (v) => { Object.assign(this._config, v); this._clean(); });
    wire(".f-latopt", UGW_S_LATOPT, (v) => { Object.assign(this._config, v); });
    wire(".f-portopt", UGW_S_PORTOPT, (v) => { Object.assign(this._config, v); });

    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-on", "accent");
    bindColor(".c-off", "accent_off");

    const add = (cls, key, item) => r.querySelector(cls).addEventListener("click", () => {
      this._config[key] = (this._config[key] || []).concat([item]);
      this._emit(); this._update(true);
    });
    add(".add-wan", "wan", { name: "" });
    r.querySelector(".add-port").addEventListener("click", () => {
      const n = (this._config.ports || []).length + 1;
      this._config.ports = (this._config.ports || []).concat([{ name: "P" + n }]);
      this._emit(); this._update(true);
    });
    add(".add-lat", "latency", { entity: "", name: "" });
    add(".add-sys", "system", { entity: "", name: "" });
  }

  _clean() {
    ["title", "state_entity", "clients_entity", "uptime_entity", "update_entity"].forEach((k) => {
      if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "", icon: c.icon || "mdi:router-network",
      state_entity: c.state_entity || "", clients_entity: c.clients_entity || "",
      uptime_entity: c.uptime_entity || "", update_entity: c.update_entity || "",
    };
    const fl = r.querySelector(".f-latopt");
    fl.hass = this._hass;
    fl.data = {
      latency_label: c.latency_label || "Latence WAN",
      latency_max: c.latency_max || 50, latency_warn: c.latency_warn || 30,
    };
    const fp = r.querySelector(".f-portopt");
    fp.hass = this._hass;
    fp.data = { ports_label: c.ports_label || "PORTS", columns: c.columns || 5 };
    this._setColor(".c-on", c.accent || "#378ADD");
    this._setColor(".c-off", c.accent_off || "#E24B4A");
    this._rows("wan", ".rows-wan", UGW_S_WAN, force);
    this._rows("ports", ".rows-ports", UGW_S_PORT, force);
    this._rows("latency", ".rows-lat", UGW_S_LAT, force);
    this._rows("system", ".rows-sys", UGW_S_SYS, force);
  }

  _rows(key, sel, schema, force) {
    const box = this.shadowRoot.querySelector(sel);
    const list = this._config[key] || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun élément.";
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
    num.textContent = key === "ports" ? (item.name || "Port #" + (index + 1)) : "#" + (index + 1);
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
    f.schema = schema; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const list = (this._config[key] || []).slice();
      const m = Object.assign({}, list[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (list[index] && list[index].color) m.color = list[index].color;
      list[index] = m; this._config[key] = list; this._emit();
    });
    row.appendChild(f);

    if (key === "system") {
      const cf = document.createElement("div");
      cf.className = "color-field"; cf.style.marginTop = "8px";
      const ci = document.createElement("input");
      ci.type = "color"; ci.value = item.color || "#378ADD";
      const apply = (v) => {
        const list = (this._config[key] || []).slice();
        list[index] = Object.assign({}, list[index], { color: v });
        this._config[key] = list; this._emit();
      };
      let t = null;
      ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
      const cl = document.createElement("label"); cl.textContent = "Couleur";
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
customElements.define("unifi-gateway-card-editor", UnifiGatewayCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-gateway-card",
  name: "UniFi Gateway Card",
  description: "Passerelle UniFi : WAN, latences, CPU/RAM/température.",
});
console.info("%c UNIFI-GATEWAY-CARD %c v" + UGW_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-gateway-card
title: UCG Max
icon: mdi:router-network
state_entity: sensor.ucg_max_state
clients_entity: sensor.ucg_max_clients
uptime_entity: sensor.ucg_max_uptime
update_entity: update.ucg_max
wan:
  - name: WAN Fibre
    download: sensor.REMPLACE_debit_descendant
    upload: sensor.REMPLACE_debit_montant
latency_label: Latence WAN
latency_max: 50
latency_warn: 30
latency:
  - entity: sensor.ucg_max_cloudflare_wan_latency
    name: Cloudflare
  - entity: sensor.ucg_max_google_wan_latency
    name: Google
  - entity: sensor.ucg_max_microsoft_wan_latency
    name: Microsoft
ports_label: PORTS
columns: 5
ports:
  - name: P1
    link_speed: sensor.ucg_max_port_1_link_speed
    rx: sensor.ucg_max_port_1_rx
    tx: sensor.ucg_max_port_1_tx
  - name: P2
    link_speed: sensor.ucg_max_port_2_link_speed
    rx: sensor.ucg_max_port_2_rx
    tx: sensor.ucg_max_port_2_tx
  - name: P3
    link_speed: sensor.ucg_max_port_3_link_speed
    rx: sensor.ucg_max_port_3_rx
    tx: sensor.ucg_max_port_3_tx
  - name: P4
    link_speed: sensor.ucg_max_port_4_link_speed
    rx: sensor.ucg_max_port_4_rx
    tx: sensor.ucg_max_port_4_tx
  - name: P5
    link_speed: sensor.ucg_max_port_5_link_speed
    rx: sensor.ucg_max_port_5_rx
    tx: sensor.ucg_max_port_5_tx
system:
  - entity: sensor.ucg_max_cpu_utilization
    name: CPU
    color: "#378ADD"
  - entity: sensor.ucg_max_memory_utilization
    name: RAM
    color: "#7F77DD"
  - entity: sensor.ucg_max_cpu_temperature
    name: Temp
    color: "#BA7517"
============================================================ */
}

/* ---- src/cards/network/unifi-switch-card.js ---- */
{
/**
 * UniFi Switch Card — grille de ports avec vitesse de lien
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/unifi-switch-card.js
 *  2. Resources → /local/perso/unifi-switch-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const USW_VERSION = "1.1.1";

const sRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const sFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const sUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const sEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sOnline = (st) => {
  if (!st) return true;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "home" || s === "online" || s === "en ligne" ||
         s === "connected" || s === "ok";
};

/* Formate une vitesse de lien en Mbit/s vers un libellé court */
function linkLabel(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "" || s === "0" || s === "none") return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return String(raw);
  if (n <= 0) return null;
  if (n >= 1000) {
    const g = n / 1000;
    return (g % 1 === 0 ? g.toFixed(0) : g.toFixed(1).replace(".", ",")) + "G";
  }
  return n.toFixed(0) + "M";
}

class UnifiSwitchCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Switch",
      icon: config.icon || "mdi:switch",
      accent: config.accent || "#1D9E75",
      accent_off: config.accent_off || "#E24B4A",
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
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const c = this._config, ids = [];
    [c.state_entity, c.clients_entity, c.uptime_entity, c.update_entity].forEach((x) => x && ids.push(x));
    c.ports.forEach((p) => { ["link_speed", "rx", "tx"].forEach((k) => p[k] && ids.push(p[k])); });
    c.totals.forEach((t) => t.entity && ids.push(t.entity));
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Couleur d'un port selon sa vitesse */
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
      this._more(this._config.state_entity || this._config.clients_entity);
    });
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
    const stateSt = c.state_entity ? hass.states[c.state_entity] : null;
    const online = c.state_entity ? sOnline(stateSt) : true;
    const accent = online ? c.accent : c.accent_off;

    const card = r.querySelector("ha-card");
    card.style.borderColor = sRgba(accent, 0.28);
    card.style.boxShadow = "0 0 24px " + sRgba(accent, 0.09);

    const disc = r.querySelector(".disc");
    disc.style.background = sRgba(accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = accent;

    r.querySelector(".htitle").textContent = c.title;

    /* Ports actifs = ceux avec une vitesse de lien exploitable */
    let active = 0;
    const portData = c.ports.map((p) => {
      const lsSt = p.link_speed ? hass.states[p.link_speed] : null;
      const label = lsSt ? linkLabel(lsSt.state) : null;
      const mbits = lsSt ? parseFloat(lsSt.state) : NaN;
      const up = label !== null;
      if (up) active++;
      return { p: p, label: label, color: up ? this._portColor(isNaN(mbits) ? 1000 : mbits) : null, up: up };
    });

    const bits = [];
    bits.push('<b style="color:' + accent + '">' +
      sEsc(stateSt ? stateSt.state : online ? "En ligne" : "Hors ligne") + "</b>");
    if (c.ports.length) bits.push(active + "/" + c.ports.length + " ports actifs");
    if (c.clients_entity && hass.states[c.clients_entity]) {
      bits.push(sFmt(hass.states[c.clients_entity], 0) + " clients");
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    /* L'uptime a sa propre ligne : il ne doit jamais être tronqué */
    const sub = r.querySelector(".subline");
    const upSt = c.uptime_entity ? hass.states[c.uptime_entity] : null;
    if (upSt) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Actif depuis " + upSt.state;
      sub.onclick = () => this._more(c.uptime_entity);
      sub.style.cursor = "pointer";
    } else sub.classList.add("hidden");

    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ dispo" : "À jour";
      badge.style.background = sRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* Grille de ports */
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

        /* Info-bulle : trafic du port */
        const tips = [];
        if (d.p.rx && hass.states[d.p.rx]) {
          tips.push("↓ " + sFmt(hass.states[d.p.rx]) + " " + sUnit(hass.states[d.p.rx]));
        }
        if (d.p.tx && hass.states[d.p.tx]) {
          tips.push("↑ " + sFmt(hass.states[d.p.tx]) + " " + sUnit(hass.states[d.p.tx]));
        }
        el.title = (d.p.name || "Port " + (i + 1)) + (tips.length ? "\n" + tips.join("\n") : "");

        el.innerHTML =
          '<div class="pn">' + sEsc(d.p.name || "P" + (i + 1)) + "</div>" +
          '<ha-icon icon="' + (d.up ? "mdi:lan-connect" : "mdi:lan-disconnect") +
            '" style="color:' + col + '"></ha-icon>' +
          '<div class="ps" style="color:' + col + '">' + (d.label || "—") + "</div>";
        el.addEventListener("click", () => this._more(d.p.link_speed || d.p.rx || d.p.tx));
        grid.appendChild(el);
      });
    } else grid.classList.add("hidden");

    /* Totaux */
    const tot = r.querySelector(".totals");
    if (c.totals.length) {
      tot.classList.remove("hidden");
      tot.innerHTML = "";
      c.totals.forEach((t) => {
        const st = hass.states[t.entity];
        const el = document.createElement("div");
        el.className = "tot";
        el.innerHTML =
          '<div class="v" style="color:' + (t.color || "var(--primary-text-color)") + '">' +
            sFmt(st, t.digits === undefined ? 1 : t.digits) +
            (sUnit(st) ? " " + sEsc(sUnit(st)) : "") + "</div>" +
          '<div class="n">' + sEsc(t.name || (st && st.attributes.friendly_name) || t.entity) + "</div>";
        el.addEventListener("click", () => this._more(t.entity));
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
    const c = this._config;
    return 2 + (c.ports.length ? Math.ceil(c.ports.length / c.columns) + 1 : 0) + (c.totals.length ? 1 : 0);
  }
  static getStubConfig() { return { type: "custom:unifi-switch-card", title: "Switch" }; }
  static getConfigElement() { return document.createElement("unifi-switch-card-editor"); }
}
customElements.define("unifi-switch-card", UnifiSwitchCard);

/* ================= ÉDITEUR ================= */
const USW_L = {
  title: "Titre", icon: "Icône", state_entity: "Capteur d'état",
  clients_entity: "Nombre de clients", uptime_entity: "Temps de fonctionnement",
  update_entity: "Entité de mise à jour", columns: "Colonnes dans la grille",
  name: "Nom du port", link_speed: "Vitesse de liaison", rx: "Réception", tx: "Émission",
  entity: "Entité", digits: "Décimales",
};
const USW_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
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

class UnifiSwitchCardEditor extends HTMLElement {
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
  _label(s) { return USW_L[s.name] || s.name; }

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
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Hors ligne</label></div>
        </div>
        <div class="sec-hint">Les ports se colorent automatiquement selon leur vitesse : 10G ambre, 2.5G vert, 1G bleu, en dessous violet.</div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Ports</span></div>
        <div class="sec-hint">Un port sans vitesse de liaison s'affiche déconnecté. Survole un port pour voir son trafic.</div>
        <div class="rows-ports"></div>
        <div class="addbtn add-port"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un port</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Totaux</span></div>
        <div class="sec-hint">Rangée du bas : trafic global, CPU, mémoire…</div>
        <div class="rows-tot"></div>
        <div class="addbtn add-tot"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un total</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = USW_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      ["title", "state_entity", "clients_entity", "uptime_entity", "update_entity"].forEach((k) => {
        if (this._config[k] === "" || this._config[k] === undefined) delete this._config[k];
      });
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
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
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:switch",
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
        e.className = "empty"; e.textContent = "Aucun élément.";
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
    num.textContent = item.name || (key === "ports" ? "Port #" : "#") + (index + 1);
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
    f.schema = schema; f.computeLabel = this._label; f.hass = this._hass;
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
      let t = null;
      ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
      const cl = document.createElement("label"); cl.textContent = "Couleur";
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
  description: "Switch UniFi : grille de ports colorée par vitesse de lien.",
});
console.info("%c UNIFI-SWITCH-CARD %c v" + USW_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-switch-card
title: USW Flex 2.5G Bureau
icon: mdi:switch
state_entity: sensor.usw_flex_2_5g_bureau_state
clients_entity: sensor.usw_flex_2_5g_bureau_clients
uptime_entity: sensor.usw_flex_2_5g_bureau_uptime
update_entity: update.usw_flex_2_5g_bureau
columns: 5
ports:
  - name: P1
    rx: sensor.usw_flex_2_5g_bureau_port_1_rx
    tx: sensor.usw_flex_2_5g_bureau_port_1_tx
  - name: P2
    link_speed: sensor.usw_flex_2_5g_bureau_port_2_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_2_rx
    tx: sensor.usw_flex_2_5g_bureau_port_2_tx
  - name: P3
    link_speed: sensor.usw_flex_2_5g_bureau_port_3_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_3_rx
    tx: sensor.usw_flex_2_5g_bureau_port_3_tx
  - name: P4
    link_speed: sensor.usw_flex_2_5g_bureau_port_4_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_4_rx
    tx: sensor.usw_flex_2_5g_bureau_port_4_tx
  - name: P5
    link_speed: sensor.usw_flex_2_5g_bureau_port_5_link_speed
    rx: sensor.usw_flex_2_5g_bureau_port_5_rx
    tx: sensor.usw_flex_2_5g_bureau_port_5_tx
totals:
  - entity: sensor.usw_flex_2_5g_bureau_cpu_utilization
    name: CPU
    color: "#378ADD"
    digits: 0
  - entity: sensor.usw_flex_2_5g_bureau_memory_utilization
    name: RAM
    color: "#7F77DD"
    digits: 0
============================================================ */

}

/* ---- src/cards/network/unifi-wifi-card.js ---- */
{
/**
 * UniFi WiFi Card — gestion des réseaux WiFi (SSID)
 * Version 1.0.0
 *
 * Active / désactive chaque réseau et affiche le nombre de clients connectés.
 *
 * Installation :
 *  1. config/www/perso/unifi-wifi-card.js
 *  2. Resources → /local/perso/unifi-wifi-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 *
 * ⚠️ Les switches de réseau WiFi ne sont créés par l'intégration UniFi que si
 *    l'option correspondante est activée dans les paramètres de l'intégration.
 *    Settings → Devices & Services → UniFi Network → Configurer.
 */

const UWF_VERSION = "1.0.1";

const wRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const wFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d });
};
const wEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

class UnifiWifiCard extends HTMLElement {
  setConfig(config) {
    if (!config.networks || !config.networks.length) {
      throw new Error("La clé 'networks' est requise (au moins un réseau WiFi).");
    }
    this._config = {
      title: config.title || "Réseaux WiFi",
      icon: config.icon || "mdi:wifi-cog",
      accent: config.accent || "#378ADD",
      color_on: config.color_on || "#1D9E75",
      color_off: config.color_off || "#6a6a67",
      confirm_disable: config.confirm_disable === true,
      networks: config.networks,
    };
    this._built = false;
    this._pending = {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.networks.forEach((n) => {
      ["entity", "clients"].forEach((k) => n[k] && ids.push(n[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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
    const hass = this._hass, c = this._config, r = this.shadowRoot;

    r.querySelector("ha-card").style.borderColor = wRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = wRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let active = 0, totalCli = 0, hasCli = false, missing = 0;
    c.networks.forEach((n) => {
      const st = n.entity ? hass.states[n.entity] : null;
      if (n.entity && !st) missing++;
      if (st && st.state === "on") active++;
      if (n.clients && hass.states[n.clients]) {
        const v = parseFloat(hass.states[n.clients].state);
        if (!isNaN(v)) { totalCli += v; hasCli = true; }
      }
    });

    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_on + '">' + active + " actif" + (active > 1 ? "s" : "") + "</b>" +
      " / " + c.networks.length +
      (hasCli ? " · " + totalCli.toLocaleString("fr-FR") + " clients" : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (missing) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = missing + " réseau(x) introuvable(s). Vérifie que les switches de réseau WiFi " +
        "sont activés dans les options de l'intégration UniFi Network.";
      list.appendChild(w);
    }

    c.networks.forEach((n) => {
      const st = n.entity ? hass.states[n.entity] : null;
      const on = st ? st.state === "on" : false;
      const avail = !!st;
      const cliSt = n.clients ? hass.states[n.clients] : null;
      const busy = this._pending[n.entity];

      const el = document.createElement("div");
      el.className = "net" + (on ? "" : " off");

      const meta = [];
      if (n.guest) meta.push('<span class="tag" style="background:' + wRgba("#BA7517", 0.15) +
        ';color:#BA7517">Invité</span>');
      if (n.band) meta.push("<span>" + wEsc(n.band) + "</span>");
      if (!avail) meta.push('<span style="color:#E24B4A">entité introuvable</span>');
      else if (!on) meta.push("<span>Désactivé</span>");

      el.innerHTML =
        '<div class="nic" style="background:' + wRgba(on ? c.color_on : c.color_off, on ? 0.16 : 0.08) + '">' +
          '<ha-icon icon="' + (on ? (n.icon || "mdi:wifi") : "mdi:wifi-off") +
            '" style="color:' + (on ? c.color_on : c.color_off) + '"></ha-icon>' +
        "</div>" +
        '<div class="nbody">' +
          '<div class="nname">' + wEsc(n.name || (st && st.attributes.friendly_name) || n.entity || "Réseau") + "</div>" +
          (meta.length ? '<div class="nmeta">' + meta.join("") + "</div>" : "") +
        "</div>" +
        (cliSt ? '<div class="ncli" style="color:' + (on ? c.accent : c.color_off) + '">' +
          wFmt(cliSt) + "</div>" : "") +
        '<div class="toggle' + (busy ? " busy" : "") + '"><div class="knob"></div></div>';

      const tg = el.querySelector(".toggle");
      tg.style.background = on ? c.color_on : "rgba(255,255,255,0.2)";
      el.querySelector(".knob").style.left = on ? "21px" : "3px";

      if (avail) {
        tg.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._pending[n.entity]) return;
          if (on && c.confirm_disable) {
            const label = n.name || n.entity;
            if (!window.confirm("Désactiver le réseau « " + label + " » ?")) return;
          }
          this._pending[n.entity] = true;
          this._render();
          this._hass.callService("switch", "toggle", { entity_id: n.entity });
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

  getCardSize() { return 2 + this._config.networks.length; }
  static getStubConfig() {
    return { type: "custom:unifi-wifi-card", title: "Réseaux WiFi", networks: [{ name: "SSID 1" }] };
  }
  static getConfigElement() { return document.createElement("unifi-wifi-card-editor"); }
}
customElements.define("unifi-wifi-card", UnifiWifiCard);

/* ================= ÉDITEUR ================= */
const UWF_L = {
  title: "Titre", icon: "Icône", confirm_disable: "Demander confirmation avant désactivation",
  name: "Nom du réseau", entity: "Switch d'activation", clients: "Nombre de clients",
  band: "Bande (texte libre)", guest: "Réseau invité",
};
const UWF_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { name: "confirm_disable", selector: { boolean: {} } },
];
const UWF_S_NET = [
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

class UnifiWifiCardEditor extends HTMLElement {
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
  _label(s) { return UWF_L[s.name] || s.name; }

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
      </style>
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
          <div class="color-field"><input type="color" class="c-on"><label>Actif</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Réseaux</span></div>
        <div class="sec-hint">Un bloc par SSID. Le switch d'activation vient de l'intégration UniFi (il faut activer cette option dans ses paramètres).</div>
        <div class="rows-net"></div>
        <div class="addbtn add-net"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un réseau</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = UWF_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bindColor = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bindColor(".c-accent", "accent");
    bindColor(".c-on", "color_on");
    r.querySelector(".add-net").addEventListener("click", () => {
      this._config.networks = (this._config.networks || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
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
        e.className = "empty"; e.textContent = "Aucun réseau.";
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
    num.textContent = item.name || "Réseau #" + (index + 1);
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
    f.schema = UWF_S_NET; f.computeLabel = this._label; f.hass = this._hass;
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
  description: "Réseaux WiFi UniFi : activer/désactiver et clients par SSID.",
});
console.info("%c UNIFI-WIFI-CARD %c v" + UWF_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:unifi-wifi-card
title: Réseaux WiFi
icon: mdi:wifi-cog
accent: "#378ADD"
color_on: "#1D9E75"
confirm_disable: false
networks:
  - name: Reseau_Maison
    entity: switch.reseau_maison
    clients: sensor.reseau_maison_clients
    band: 2.4 + 5 GHz
  - name: Reseau_Autre
    entity: switch.reseau_autre
    clients: sensor.reseau_autre_clients
  - name: Brico_Guest
    entity: switch.brico_guest
    clients: sensor.brico_guest_clients
    guest: true
============================================================ */

}

/* ---- src/cards/storage/synology-drives-card.js ---- */
{
/**
 * Synology Drives Card — disques DSM
 * Version 1.0.0
 *
 * Affiche l'état, la température et les deux alarmes S.M.A.R.T. que
 * l'intégration Synology expose : secteurs défectueux et durée de vie.
 *
 * ⚠️ Ces binary_sensor sont en device_class "problem" : l'état "on" signifie
 *    qu'un problème EST détecté. La carte en tient compte automatiquement.
 *
 * Installation :
 *  1. config/www/perso/synology-drives-card.js
 *  2. Resources → /local/perso/synology-drives-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const SYDRV_VERSION = "1.0.0";

const kRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const kNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const kFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d });
};
const kUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const kEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Un binary_sensor de device_class "problem" est inversé : "on" = problème.
   Renvoie true si tout va bien, false si problème, null si indéterminé. */
function kAlarmOk(st, invert) {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return null;
  const dc = st.attributes ? st.attributes.device_class : null;
  const inverted = invert !== undefined && invert !== null
    ? invert : (dc === "problem" || dc === "safety");
  if (s === "on") return inverted ? false : true;
  if (s === "off") return inverted ? true : false;
  if (s === "ok" || s === "normal" || s === "good") return true;
  if (s === "bad" || s === "critical" || s === "failed") return false;
  return null;
}

/* Classe un état textuel de disque */
function kStatusKind(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "") return null;
  if (["normal", "ok", "healthy", "good", "normale"].indexOf(s) !== -1) return "ok";
  if (["warning", "attention", "degraded", "background", "initialized",
       "verifying", "smart_warning"].indexOf(s) !== -1) return "warn";
  if (["crashed", "critical", "failed", "failing", "bad", "danger"].indexOf(s) !== -1) return "bad";
  return "warn";
}

class SynologyDrivesCard extends HTMLElement {
  setConfig(config) {
    if (!config.drives || !config.drives.length) {
      throw new Error("La clé 'drives' est requise (au moins un disque).");
    }
    this._config = {
      title: config.title || "Disques",
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      temp_warn: config.temp_warn || 45,
      temp_critical: config.temp_critical || 55,
      show_alarms: config.show_alarms !== false,
      label_sectors_ok: config.label_sectors_ok || "secteurs OK",
      label_sectors_ko: config.label_sectors_ko || "secteurs défectueux",
      label_life_ok: config.label_life_ok || "durée de vie OK",
      label_life_ko: config.label_life_ko || "fin de vie proche",
      drives: config.drives,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.drives.forEach((d) => {
      ["status", "temperature", "bad_sectors", "remaining_life", "size"]
        .forEach((k) => d[k] && ids.push(d[k]));
    });
    return [...new Set(ids)];
  }
  _sig(h) {
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  _tempColor(t) {
    const c = this._config;
    if (isNaN(t)) return "var(--disabled-text-color)";
    if (t >= c.temp_critical) return "#E24B4A";
    if (t >= c.temp_warn) return "#BA7517";
    return "var(--disabled-text-color)";
  }

  /* Un disque est sain si son état est normal ET qu'aucune alarme n'est levée */
  _overall(d) {
    const hass = this._hass;
    const kind = d.status && hass.states[d.status]
      ? kStatusKind(hass.states[d.status].state) : null;
    const alarms = [
      kAlarmOk(d.bad_sectors ? hass.states[d.bad_sectors] : null, d.alarm_invert),
      kAlarmOk(d.remaining_life ? hass.states[d.remaining_life] : null, d.alarm_invert),
    ];
    if (alarms.indexOf(false) !== -1) return "bad";
    if (kind === "bad") return "bad";
    if (kind === "warn") return "warn";
    if (kind === "ok") return "ok";
    if (alarms.indexOf(true) !== -1) return "ok";
    return null;
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
          cursor:pointer; transition:background .2s ease; overflow:hidden; }
        .dk:hover { background:rgba(255,255,255,0.07); }
        .dk-top { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .dk-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dk-size { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .dk-state { display:inline-flex; align-items:center; gap:3px;
          font-size:10px; font-weight:600; flex-shrink:0; }
        .dk-state ha-icon { --mdc-icon-size:12px; }
        .dk-foot { display:flex; gap:12px; flex-wrap:wrap;
          font-size:10px; color:var(--disabled-text-color); line-height:1.5; }
        .dk-foot span { white-space:nowrap; }
        .dk-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
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

    r.querySelector("ha-card").style.borderColor = kRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = kRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let ok = 0, known = 0;
    c.drives.forEach((d) => {
      const o = this._overall(d);
      if (o !== null) { known++; if (o === "ok") ok++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (ok === known ? "#1D9E75" : "#E24B4A") + '">' +
        ok + " sain" + (ok > 1 ? "s" : "") + "</b> / " + known
      : c.drives.length + " disque" + (c.drives.length > 1 ? "s" : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

    c.drives.forEach((d) => {
      const overall = this._overall(d);
      const dotCol = overall === "bad" ? "#E24B4A"
        : overall === "warn" ? "#BA7517"
        : overall === "ok" ? "#1D9E75" : "#4a4a48";

      const stSt = d.status ? hass.states[d.status] : null;
      const tempSt = d.temperature ? hass.states[d.temperature] : null;
      const sizeSt = d.size ? hass.states[d.size] : null;
      const el = document.createElement("div");
      el.className = "dk";

      let stateHtml = "";
      if (stSt) {
        stateHtml = '<span class="dk-state" style="color:' + dotCol + '">' +
          '<ha-icon icon="' + (overall === "bad" ? "mdi:alert" :
            overall === "warn" ? "mdi:alert-outline" : "mdi:check-circle") + '"></ha-icon>' +
          kEsc(stSt.state) + "</span>";
      }

      const foot = [];
      if (tempSt) {
        const t = kNum(tempSt);
        foot.push('<span style="color:' + this._tempColor(t) +
          '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + kFmt(tempSt, 0) + " " +
          kEsc(kUnit(tempSt) || "°C") + "</span>");
      }
      if (c.show_alarms) {
        const mkAlarm = (entity, okLbl, koLbl) => {
          if (!entity) return;
          const a = kAlarmOk(hass.states[entity], d.alarm_invert);
          if (a === null) return;
          foot.push('<span style="color:' + (a ? "inherit" : "#E24B4A") +
            '"><ha-icon icon="' + (a ? "mdi:check-circle" : "mdi:alert-circle") +
            '" style="color:' + (a ? "#1D9E75" : "#E24B4A") + '"></ha-icon> ' +
            kEsc(a ? okLbl : koLbl) + "</span>");
        };
        mkAlarm(d.bad_sectors, c.label_sectors_ok, c.label_sectors_ko);
        mkAlarm(d.remaining_life, c.label_life_ok, c.label_life_ko);
      }

      el.innerHTML =
        '<div class="dk-top">' +
          '<span class="dot" style="background:' + dotCol + '"></span>' +
          '<span class="dk-name">' + kEsc(d.name || "Disque") + "</span>" +
          (sizeSt ? '<span class="dk-size">' + kFmt(sizeSt, 0) + " " +
            kEsc(kUnit(sizeSt)) + "</span>" : "") +
          stateHtml +
        "</div>" +
        (foot.length ? '<div class="dk-foot">' + foot.join("") + "</div>" : "");

      el.addEventListener("click", () =>
        this._more(d.status || d.temperature || d.bad_sectors));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.drives.length; }
  static getStubConfig() {
    return { type: "custom:synology-drives-card", title: "Disques", drives: [{ name: "Drive 1" }] };
  }
  static getConfigElement() { return document.createElement("synology-drives-card-editor"); }
}
customElements.define("synology-drives-card", SynologyDrivesCard);

/* ================= ÉDITEUR ================= */
const SD_L = {
  title: "Titre", icon: "Icône", temp_warn: "Température d'alerte (°C)",
  temp_critical: "Température critique (°C)", show_alarms: "Afficher les alarmes S.M.A.R.T.",
  label_sectors_ok: "Libellé secteurs — OK", label_sectors_ko: "Libellé secteurs — problème",
  label_life_ok: "Libellé durée de vie — OK", label_life_ko: "Libellé durée de vie — problème",
  name: "Nom du disque", status: "État", temperature: "Température",
  bad_sectors: "Alarme secteurs défectueux", remaining_life: "Alarme durée de vie",
  size: "Taille", alarm_invert: "Inverser la lecture des alarmes",
};
const SD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SD_BIN = { entity: { filter: { domain: ["binary_sensor", "sensor"] } } };
const SD_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "temp_warn", selector: { number: { min: 20, max: 100, mode: "box" } } },
    { name: "temp_critical", selector: { number: { min: 20, max: 100, mode: "box" } } },
  ]},
  { name: "show_alarms", selector: { boolean: {} } },
];
const SD_S_LABELS = [
  { type: "grid", schema: [
    { name: "label_sectors_ok", selector: { text: {} } },
    { name: "label_sectors_ko", selector: { text: {} } },
  ]},
  { type: "grid", schema: [
    { name: "label_life_ok", selector: { text: {} } },
    { name: "label_life_ko", selector: { text: {} } },
  ]},
];
const SD_S_DRIVE = [
  { name: "name", selector: { text: {} } },
  { name: "status", selector: SD_SENSOR },
  { name: "temperature", selector: SD_SENSOR },
  { name: "bad_sectors", selector: SD_BIN },
  { name: "remaining_life", selector: SD_BIN },
  { name: "size", selector: SD_SENSOR },
  { name: "alarm_invert", selector: { boolean: {} } },
];

class SynologyDrivesCardEditor extends HTMLElement {
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
  _label(s) { return SD_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleur</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Libellés des alarmes</span></div>
        <ha-form class="f-labels"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Disques</span></div>
        <div class="sec-hint">Les alarmes Synology sont en device_class « problem » : leur lecture est inversée automatiquement. Coche « Inverser » seulement si un disque sain apparaît en défaut.</div>
        <div class="rows-drives"></div>
        <div class="addbtn add-drive"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un disque</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", SD_S_GEN, (v) => {
      Object.assign(this._config, v);
      if (this._config.title === "") delete this._config.title;
    });
    wire(".f-labels", SD_S_LABELS, (v) => {
      Object.assign(this._config, v);
      ["label_sectors_ok", "label_sectors_ko", "label_life_ok", "label_life_ko"]
        .forEach((k) => { if (this._config[k] === "") delete this._config[k]; });
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    r.querySelector(".add-drive").addEventListener("click", () => {
      this._config.drives = (this._config.drives || []).concat([{ name: "" }]);
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
      temp_warn: c.temp_warn || 45, temp_critical: c.temp_critical || 55,
      show_alarms: c.show_alarms !== false,
    };
    const fl = r.querySelector(".f-labels");
    fl.hass = this._hass;
    fl.data = {
      label_sectors_ok: c.label_sectors_ok || "secteurs OK",
      label_sectors_ko: c.label_sectors_ko || "secteurs défectueux",
      label_life_ok: c.label_life_ok || "durée de vie OK",
      label_life_ko: c.label_life_ko || "fin de vie proche",
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-drives");
    const list = c.drives || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun disque.";
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        const ff = row.querySelector("ha-form");
        ff.hass = this._hass;
        ff.data = Object.assign({ alarm_invert: false }, list[i]);
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
    num.textContent = item.name || "Disque #" + (index + 1);
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
      this._config.drives = this._config.drives.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = SD_S_DRIVE; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({ alarm_invert: false }, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.drives || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined) delete m[k];
        if (k === "alarm_invert" && m[k] === false) delete m[k];
      });
      l[index] = m; this._config.drives = l; this._emit();
    });
    row.appendChild(f);
    return row;
  }

  _move(i, d) {
    const l = (this._config.drives || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.drives = l; this._emit(); this._update(true);
  }
}
customElements.define("synology-drives-card-editor", SynologyDrivesCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-drives-card",
  name: "Synology Drives Card",
  description: "Disques Synology : état, température et alarmes S.M.A.R.T.",
});
console.info("%c SYNOLOGY-DRIVES-CARD %c v" + SYDRV_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:synology-drives-card
title: Disques
icon: mdi:harddisk
accent: "#7F77DD"
temp_warn: 45
temp_critical: 55
show_alarms: true
drives:
  - name: Drive 1
    status: sensor.syno_drive_1_status
    temperature: sensor.syno_drive_1_temperature
    bad_sectors: binary_sensor.syno_drive_1_exceeded_max_bad_sectors
    remaining_life: binary_sensor.syno_drive_1_below_min_remaining_life
  - name: Drive 2
    status: sensor.syno_drive_2_status
    temperature: sensor.syno_drive_2_temperature
    bad_sectors: binary_sensor.syno_drive_2_exceeded_max_bad_sectors
    remaining_life: binary_sensor.syno_drive_2_below_min_remaining_life
============================================================ */

}

/* ---- src/cards/storage/synology-nas-card.js ---- */
{
/**
 * Synology NAS Card — système DSM (CPU, mémoire, charge, débits, actions)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/synology-nas-card.js
 *  2. Resources → /local/perso/synology-nas-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const SYNAS_VERSION = "1.0.0";

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
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const nUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const nEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Met une valeur d'octets à l'échelle : 4200 GB → 4,2 TB */
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
  return v.toLocaleString("fr-FR", { maximumFractionDigits: d }) + " " + seq[i];
}

/* Convertit un horodatage en durée lisible */
function nSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365), mo = Math.floor((d % 365) / 30);
    return y + " an" + (y > 1 ? "s" : "") + (mo ? " " + mo + " mois" : "");
  }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

/* Lecture d'un binary_sensor en tenant compte de device_class "problem",
   où "on" signifie qu'un problème est détecté. */
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

class SynologyNasCard extends HTMLElement {
  setConfig(config) {
    this._config = {
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
    this._built = false;
  }

  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._renderUptime();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

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

  /* Une jauge accepte plusieurs sources : pourcentage direct, valeur/max,
     utilisé/total, ou libre/total (le cas Synology pour la mémoire). */
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

    /* Libellé de droite : le plus parlant disponible */
    let label;
    if (!isNaN(used) && !isNaN(total)) {
      const unit = nUnit(totSt) || nUnit(usedSt) || nUnit(freeSt);
      const su = nScale(used, unit), st_ = nScale(total, unit);
      label = (su && st_) ? su.split(" ")[0] + "/" + st_
        : used.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + "/" +
          total.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " " + unit;
    } else if (valSt) {
      label = nFmt(valSt, 2) + (nUnit(valSt) ? " " + nUnit(valSt) : "");
    } else {
      label = isNaN(pct) ? "—" : pct.toFixed(0) + " %";
    }
    return { pct: pct, label: label };
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
      sub.querySelector("span").textContent = "Démarré il y a " + since;
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
        (secOk ? "Sécurisé" : "Alerte sécurité") + "</b>");
    }
    if (c.subtitle) bits.push(nEsc(c.subtitle));
    r.querySelector(".hsub").innerHTML = bits.length ? bits.join(" · ") : "&nbsp;";

    this._renderUptime();

    /* Badge DSM */
    const badge = r.querySelector(".badge");
    if (c.update_entity && hass.states[c.update_entity]) {
      const up = hass.states[c.update_entity].state === "on";
      badge.classList.remove("hidden");
      badge.textContent = up ? "MAJ DSM" : "DSM à jour";
      badge.style.background = nRgba(up ? "#BA7517" : "#1D9E75", 0.12);
      badge.style.color = up ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.update_entity); };
    } else badge.classList.add("hidden");

    /* Jauges */
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

    /* Débits + température */
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
          '<div class="fval">' + nFmt(st, 2) +
            (nUnit(st) ? "<em>" + nEsc(nUnit(st)) + "</em>" : "") + "</div>";
        d.addEventListener("click", () => this._more(entity));
        flow.appendChild(d);
      };
      if (tp && tp.download) mk(tp.download, tp.download_label || "Téléchargement", "mdi:arrow-down", c.accent);
      if (tp && tp.upload) mk(tp.upload, tp.upload_label || "Téléversement", "mdi:arrow-up", "#1D9E75");
      if (hasTemp) {
        const st = hass.states[c.temperature];
        const t = nNum(st);
        const col = this._tempColor(t);
        const d = document.createElement("div");
        d.className = "tbox";
        d.innerHTML =
          '<ha-icon icon="mdi:thermometer" style="color:' + col + '"></ha-icon>' +
          '<div class="tv">' + nFmt(st, 0) + "°</div>" +
          '<div class="tn">Système</div>';
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
          (a.icon ? '<ha-icon icon="' + a.icon + '" style="color:' + (a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + nEsc(a.name) + "</span>";
        el.addEventListener("click", () => {
          if (a.confirm !== false &&
              !window.confirm(a.confirm_text || (a.name + " le NAS « " + c.title + " » ?"))) return;
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
  static getStubConfig() { return { type: "custom:synology-nas-card", title: "NAS" }; }
  static getConfigElement() { return document.createElement("synology-nas-card-editor"); }
}
customElements.define("synology-nas-card", SynologyNasCard);

/* ================= ÉDITEUR ================= */
const SN_L = {
  title: "Titre", icon: "Icône", subtitle: "Sous-titre libre",
  security_entity: "État de sécurité", security_invert: "Inverser l'état de sécurité",
  last_boot: "Dernier démarrage", update_entity: "Mise à jour DSM",
  temperature: "Température système",
  warn_at: "Seuil d'alerte (%)", critical_at: "Seuil critique (%)",
  temp_warn: "Température d'alerte (°C)", temp_critical: "Température critique (°C)",
  name: "Nom affiché", percentage: "Pourcentage", value: "Valeur brute",
  max: "Valeur max (échelle)", used: "Utilisé", free: "Disponible", total: "Total",
  download: "Débit descendant", upload: "Débit montant",
  download_label: "Libellé descendant", upload_label: "Libellé montant",
  entity: "Entité", confirm: "Demander confirmation",
  actions_label: "Titre de la zone d'actions",
};
const SN_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SN_S_GEN = [
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
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (!this._built) return;
    if (first) this._update(); else this._refreshHass();
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
  _label(s) { return SN_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>Normal</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Alerte</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Jauges</span></div>
        <div class="sec-hint">Plusieurs sources possibles par jauge : un pourcentage direct, ou « Disponible + Total » (cas de la mémoire Synology), ou « Valeur brute + Max » (cas de la charge processeur).</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une jauge</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Débits réseau</span></div>
        <ha-form class="f-flow"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">La confirmation est activée par défaut : arrêter un NAS à distance sans filet est risqué.</div>
        <ha-form class="f-actlabel"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une action</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", SN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "subtitle", "security_entity", "last_boot", "update_entity", "temperature"]
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
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
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
        e.className = "empty"; e.textContent = "Aucun élément.";
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
    f.schema = schema; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config[key] || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (m[k] === "" || m[k] === undefined) delete m[k];
        if (k === "confirm" && m[k] === true) delete m[k]; /* true = défaut */
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
      const cl = document.createElement("label"); cl.textContent = "Couleur";
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
  description: "NAS Synology : CPU, mémoire, débits, température et actions.",
});
console.info("%c SYNOLOGY-NAS-CARD %c v" + SYNAS_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:synology-nas-card
title: Guy
icon: mdi:nas
accent: "#378ADD"
subtitle: DiskStation
security_entity: binary_sensor.syno_security_status
last_boot: sensor.syno_last_boot
update_entity: update.syno_dsm_update
temperature: sensor.syno_temperature
temp_warn: 50
temp_critical: 60
warn_at: 75
critical_at: 90
gauges:
  - name: CPU
    percentage: sensor.syno_cpu_utilization_total
    color: "#378ADD"
  - name: Mémoire
    percentage: sensor.syno_memory_usage_real
    free: sensor.syno_memory_available_real
    total: sensor.syno_memory_total_real
    color: "#7F77DD"
  - name: Charge 5 min
    value: sensor.syno_cpu_load_average_5_min
    max: 4
    color: "#1D9E75"
throughput:
  download: sensor.syno_download_throughput
  upload: sensor.syno_upload_throughput
actions_label: Contrôles du NAS
actions:
  - name: Redémarrer
    entity: button.syno_reboot
    icon: mdi:restart
    color: "#378ADD"
  - name: Arrêter
    entity: button.syno_shutdown
    icon: mdi:power
    color: "#E24B4A"
============================================================ */

}

/* ---- src/cards/storage/synology-volumes-card.js ---- */
{
/**
 * Synology Volumes Card — volumes DSM
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/synology-volumes-card.js
 *  2. Resources → /local/perso/synology-volumes-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const SYVOL_VERSION = "1.0.0";

const vRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const vNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const vFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const vUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const vEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function vScale(st) {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  const unit = vUnit(st);
  const dec = ["B", "kB", "KB", "MB", "GB", "TB", "PB"];
  const bin = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let seq = dec, base = 1000, i = dec.indexOf(unit);
  if (i === -1) { i = bin.indexOf(unit); seq = bin; base = 1024; }
  if (i === -1) return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + (unit ? " " + unit : "");
  let v = n;
  while (Math.abs(v) >= base && i < seq.length - 1) { v /= base; i++; }
  const d = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return v.toLocaleString("fr-FR", { maximumFractionDigits: d }) + " " + seq[i];
}

/* Classe un état textuel Synology : normal / attention / défaillant */
function vStatusKind(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).toLowerCase();
  if (s === "unavailable" || s === "unknown" || s === "") return null;
  if (["normal", "ok", "healthy", "good", "normale"].indexOf(s) !== -1) return "ok";
  if (["background", "attention", "warning", "degraded", "degrade", "dégradé",
       "verifying", "migrating", "expanding", "deleting", "cleaning",
       "raid_syncing", "syncing"].indexOf(s) !== -1) return "warn";
  if (["crashed", "critical", "failed", "failing", "danger", "bad"].indexOf(s) !== -1) return "bad";
  return "warn"; /* état inconnu : on ne prétend pas que tout va bien */
}

class SynologyVolumesCard extends HTMLElement {
  setConfig(config) {
    if (!config.volumes || !config.volumes.length) {
      throw new Error("La clé 'volumes' est requise (au moins un volume).");
    }
    this._config = {
      title: config.title || "Volumes",
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#1D9E75",
      warn_at: config.warn_at || 80,
      critical_at: config.critical_at || 90,
      temp_warn: config.temp_warn || 45,
      temp_critical: config.temp_critical || 55,
      show_detail: config.show_detail !== false,
      sort: config.sort || "config",
      volumes: config.volumes,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.volumes.forEach((v) => {
      ["status", "percentage", "used_space", "total_space", "temperature"]
        .forEach((k) => v[k] && ids.push(v[k]));
    });
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
        .list { padding:0 15px 14px 15px; display:flex; flex-direction:column; gap:8px; }
        .vo { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          cursor:pointer; transition:background .2s ease; overflow:hidden; }
        .vo:hover { background:rgba(255,255,255,0.07); }
        .vo-top { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .vo-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .vo-state { font-size:10px; flex-shrink:0; }
        .vo-pct { font-size:11px; font-weight:700; flex-shrink:0; }
        .vo-t { height:5px; border-radius:3px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .vo-f { height:100%; border-radius:3px; transition:width .4s ease; }
        .vo-foot { display:flex; gap:12px; flex-wrap:wrap; align-items:center;
          margin-top:6px; font-size:10px; color:var(--disabled-text-color); }
        .vo-foot span { white-space:nowrap; }
        .vo-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .spacer { flex:1; }
        .alert { display:inline-flex; align-items:center; gap:3px; }
        .alert ha-icon { --mdc-icon-size:11px; }
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

    r.querySelector("ha-card").style.borderColor = vRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = vRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let items = c.volumes.map((v) => {
      const stSt = v.status ? hass.states[v.status] : null;
      const kind = stSt ? vStatusKind(stSt.state) : null;
      const pctSt = v.percentage ? hass.states[v.percentage] : null;
      let pct = vNum(pctSt);
      const usedSt = v.used_space ? hass.states[v.used_space] : null;
      const totSt = v.total_space ? hass.states[v.total_space] : null;
      if (isNaN(pct)) {
        const u = vNum(usedSt), t = vNum(totSt);
        if (!isNaN(u) && t) pct = (u / t) * 100;
      }
      return { v: v, kind: kind, stSt: stSt, pct: pct,
               usedSt: usedSt, totSt: totSt,
               tempSt: v.temperature ? hass.states[v.temperature] : null };
    });

    const okCount = items.filter((i) => i.kind === "ok").length;
    const known = items.filter((i) => i.kind !== null).length;
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (okCount === known ? "#1D9E75" : "#BA7517") + '">' +
        okCount + " normal" + (okCount > 1 ? "s" : "") + "</b> / " + known
      : c.volumes.length + " volume" + (c.volumes.length > 1 ? "s" : "");

    if (c.sort === "usage") items.sort((a, b) => (b.pct || 0) - (a.pct || 0));
    else if (c.sort === "name") {
      items.sort((a, b) => String(a.v.name || "").localeCompare(String(b.v.name || ""), "fr", { numeric: true }));
    }

    const list = r.querySelector(".list");
    list.innerHTML = "";

    items.forEach((it) => {
      const col = this._barColor(it.pct, it.v.color || c.accent);
      const dotCol = it.kind === "bad" ? "#E24B4A"
        : it.kind === "warn" ? "#BA7517"
        : it.kind === "ok" ? "#1D9E75" : "#4a4a48";
      const el = document.createElement("div");
      el.className = "vo";

      const foot = [];
      if (it.usedSt) foot.push("<span>" + vEsc(vScale(it.usedSt)) + " utilisés</span>");
      if (it.totSt) foot.push("<span>sur " + vEsc(vScale(it.totSt)) + "</span>");
      foot.push('<span class="spacer"></span>');
      if (it.tempSt) {
        const t = vNum(it.tempSt);
        foot.push('<span style="color:' + this._tempColor(t) +
          '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + vFmt(it.tempSt, 0) + " " +
          vEsc(vUnit(it.tempSt) || "°C") + " moy.</span>");
      }
      if (!isNaN(it.pct) && it.pct >= c.critical_at) {
        foot.push('<span class="alert" style="color:#E24B4A">' +
          '<ha-icon icon="mdi:alert"></ha-icon>espace critique</span>');
      }

      el.innerHTML =
        '<div class="vo-top">' +
          '<span class="dot" style="background:' + dotCol + '"></span>' +
          '<span class="vo-name">' + vEsc(it.v.name || "Volume") + "</span>" +
          (it.stSt ? '<span class="vo-state" style="color:' + dotCol + '">' +
            vEsc(it.stSt.state) + "</span>" : "") +
          '<span class="vo-pct" style="color:' + col + '">' +
            (isNaN(it.pct) ? "—" : it.pct.toFixed(0) + " %") + "</span>" +
        "</div>" +
        '<div class="vo-t"><div class="vo-f" style="width:' +
          (isNaN(it.pct) ? 0 : Math.min(Math.max(it.pct, 0), 100)).toFixed(1) +
          "%;background:" + col + '"></div></div>' +
        (c.show_detail ? '<div class="vo-foot">' + foot.join("") + "</div>" : "");

      el.addEventListener("click", () =>
        this._more(it.v.percentage || it.v.status || it.v.used_space));
      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.volumes.length; }
  static getStubConfig() {
    return { type: "custom:synology-volumes-card", title: "Volumes", volumes: [{ name: "Volume 1" }] };
  }
  static getConfigElement() { return document.createElement("synology-volumes-card-editor"); }
}
customElements.define("synology-volumes-card", SynologyVolumesCard);

/* ================= ÉDITEUR ================= */
const SV_L = {
  title: "Titre", icon: "Icône", warn_at: "Seuil d'alerte (%)",
  critical_at: "Seuil critique (%)", temp_warn: "Température d'alerte (°C)",
  temp_critical: "Température critique (°C)", show_detail: "Afficher le détail",
  sort: "Tri", name: "Nom du volume", status: "État", percentage: "Pourcentage utilisé",
  used_space: "Espace utilisé", total_space: "Espace total",
  temperature: "Température moyenne des disques",
};
const SV_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const SV_S_GEN = [
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
  { name: "sort", selector: { select: { mode: "dropdown", options: [
    { value: "config", label: "Ordre de la configuration" },
    { value: "usage", label: "Les plus remplis d'abord" },
    { value: "name", label: "Nom" },
  ]}}},
  { name: "show_detail", selector: { boolean: {} } },
];
const SV_S_VOL = [
  { name: "name", selector: { text: {} } },
  { name: "status", selector: SV_SENSOR },
  { name: "percentage", selector: SV_SENSOR },
  { name: "used_space", selector: SV_SENSOR },
  { name: "total_space", selector: SV_SENSOR },
  { name: "temperature", selector: SV_SENSOR },
];

class SynologyVolumesCardEditor extends HTMLElement {
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
  _label(s) { return SV_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleur</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Volumes</span></div>
        <div class="sec-hint">Un état inconnu est affiché en ambre plutôt qu'en vert : mieux vaut douter que rassurer à tort.</div>
        <div class="rows-vol"></div>
        <div class="addbtn add-vol"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un volume</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = SV_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    r.querySelector(".add-vol").addEventListener("click", () => {
      this._config.volumes = (this._config.volumes || []).concat([{ name: "" }]);
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
      warn_at: c.warn_at || 80, critical_at: c.critical_at || 90,
      temp_warn: c.temp_warn || 45, temp_critical: c.temp_critical || 55,
      sort: c.sort || "config", show_detail: c.show_detail !== false,
    };
    this._setColor(".c-accent", c.accent || "#1D9E75");

    const box = r.querySelector(".rows-vol");
    const list = c.volumes || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun volume.";
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
    num.textContent = item.name || "Volume #" + (index + 1);
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
      this._config.volumes = this._config.volumes.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const f = document.createElement("ha-form");
    f.schema = SV_S_VOL; f.computeLabel = this._label; f.hass = this._hass;
    f.data = Object.assign({}, item);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.volumes || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => { if (m[k] === "" || m[k] === undefined) delete m[k]; });
      if (l[index] && l[index].color) m.color = l[index].color;
      l[index] = m; this._config.volumes = l; this._emit();
    });
    row.appendChild(f);

    const cf = document.createElement("div");
    cf.className = "color-field"; cf.style.marginTop = "8px";
    const ci = document.createElement("input");
    ci.type = "color"; ci.value = item.color || "#1D9E75";
    const apply = (v) => {
      const l = (this._config.volumes || []).slice();
      l[index] = Object.assign({}, l[index], { color: v });
      this._config.volumes = l; this._emit();
    };
    let t = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = "Couleur";
    cf.appendChild(ci); cf.appendChild(cl); row.appendChild(cf);
    return row;
  }

  _move(i, d) {
    const l = (this._config.volumes || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.volumes = l; this._emit(); this._update(true);
  }
}
customElements.define("synology-volumes-card-editor", SynologyVolumesCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "synology-volumes-card",
  name: "Synology Volumes Card",
  description: "Volumes Synology : état, occupation et température moyenne.",
});
console.info("%c SYNOLOGY-VOLUMES-CARD %c v" + SYVOL_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:synology-volumes-card
title: Volumes
icon: mdi:harddisk
accent: "#1D9E75"
warn_at: 80
critical_at: 90
temp_warn: 45
temp_critical: 55
sort: usage
show_detail: true
volumes:
  - name: Volume 1
    status: sensor.syno_volume_1_status
    percentage: sensor.syno_volume_1_volume_used
    used_space: sensor.syno_volume_1_used_space
    temperature: sensor.syno_volume_1_average_disk_temperature
============================================================ */

}

/* ---- src/cards/virtualization/proxmox-disks-card.js ---- */
{
/**
 * Proxmox Disks Card — disques physiques (santé S.M.A.R.T.)
 * Version 1.0.0
 *
 * ⚠️ Le « wearout » d'un SSD est ambigu selon le disque et le firmware :
 *    certains rapportent l'usure consommée (0 = neuf), d'autres la vie
 *    restante (100 = neuf). Règle `wearout_mode` par disque :
 *      used      → la valeur EST l'usure  (0 % = neuf)
 *      remaining → la valeur est la vie restante (100 % = neuf)
 *    En cas de doute, compare avec l'âge du disque : un disque récent
 *    affichant 95 % d'usure est presque sûrement en mode "remaining".
 *
 * Installation :
 *  1. config/www/perso/proxmox-disks-card.js
 *  2. Resources → /local/perso/proxmox-disks-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PDISK_VERSION = "1.1.0";

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
const dFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 0 : d });
};
const dUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const dEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Un binary_sensor de device_class "problem" est INVERSÉ : "on" signifie
   qu'un problème est détecté, "off" que tout va bien. Home Assistant affiche
   d'ailleurs "OK" pour l'état off dans ce cas. Sans cette lecture, un disque
   sain est signalé défaillant. `invert` permet de forcer manuellement. */
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
  /* Certaines intégrations renvoient directement un libellé */
  if (s === "passed" || s === "ok" || s === "healthy" || s === "good") return true;
  if (s === "failed" || s === "failing" || s === "bad" || s === "ko") return false;
  return null;
};

/* Convertit les heures de fonctionnement en durée lisible */
function dHours(h) {
  if (isNaN(h)) return null;
  const y = Math.floor(h / 8760);
  const rest = h % 8760;
  const d = Math.floor(rest / 24);
  if (y >= 1) return y + " an" + (y > 1 ? "s" : "") + (d ? " " + d + " j" : "");
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  return Math.floor(h) + " h";
}

class ProxmoxDisksCard extends HTMLElement {
  setConfig(config) {
    if (!config.disks || !config.disks.length) {
      throw new Error("La clé 'disks' est requise (au moins un disque).");
    }
    this._config = {
      title: config.title || "Disques",
      icon: config.icon || "mdi:harddisk",
      accent: config.accent || "#7F77DD",
      color_ok: config.color_ok || "#1D9E75",
      color_ko: config.color_ko || "#E24B4A",
      warn_at: config.warn_at || 60,
      critical_at: config.critical_at || 85,
      temp_warn: config.temp_warn || 50,
      temp_critical: config.temp_critical || 60,
      show_wearout: config.show_wearout !== false,
      disks: config.disks,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
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
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
  }

  /* Renvoie l'usure réelle en %, quel que soit le mode de rapport du disque */
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

    r.querySelector("ha-card").style.borderColor = dRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = dRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let healthy = 0, known = 0;
    c.disks.forEach((d) => {
      const st = d.health ? hass.states[d.health] : null;
      const ok = dOk(st, d.health_invert);
      if (ok !== null) { known++; if (ok) healthy++; }
    });
    r.querySelector(".hsub").innerHTML = known
      ? '<b style="color:' + (healthy === known ? c.color_ok : c.color_ko) + '">' +
        healthy + " sain" + (healthy > 1 ? "s" : "") + "</b> / " + known
      : c.disks.length + " disque" + (c.disks.length > 1 ? "s" : "");

    const list = r.querySelector(".list");
    list.innerHTML = "";

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
          '<span class="dk-name">' + dEsc(d.name || "Disque") + "</span>" +
          (ok === false
            ? '<span class="badko"><ha-icon icon="mdi:alert"></ha-icon>défaillant</span>'
            : ok === true
              ? '<span class="badok"><ha-icon icon="mdi:check-circle"></ha-icon>sain</span>'
              : "") +
          (sizeSt ? '<span class="dk-size">' + dFmt(sizeSt, 0) + " " +
            dEsc(dUnit(sizeSt)) + "</span>" : "") +
        "</div>";

      if (c.show_wearout && !isNaN(wearUsed)) {
        html +=
          '<div class="w-top"><span>Usure</span><span>' + wearUsed.toFixed(0) + " %</span></div>" +
          '<div class="w-t"><div class="w-f" style="width:' +
            Math.min(Math.max(wearUsed, 0), 100).toFixed(1) +
            "%;background:" + wearCol + '"></div></div>';
      }

      const foot = [];
      if (tempSt) foot.push('<span style="color:' + this._tempColor(temp) +
        '"><ha-icon icon="mdi:thermometer"></ha-icon> ' + dFmt(tempSt, 0) + " " +
        dEsc(dUnit(tempSt) || "°C") + "</span>");
      if (pohSt) {
        const lbl = dHours(dNum(pohSt));
        foot.push('<span><ha-icon icon="mdi:power"></ha-icon> ' +
          (lbl || dFmt(pohSt, 0) + " h") + "</span>");
      }
      if (pcSt) foot.push('<span><ha-icon icon="mdi:restart"></ha-icon> ' +
        dFmt(pcSt, 0) + " cycles</span>");
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
  static getStubConfig() {
    return { type: "custom:proxmox-disks-card", title: "Disques", disks: [{ name: "Disque 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-disks-card-editor"); }
}
customElements.define("proxmox-disks-card", ProxmoxDisksCard);

/* ================= ÉDITEUR ================= */
const PD_L = {
  title: "Titre", icon: "Icône", warn_at: "Usure — seuil d'alerte (%)",
  critical_at: "Usure — seuil critique (%)", temp_warn: "Température d'alerte (°C)",
  temp_critical: "Température critique (°C)", show_wearout: "Afficher la barre d'usure",
  name: "Nom du disque", health: "Santé (S.M.A.R.T.)",
  health_invert: "Inverser la lecture de la santé", wearout: "Usure",
  wearout_mode: "Interprétation de l'usure", temperature: "Température",
  power_on_hours: "Heures de fonctionnement", power_cycles: "Cycles d'alimentation",
  size: "Taille",
};
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
];
const PD_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const PD_S_DISK = [
  { name: "name", selector: { text: {} } },
  { name: "health", selector: { entity: { filter: { domain: ["binary_sensor", "sensor"] } } } },
  { name: "health_invert", selector: { boolean: {} } },
  { name: "wearout", selector: PD_SENSOR },
  { name: "wearout_mode", selector: { select: { mode: "dropdown", options: [
    { value: "used", label: "Usure consommée (0 % = neuf)" },
    { value: "remaining", label: "Vie restante (100 % = neuf)" },
  ]}}},
  { name: "temperature", selector: PD_SENSOR },
  { name: "power_on_hours", selector: PD_SENSOR },
  { name: "power_cycles", selector: PD_SENSOR },
  { name: "size", selector: PD_SENSOR },
];

class ProxmoxDisksCardEditor extends HTMLElement {
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
  _label(s) { return PD_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleur</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Disques</span></div>
        <div class="sec-hint">Le champ « Interprétation de l'usure » compte : selon le disque, Proxmox rapporte soit l'usure consommée, soit la vie restante. Si un disque récent affiche une usure énorme, bascule sur « Vie restante ».<br>Si un disque sain est marqué défaillant, coche « Inverser la lecture de la santé ».</div>
        <div class="rows-disks"></div>
        <div class="addbtn add-disk"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un disque</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = PD_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });

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
      show_wearout: c.show_wearout !== false,
    };
    this._setColor(".c-accent", c.accent || "#7F77DD");

    const box = r.querySelector(".rows-disks");
    const list = c.disks || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun disque.";
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
    num.textContent = item.name || "Disque #" + (index + 1);
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
    f.schema = PD_S_DISK; f.computeLabel = this._label; f.hass = this._hass;
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
  description: "Disques physiques : santé S.M.A.R.T., usure, température.",
});
console.info("%c PROXMOX-DISKS-CARD %c v" + PDISK_VERSION + " ",
  "color:#fff;background:#7F77DD;font-weight:700", "color:#7F77DD;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:proxmox-disks-card
title: Disques
icon: mdi:harddisk
accent: "#7F77DD"
warn_at: 60
critical_at: 85
temp_warn: 50
temp_critical: 60
disks:
  - name: Samsung SSD 840 Series
    health: binary_sensor.disk_pve01_samsung_ssd_840_series_health
    wearout: sensor.disk_pve01_samsung_ssd_840_series_wearout
    wearout_mode: used
    temperature: sensor.disk_pve01_samsung_ssd_840_series_airflow_temperature
    power_on_hours: sensor.disk_pve01_samsung_ssd_840_series_power_on_hours
    power_cycles: sensor.disk_pve01_samsung_ssd_840_series_power_cycles
    size: sensor.disk_pve01_samsung_ssd_840_series_size
============================================================ */
}

/* ---- src/cards/virtualization/proxmox-guests-card.js ---- */
{
/**
 * Proxmox Guests Card — VM (QEMU) et conteneurs (LXC)
 * Version 1.0.0
 *
 * Une seule carte pour les deux : instancie-la deux fois si tu veux
 * un bloc « Machines virtuelles » et un bloc « Conteneurs ».
 *
 * Les boutons s'adaptent à l'état : un invité arrêté propose « Démarrer »,
 * un invité en marche propose « Éteindre / Forcer l'arrêt / Redémarrer ».
 *
 * Installation :
 *  1. config/www/perso/proxmox-guests-card.js
 *  2. Resources → /local/perso/proxmox-guests-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PGUEST_VERSION = "1.0.0";

const gRgba = (c, a) => {
  if (!c || c.indexOf("var(") === 0 || c.indexOf("rgb") === 0) return c;
  const h = c.replace("#", "");
  return "rgba(" + parseInt(h.substr(0, 2), 16) + "," + parseInt(h.substr(2, 2), 16) +
         "," + parseInt(h.substr(4, 2), 16) + "," + a + ")";
};
const gNum = (st) => {
  if (!st) return NaN;
  const n = parseFloat(st.state);
  return isNaN(n) ? NaN : n;
};
const gFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const gUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const gEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const gOn = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "running" || s === "online";
};
function gSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) { const y = Math.floor(d / 365); return y + " an" + (y > 1 ? "s" : ""); }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " j";
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

/* Catalogue des actions : icône, couleur, libellé, et si elles sont à risque */
const G_ACTIONS = {
  start:     { icon: "mdi:play",           color: "#1D9E75", label: "Démarrer",       risky: false, when: "off" },
  resume:    { icon: "mdi:play-pause",     color: "#1D9E75", label: "Reprendre",      risky: false, when: "off" },
  shutdown:  { icon: "mdi:power",          color: "#BA7517", label: "Éteindre",       risky: true,  when: "on" },
  stop:      { icon: "mdi:stop",           color: "#E24B4A", label: "Forcer l'arrêt", risky: true,  when: "on" },
  reboot:    { icon: "mdi:restart",        color: "#378ADD", label: "Redémarrer",     risky: true,  when: "on" },
  reset:     { icon: "mdi:restart-alert",  color: "#E24B4A", label: "Réinitialiser",  risky: true,  when: "on" },
  suspend:   { icon: "mdi:pause",          color: "#7F77DD", label: "Suspendre",      risky: true,  when: "on" },
  hibernate: { icon: "mdi:snowflake",      color: "#7F77DD", label: "Hiberner",       risky: true,  when: "on" },
};
const G_ORDER = ["start", "resume", "shutdown", "stop", "reboot", "reset", "suspend", "hibernate"];

class ProxmoxGuestsCard extends HTMLElement {
  setConfig(config) {
    if (!config.guests || !config.guests.length) {
      throw new Error("La clé 'guests' est requise (au moins un invité).");
    }
    this._config = {
      title: config.title || "Invités",
      icon: config.icon || "mdi:server",
      accent: config.accent || "#378ADD",
      color_on: config.color_on || "#1D9E75",
      color_off: config.color_off || "#4a4a48",
      color_cpu: config.color_cpu || "#378ADD",
      color_mem: config.color_mem || "#7F77DD",
      color_disk: config.color_disk || "#1D9E75",
      warn_at: config.warn_at || 80,
      critical_at: config.critical_at || 92,
      show_bars: config.show_bars !== false,
      show_network: config.show_network !== false,
      show_uptime: config.show_uptime !== false,
      confirm_actions: config.confirm_actions ||
        ["stop", "shutdown", "reboot", "reset", "suspend", "hibernate"],
      guests: config.guests,
    };
    this._built = false;
    this._pending = {};
  }

  connectedCallback() {
    this._timer = setInterval(() => {
      if (this._built && this._hass && this._config.show_uptime) this._render();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const ids = [];
    this._config.guests.forEach((g) => {
      ["status", "status_text", "health", "cpu", "memory", "disk",
       "network_in", "network_out", "last_boot"].forEach((k) => g[k] && ids.push(g[k]));
    });
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
        .gu { background:rgba(255,255,255,0.035); border-radius:10px; padding:11px 12px;
          transition:background .2s ease; }
        .gu.off { opacity:.55; }
        .gu-top { display:flex; align-items:center; gap:8px; }
        .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .gu-name { flex:1; min-width:0; font-size:12.5px; font-weight:600;
          color:var(--primary-text-color); cursor:pointer;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .gu-name .vmid { color:var(--disabled-text-color); font-weight:400; }
        .gu-state { font-size:10px; color:var(--disabled-text-color); flex-shrink:0; }
        .gu-health { --mdc-icon-size:13px; flex-shrink:0; }
        .bars { display:flex; gap:8px; margin-top:9px; }
        .bar { flex:1; min-width:0; cursor:pointer; }
        .bar-top { display:flex; justify-content:space-between;
          font-size:9.5px; color:var(--disabled-text-color); margin-bottom:3px; }
        .bar-t { height:4px; border-radius:2px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .bar-f { height:100%; border-radius:2px; transition:width .4s ease; }
        .gu-foot { display:flex; align-items:center; gap:10px; margin-top:8px;
          font-size:10px; color:var(--disabled-text-color); }
        .gu-foot ha-icon { --mdc-icon-size:11px; vertical-align:-1px; }
        .btns { display:flex; gap:4px; margin-left:auto; flex-shrink:0; }
        .btn { width:26px; height:26px; border-radius:6px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          transition:transform .1s ease, opacity .2s ease; }
        .btn:active { transform:scale(.9); }
        .btn ha-icon { --mdc-icon-size:13px; }
        .btn.busy { opacity:.35; cursor:default; }
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
    const hass = this._hass, c = this._config, r = this.shadowRoot;

    r.querySelector("ha-card").style.borderColor = gRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = gRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    let running = 0, missing = 0;
    c.guests.forEach((g) => {
      const st = g.status ? hass.states[g.status] : null;
      if (g.status && !st) missing++;
      if (gOn(st)) running++;
    });
    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_on + '">' + running + " en marche</b> / " + c.guests.length;

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (missing) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = missing + " invité(s) avec une entité d'état introuvable.";
      list.appendChild(w);
    }

    c.guests.forEach((g) => {
      const stSt = g.status ? hass.states[g.status] : null;
      const on = gOn(stSt);
      const el = document.createElement("div");
      el.className = "gu" + (on ? "" : " off");

      /* --- Ligne 1 : état, nom, santé --- */
      const top = document.createElement("div");
      top.className = "gu-top";

      const stateLabel = g.status_text && hass.states[g.status_text]
        ? hass.states[g.status_text].state
        : (on ? "" : "arrêté");

      let healthHtml = "";
      if (g.health && hass.states[g.health]) {
        const ok = gOn(hass.states[g.health]);
        healthHtml = '<ha-icon class="gu-health" icon="' +
          (ok ? "mdi:heart-pulse" : "mdi:heart-broken") +
          '" style="color:' + (ok ? c.color_on : "#E24B4A") + '"></ha-icon>';
      }

      top.innerHTML =
        '<span class="dot" style="background:' + (on ? c.color_on : c.color_off) + '"></span>' +
        '<span class="gu-name">' + gEsc(g.name || "Invité") +
          (g.vmid ? ' <span class="vmid">· ' + gEsc(g.vmid) + "</span>" : "") + "</span>" +
        (stateLabel ? '<span class="gu-state">' + gEsc(stateLabel) + "</span>" : "") +
        healthHtml;
      top.querySelector(".gu-name").addEventListener("click", () =>
        this._more(g.status || g.cpu));
      el.appendChild(top);

      /* --- Ligne 2 : barres CPU / RAM / disque (seulement si en marche) --- */
      if (c.show_bars && on) {
        const bars = document.createElement("div");
        bars.className = "bars";
        const defs = [
          { e: g.cpu, n: "CPU", col: c.color_cpu },
          { e: g.memory, n: "RAM", col: c.color_mem },
          { e: g.disk, n: "Disque", col: c.color_disk },
        ].filter((d) => d.e);
        if (defs.length) {
          defs.forEach((d) => {
            const st = hass.states[d.e];
            const pct = gNum(st);
            const col = this._barColor(pct, d.col);
            const b = document.createElement("div");
            b.className = "bar";
            b.innerHTML =
              '<div class="bar-top"><span>' + d.n + "</span><span>" +
                (isNaN(pct) ? "—" : pct.toFixed(0) + " %") + "</span></div>" +
              '<div class="bar-t"><div class="bar-f" style="width:' +
                (isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100)).toFixed(1) +
                "%;background:" + col + '"></div></div>';
            b.addEventListener("click", () => this._more(d.e));
            bars.appendChild(b);
          });
          el.appendChild(bars);
        }
      }

      /* --- Ligne 3 : réseau, uptime, boutons --- */
      const foot = document.createElement("div");
      foot.className = "gu-foot";
      const parts = [];

      if (c.show_network && on) {
        const inSt = g.network_in ? hass.states[g.network_in] : null;
        const outSt = g.network_out ? hass.states[g.network_out] : null;
        if (inSt) parts.push('<span><ha-icon icon="mdi:arrow-down" style="color:' +
          c.color_cpu + '"></ha-icon> ' + gFmt(inSt) + " " + gEsc(gUnit(inSt)) + "</span>");
        if (outSt) parts.push('<span><ha-icon icon="mdi:arrow-up" style="color:' +
          c.color_disk + '"></ha-icon> ' + gFmt(outSt) + " " + gEsc(gUnit(outSt)) + "</span>");
      }
      if (c.show_uptime && on && g.last_boot && hass.states[g.last_boot]) {
        const since = gSince(hass.states[g.last_boot].state);
        if (since) parts.push('<span><ha-icon icon="mdi:clock-outline"></ha-icon> ' + since + "</span>");
      }
      foot.innerHTML = parts.join("");

      /* Boutons contextuels */
      const btns = document.createElement("div");
      btns.className = "btns";
      const acts = g.actions || {};
      let any = false;
      G_ORDER.forEach((key) => {
        const entity = acts[key];
        if (!entity) return;
        const def = G_ACTIONS[key];
        if (on && def.when === "off") return;
        if (!on && def.when === "on") return;
        any = true;
        const busy = this._pending[entity];
        const b = document.createElement("div");
        b.className = "btn" + (busy ? " busy" : "");
        b.title = def.label;
        b.style.background = gRgba(def.color, 0.14);
        b.innerHTML = '<ha-icon icon="' + def.icon + '" style="color:' + def.color + '"></ha-icon>';
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._pending[entity]) return;
          const needsConfirm = c.confirm_actions.indexOf(key) !== -1;
          if (needsConfirm) {
            const who = (g.name || "cet invité") + (g.vmid ? " (" + g.vmid + ")" : "");
            if (!window.confirm(def.label + " « " + who + " » ?")) return;
          }
          this._pending[entity] = true;
          this._render();
          this._hass.callService("button", "press", { entity_id: entity });
          setTimeout(() => { delete this._pending[entity]; this._render(); }, 3000);
        });
        btns.appendChild(b);
      });
      if (any) foot.appendChild(btns);
      if (parts.length || any) el.appendChild(foot);

      list.appendChild(el);
    });
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 2 + this._config.guests.length * 2; }
  static getStubConfig() {
    return { type: "custom:proxmox-guests-card", title: "Invités", guests: [{ name: "Invité 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-guests-card-editor"); }
}
customElements.define("proxmox-guests-card", ProxmoxGuestsCard);

/* ================= ÉDITEUR ================= */
const PG_L = {
  title: "Titre", icon: "Icône", show_bars: "Afficher les barres CPU/RAM/disque",
  show_network: "Afficher le trafic réseau", show_uptime: "Afficher la durée de marche",
  warn_at: "Seuil d'alerte (%)", critical_at: "Seuil critique (%)",
  name: "Nom de l'invité", vmid: "Identifiant (VMID)",
  status: "Capteur d'état", status_text: "État en texte", health: "Santé",
  cpu: "CPU (%)", memory: "Mémoire (%)", disk: "Disque (%)",
  network_in: "Réseau entrant", network_out: "Réseau sortant", last_boot: "Dernier démarrage",
  a_start: "Démarrer", a_resume: "Reprendre", a_shutdown: "Éteindre",
  a_stop: "Forcer l'arrêt", a_reboot: "Redémarrer", a_reset: "Réinitialiser",
  a_suspend: "Suspendre", a_hibernate: "Hiberner",
};
const PG_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { name: "show_bars", selector: { boolean: {} } },
  { name: "show_network", selector: { boolean: {} } },
  { name: "show_uptime", selector: { boolean: {} } },
];
const SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const BINSENS = { entity: { filter: { domain: ["binary_sensor", "sensor"] } } };
const BTN = { entity: { filter: { domain: ["button", "switch", "script"] } } };
const PG_S_GUEST = [
  { type: "grid", schema: [
    { name: "name", selector: { text: {} } },
    { name: "vmid", selector: { text: {} } },
  ]},
  { name: "status", selector: BINSENS },
  { name: "status_text", selector: SENSOR },
  { name: "health", selector: BINSENS },
  { name: "cpu", selector: SENSOR },
  { name: "memory", selector: SENSOR },
  { name: "disk", selector: SENSOR },
  { name: "network_in", selector: SENSOR },
  { name: "network_out", selector: SENSOR },
  { name: "last_boot", selector: SENSOR },
];
const PG_S_ACTS = [
  { name: "a_start", selector: BTN },
  { name: "a_shutdown", selector: BTN },
  { name: "a_stop", selector: BTN },
  { name: "a_reboot", selector: BTN },
  { name: "a_reset", selector: BTN },
  { name: "a_suspend", selector: BTN },
  { name: "a_resume", selector: BTN },
  { name: "a_hibernate", selector: BTN },
];

class ProxmoxGuestsCardEditor extends HTMLElement {
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
  _label(s) { return PG_L[s.name] || s.name; }

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
        .sub-lbl { font-size:11.5px; font-weight:600; color:var(--secondary-text-color);
          margin:12px 0 4px 0; padding-top:8px; border-top:1px solid var(--divider-color); }
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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
          <div class="color-field"><input type="color" class="c-on"><label>En marche</label></div>
        </div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Invités</span></div>
        <div class="sec-hint">Les boutons s'adaptent à l'état : « Démarrer » quand l'invité est arrêté, « Éteindre / Forcer / Redémarrer » quand il tourne. Laisse vide les actions que ton type d'invité n'a pas.</div>
        <div class="rows-guests"></div>
        <div class="addbtn add-guest"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un invité</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = PG_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const bind = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let t = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    };
    bind(".c-accent", "accent");
    bind(".c-on", "color_on");
    r.querySelector(".add-guest").addEventListener("click", () => {
      this._config.guests = (this._config.guests || []).concat([{ name: "" }]);
      this._emit(); this._update(true);
    });
  }

  _update(force) {
    if (!this._hass || !this._config) return;
    const r = this.shadowRoot, c = this._config;
    const f = r.querySelector(".f-gen");
    f.hass = this._hass;
    f.data = {
      title: c.title || "", icon: c.icon || "mdi:server",
      warn_at: c.warn_at || 80, critical_at: c.critical_at || 92,
      show_bars: c.show_bars !== false,
      show_network: c.show_network !== false,
      show_uptime: c.show_uptime !== false,
    };
    this._setColor(".c-accent", c.accent || "#378ADD");
    this._setColor(".c-on", c.color_on || "#1D9E75");

    const box = r.querySelector(".rows-guests");
    const list = c.guests || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun invité.";
        box.appendChild(e);
      }
      list.forEach((it, i) => box.appendChild(this._row(it, i, list.length)));
    } else {
      cur.forEach((row, i) => {
        row.querySelector(".f-guest").hass = this._hass;
        row.querySelector(".f-guest").data = this._guestData(list[i]);
        row.querySelector(".f-acts").hass = this._hass;
        row.querySelector(".f-acts").data = this._actsData(list[i]);
      });
    }
  }

  _guestData(g) {
    const d = {};
    ["name", "vmid", "status", "status_text", "health", "cpu", "memory", "disk",
     "network_in", "network_out", "last_boot"].forEach((k) => { d[k] = g[k] || ""; });
    return d;
  }
  _actsData(g) {
    const a = g.actions || {}, d = {};
    G_ORDER.forEach((k) => { d["a_" + k] = a[k] || ""; });
    return d;
  }

  _row(item, index, total) {
    const row = document.createElement("div");
    row.className = "row";
    const head = document.createElement("div");
    head.className = "row-head";
    const num = document.createElement("span");
    num.className = "row-num";
    num.textContent = (item.name || "Invité #" + (index + 1)) + (item.vmid ? " · " + item.vmid : "");
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
      this._config.guests = this._config.guests.filter((_, i) => i !== index);
      this._emit(); this._update(true);
    }));
    row.appendChild(head);

    const fg = document.createElement("ha-form");
    fg.className = "f-guest";
    fg.schema = PG_S_GUEST; fg.computeLabel = this._label; fg.hass = this._hass;
    fg.data = this._guestData(item);
    fg.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.guests || []).slice();
      const m = Object.assign({}, l[index], e.detail.value);
      Object.keys(m).forEach((k) => {
        if (k !== "actions" && (m[k] === "" || m[k] === undefined)) delete m[k];
      });
      l[index] = m; this._config.guests = l; this._emit();
    });
    row.appendChild(fg);

    const lbl = document.createElement("div");
    lbl.className = "sub-lbl";
    lbl.textContent = "Boutons d'action";
    row.appendChild(lbl);

    const fa = document.createElement("ha-form");
    fa.className = "f-acts";
    fa.schema = PG_S_ACTS; fa.computeLabel = this._label; fa.hass = this._hass;
    fa.data = this._actsData(item);
    fa.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      const l = (this._config.guests || []).slice();
      const acts = {};
      G_ORDER.forEach((k) => {
        const v = e.detail.value["a_" + k];
        if (v) acts[k] = v;
      });
      const m = Object.assign({}, l[index]);
      if (Object.keys(acts).length) m.actions = acts; else delete m.actions;
      l[index] = m; this._config.guests = l; this._emit();
    });
    row.appendChild(fa);

    return row;
  }

  _move(i, d) {
    const l = (this._config.guests || []).slice();
    const t = i + d;
    if (t < 0 || t >= l.length) return;
    const tmp = l[i]; l[i] = l[t]; l[t] = tmp;
    this._config.guests = l; this._emit(); this._update(true);
  }
}
customElements.define("proxmox-guests-card-editor", ProxmoxGuestsCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "proxmox-guests-card",
  name: "Proxmox Guests Card",
  description: "VM et conteneurs LXC : état, ressources et actions contextuelles.",
});
console.info("%c PROXMOX-GUESTS-CARD %c v" + PGUEST_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
EXEMPLE — MACHINES VIRTUELLES

type: custom:proxmox-guests-card
title: Machines virtuelles
icon: mdi:server
accent: "#378ADD"
guests:
  - name: docker01
    vmid: 101
    status: binary_sensor.qemu_docker01_101_status
    status_text: sensor.qemu_docker01_101_status
    health: binary_sensor.qemu_docker01_101_health
    cpu: sensor.qemu_docker01_101_cpu_used
    memory: sensor.qemu_docker01_101_memory_used_percentage
    disk: sensor.qemu_docker01_101_disk_used_percentage
    network_in: sensor.qemu_docker01_101_network_in
    network_out: sensor.qemu_docker01_101_network_out
    last_boot: sensor.qemu_docker01_101_last_boot
    actions:
      start: button.qemu_docker01_101_start
      shutdown: button.qemu_docker01_101_shutdown
      stop: button.qemu_docker01_101_stop
      reboot: button.qemu_docker01_101_reboot
      reset: button.qemu_docker01_101_reset
      suspend: button.qemu_docker01_101_suspend
      resume: button.qemu_docker01_101_resume
      hibernate: button.qemu_docker01_101_hibernate

EXEMPLE — CONTENEURS LXC

type: custom:proxmox-guests-card
title: Conteneurs LXC
icon: mdi:package-variant-closed
accent: "#7F77DD"
guests:
  - name: DNSINTERNE
    vmid: 110
    status: binary_sensor.lxc_dnsinterne_110_status
    cpu: sensor.lxc_dnsinterne_110_cpu_used
    memory: sensor.lxc_dnsinterne_110_memory_used_percentage
    disk: sensor.lxc_dnsinterne_110_disk_used_percentage
    network_in: sensor.lxc_dnsinterne_110_network_in
    network_out: sensor.lxc_dnsinterne_110_network_out
    last_boot: sensor.lxc_dnsinterne_110_last_boot
    actions:
      start: button.lxc_dnsinterne_110_start
      shutdown: button.lxc_dnsinterne_110_shutdown
      stop: button.lxc_dnsinterne_110_stop
      reboot: button.lxc_dnsinterne_110_reboot
============================================================ */

}

/* ---- src/cards/virtualization/proxmox-node-card.js ---- */
{
/**
 * Proxmox Node Card — nœud PVE (CPU, mémoire, disque, swap, actions)
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/proxmox-node-card.js
 *  2. Resources → /local/perso/proxmox-node-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PNODE_VERSION = "1.0.0";

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
const pFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const pUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const pEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Convertit un horodatage (last_boot) en durée lisible : "42 jours" */
function pSince(raw) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const mo = Math.floor((d % 365) / 30);
    return y + " an" + (y > 1 ? "s" : "") + (mo ? " " + mo + " mois" : "");
  }
  if (d >= 30) { const mo = Math.floor(d / 30); return mo + " mois"; }
  if (d >= 1) return d + " jour" + (d > 1 ? "s" : "");
  const h = Math.floor(sec / 3600);
  if (h >= 1) return h + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

const pOn = (st) => {
  if (!st) return null;
  const s = String(st.state).toLowerCase();
  if (s === "unavailable" || s === "unknown") return false;
  return s === "on" || s === "running" || s === "online" || s === "home";
};

class ProxmoxNodeCard extends HTMLElement {
  setConfig(config) {
    this._config = {
      title: config.title || "Nœud Proxmox",
      icon: config.icon || "mdi:server",
      accent: config.accent || "#E2782D",
      accent_off: config.accent_off || "#E24B4A",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
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
    this._built = false;
  }

  connectedCallback() {
    /* "Démarré il y a X" doit vieillir même sans changement d'état */
    this._timer = setInterval(() => {
      if (this._built && this._hass) this._renderUptime();
    }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    const sig = this._sig(hass);
    if (sig !== this._last) { this._last = sig; this._render(); }
  }

  _ids() {
    const c = this._config, ids = [];
    [c.status_entity, c.last_boot, c.vms_running, c.containers_running,
     c.updates_count, c.updates_available].forEach((x) => x && ids.push(x));
    c.gauges.forEach((g) => { ["percentage", "used", "total", "free"].forEach((k) => g[k] && ids.push(g[k])); });
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
    const c = this._config, r = this.shadowRoot;
    const sub = r.querySelector(".subline");
    const st = c.last_boot ? this._hass.states[c.last_boot] : null;
    const since = st ? pSince(st.state) : null;
    if (since) {
      sub.classList.remove("hidden");
      sub.querySelector("span").textContent = "Démarré il y a " + since;
      sub.onclick = () => this._more(c.last_boot);
    } else sub.classList.add("hidden");
  }

  _render() {
    const hass = this._hass, c = this._config, r = this.shadowRoot;
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

    r.querySelector(".htitle").textContent = c.title;

    const bits = ['<b style="color:' + accent + '">' + (online ? "En ligne" : "Hors ligne") + "</b>"];
    if (c.vms_running && hass.states[c.vms_running]) {
      const n = pFmt(hass.states[c.vms_running], 0);
      bits.push(n + " VM");
    }
    if (c.containers_running && hass.states[c.containers_running]) {
      const n = pNum(hass.states[c.containers_running]);
      bits.push(pFmt(hass.states[c.containers_running], 0) + " conteneur" + (n > 1 ? "s" : ""));
    }
    r.querySelector(".hsub").innerHTML = bits.join(" · ");

    this._renderUptime();

    /* Badge mises à jour */
    const badge = r.querySelector(".badge");
    const upCount = c.updates_count ? hass.states[c.updates_count] : null;
    const upAvail = c.updates_available ? hass.states[c.updates_available] : null;
    const n = upCount ? pNum(upCount) : NaN;
    const has = upAvail ? pOn(upAvail) : (!isNaN(n) && n > 0);
    if (upCount || upAvail) {
      badge.classList.remove("hidden");
      badge.textContent = has ? (!isNaN(n) && n > 0 ? n + " MAJ" : "MAJ dispo") : "À jour";
      badge.style.background = pRgba(has ? "#BA7517" : "#1D9E75", 0.14);
      badge.style.color = has ? "#BA7517" : "#1D9E75";
      badge.onclick = (e) => { e.stopPropagation(); this._more(c.updates_count || c.updates_available); };
    } else badge.classList.add("hidden");

    /* Jauges */
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
          const u = pNum(usedSt), t = pNum(totSt);
          if (!isNaN(u) && t) pct = (u / t) * 100;
        }
        const col = this._barColor(pct, g.color || "#378ADD");

        /* Valeur à droite : "20,5/32 Go" si dispo, sinon le pourcentage */
        let val;
        if (usedSt && totSt) {
          val = pFmt(usedSt, 1) + "/" + pFmt(totSt, 0) + " " + pEsc(pUnit(totSt) || pUnit(usedSt));
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
          (a.icon ? '<ha-icon icon="' + a.icon + '" style="color:' + (a.color || "inherit") + '"></ha-icon>' : "") +
          "<span>" + pEsc(a.name) + "</span>";
        el.addEventListener("click", () => {
          const needs = a.confirm !== undefined ? a.confirm : (c.confirm_actions && a.destructive !== false);
          if (needs && !window.confirm(a.confirm_text || ("Confirmer : " + a.name + " ?"))) return;
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
  static getStubConfig() { return { type: "custom:proxmox-node-card", title: "Nœud Proxmox" }; }
  static getConfigElement() { return document.createElement("proxmox-node-card-editor"); }
}
customElements.define("proxmox-node-card", ProxmoxNodeCard);

/* ================= ÉDITEUR ================= */
const PN_L = {
  title: "Titre", icon: "Icône", status_entity: "Capteur d'état",
  last_boot: "Dernier démarrage", vms_running: "VM en marche",
  containers_running: "Conteneurs en marche", updates_count: "Nombre de mises à jour",
  updates_available: "Mises à jour disponibles", warn_at: "Seuil d'alerte (%)",
  critical_at: "Seuil critique (%)", confirm_actions: "Confirmer les actions par défaut",
  name: "Nom affiché", percentage: "Capteur de pourcentage", used: "Utilisé", total: "Total",
  entity: "Entité", actions_label: "Titre de la zone d'actions",
  confirm: "Demander confirmation",
};
const PN_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
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

class ProxmoxNodeCardEditor extends HTMLElement {
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
  _label(s) { return PN_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleurs</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-on"><label>En ligne</label></div>
          <div class="color-field"><input type="color" class="c-off"><label>Hors ligne</label></div>
        </div>
        <div class="sec-hint">Les jauges passent en ambre puis en rouge au-delà des seuils.</div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Jauges</span></div>
        <div class="sec-hint">Si tu renseignes « Utilisé » et « Total », la valeur affichée devient « 20,5/32 Go » au lieu du pourcentage.</div>
        <div class="rows-gauges"></div>
        <div class="addbtn add-gauge"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une jauge</span></div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Actions</span></div>
        <div class="sec-hint">Coche « Demander confirmation » pour les actions à risque (arrêt, redémarrage).</div>
        <ha-form class="f-actlabel"></ha-form>
        <div class="rows-actions"></div>
        <div class="addbtn add-action"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter une action</span></div></div>
    `;
    const r = this.shadowRoot;
    const wire = (sel, schema, fn) => {
      const f = r.querySelector(sel);
      f.schema = schema; f.computeLabel = this._label;
      f.addEventListener("value-changed", (e) => { e.stopPropagation(); fn(e.detail.value); this._emit(); });
    };
    wire(".f-gen", PN_S_GEN, (v) => {
      Object.assign(this._config, v);
      ["title", "status_entity", "last_boot", "vms_running", "containers_running",
       "updates_count", "updates_available"].forEach((k) => {
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
    const r = this.shadowRoot, c = this._config;
    const fg = r.querySelector(".f-gen");
    fg.hass = this._hass;
    fg.data = {
      title: c.title || "", icon: c.icon || "mdi:server",
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
        e.className = "empty"; e.textContent = "Aucun élément.";
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
    f.schema = schema; f.computeLabel = this._label; f.hass = this._hass;
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
    let t = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = "Couleur";
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
  description: "Nœud Proxmox : CPU, mémoire, disque, swap, mises à jour et actions.",
});
console.info("%c PROXMOX-NODE-CARD %c v" + PNODE_VERSION + " ",
  "color:#fff;background:#E2782D;font-weight:700", "color:#E2782D;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:proxmox-node-card
title: Node pve01
icon: mdi:server
accent: "#E2782D"
warn_at: 75
critical_at: 90
status_entity: binary_sensor.node_pve01_status
last_boot: sensor.node_pve01_last_boot
vms_running: sensor.node_pve01_virtual_machines_running
containers_running: sensor.node_pve01_containers_running
updates_count: sensor.node_pve01_total_updates
updates_available: binary_sensor.node_pve01_updates_packages
gauges:
  - name: CPU
    percentage: sensor.node_pve01_cpu_used
    color: "#378ADD"
  - name: Mémoire
    percentage: sensor.node_pve01_memory_used_percentage
    used: sensor.node_pve01_memory_used
    total: sensor.node_pve01_memory_total
    color: "#7F77DD"
  - name: Disque
    percentage: sensor.node_pve01_disk_used_percentage
    used: sensor.node_pve01_disk_used
    total: sensor.node_pve01_disk_total
    color: "#1D9E75"
  - name: Swap
    percentage: sensor.node_pve01_swap_used_percentage
    color: "#8a8a86"
actions_label: Contrôles du nœud
actions:
  - name: Tout démarrer
    entity: button.node_pve01_start_all
    icon: mdi:play
    color: "#1D9E75"
    confirm: false
  - name: Tout arrêter
    entity: button.node_pve01_stop_all
    icon: mdi:stop
    color: "#BA7517"
    confirm: true
  - name: Redémarrer
    entity: button.node_pve01_reboot
    icon: mdi:restart
    color: "#378ADD"
    confirm: true
  - name: Éteindre
    entity: button.node_pve01_shutdown
    icon: mdi:power
    color: "#E24B4A"
    confirm: true
============================================================ */

}

/* ---- src/cards/virtualization/proxmox-storage-card.js ---- */
{
/**
 * Proxmox Storage Card — volumes de stockage PVE
 * Version 1.0.0
 *
 * Installation :
 *  1. config/www/perso/proxmox-storage-card.js
 *  2. Resources → /local/perso/proxmox-storage-card.js?v=1 → JavaScript Module
 *  3. Ctrl+Shift+R
 */

const PSTOR_VERSION = "1.0.0";

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
const sFmt = (st, d) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state;
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d === undefined ? 1 : d });
};
const sUnit = (st) => (st && st.attributes ? st.attributes.unit_of_measurement || "" : "");
const sEsc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

class ProxmoxStorageCard extends HTMLElement {
  setConfig(config) {
    if (!config.storages || !config.storages.length) {
      throw new Error("La clé 'storages' est requise (au moins un volume).");
    }
    this._config = {
      title: config.title || "Stockages",
      icon: config.icon || "mdi:database",
      accent: config.accent || "#1D9E75",
      warn_at: config.warn_at || 75,
      critical_at: config.critical_at || 90,
      show_detail: config.show_detail !== false,
      sort: config.sort || "config",
      storages: config.storages,
    };
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
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
    return this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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

    r.querySelector("ha-card").style.borderColor = sRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = sRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title;

    /* Calcule chaque volume */
    let items = c.storages.map((s) => {
      const pctSt = s.percentage ? hass.states[s.percentage] : null;
      const usedSt = s.used ? hass.states[s.used] : null;
      const freeSt = s.free ? hass.states[s.free] : null;
      const totSt = s.total ? hass.states[s.total] : null;
      let pct = sNum(pctSt);
      if (isNaN(pct)) {
        const u = sNum(usedSt), t = sNum(totSt);
        if (!isNaN(u) && t) pct = (u / t) * 100;
      }
      return { s: s, pct: pct, usedSt: usedSt, freeSt: freeSt, totSt: totSt };
    });

    /* Total libre pour le sous-titre */
    let freeSum = 0, freeUnit = "", hasFree = false;
    items.forEach((it) => {
      const v = sNum(it.freeSt);
      if (!isNaN(v)) { freeSum += v; hasFree = true; freeUnit = sUnit(it.freeSt) || freeUnit; }
    });
    const nCrit = items.filter((it) => !isNaN(it.pct) && it.pct >= c.critical_at).length;
    const subBits = [c.storages.length + " volume" + (c.storages.length > 1 ? "s" : "")];
    if (hasFree) {
      subBits.push(freeSum.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) +
        " " + freeUnit + " libres");
    }
    if (nCrit) subBits.push('<span style="color:#E24B4A;font-weight:600">' + nCrit + " critique" +
      (nCrit > 1 ? "s" : "") + "</span>");
    r.querySelector(".hsub").innerHTML = subBits.join(" · ");

    if (c.sort === "usage") items.sort((a, b) => (b.pct || 0) - (a.pct || 0));
    else if (c.sort === "name") {
      items.sort((a, b) => String(a.s.name || "").localeCompare(String(b.s.name || ""), "fr", { numeric: true }));
    }

    const list = r.querySelector(".list");
    list.innerHTML = "";

    items.forEach((it) => {
      const col = this._color(it.pct, it.s.color || c.accent);
      const el = document.createElement("div");
      el.className = "st";

      /* Détail : utilisé · libre · total */
      const det = [];
      if (it.usedSt) det.push(sFmt(it.usedSt, 0) + " " + sEsc(sUnit(it.usedSt)) + " utilisés");
      if (it.freeSt) det.push(sFmt(it.freeSt, 0) + " " + sEsc(sUnit(it.freeSt)) + " libres");
      if (it.totSt) det.push(sFmt(it.totSt, 0) + " " + sEsc(sUnit(it.totSt)) + " au total");

      let alert = "";
      if (!isNaN(it.pct) && it.pct >= c.critical_at) {
        alert = '<span class="alert" style="color:#E24B4A">' +
          '<ha-icon icon="mdi:alert"></ha-icon>espace critique</span>';
      } else if (!isNaN(it.pct) && it.pct >= c.warn_at) {
        alert = '<span class="alert" style="color:#BA7517">' +
          '<ha-icon icon="mdi:alert-outline"></ha-icon>surveiller</span>';
      }

      el.innerHTML =
        '<div class="st-top">' +
          '<span class="st-name">' + sEsc(it.s.name || "Volume") + "</span>" +
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
  static getStubConfig() {
    return { type: "custom:proxmox-storage-card", title: "Stockages", storages: [{ name: "Volume 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-storage-card-editor"); }
}
customElements.define("proxmox-storage-card", ProxmoxStorageCard);

/* ================= ÉDITEUR ================= */
const PS_L = {
  title: "Titre", icon: "Icône", warn_at: "Seuil d'alerte (%)",
  critical_at: "Seuil critique (%)", show_detail: "Afficher le détail sous la barre",
  sort: "Tri", name: "Nom du volume", percentage: "Pourcentage utilisé",
  used: "Utilisé", free: "Libre", total: "Total",
};
const PS_S_GEN = [
  { type: "grid", schema: [
    { name: "title", selector: { text: {} } },
    { name: "icon", selector: { icon: {} } },
  ]},
  { type: "grid", schema: [
    { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
    { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
  ]},
  { name: "sort", selector: { select: { mode: "dropdown", options: [
    { value: "config", label: "Ordre de la configuration" },
    { value: "usage", label: "Les plus remplis d'abord" },
    { value: "name", label: "Nom" },
  ]}}},
  { name: "show_detail", selector: { boolean: {} } },
];
const PS_SENSOR = { entity: { filter: { domain: ["sensor"] } } };
const PS_S_STOR = [
  { name: "name", selector: { text: {} } },
  { name: "percentage", selector: PS_SENSOR },
  { name: "used", selector: PS_SENSOR },
  { name: "free", selector: PS_SENSOR },
  { name: "total", selector: PS_SENSOR },
];

class ProxmoxStorageCardEditor extends HTMLElement {
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
  _label(s) { return PS_L[s.name] || s.name; }

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
      <div class="sec"><div class="sec-head"><span class="sec-title">Général</span></div>
        <ha-form class="f-gen"></ha-form></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Couleur</span></div>
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>Accent</label></div>
        </div>
        <div class="sec-hint">Une barre passe en ambre au seuil d'alerte, en rouge au seuil critique, avec une mention explicite.</div></div>
      <div class="sec"><div class="sec-head"><span class="sec-title">Volumes</span></div>
        <div class="sec-hint">Le pourcentage suffit pour la barre. « Utilisé / Libre / Total » enrichissent la ligne de détail.</div>
        <div class="rows-stor"></div>
        <div class="addbtn add-stor"><ha-icon icon="mdi:plus"></ha-icon><span>Ajouter un volume</span></div></div>
    `;
    const r = this.shadowRoot;
    const f = r.querySelector(".f-gen");
    f.schema = PS_S_GEN; f.computeLabel = this._label;
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      this._emit();
    });
    const el = r.querySelector(".c-accent");
    const apply = (v) => { this._config.accent = v; this._emit(); };
    let t = null;
    el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    el.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });

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
      sort: c.sort || "config", show_detail: c.show_detail !== false,
    };
    this._setColor(".c-accent", c.accent || "#1D9E75");

    const box = r.querySelector(".rows-stor");
    const list = c.storages || [];
    const cur = box.querySelectorAll(".row");
    if (force || cur.length !== list.length) {
      box.innerHTML = "";
      if (!list.length) {
        const e = document.createElement("div");
        e.className = "empty"; e.textContent = "Aucun volume.";
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
    num.textContent = item.name || "Volume #" + (index + 1);
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
    f.schema = PS_S_STOR; f.computeLabel = this._label; f.hass = this._hass;
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
    let t = null;
    ci.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(t); t = setTimeout(() => apply(v), 200); });
    ci.addEventListener("change", (e) => { clearTimeout(t); apply(e.target.value); });
    const cl = document.createElement("label"); cl.textContent = "Couleur";
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
  description: "Volumes de stockage Proxmox avec seuils d'alerte.",
});
console.info("%c PROXMOX-STORAGE-CARD %c v" + PSTOR_VERSION + " ",
  "color:#fff;background:#1D9E75;font-weight:700", "color:#1D9E75;background:#222");

/* ============================================================
EXEMPLE DE CONFIG

type: custom:proxmox-storage-card
title: Stockages
icon: mdi:database
accent: "#1D9E75"
warn_at: 75
critical_at: 90
sort: usage
show_detail: true
storages:
  - name: DisqueSSD
    percentage: sensor.storage_pve01_disquessd_disk_used_percentage
    used: sensor.storage_pve01_disquessd_disk_used
    free: sensor.storage_pve01_disquessd_disk_free
    total: sensor.storage_pve01_disquessd_disk_total
============================================================ */

}