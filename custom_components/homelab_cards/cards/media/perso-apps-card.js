/**
 * perso-apps-card.js
 * App launcher grid for a remote entity (e.g. Android TV Remote).
 * Logos are user-provided (e.g. /local/apps/<name>.webp); tiles without a
 * working image fall back to the app icon or its initial.
 *
 * Version : 1.1.0
 */

const PAC_VERSION = "1.1.0";

/* UI strings. Language follows the HA UI language (fr* -> French, else English). */
const PAC_I18N = {
  en: {
    err_empty: "perso-apps-card: empty configuration.",
    err_apps: "perso-apps-card: 'apps' must be a list.",
    err_app: "perso-apps-card: each app must define 'activity', 'package' or 'action'.",
    err_entity: "perso-apps-card: 'entity' (remote domain) is required as soon as an app uses 'activity' or 'package'.",
    no_apps: "No application yet. Add some in the card editor.",
    card_name: "Perso — Apps",
    card_desc: "App launcher grid for a remote entity.",
    expand_all: "Expand all",
    collapse_all: "Collapse all",
    sec_general: "General",
    sec_display: "Display",
    sec_apps: "Applications",
    add_app: "+ Add an application",
    f_name: "Name",
    f_image: "Image (/local/apps/...)",
    f_icon: "Fallback icon (mdi:...)",
    f_activity: "Activity / package",
    labels: {
      entity: "Remote entity",
      title: "Title (leave empty to hide)",
      columns: "Columns",
      radius: "Corner radius (px)",
      state_entity: "Player used to highlight the active app (optional)",
      show_labels: "Show names under tiles",
    },
  },
  fr: {
    err_empty: "perso-apps-card : configuration vide.",
    err_apps: "perso-apps-card : 'apps' doit être une liste.",
    err_app: "perso-apps-card : chaque app doit définir 'activity', 'package' ou 'action'.",
    err_entity: "perso-apps-card : 'entity' (domaine remote) est obligatoire dès qu'une app utilise 'activity' ou 'package'.",
    no_apps: "Aucune application. Ajoutez-en dans l'éditeur de la carte.",
    card_name: "Perso — Applications",
    card_desc: "Grille de lancement d'applications pour une entité remote.",
    expand_all: "Tout déplier",
    collapse_all: "Tout replier",
    sec_general: "Général",
    sec_display: "Affichage",
    sec_apps: "Applications",
    add_app: "+ Ajouter une application",
    f_name: "Nom",
    f_image: "Image (/local/apps/...)",
    f_icon: "Icône de repli (mdi:...)",
    f_activity: "Activity / package",
    labels: {
      entity: "Entité remote",
      title: "Titre (laisser vide pour masquer)",
      columns: "Colonnes",
      radius: "Arrondi (px)",
      state_entity: "Lecteur pour surligner l'app active (optionnel)",
      show_labels: "Afficher les noms sous les tuiles",
    },
  },
};

// Without hass (setConfig before first hass, module load) fall back to the page language.
function pacT(hass) {
  const l = (hass && (hass.locale?.language || hass.language)) || document.documentElement.lang || "en";
  return PAC_I18N[String(l).toLowerCase().startsWith("fr") ? "fr" : "en"];
}

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

  /* No app is assumed: the grid starts empty and is filled in the editor */
  static getStubConfig(hass) {
    const ids = Object.keys(hass.states);
    const ents = hass.entities || {};
    const remote =
      ids.find((e) => e.startsWith("remote.") && ents[e]?.platform === "androidtv_remote") ||
      ids.find((e) => e.startsWith("remote."));
    return {
      type: "custom:perso-apps-card",
      entity: remote || "remote.example",
      columns: 4,
      apps: [],
    };
  }

  setConfig(config) {
    const t = pacT(this._hass);
    if (!config) throw new Error(t.err_empty);
    // An empty list is accepted (empty-state hint) so the card can be added from the picker
    const apps = config.apps === undefined ? [] : config.apps;
    if (!Array.isArray(apps)) throw new Error(t.err_apps);
    const bad = apps.find((a) => !a || (!a.activity && !a.package && !a.action));
    if (bad) throw new Error(t.err_app);
    if (!config.entity && apps.some((a) => a.activity || a.package)) {
      throw new Error(t.err_entity);
    }
    this._config = Object.assign({}, PAC_DEFAULTS, config, { apps });
    this._built = false;
    this._sigCache = null;
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
  }

  getCardSize() {
    const cols = this._config.columns || 4;
    return Math.max(1, Math.ceil(this._config.apps.length / cols) * 2 + (this._config.title ? 1 : 0));
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
    // Reverse match only against app_id: a short generic state ("on") would match any needle
    const appId = String(st.attributes.app_id || "").toLowerCase();
    return hay.includes(needle) || (!!appId && needle.includes(appId));
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

    if (!c.apps.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = pacT(this._hass).no_apps;
      body.appendChild(empty);
    }

    this._tiles = [];
    c.apps.forEach((app) => {
      const wrap = document.createElement("div");
      wrap.className = "wrap";

      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.style.borderRadius = c.radius + "px";
      tile.title = app.name || "";
      if (app.name) tile.setAttribute("aria-label", app.name);

      // Missing/broken image: optional icon, else the name's initial (+ short name), else a generic icon
      const mkFallback = () => {
        const fb = document.createElement("span");
        fb.className = "fallback";
        const name = String(app.name || "").trim();
        if (app.icon || !name) {
          const ic = document.createElement("ha-icon");
          ic.setAttribute("icon", app.icon || "mdi:application-outline");
          fb.appendChild(ic);
        } else {
          const ini = document.createElement("span");
          ini.className = "ini";
          ini.textContent = Array.from(name)[0].toUpperCase();
          fb.appendChild(ini);
        }
        if (name && !c.show_labels) {
          const nm = document.createElement("span");
          nm.className = "nm";
          nm.textContent = name;
          fb.appendChild(nm);
        }
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
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  width: 100%; height: 100%; box-sizing: border-box;
  font-size: 11px; font-weight: 700; color: #dfe4ec;
  padding: 4px; text-align: center; line-height: 1.15;
}
.tile .fallback .ini { font-size: 22px; line-height: 1; }
.tile .fallback ha-icon { --mdc-icon-size: 26px; }
.tile .fallback .nm {
  max-width: 100%; font-size: 10px; font-weight: 600; opacity: .8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.empty {
  font-size: 12px; font-style: italic;
  color: var(--secondary-text-color, #9aa0ab);
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

/* Collapsible editor sections. Open/closed state survives editor re-creation
   (module-level Map keyed `${tag}:${sectionId}`); only `hidden` is toggled so
   form fields, their values and focus are never touched. */
const PAC_SECTIONS = new Map();
let pacSecSeq = 0;

const PAC_SEC_CSS = `
  .pac-sec { margin-bottom: 14px; }
  .pac-sec-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px; padding-bottom: 6px;
    border-bottom: 1px solid var(--divider-color);
  }
  .pac-sec-toggle {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px;
    background: none; border: none; padding: 2px 0; margin: 0; border-radius: 4px;
    font: inherit; font-size: 15px; font-weight: 600; color: var(--primary-text-color);
    text-align: left; cursor: pointer;
  }
  .pac-chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform .2s ease; flex-shrink: 0; }
  .pac-sec-toggle[aria-expanded="true"] .pac-chev { transform: rotate(90deg); }
  .pac-sec-allbar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .pac-sec-all {
    background: none; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer;
    font: inherit; font-size: 12px; color: var(--secondary-text-color);
  }
  .pac-sec-all:hover { color: var(--primary-text-color); }
  .pac-sec-toggle:focus-visible, .pac-sec-all:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .pac-sec-body[hidden] { display: none !important; }
  @media (prefers-reduced-motion: reduce) { .pac-chev { transition: none; } }
`;

function pacSection(id, title) {
  const sec = document.createElement("div");
  sec.className = "pac-sec";
  sec.dataset.sec = id;
  sec.innerHTML =
    '<div class="pac-sec-head"><button type="button" class="pac-sec-toggle">' +
    '<ha-icon class="pac-chev" icon="mdi:chevron-right"></ha-icon><span></span></button></div>' +
    '<div class="pac-sec-body"></div>';
  sec.querySelector(".pac-sec-toggle span").textContent = title;
  return sec;
}

function pacWireSections(root, tag, t) {
  const secs = Array.from(root.querySelectorAll(".pac-sec[data-sec]"));
  const all = root.querySelector(".pac-sec-all");
  const uid = "pacsec" + ++pacSecSeq;
  const sync = () => {
    if (all) all.textContent = secs.some((s) => s.hasAttribute("data-closed")) ? t.expand_all : t.collapse_all;
  };
  const set = (s, open) => {
    PAC_SECTIONS.set(tag + ":" + s.dataset.sec, open);
    s.toggleAttribute("data-closed", !open);
    s.querySelector(".pac-sec-toggle").setAttribute("aria-expanded", String(open));
    s.querySelector(".pac-sec-body").hidden = !open;
  };
  secs.forEach((s, i) => {
    const btn = s.querySelector(".pac-sec-toggle");
    const body = s.querySelector(".pac-sec-body");
    btn.id = uid + "-" + s.dataset.sec + "-h";
    body.id = uid + "-" + s.dataset.sec + "-b";
    btn.setAttribute("aria-controls", body.id);
    body.setAttribute("role", "region");
    body.setAttribute("aria-labelledby", btn.id);
    const saved = PAC_SECTIONS.get(tag + ":" + s.dataset.sec);
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

class PersoAppsCardEditor extends HTMLElement {
  constructor() {
    super();
    this._built = false;
  }

  setConfig(config) {
    // HA echoes back the config we just emitted: rebuilding the rows would steal focus mid-typing
    if (this._built && JSON.stringify(config) === this._lastEmitted) return;
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!Array.isArray(this._config.apps)) this._config.apps = [];
    if (this._built) this._fill();
    else this._ensureBuilt();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._forms) this._forms.forEach((f) => (f.hass = hass));
    else this._ensureBuilt();
  }

  /* Built once both config and hass are known (labels depend on the UI language) */
  _ensureBuilt() {
    if (this._built || !this._config || !this._hass) return;
    this._build();
    this._fill();
  }

  _emit() {
    const cfg = JSON.parse(JSON.stringify(this._config));
    cfg.apps = cfg.apps.map((a) => {
      const o = {};
      ["name", "image", "icon", "activity", "package", "match", "background", "action"].forEach((k) => {
        if (a[k]) o[k] = a[k];
      });
      if (a.data) o.data = a.data;
      if (a.target) o.target = a.target;
      return o;
    });
    this._lastEmitted = JSON.stringify(cfg);
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: cfg },
        bubbles: true,
        composed: true,
      })
    );
  }

  _generalSchema() {
    return [
      { name: "entity", selector: { entity: { filter: { domain: ["remote"] } } } },
      { name: "title", selector: { text: {} } },
      {
        name: "state_entity",
        selector: { entity: { filter: { domain: ["media_player"] } } },
      },
    ];
  }

  _displaySchema() {
    return [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "columns", selector: { number: { min: 2, max: 8, step: 1, mode: "box" } } },
          { name: "radius", selector: { number: { min: 0, max: 40, step: 1, mode: "box" } } },
        ],
      },
      { name: "show_labels", selector: { boolean: {} } },
    ];
  }

  _label(schema) {
    return pacT(this._hass).labels[schema.name] || schema.name;
  }

  _build() {
    const t = pacT(this._hass);
    this.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      .pac-ed-apps { margin-top: 14px; display: flex; flex-direction: column; gap: 10px; }
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
    style.textContent += PAC_SEC_CSS;
    this.appendChild(style);

    const bar = document.createElement("div");
    bar.className = "pac-sec-allbar";
    bar.innerHTML = '<button type="button" class="pac-sec-all"></button>';
    this.appendChild(bar);

    // General + display forms both carry every top-level key (ha-form emits data + change)
    const mkTopForm = () => {
      const f = document.createElement("ha-form");
      f.computeLabel = (s) => this._label(s);
      f.hass = this._hass;
      f.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const v = Object.assign({}, ev.detail.value);
        Object.keys(v).forEach((k) => {
          if (v[k] === "" || v[k] === undefined) delete v[k];
        });
        const apps = this._config.apps;
        this._config = Object.assign({}, v, { type: this._config.type, apps });
        this._fillTop();
        this._emit();
      });
      return f;
    };
    this._generalForm = mkTopForm();
    this._displayForm = mkTopForm();
    this._forms = [this._generalForm, this._displayForm];

    const general = pacSection("general", t.sec_general);
    general.querySelector(".pac-sec-body").appendChild(this._generalForm);
    this.appendChild(general);

    const display = pacSection("display", t.sec_display);
    display.querySelector(".pac-sec-body").appendChild(this._displayForm);
    this.appendChild(display);

    const appsSec = pacSection("apps", t.sec_apps);
    const appsBody = appsSec.querySelector(".pac-sec-body");
    this._appsBox = document.createElement("div");
    this._appsBox.className = "pac-ed-apps";
    appsBody.appendChild(this._appsBox);

    const add = document.createElement("button");
    add.className = "pac-ed-add";
    add.type = "button";
    add.textContent = t.add_app;
    add.addEventListener("click", () => {
      this._config.apps = this._config.apps.concat([{ name: "", image: "", activity: "" }]);
      this._fillApps();
      this._emit();
    });
    appsBody.appendChild(add);
    this.appendChild(appsSec);

    pacWireSections(this, "perso-apps-card-editor", t);
    this._built = true;
  }

  _fillTop() {
    const top = Object.assign({}, this._config);
    delete top.apps;
    delete top.type;
    this._generalForm.data = top;
    this._generalForm.schema = this._generalSchema();
    this._displayForm.data = top;
    this._displayForm.schema = this._displaySchema();
  }

  _fill() {
    this._fillTop();
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
    const tx = pacT(this._hass);

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
        this._mkField(tx.f_name, app.name, (v) => {
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
        this._mkField(tx.f_image, app.image, (v) => {
          this._config.apps[i].image = v;
          this._emit();
        })
      );
      line2.appendChild(
        this._mkField(tx.f_icon, app.icon, (v) => {
          this._config.apps[i].icon = v;
          this._emit();
        })
      );
      row.appendChild(line2);

      const line3 = document.createElement("div");
      line3.className = "pac-ed-line";
      line3.appendChild(
        this._mkField(tx.f_activity, app.activity || app.package, (v) => {
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
  name: pacT(null).card_name,
  description: pacT(null).card_desc,
  preview: true,
});

console.info(
  `%c PERSO-APPS-CARD %c ${PAC_VERSION} `,
  "color:#0b0c0e;background:#8e9bb0;font-weight:700;border-radius:3px 0 0 3px",
  "color:#dfe4ec;background:#2c2f37;border-radius:0 3px 3px 0"
);