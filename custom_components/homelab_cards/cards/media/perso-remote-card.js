/**
 * perso-remote-card.js
 * "Physical" remote control for any Home Assistant remote entity (e.g. Android TV Remote).
 * Circular quadrant D-pad, raised keys, volume routed to a media_player.
 *
 * Version : 1.0.0
 */

const PRC_VERSION = "1.0.0";

/* UI strings. Language follows the HA UI language (fr* -> French, else English). */
const PRC_I18N = {
  en: {
    err_entity: "perso-remote-card: the 'entity' key (remote domain) is required.",
    err_domain: "perso-remote-card: 'entity' must be an entity of the remote domain.",
    power: "On / Off",
    unavailable: "unavailable",
    muted: "Muted",
    volume: "Volume",
    card_name: "Perso — Remote",
    card_desc: "Physical remote with a circular D-pad for a remote entity.",
    expand_all: "Expand all",
    collapse_all: "Collapse all",
    sec_general: "General",
    sec_power: "Power",
    sec_volume: "Volume",
    sec_display: "Display & behavior",
    labels: {
      entity: "Remote entity (required)",
      name: "Display name",
      power_entity: "Entity driven by the power button",
      power_off_option: "Select option for \"off\"",
      power_on_option: "Select option for \"on\"",
      volume_entity: "Player for volume (leave empty to hide)",
      show_nav: "Back / home / menu row",
      show_transport: "Playback row",
      haptic: "Haptic feedback",
      hold_secs: "Long press duration (s)",
    },
  },
  fr: {
    err_entity: "perso-remote-card : la clé 'entity' (domaine remote) est obligatoire.",
    err_domain: "perso-remote-card : 'entity' doit être une entité du domaine remote.",
    power: "Marche / Arrêt",
    unavailable: "indisponible",
    muted: "Coupé",
    volume: "Volume",
    card_name: "Perso — Télécommande",
    card_desc: "Télécommande physique avec D-pad circulaire pour une entité remote.",
    expand_all: "Tout déplier",
    collapse_all: "Tout replier",
    sec_general: "Général",
    sec_power: "Alimentation",
    sec_volume: "Volume",
    sec_display: "Affichage et comportement",
    labels: {
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
    },
  },
};

// Without hass (setConfig before first hass, module load) fall back to the page language.
function prcLocale(hass) {
  return (hass && (hass.locale?.language || hass.language)) || document.documentElement.lang || "en";
}
function prcT(hass) {
  return PRC_I18N[String(prcLocale(hass)).toLowerCase().startsWith("fr") ? "fr" : "en"];
}

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

  /* Prefers an Android TV Remote entity, then any remote; the volume player is
     the media_player sharing the remote's device (detected via hass.entities). */
  static getStubConfig(hass) {
    const ids = Object.keys(hass.states);
    const ents = hass.entities || {};
    const remote =
      ids.find((e) => e.startsWith("remote.") && ents[e]?.platform === "androidtv_remote") ||
      ids.find((e) => e.startsWith("remote."));
    const dev = remote && ents[remote]?.device_id;
    const player = dev && ids.find((e) => e.startsWith("media_player.") && ents[e]?.device_id === dev);
    const cfg = {
      type: "custom:perso-remote-card",
      entity: remote || "remote.example",
      name: "",
      show_nav: true,
      show_transport: true,
    };
    if (player) cfg.volume_entity = player;
    return cfg;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(prcT(this._hass).err_entity);
    }
    if (config.entity.split(".")[0] !== "remote") {
      throw new Error(prcT(this._hass).err_domain);
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
      <button class="power" type="button">
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    `;
    body.appendChild(head);
    this._el = { brand: head.querySelector(".brand"), power: head.querySelector(".power") };
    this._el.power.title = prcT(this._hass).power;
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
      const t = prcT(h);
      const v = h.states[c.volume_entity];
      if (!v || v.state === "unavailable") {
        this._el.vlabel.textContent = t.unavailable;
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
          ? t.muted
          : typeof lvl === "number"
          ? new Intl.NumberFormat(prcLocale(h), { style: "percent", maximumFractionDigits: 0 }).format(lvl)
          : t.volume;
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

/* Collapsible editor sections. Open/closed state survives editor re-creation
   (module-level Map keyed `${tag}:${sectionId}`); only `hidden` is toggled so
   form fields, their values and focus are never touched. */
const PRC_SECTIONS = new Map();
let prcSecSeq = 0;

const PRC_SEC_CSS = `
  .prc-sec { margin-bottom: 14px; }
  .prc-sec-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px; padding-bottom: 6px;
    border-bottom: 1px solid var(--divider-color);
  }
  .prc-sec-toggle {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;
    background: none; border: none; padding: 2px 0; margin: 0; border-radius: 4px;
    font: inherit; font-size: 15px; font-weight: 600; color: var(--primary-text-color);
    text-align: left; cursor: pointer;
  }
  .prc-chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform .2s ease; flex-shrink: 0; }
  .prc-sec-toggle[aria-expanded="true"] .prc-chev { transform: rotate(90deg); }
  .prc-sec-allbar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .prc-sec-all {
    background: none; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer;
    font: inherit; font-size: 12px; color: var(--secondary-text-color);
  }
  .prc-sec-all:hover { color: var(--primary-text-color); }
  .prc-sec-toggle:focus-visible, .prc-sec-all:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .prc-sec-body[hidden] { display: none !important; }
  @media (prefers-reduced-motion: reduce) { .prc-chev { transition: none; } }
`;

function prcSection(id, title) {
  const sec = document.createElement("div");
  sec.className = "prc-sec";
  sec.dataset.sec = id;
  sec.innerHTML =
    '<div class="prc-sec-head"><button type="button" class="prc-sec-toggle">' +
    '<ha-icon class="prc-chev" icon="mdi:chevron-right"></ha-icon><span></span></button></div>' +
    '<div class="prc-sec-body"></div>';
  sec.querySelector(".prc-sec-toggle span").textContent = title;
  return sec;
}

function prcWireSections(root, tag, t) {
  const secs = Array.from(root.querySelectorAll(".prc-sec[data-sec]"));
  const all = root.querySelector(".prc-sec-all");
  const uid = "prcsec" + ++prcSecSeq;
  const sync = () => {
    if (all) all.textContent = secs.some((s) => s.hasAttribute("data-closed")) ? t.expand_all : t.collapse_all;
  };
  const set = (s, open) => {
    PRC_SECTIONS.set(tag + ":" + s.dataset.sec, open);
    s.toggleAttribute("data-closed", !open);
    s.querySelector(".prc-sec-toggle").setAttribute("aria-expanded", String(open));
    s.querySelector(".prc-sec-body").hidden = !open;
  };
  secs.forEach((s, i) => {
    const btn = s.querySelector(".prc-sec-toggle");
    const body = s.querySelector(".prc-sec-body");
    btn.id = uid + "-" + s.dataset.sec + "-h";
    body.id = uid + "-" + s.dataset.sec + "-b";
    btn.setAttribute("aria-controls", body.id);
    body.setAttribute("role", "region");
    body.setAttribute("aria-labelledby", btn.id);
    const saved = PRC_SECTIONS.get(tag + ":" + s.dataset.sec);
    set(s, saved === undefined ? i === 0 : saved);
    btn.addEventListener("click", () => {
      set(s, s.hasAttribute("data-closed"));
      sync();
    });
  });
  if (all) {
    all.addEventListener("click", () => {
      const open = secs.some((s) => s.hasAttribute("data-closed"));
      secs.forEach((s) => set(s, open));
      sync();
    });
  }
  sync();
}

class PersoRemoteCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._forms) Object.values(this._forms).forEach((f) => (f.hass = hass));
    else this._render();
  }

  /* One ha-form per section; each gets the full config as data */
  _schemas() {
    const isSelect =
      this._config &&
      this._config.power_entity &&
      ["select", "input_select"].includes(this._config.power_entity.split(".")[0]);

    return {
      general: [
        {
          name: "entity",
          required: true,
          selector: { entity: { filter: { domain: ["remote"] } } },
        },
        { name: "name", selector: { text: {} } },
      ],
      power: [
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
      ],
      volume: [
        {
          name: "volume_entity",
          selector: { entity: { filter: { domain: ["media_player"] } } },
        },
      ],
      display: [
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
      ],
    };
  }

  _label(schema) {
    return prcT(this._hass).labels[schema.name] || schema.name;
  }

  _build() {
    const t = prcT(this._hass);
    this.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = PRC_SEC_CSS;
    this.appendChild(style);

    const bar = document.createElement("div");
    bar.className = "prc-sec-allbar";
    bar.innerHTML = '<button type="button" class="prc-sec-all"></button>';
    this.appendChild(bar);

    this._forms = {};
    [
      ["general", t.sec_general],
      ["power", t.sec_power],
      ["volume", t.sec_volume],
      ["display", t.sec_display],
    ].forEach(([id, title]) => {
      const sec = prcSection(id, title);
      const form = document.createElement("ha-form");
      form.computeLabel = (s) => this._label(s);
      form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const value = Object.assign({}, ev.detail.value);
        Object.keys(value).forEach((k) => {
          if (value[k] === "" || value[k] === undefined) delete value[k];
        });
        this._config = value;
        this._render(); // keeps the other forms' data in sync
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: value },
            bubbles: true,
            composed: true,
          })
        );
      });
      sec.querySelector(".prc-sec-body").appendChild(form);
      this.appendChild(sec);
      this._forms[id] = form;
    });
    prcWireSections(this, "perso-remote-card-editor", t);
  }

  /* Built once both config and hass are known (labels depend on the UI language) */
  _render() {
    if (!this._config || !this._hass) return;
    if (!this._forms) this._build();
    const schemas = this._schemas();
    Object.keys(this._forms).forEach((k) => {
      const f = this._forms[k];
      f.hass = this._hass;
      f.data = this._config;
      f.schema = schemas[k];
    });
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
  name: prcT(null).card_name,
  description: prcT(null).card_desc,
  preview: true,
});

console.info(
  `%c PERSO-REMOTE-CARD %c ${PRC_VERSION} `,
  "color:#0b0c0e;background:#8e9bb0;font-weight:700;border-radius:3px 0 0 3px",
  "color:#dfe4ec;background:#2c2f37;border-radius:0 3px 3px 0"
);