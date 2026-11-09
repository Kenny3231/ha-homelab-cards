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