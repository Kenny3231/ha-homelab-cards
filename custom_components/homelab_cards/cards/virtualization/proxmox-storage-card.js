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
