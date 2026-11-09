/**
 * Proxmox Guests Card — VMs (QEMU) and containers (LXC)
 * Version 1.0.0
 *
 * One card for both: add it twice for a "Virtual machines" block and a
 * "Containers" block (see `guest_type`).
 *
 * Buttons follow the state: a stopped guest offers "Start", a running guest
 * offers "Shut down / Force stop / Reboot".
 *
 * Loaded automatically by the Homelab Cards integration.
 * With an empty `guests` list, guests are detected from the Proxmox VE (HACS
 * "proxmoxve") integration through the entity/device registries
 * (platform + translation_key + device model), never from names or UI language.
 */

const PGUEST_VERSION = "1.0.0";

/* ---------- i18n ---------- */
const PG_I18N = {
  en: {
    def_title: "Guests", running: "{0} running", stopped: "stopped", guest: "Guest",
    this_guest: "this guest", missing: "{0} guest(s) with a status entity not found.",
    none: "No guest found (Proxmox VE integration).",
    b_cpu: "CPU", b_mem: "RAM", b_disk: "Disk",
    y: "y", mo: "mo", d: "d",
    act_start: "Start", act_resume: "Resume", act_shutdown: "Shut down", act_stop: "Force stop",
    act_reboot: "Reboot", act_reset: "Reset", act_suspend: "Suspend", act_hibernate: "Hibernate",
    /* editor */
    title: "Title", icon: "Icon", show_bars: "Show CPU/RAM/disk bars",
    show_network: "Show network traffic", show_uptime: "Show uptime",
    warn_at: "Warning threshold (%)", critical_at: "Critical threshold (%)",
    node: "Node (name or device ID, auto-detection)", guest_type: "Guest type (auto-detection)",
    gt_all: "VMs and containers", gt_qemu: "Virtual machines (QEMU)", gt_lxc: "Containers (LXC)",
    name: "Guest name", vmid: "ID (VMID)",
    status: "Status sensor", status_text: "Status as text", health: "Health",
    cpu: "CPU (%)", memory: "Memory (%)", disk: "Disk (%)",
    network_in: "Network in", network_out: "Network out", last_boot: "Last boot",
    s_general: "General", s_colors: "Colors", s_guests: "Guests",
    c_accent: "Accent", c_on: "Running", buttons: "Action buttons", empty: "No guest.",
    add_guest: "Add a guest", guest_n: "Guest #{0}",
    expand_all: "Expand all", collapse_all: "Collapse all",
    hint_guests: "Buttons follow the state: “Start” when the guest is stopped, “Shut down / Force / Reboot” when it runs. Leave empty the actions your guest type does not have. Leave the list empty to detect guests automatically.",
    desc: "VMs and LXC containers: status, resources and contextual actions.",
  },
  fr: {
    def_title: "Invités", running: "{0} en marche", stopped: "arrêté", guest: "Invité",
    this_guest: "cet invité", missing: "{0} invité(s) avec une entité d'état introuvable.",
    none: "Aucun invité détecté (intégration Proxmox VE).",
    b_cpu: "CPU", b_mem: "RAM", b_disk: "Disque",
    y: "an", mo: "mois", d: "j",
    act_start: "Démarrer", act_resume: "Reprendre", act_shutdown: "Éteindre", act_stop: "Forcer l'arrêt",
    act_reboot: "Redémarrer", act_reset: "Réinitialiser", act_suspend: "Suspendre", act_hibernate: "Hiberner",
    title: "Titre", icon: "Icône", show_bars: "Afficher les barres CPU/RAM/disque",
    show_network: "Afficher le trafic réseau", show_uptime: "Afficher la durée de marche",
    warn_at: "Seuil d'alerte (%)", critical_at: "Seuil critique (%)",
    node: "Nœud (nom ou ID d'appareil, détection auto)", guest_type: "Type d'invité (détection auto)",
    gt_all: "VM et conteneurs", gt_qemu: "Machines virtuelles (QEMU)", gt_lxc: "Conteneurs (LXC)",
    name: "Nom de l'invité", vmid: "Identifiant (VMID)",
    status: "Capteur d'état", status_text: "État en texte", health: "Santé",
    cpu: "CPU (%)", memory: "Mémoire (%)", disk: "Disque (%)",
    network_in: "Réseau entrant", network_out: "Réseau sortant", last_boot: "Dernier démarrage",
    s_general: "Général", s_colors: "Couleurs", s_guests: "Invités",
    c_accent: "Accent", c_on: "En marche", buttons: "Boutons d'action", empty: "Aucun invité.",
    add_guest: "Ajouter un invité", guest_n: "Invité #{0}",
    expand_all: "Tout déplier", collapse_all: "Tout replier",
    hint_guests: "Les boutons s'adaptent à l'état : « Démarrer » quand l'invité est arrêté, « Éteindre / Forcer / Redémarrer » quand il tourne. Laisse vide les actions que ton type d'invité n'a pas. Laisse la liste vide pour détecter les invités automatiquement.",
    desc: "VM et conteneurs LXC : état, ressources et actions contextuelles.",
  },
};
const gLoc = (h) => (h && ((h.locale && h.locale.language) || h.language)) || "en";
const gDict = (loc) => PG_I18N[/^fr/i.test(loc) ? "fr" : "en"];
const gT = (h, k, a) => {
  const v = gDict(gLoc(h))[k];
  const s = v !== undefined ? v : (PG_I18N.en[k] !== undefined ? PG_I18N.en[k] : k);
  return a === undefined ? s : String(s).replace("{0}", a);
};

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
const gFmt = (st, d, h) => {
  if (!st) return "—";
  const n = parseFloat(st.state);
  if (isNaN(n)) return st.state === "unavailable" || st.state === "unknown" ? "—" : st.state;
  return n.toLocaleString(gLoc(h), { maximumFractionDigits: d === undefined ? 1 : d });
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
function gSince(raw, h) {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return null;
  const d = Math.floor(sec / 86400);
  if (d >= 365) {
    const y = Math.floor(d / 365);
    return y + " " + gT(h, "y") + (y > 1 && /^fr/i.test(gLoc(h)) ? "s" : "");
  }
  if (d >= 30) return Math.floor(d / 30) + " " + gT(h, "mo");
  if (d >= 1) return d + " " + gT(h, "d");
  const hr = Math.floor(sec / 3600);
  if (hr >= 1) return hr + " h";
  return Math.max(1, Math.floor(sec / 60)) + " min";
}

/* Action catalogue: icon, color and the state in which it is offered.
   The key is also the proxmoxve button translation_key. */
const G_ACTIONS = {
  start:     { icon: "mdi:play",           color: "#1D9E75", when: "off" },
  resume:    { icon: "mdi:play-pause",     color: "#1D9E75", when: "off" },
  shutdown:  { icon: "mdi:power",          color: "#BA7517", when: "on" },
  stop:      { icon: "mdi:stop",           color: "#E24B4A", when: "on" },
  reboot:    { icon: "mdi:restart",        color: "#378ADD", when: "on" },
  reset:     { icon: "mdi:restart-alert",  color: "#E24B4A", when: "on" },
  suspend:   { icon: "mdi:pause",          color: "#7F77DD", when: "on" },
  hibernate: { icon: "mdi:snowflake",      color: "#7F77DD", when: "on" },
};
const G_ORDER = ["start", "resume", "shutdown", "stop", "reboot", "reset", "suspend", "hibernate"];

/* ---------- proxmoxve auto-detection ---------- */
/* { device_id: { "<domain>.<translation_key>": entity_id } } for proxmoxve entities */
function pgByDevice(hass) {
  const out = {};
  Object.values((hass && hass.entities) || {}).forEach((e) => {
    if (!e || e.platform !== "proxmoxve" || !e.device_id || !e.translation_key) return;
    if (!hass.states[e.entity_id]) return;
    const m = out[e.device_id] || (out[e.device_id] = {});
    m[e.entity_id.split(".")[0] + "." + e.translation_key] = e.entity_id;
  });
  return out;
}
/* Node device id matching `want` (device id, device name or "… <node>") */
function pgNodeId(hass, by, want) {
  const devs = hass.devices || {};
  return Object.keys(by).find((id) => {
    const e = by[id];
    if (!(e["sensor.node_status"] || e["sensor.qemu_on"] || e["sensor.lxc_on"] || e["button.start_all"])) return false;
    return [id, devs[id] && devs[id].name_by_user, devs[id] && devs[id].name]
      .some((x) => x && (x === want || String(x).endsWith(" " + want)));
  }) || null;
}
/* Guest devices: model "QEMU" / "LXC", name "<TYPE> <name> (<vmid>)" */
function pgDetect(hass, want, type) {
  if (!hass) return [];
  const by = pgByDevice(hass), devs = hass.devices || {};
  const nodeId = want ? pgNodeId(hass, by, want) : null;
  if (want && !nodeId) return [];
  const kindWanted = type && type !== "all" ? String(type).toUpperCase() : null;
  return Object.keys(by).map((id) => {
    const e = by[id], d = devs[id] || {};
    const kind = String(d.model || "").toUpperCase();
    if (kind !== "QEMU" && kind !== "LXC") return null;
    if (kindWanted && kind !== kindWanted) return null;
    if (nodeId && d.via_device_id !== nodeId) return null;
    const m = /^\S+\s+(.*)\s+\((\d+)\)$/.exec(d.name || "");
    const actions = {};
    G_ORDER.forEach((k) => { if (e["button." + k]) actions[k] = e["button." + k]; });
    const g = {
      name: d.name_by_user || (m ? m[1] : d.name) || id,
      vmid: m ? m[2] : undefined,
      status: e["binary_sensor.status"],
      status_text: e["sensor.status_raw"],
      health: e["binary_sensor.health"],
      cpu: e["sensor.cpu_used"],
      memory: e["sensor.memory_used_perc"],
      disk: e["sensor.disk_used_perc"],
      network_in: e["sensor.network_in"],
      network_out: e["sensor.network_out"],
      last_boot: e["sensor.uptime"],
    };
    if (Object.keys(actions).length) g.actions = actions;
    return g;
  }).filter(Boolean).sort((a, b) =>
    (parseInt(a.vmid, 10) || 0) - (parseInt(b.vmid, 10) || 0) || String(a.name).localeCompare(String(b.name)));
}

class ProxmoxGuestsCard extends HTMLElement {
  setConfig(config) {
    this._auto = !(config.guests && config.guests.length);
    this._config = {
      title: config.title || null,
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
      node: config.node || null,
      guest_type: config.guest_type || "all",
      guests: this._auto ? [] : config.guests,
    };
    this._ents = undefined;
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
    if (this._auto && hass.entities !== this._ents) {
      this._ents = hass.entities;
      this._config.guests = pgDetect(hass, this._config.node, this._config.guest_type);
    }
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
    return gLoc(h) + "#" + this._config.guests.length + "#" +
      this._ids().map((id) => id + ":" + (h.states[id] ? h.states[id].state : "∅")).join("|");
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
        .none { font-size:11px; color:var(--secondary-text-color); font-style:italic; padding:2px; }
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
    const t = (k, a) => gT(hass, k, a);

    r.querySelector("ha-card").style.borderColor = gRgba(c.accent, 0.28);
    const disc = r.querySelector(".disc");
    disc.style.background = gRgba(c.accent, 0.14);
    const ic = disc.querySelector("ha-icon");
    ic.setAttribute("icon", c.icon);
    ic.style.color = c.accent;
    r.querySelector(".htitle").textContent = c.title || t("def_title");

    let running = 0, missing = 0;
    c.guests.forEach((g) => {
      const st = g.status ? hass.states[g.status] : null;
      if (g.status && !st) missing++;
      if (gOn(st)) running++;
    });
    r.querySelector(".hsub").innerHTML =
      '<b style="color:' + c.color_on + '">' + gEsc(t("running", running)) + "</b> / " + c.guests.length;

    const list = r.querySelector(".list");
    list.innerHTML = "";

    if (!c.guests.length) {
      const n = document.createElement("div");
      n.className = "none";
      n.textContent = t("none");
      list.appendChild(n);
    }

    if (missing) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = t("missing", missing);
      list.appendChild(w);
    }

    c.guests.forEach((g) => {
      const stSt = g.status ? hass.states[g.status] : null;
      const on = gOn(stSt);
      const el = document.createElement("div");
      el.className = "gu" + (on ? "" : " off");

      /* --- Line 1: state, name, health --- */
      const top = document.createElement("div");
      top.className = "gu-top";

      const txtSt = g.status_text ? hass.states[g.status_text] : null;
      const stateLabel = txtSt
        ? (hass.formatEntityState ? hass.formatEntityState(txtSt) : txtSt.state)
        : (on ? "" : t("stopped"));

      let healthHtml = "";
      if (g.health && hass.states[g.health]) {
        const ok = gOn(hass.states[g.health]);
        healthHtml = '<ha-icon class="gu-health" icon="' +
          (ok ? "mdi:heart-pulse" : "mdi:heart-broken") +
          '" style="color:' + (ok ? c.color_on : "#E24B4A") + '"></ha-icon>';
      }

      top.innerHTML =
        '<span class="dot" style="background:' + (on ? c.color_on : c.color_off) + '"></span>' +
        '<span class="gu-name">' + gEsc(g.name || t("guest")) +
          (g.vmid ? ' <span class="vmid">· ' + gEsc(g.vmid) + "</span>" : "") + "</span>" +
        (stateLabel ? '<span class="gu-state">' + gEsc(stateLabel) + "</span>" : "") +
        healthHtml;
      top.querySelector(".gu-name").addEventListener("click", () =>
        this._more(g.status || g.cpu));
      el.appendChild(top);

      /* --- Line 2: CPU / RAM / disk bars (only while running) --- */
      if (c.show_bars && on) {
        const bars = document.createElement("div");
        bars.className = "bars";
        const defs = [
          { e: g.cpu, n: t("b_cpu"), col: c.color_cpu },
          { e: g.memory, n: t("b_mem"), col: c.color_mem },
          { e: g.disk, n: t("b_disk"), col: c.color_disk },
        ].filter((d) => d.e);
        if (defs.length) {
          defs.forEach((d) => {
            const st = hass.states[d.e];
            const pct = gNum(st);
            const col = this._barColor(pct, d.col);
            const b = document.createElement("div");
            b.className = "bar";
            b.innerHTML =
              '<div class="bar-top"><span>' + gEsc(d.n) + "</span><span>" +
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

      /* --- Line 3: network, uptime, buttons --- */
      const foot = document.createElement("div");
      foot.className = "gu-foot";
      const parts = [];

      if (c.show_network && on) {
        const inSt = g.network_in ? hass.states[g.network_in] : null;
        const outSt = g.network_out ? hass.states[g.network_out] : null;
        if (inSt) parts.push('<span><ha-icon icon="mdi:arrow-down" style="color:' +
          c.color_cpu + '"></ha-icon> ' + gEsc(gFmt(inSt, undefined, hass)) + " " + gEsc(gUnit(inSt)) + "</span>");
        if (outSt) parts.push('<span><ha-icon icon="mdi:arrow-up" style="color:' +
          c.color_disk + '"></ha-icon> ' + gEsc(gFmt(outSt, undefined, hass)) + " " + gEsc(gUnit(outSt)) + "</span>");
      }
      if (c.show_uptime && on && g.last_boot && hass.states[g.last_boot]) {
        const since = gSince(hass.states[g.last_boot].state, hass);
        if (since) parts.push('<span><ha-icon icon="mdi:clock-outline"></ha-icon> ' + gEsc(since) + "</span>");
      }
      foot.innerHTML = parts.join("");

      /* Contextual buttons */
      const btns = document.createElement("div");
      btns.className = "btns";
      const acts = g.actions || {};
      let any = false;
      G_ORDER.forEach((key) => {
        const entity = acts[key];
        if (!entity) return;
        const def = G_ACTIONS[key];
        const label = t("act_" + key);
        if (on && def.when === "off") return;
        if (!on && def.when === "on") return;
        any = true;
        const busy = this._pending[entity];
        const b = document.createElement("div");
        b.className = "btn" + (busy ? " busy" : "");
        b.title = label;
        b.style.background = gRgba(def.color, 0.14);
        b.innerHTML = '<ha-icon icon="' + def.icon + '" style="color:' + def.color + '"></ha-icon>';
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this._pending[entity]) return;
          const needsConfirm = c.confirm_actions.indexOf(key) !== -1;
          if (needsConfirm) {
            const who = (g.name || t("this_guest")) + (g.vmid ? " (" + g.vmid + ")" : "");
            if (!window.confirm(label + " « " + who + " » ?")) return;
          }
          this._pending[entity] = true;
          this._render();
          const domain = String(entity).split(".")[0];
          const svc = domain === "button" ? "press" : domain === "switch" ? "toggle" : "turn_on";
          this._hass.callService(domain, svc, { entity_id: entity });
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
  static getStubConfig(hass) {
    /* JSON round-trip drops the undefined keys of entities that do not exist */
    const guests = JSON.parse(JSON.stringify(pgDetect(hass, null, "all")));
    return { type: "custom:proxmox-guests-card", title: gT(hass, "def_title"),
      guests: guests.length ? guests : [{ name: gT(hass, "guest") + " 1" }] };
  }
  static getConfigElement() { return document.createElement("proxmox-guests-card-editor"); }
}
customElements.define("proxmox-guests-card", ProxmoxGuestsCard);

/* ================= EDITOR ================= */
const PG_S_GEN = (t) => [
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
  { type: "grid", schema: [
    { name: "node", selector: { text: {} } },
    { name: "guest_type", selector: { select: { mode: "dropdown", options: [
      { value: "all", label: t("gt_all") },
      { value: "qemu", label: t("gt_qemu") },
      { value: "lxc", label: t("gt_lxc") },
    ]}}},
  ]},
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

/* ---------- Collapsible editor sections (state kept across editor re-creations) ---------- */
const PG_SEC_STATE = new Map();
const PG_SEC_CSS = `
  .sec-tools { display:flex; justify-content:flex-end; margin-bottom:4px; }
  .sec-all { background:none; border:none; padding:2px 4px; border-radius:4px; cursor:pointer;
    font:inherit; font-size:12px; color:var(--secondary-text-color); }
  .sec-all:hover { color:var(--primary-text-color); }
  button.sec-head { width:100%; background:none; border:none; border-bottom:1px solid var(--divider-color);
    padding:0 0 6px 0; font:inherit; color:inherit; text-align:left; cursor:pointer; }
  .sec-head:focus-visible, .sec-all:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
  .sec-chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; flex-shrink:0; }
  .sec-head[aria-expanded="false"] .sec-chev { transform:rotate(-90deg); }
  .sec-body[hidden] { display:none !important; }`;
const pgSec = (id, title, body) =>
  '<div class="sec"><button type="button" class="sec-head" data-sec="' + id + '" aria-expanded="false" aria-controls="sec-' + id + '">' +
  '<ha-icon class="sec-chev" icon="mdi:chevron-down"></ha-icon><span class="sec-title">' + gEsc(title) + "</span></button>" +
  '<div class="sec-body" id="sec-' + id + '" hidden>' + body + "</div></div>";
/* Wires headers + "expand/collapse all"; the first section is open by default, the others closed */
function pgWireSections(root, tag, t) {
  const heads = Array.from(root.querySelectorAll(".sec-head"));
  const all = root.querySelector(".sec-all");
  const sync = () => {
    all.textContent = t(heads.some((h) => h.getAttribute("aria-expanded") !== "true") ? "expand_all" : "collapse_all");
  };
  const set = (h, open) => {
    h.setAttribute("aria-expanded", String(open));
    root.getElementById(h.getAttribute("aria-controls")).hidden = !open;
    PG_SEC_STATE.set(tag + ":" + h.dataset.sec, open);
  };
  heads.forEach((h, i) => {
    const k = tag + ":" + h.dataset.sec;
    set(h, PG_SEC_STATE.has(k) ? PG_SEC_STATE.get(k) : i === 0);
    h.addEventListener("click", () => { set(h, h.getAttribute("aria-expanded") !== "true"); sync(); });
  });
  all.addEventListener("click", () => {
    const open = heads.some((h) => h.getAttribute("aria-expanded") !== "true");
    heads.forEach((h) => set(h, open)); sync();
  });
  sync();
}

class ProxmoxGuestsCardEditor extends HTMLElement {
  setConfig(cfg) {
    this._config = JSON.parse(JSON.stringify(cfg || {}));
    if (!this._hass) return;
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }
  set hass(h) {
    this._hass = h;
    if (!this._config) return;
    /* Built once hass is known so the UI language is right from the start */
    if (!this._built) { this._build(); this._built = true; this._update(); }
    else this._refreshHass();
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
  _t(k, a) { return gT(this._hass, k, a); }
  _label(s) { return this._t(s.name.indexOf("a_") === 0 ? "act_" + s.name.slice(2) : s.name); }

  _build() {
    const t = (k) => gEsc(this._t(k));
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
        ${PG_SEC_CSS}
      </style>
      <div class="sec-tools"><button type="button" class="sec-all"></button></div>
      ${pgSec("general", this._t("s_general"), `<ha-form class="f-gen"></ha-form>`)}
      ${pgSec("colors", this._t("s_colors"), `
        <div class="colors">
          <div class="color-field"><input type="color" class="c-accent"><label>${t("c_accent")}</label></div>
          <div class="color-field"><input type="color" class="c-on"><label>${t("c_on")}</label></div>
        </div>`)}
      ${pgSec("guests", this._t("s_guests"), `
        <div class="sec-hint">${t("hint_guests")}</div>
        <div class="rows-guests"></div>
        <div class="addbtn add-guest"><ha-icon icon="mdi:plus"></ha-icon><span>${t("add_guest")}</span></div>`)}
    `;
    const r = this.shadowRoot;
    pgWireSections(r, this.tagName.toLowerCase(), (k) => this._t(k));
    const f = r.querySelector(".f-gen");
    f.schema = PG_S_GEN((k) => this._t(k)); f.computeLabel = (s) => this._label(s);
    f.addEventListener("value-changed", (e) => {
      e.stopPropagation();
      Object.assign(this._config, e.detail.value);
      if (this._config.title === "") delete this._config.title;
      if (!this._config.node) delete this._config.node;
      if (!this._config.guest_type || this._config.guest_type === "all") delete this._config.guest_type;
      this._emit();
    });
    const bind = (sel, key) => {
      const el = r.querySelector(sel);
      const apply = (v) => { this._config[key] = v; this._emit(); };
      let tm = null;
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
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
      node: c.node || "", guest_type: c.guest_type || "all",
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
        e.className = "empty"; e.textContent = this._t("empty");
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
    num.textContent = (item.name || this._t("guest_n", index + 1)) + (item.vmid ? " · " + item.vmid : "");
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
    fg.schema = PG_S_GUEST; fg.computeLabel = (s) => this._label(s); fg.hass = this._hass;
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
    lbl.textContent = this._t("buttons");
    row.appendChild(lbl);

    const fa = document.createElement("ha-form");
    fa.className = "f-acts";
    fa.schema = PG_S_ACTS; fa.computeLabel = (s) => this._label(s); fa.hass = this._hass;
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
  description: gDict(document.documentElement.lang || navigator.language || "en").desc,
});
console.info("%c PROXMOX-GUESTS-CARD %c v" + PGUEST_VERSION + " ",
  "color:#fff;background:#378ADD;font-weight:700", "color:#378ADD;background:#222");

/* ============================================================
CONFIG EXAMPLES

Minimal (auto-detection through the proxmoxve integration):

type: custom:proxmox-guests-card
title: Virtual machines
guest_type: qemu          # all | qemu | lxc
node: example-node        # optional, only needed with several nodes

Explicit (entity IDs are placeholders, use your own):

type: custom:proxmox-guests-card
title: Virtual machines
icon: mdi:server
accent: "#378ADD"
guests:
  - name: example-vm
    vmid: 100
    status: binary_sensor.qemu_example_vm_100_status
    status_text: sensor.qemu_example_vm_100_status
    health: binary_sensor.qemu_example_vm_100_health
    cpu: sensor.qemu_example_vm_100_cpu_used
    memory: sensor.qemu_example_vm_100_memory_used_percentage
    disk: sensor.qemu_example_vm_100_disk_used_percentage
    network_in: sensor.qemu_example_vm_100_network_in
    network_out: sensor.qemu_example_vm_100_network_out
    last_boot: sensor.qemu_example_vm_100_last_boot
    actions:
      start: button.qemu_example_vm_100_start
      shutdown: button.qemu_example_vm_100_shutdown
      stop: button.qemu_example_vm_100_stop
      reboot: button.qemu_example_vm_100_reboot
============================================================ */
