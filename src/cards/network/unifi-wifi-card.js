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
