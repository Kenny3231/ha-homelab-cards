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