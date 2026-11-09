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