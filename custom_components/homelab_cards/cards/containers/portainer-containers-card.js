/**
 * Portainer Containers Card — containers of the native Home Assistant "portainer" integration
 * Version 1.0.0
 *
 * Auto mode (default): every container is discovered through hass.entities
 * (platform "portainer" + translation_key + device_id) and hass.devices
 * (via_device_id → stack → endpoint). Entity ids and display names are never parsed.
 * Optional explicit list: `containers:` (device id / device name, or a map of
 * translation_key → entity_id), see the example at the end of the file.
 */
// Block scope keeps helpers private even if the file is loaded as a classic script.
{
const VERSION = "1.0.0";
const TAG = "portainer-containers-card";

/* ---------- i18n ---------- */
const I18N = {
  en: {
    title: "Containers", running_n: "{n} running", problems_n: "{n} issue(s)", updates_n: "{n} update(s)",
    search: "Search…", f_all: "All", f_running: "Running", f_stopped: "Stopped", f_paused: "Paused",
    f_problem: "Issues", all_endpoints: "All endpoints", all_stacks: "All stacks", no_stack: "No stack",
    s_name: "Name", s_state: "State", s_cpu: "CPU", s_memory: "Memory", s_uptime: "Recently started",
    sort: "Sort", cpu: "CPU", mem: "RAM", restarts: "Restarts", oom: "Out of memory (OOM)",
    update: "Update", update_t: "Image update available", started: "Started", health: "Health",
    a_start: "Start", a_stop: "Stop", a_restart: "Restart", a_pause: "Pause", a_resume: "Resume",
    a_kill: "Kill", a_recreate: "Recreate", confirm_q: "{a} “{n}”?", cancel: "Cancel", confirm: "Confirm",
    st_running: "running", st_exited: "stopped", st_unavailable: "unavailable",
    empty_t: "No Portainer container found",
    empty_h: "Check that the Portainer integration is set up and that its entities are enabled.",
    nomatch_t: "No container matches", reset: "Reset filters", failed: "Action failed: {e}",
    // editor
    sec_gen: "General", sec_display: "Display", sec_colors: "Colors", sec_actions: "Actions",
    open_all: "Expand all", close_all: "Collapse all",
    hint_gen: "Leave the filters empty to show every container. For a hand-picked list, use the YAML key `containers` (see the example at the end of the card file).",
    l_title: "Title (empty = automatic)", l_icon: "Icon", l_endpoints: "Endpoints (empty = all)",
    l_stacks: "Stacks (empty = all)", l_exclude: "Containers to hide", l_group_by_stack: "Group by stack",
    l_sort: "Default sort", l_hide_stopped: "Hide stopped containers", l_max_height: "Max list height (0 = unlimited)", l_show_search: "Search bar",
    l_show_filters: "Filters (state, endpoint, stack, sort)", l_show_bars: "CPU / memory gauges",
    l_show_image: "Show image", l_show_actions: "Action buttons", l_warn_at: "Warning threshold (%)",
    l_critical_at: "Critical threshold (%)", l_confirm_actions: "Ask for confirmation before",
    l_accent: "Accent",
  },
  fr: {
    title: "Conteneurs", running_n: "{n} en marche", problems_n: "{n} problème(s)", updates_n: "{n} MAJ",
    search: "Rechercher…", f_all: "Tous", f_running: "En marche", f_stopped: "Arrêtés", f_paused: "En pause",
    f_problem: "Problèmes", all_endpoints: "Tous les endpoints", all_stacks: "Toutes les stacks", no_stack: "Hors stack",
    s_name: "Nom", s_state: "État", s_cpu: "CPU", s_memory: "Mémoire", s_uptime: "Démarrage récent",
    sort: "Tri", cpu: "CPU", mem: "RAM", restarts: "Redémarrages", oom: "Mémoire saturée (OOM)",
    update: "MAJ", update_t: "Mise à jour d'image disponible", started: "Démarré", health: "Santé",
    a_start: "Démarrer", a_stop: "Arrêter", a_restart: "Redémarrer", a_pause: "Mettre en pause", a_resume: "Reprendre",
    a_kill: "Forcer l'arrêt (kill)", a_recreate: "Recréer", confirm_q: "{a} « {n} » ?", cancel: "Annuler", confirm: "Confirmer",
    st_running: "en marche", st_exited: "arrêté", st_unavailable: "indisponible",
    empty_t: "Aucun conteneur Portainer trouvé",
    empty_h: "Vérifiez que l'intégration Portainer est configurée et que ses entités sont activées.",
    nomatch_t: "Aucun conteneur ne correspond", reset: "Réinitialiser les filtres", failed: "Échec de l'action : {e}",
    sec_gen: "Général", sec_display: "Affichage", sec_colors: "Couleurs", sec_actions: "Actions",
    open_all: "Tout déplier", close_all: "Tout replier",
    hint_gen: "Laissez les filtres vides pour afficher tous les conteneurs. Pour une liste choisie à la main, utilisez la clé YAML `containers` (voir l'exemple en fin de fichier de la carte).",
    l_title: "Titre (vide = automatique)", l_icon: "Icône", l_endpoints: "Endpoints (vide = tous)",
    l_stacks: "Stacks (vide = toutes)", l_exclude: "Conteneurs à masquer", l_group_by_stack: "Grouper par stack",
    l_sort: "Tri par défaut", l_hide_stopped: "Masquer les conteneurs arrêtés", l_max_height: "Hauteur max. de la liste (0 = illimitée)", l_show_search: "Barre de recherche",
    l_show_filters: "Filtres (état, endpoint, stack, tri)", l_show_bars: "Jauges CPU / mémoire",
    l_show_image: "Afficher l'image", l_show_actions: "Boutons d'action", l_warn_at: "Seuil d'alerte (%)",
    l_critical_at: "Seuil critique (%)", l_confirm_actions: "Demander confirmation avant",
    l_accent: "Accent",
  },
};
const langCode = (h) => String((h && ((h.locale && h.locale.language) || h.language)) || "en");
const tr = (h) => {
  const L = langCode(h).toLowerCase().indexOf("fr") === 0 ? I18N.fr : I18N.en;
  return (k, v) => String(L[k] != null ? L[k] : I18N.en[k] != null ? I18N.en[k] : k)
    .replace(/\{(\w+)\}/g, (_, x) => (v && v[x] != null ? v[x] : ""));
};

/* ---------- Helpers ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const bad = (st) => !st || st.state === "unavailable" || st.state === "unknown";
const num = (st) => { if (bad(st)) return NaN; const n = parseFloat(st.state); return isNaN(n) ? NaN : n; };
const nf = (h, o) => { try { return new Intl.NumberFormat(langCode(h), o); } catch (e) { return new Intl.NumberFormat("en", o); } };
const fmt = (h, st) => {
  if (bad(st)) return "—";
  if (h.formatEntityState) { try { return h.formatEntityState(st); } catch (e) { /* older HA: manual format */ } }
  const u = (st.attributes || {}).unit_of_measurement;
  // Only plain numbers get locale formatting ("1.25.3" is a version, not 1.25).
  const n = /^-?\d+(\.\d+)?$/.test(st.state) ? parseFloat(st.state) : NaN;
  return (isNaN(n) ? st.state : nf(h, { maximumFractionDigits: 1 }).format(n)) + (u ? " " + u : "");
};
const UNITS = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 };
const bytes = (st) => {
  const n = num(st); if (isNaN(n)) return NaN;
  const f = UNITS[String((st.attributes || {}).unit_of_measurement || "B").toLowerCase()];
  return f ? n * f : NaN;
};
const since = (h, raw) => {
  const t = Date.parse(raw); if (isNaN(t)) return null;
  const s = (Date.now() - t) / 1000; if (s < 0) return null;
  const [v, unit] = s >= 86400 ? [Math.floor(s / 86400), "day"] : s >= 3600 ? [Math.floor(s / 3600), "hour"]
    : [Math.max(1, Math.floor(s / 60)), "minute"];
  return nf(h, { style: "unit", unit, unitDisplay: "narrow" }).format(v);
};
const arr = (v) => (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]);
const lc = (s) => String(s == null ? "" : s).toLowerCase();
const matchAny = (list, id, name) => list.some((x) => x === id || (name && lc(x) === lc(name)));

/* ---------- Portainer discovery (shared shape across the Portainer cards) ---------- */
// Kind inferred from the entities a device carries; the device model is only a fallback.
const KIND_KEYS = {
  container: ["container_state", "container", "restart_container", "cpu_usage_total"],
  stack: ["stack_type", "stack", "update_stack", "stack_containers_count"],
  endpoint: ["containers_count", "docker_version", "images_prune", "containers_running"],
  server: ["server_update"],
  volume: ["volume_driver", "volume_size"],
};
const MODELS = ["container", "stack", "endpoint", "server", "volume"];
let SCAN = null;
function scan(hass) {
  if (SCAN && SCAN.e === hass.entities && SCAN.d === hass.devices) return SCAN.r;
  const reg = hass.devices || {}, ents = hass.entities || {}, devs = {};
  Object.keys(ents).forEach((eid) => {
    const e = ents[eid];
    if (!e || e.platform !== "portainer" || !e.device_id || !e.translation_key) return;
    const d = devs[e.device_id] || (devs[e.device_id] = { id: e.device_id, ents: {} });
    if (!d.ents[e.translation_key]) d.ents[e.translation_key] = eid;
  });
  const kindOf = (id) => {
    const d = devs[id];
    if (d) {
      const keys = Object.keys(d.ents);
      const k = Object.keys(KIND_KEYS).find((x) => KIND_KEYS[x].some((y) => keys.indexOf(y) !== -1));
      if (k) return k;
    }
    const m = lc(reg[id] && reg[id].model);
    return MODELS.indexOf(m) !== -1 ? m : null;
  };
  // First ancestor of a wanted kind: a container hangs on its stack or directly on its endpoint.
  const up = (id, kinds) => {
    let cur = reg[id] && reg[id].via_device_id;
    for (let i = 0; cur && i < 8; i++) {
      if (kinds.indexOf(kindOf(cur)) !== -1) return cur;
      cur = reg[cur] && reg[cur].via_device_id;
    }
    return null;
  };
  const nameOf = (id) => (reg[id] && (reg[id].name_by_user || reg[id].name)) || "";
  const r = { byId: devs, containers: [], stacks: [], endpoints: [], servers: [], volumes: [] };
  Object.keys(devs).forEach((id) => {
    const d = devs[id];
    d.name = nameOf(id) || id;
    d.entries = (reg[id] && reg[id].config_entries) || [];
    d.kind = kindOf(id);
    d.stack = d.kind === "container" || d.kind === "volume" ? up(id, ["stack"]) : null;
    d.endpoint = d.kind === "endpoint" || d.kind === "server" ? null : up(id, ["endpoint", "server"]);
    d.stackName = d.stack ? nameOf(d.stack) : "";
    d.endpointName = d.endpoint ? nameOf(d.endpoint) : "";
    if (r[d.kind + "s"]) r[d.kind + "s"].push(d);
  });
  const by = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  ["containers", "stacks", "endpoints", "servers", "volumes"].forEach((k) => r[k].sort(by));
  SCAN = { e: hass.entities, d: hass.devices, r };
  return r;
}

/* ---------- Card ---------- */
const DEF = {
  icon: "mdi:docker", accent: "#2496ED", endpoints: [], stacks: [], exclude: [],
  group_by_stack: false, sort: "name", hide_stopped: false, show_search: true, show_filters: true,
  show_bars: true, show_image: true, show_actions: true, max_height: 560, warn_at: 80, critical_at: 92,
  confirm_actions: ["stop", "kill", "recreate"],
};
const TONE = {
  on: "var(--hc-on)", warn: "var(--hc-warn)", crit: "var(--hc-crit)", pause: "var(--hc-pause)",
  info: "var(--hc-info)", off: "var(--hc-off)", na: "var(--disabled-text-color,#8a8a86)",
};
const RANK = { crit: 0, warn: 1, info: 2, on: 3, pause: 4, off: 5, na: 6 };
// Contextual buttons: translation_key of the button entity, and the states where it makes sense.
const ACTS = [
  { id: "restart", key: "restart_container", icon: "mdi:restart", tone: "info", when: ["running"] },
  { id: "pause", key: "pause_container", icon: "mdi:pause", tone: "pause", when: ["running"] },
  { id: "resume", key: "resume_container", icon: "mdi:play-pause", tone: "on", when: ["paused"] },
  { id: "recreate", key: "recreate_container", icon: "mdi:autorenew", tone: "warn", when: ["running", "paused", "stopped"] },
  { id: "kill", key: "kill_container", icon: "mdi:skull-outline", tone: "crit", when: ["running", "paused"] },
];
const SORTS = ["name", "state", "cpu", "memory", "uptime"];

class PortainerContainersCard extends HTMLElement {
  setConfig(config) {
    const c = Object.assign({}, DEF, config || {});
    ["endpoints", "stacks", "exclude", "confirm_actions"].forEach((k) => { c[k] = arr(c[k]); });
    c.containers = arr(config && config.containers);
    if (SORTS.indexOf(c.sort) === -1) c.sort = "name";
    this._config = c;
    this._ui = Object.assign({ q: "", state: "all", endpoint: "", stack: "" }, this._ui, { sort: c.sort });
    this._pending = this._pending || {};
    this._collapsed = this._collapsed || new Set();
    this._listKey = null;
    if (this._built) this._render();
  }

  connectedCallback() {
    this._timer = setInterval(() => { if (this._built) this._renderList(); }, 60000);
  }
  disconnectedCallback() { clearInterval(this._timer); clearTimeout(this._cTimer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    const list = this._items();
    let changed = list !== this._lastList;
    this._lastList = list;
    const seen = this._seen || (this._seen = new Map());
    list.forEach((d) => Object.keys(d.ents).forEach((k) => {
      if (k === "docker_event") return; // fires on every Docker event, not displayed
      const id = d.ents[k], st = hass.states[id];
      if (seen.get(id) !== st) { seen.set(id, st); changed = true; }
    }));
    if (changed) this._render();
  }

  /* Containers in scope (config filters only), cached until the registry or the config changes */
  _items() {
    const h = this._hass, c = this._config, s = scan(h);
    if (this._listKey === s) return this._list;
    let list;
    if (c.containers.length) {
      list = c.containers.map((it, i) => {
        const o = typeof it === "string" ? { device: it } : it || {};
        const d = o.device ? s.containers.find((x) => matchAny([o.device], x.id, x.name)) : null;
        if (!d && !o.entities) return null;
        const base = d || { id: "cfg_" + i, stack: null, endpoint: null, stackName: "", endpointName: "" };
        return Object.assign({}, base, {
          name: o.name || (d && d.name) || "#" + (i + 1),
          ents: Object.assign({}, d ? d.ents : {}, o.entities || {}),
        });
      }).filter(Boolean);
    } else list = s.containers.slice();
    list = list.filter((d) =>
      (!c.endpoints.length || matchAny(c.endpoints, d.endpoint, d.endpointName)) &&
      (!c.stacks.length || matchAny(c.stacks, d.stack, d.stackName)) &&
      !matchAny(c.exclude, d.id, d.name));
    this._listKey = s; this._list = list;
    return list;
  }

  /* Derived view model of one container */
  _model(d) {
    const h = this._hass, S = (k) => (d.ents[k] ? h.states[d.ents[k]] : null);
    const stS = S("container_state"), hS = S("container_health_state"), sw = S("container");
    let raw = !bad(stS) ? lc(stS.state) : null;
    if (!raw) {
      const b = S("status") || sw;
      raw = bad(b) ? "unavailable" : b.state === "on" ? "running" : "exited";
    }
    const health = !bad(hS) ? lc(hS.state) : "";
    const oomS = S("container_out_of_memory"), oom = !!oomS && oomS.state === "on";
    let tone;
    if (raw === "running") tone = health === "unhealthy" ? "crit" : health === "starting" ? "warn" : "on";
    else if (raw === "paused") tone = "pause";
    else if (raw === "restarting") tone = "info";
    else if (raw === "dead") tone = "crit";
    else if (raw === "unavailable") tone = "na";
    else tone = "off";
    const group = raw === "running" || raw === "restarting" ? "running" : raw === "paused" ? "paused" : "stopped";
    const memU = S("memory_usage"), memL = S("memory_limit");
    let mem = num(S("memory_usage_percentage"));
    if (isNaN(mem)) { const u = bytes(memU), l = bytes(memL); if (!isNaN(u) && l > 0) mem = (u / l) * 100; }
    const startS = S("container_started_at"), started = !bad(startS) ? Date.parse(startS.state) : NaN;
    const upd = S("container_image_update");
    const t = this._t;
    let label;
    if (tone === "crit" || tone === "warn") label = raw === "running" && hS ? fmt(h, hS) : fmt(h, stS);
    else if (stS && !bad(stS)) label = fmt(h, stS);
    else label = t("st_" + (raw === "running" ? "running" : raw === "unavailable" ? "unavailable" : "exited"));
    return {
      d, raw, tone, group, label, health, hS, oom, oomS, mem, memU, memL,
      cpu: num(S("cpu_usage_total")), cpuS: S("cpu_usage_total"),
      started, startS, restarts: num(S("container_restart_count")), restartS: S("container_restart_count"),
      image: !bad(S("image")) ? S("image").state : "", update: !!upd && upd.state === "on", updE: d.ents.container_image_update,
      problem: tone === "crit" || oom || raw === "restarting",
    };
  }

  _build() {
    this._built = true;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { --hc-accent:${DEF.accent}; --hc-on:#1D9E75; --hc-warn:#BA7517; --hc-crit:#E24B4A;
          --hc-pause:#7F77DD; --hc-info:#378ADD; --hc-off:var(--secondary-text-color,#8a8a86);
          --hc-surface:color-mix(in srgb, var(--primary-text-color,#888) 4%, transparent);
          --hc-surface2:color-mix(in srgb, var(--primary-text-color,#888) 9%, transparent);
          --hc-track:color-mix(in srgb, var(--primary-text-color,#888) 10%, transparent); }
        ha-card { border-radius:14px; overflow:hidden;
          border:1px solid color-mix(in srgb, var(--hc-accent) 28%, transparent);
          background:var(--card-background-color,#181a1b); }
        .header { padding:15px 15px 10px; display:flex; align-items:center; gap:12px; }
        .disc { width:42px; height:42px; border-radius:50%; flex-shrink:0; display:flex;
          align-items:center; justify-content:center; color:var(--hc-accent);
          background:color-mix(in srgb, var(--hc-accent) 14%, transparent); }
        .disc ha-icon { --mdc-icon-size:22px; }
        .htext { flex:1; min-width:0; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .hsub b { font-weight:600; }
        .badge { padding:3px 8px; border-radius:20px; font:inherit; font-size:10px; font-weight:600; border:none;
          flex-shrink:0; color:var(--hc-warn); background:color-mix(in srgb, var(--hc-warn) 15%, transparent); }
        .toolbar { padding:0 15px 10px; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .search { flex:1 1 140px; min-width:0; display:flex; align-items:center; gap:6px; padding:0 9px;
          height:30px; box-sizing:border-box; border-radius:8px; background:var(--hc-surface);
          border:1px solid transparent; color:var(--secondary-text-color); transition:border-color .2s; }
        .search:focus-within { border-color:color-mix(in srgb, var(--hc-accent) 60%, transparent); }
        .search ha-icon { --mdc-icon-size:15px; }
        .search input { flex:1; min-width:0; border:none; outline:none; background:none;
          color:var(--primary-text-color); font:inherit; font-size:12px; }
        .seg { display:flex; gap:2px; padding:2px; border-radius:8px; background:var(--hc-surface); flex-wrap:wrap; }
        .seg button { border:none; background:none; color:var(--secondary-text-color); font:inherit; font-size:11px;
          padding:4px 8px; border-radius:6px; cursor:pointer; transition:background .2s, color .2s; }
        .seg button[aria-pressed="true"] { background:var(--card-background-color,#fff); color:var(--primary-text-color);
          box-shadow:0 1px 2px rgba(0,0,0,.18); }
        .seg .cnt { opacity:.6; margin-left:3px; }
        select { height:30px; border-radius:8px; border:none; background:var(--hc-surface); color:var(--primary-text-color);
          font:inherit; font-size:11px; padding:0 6px; max-width:150px; cursor:pointer; }
        select option { background:var(--card-background-color,#fff); color:var(--primary-text-color); }
        button:focus-visible, select:focus-visible { outline:2px solid var(--hc-accent); outline-offset:1px; }
        .list { padding:0 15px 14px; display:flex; flex-direction:column; gap:7px; }
        .grp { all:unset; box-sizing:border-box; display:flex; align-items:center; gap:6px; width:100%;
          padding:6px 2px 2px; cursor:pointer; font-size:11px; font-weight:600; letter-spacing:.3px;
          color:var(--secondary-text-color); border-radius:6px; }
        .grp:focus-visible { outline:2px solid var(--hc-accent); }
        .grp ha-icon { --mdc-icon-size:16px; transition:transform .2s ease; }
        .grp[aria-expanded="true"] ha-icon { transform:rotate(90deg); }
        .grp .gname { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .grp .gcount { font-weight:400; }
        .gbody { display:flex; flex-direction:column; gap:7px; }
        .ct { background:var(--hc-surface); border-radius:10px; padding:10px 12px;
          background:color-mix(in srgb, var(--tone) 8%, var(--hc-surface)); transition:background .2s ease; }
        .first .ct { animation:hc-in .25s ease both; }
        .ct.dim { opacity:.62; }
        .top { display:flex; align-items:center; gap:8px; }
        .dot { width:8px; height:8px; border-radius:50%; background:var(--tone); flex-shrink:0;
          box-shadow:0 0 0 3px color-mix(in srgb, var(--tone) 18%, transparent); }
        .dot.pulse { animation:hc-pulse 1.4s ease-in-out infinite; }
        .name { all:unset; flex:1; min-width:0; cursor:pointer; display:flex; flex-direction:column; border-radius:4px; }
        .name:focus-visible { outline:2px solid var(--hc-accent); outline-offset:2px; }
        .n1 { font-size:12.5px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .n2 { font-size:10px; color:var(--secondary-text-color); margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chip { font-size:10px; padding:2px 7px; border-radius:20px; color:var(--tone); white-space:nowrap;
          flex-shrink:0; background:color-mix(in srgb, var(--tone) 14%, transparent); max-width:40%;
          overflow:hidden; text-overflow:ellipsis; }
        .upd { border:none; font:inherit; font-size:9.5px; font-weight:600; padding:2px 6px; border-radius:20px;
          cursor:pointer; color:var(--hc-warn); background:color-mix(in srgb, var(--hc-warn) 15%, transparent);
          display:inline-flex; align-items:center; gap:2px; flex-shrink:0; }
        .upd ha-icon { --mdc-icon-size:11px; }
        .sw { position:relative; width:34px; height:20px; border-radius:10px; border:none; padding:0; flex-shrink:0;
          background:var(--hc-track); cursor:pointer; transition:background .2s ease; }
        .sw::after { content:""; position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%;
          background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.3); transition:transform .2s ease; }
        .sw[aria-checked="true"] { background:var(--hc-on); }
        .sw[aria-checked="true"]::after { transform:translateX(14px); }
        .sw:disabled, .btn:disabled { opacity:.35; cursor:default; }
        .bars { display:flex; gap:10px; margin-top:9px; }
        .bar { all:unset; flex:1; min-width:0; cursor:pointer; border-radius:4px; }
        .bar:focus-visible { outline:2px solid var(--hc-accent); outline-offset:2px; }
        .bar-top { display:flex; justify-content:space-between; gap:6px; font-size:9.5px;
          color:var(--secondary-text-color); margin-bottom:3px; }
        .bar-top span:last-child { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bar-t { height:4px; border-radius:2px; background:var(--hc-track); overflow:hidden; }
        .bar-f { height:100%; border-radius:2px; transition:width .4s ease, background .3s ease; }
        .foot { display:flex; align-items:center; gap:10px; margin-top:8px; font-size:10px;
          color:var(--secondary-text-color); flex-wrap:wrap; }
        .meta { display:inline-flex; align-items:center; gap:3px; }
        .meta ha-icon { --mdc-icon-size:12px; }
        .meta.bad { color:var(--hc-crit); }
        .btns { display:flex; gap:4px; margin-left:auto; }
        .btn { width:28px; height:28px; border-radius:7px; border:none; padding:0; cursor:pointer;
          display:flex; align-items:center; justify-content:center; color:var(--tone);
          background:color-mix(in srgb, var(--tone) 14%, transparent); transition:transform .1s ease, background .2s ease; }
        .btn:hover:not(:disabled) { background:color-mix(in srgb, var(--tone) 26%, transparent); }
        .btn:active:not(:disabled) { transform:scale(.92); }
        .btn ha-icon { --mdc-icon-size:15px; }
        .busy { animation:hc-pulse 1s ease-in-out infinite; pointer-events:none; }
        .confirm { display:flex; align-items:center; gap:8px; margin-top:8px; padding:7px 9px; border-radius:8px;
          font-size:11.5px; color:var(--primary-text-color); animation:hc-in .2s ease both;
          background:color-mix(in srgb, var(--hc-crit) 12%, transparent); }
        .confirm span { flex:1; min-width:0; }
        .cbtn { border:none; border-radius:6px; padding:5px 10px; font:inherit; font-size:11px; font-weight:600;
          cursor:pointer; background:var(--hc-surface2); color:var(--primary-text-color); }
        .cbtn.go { background:var(--hc-crit); color:#fff; }
        .empty { text-align:center; padding:22px 10px; color:var(--secondary-text-color); font-size:12px; line-height:1.45; }
        .empty ha-icon { --mdc-icon-size:34px; opacity:.45; display:block; margin:0 auto 8px; }
        .empty .e-t { font-weight:600; color:var(--primary-text-color); font-size:13px; margin-bottom:4px; }
        .empty .cbtn { margin-top:10px; }
        .hidden { display:none !important; }
        @keyframes hc-in { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
        @keyframes hc-pulse { 50% { opacity:.4; } }
        @media (prefers-reduced-motion: reduce) { *, *::after { animation:none !important; transition:none !important; } }
      </style>
      <ha-card>
        <div class="header">
          <div class="disc"><ha-icon></ha-icon></div>
          <div class="htext"><div class="htitle"></div><div class="hsub"></div></div>
          <button type="button" class="badge hidden" data-act="filter-upd"></button>
        </div>
        <div class="toolbar">
          <label class="search"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-f="q" autocomplete="off"></label>
          <div class="seg" role="group"></div>
          <select data-f="endpoint"></select>
          <select data-f="stack"></select>
          <select data-f="sort"></select>
        </div>
        <div class="list first" aria-live="polite"></div>
      </ha-card>`;
    const r = this.shadowRoot;
    let deb = null;
    r.querySelector('input[data-f="q"]').addEventListener("input", (e) => {
      const v = e.target.value; clearTimeout(deb);
      deb = setTimeout(() => { this._ui.q = v; this._renderList(); }, 120);
    });
    r.querySelectorAll("select").forEach((s) => s.addEventListener("change", (e) => {
      this._ui[e.target.dataset.f] = e.target.value; this._renderList();
    }));
    r.querySelector("ha-card").addEventListener("click", (e) => this._onClick(e));
    r.querySelector("ha-card").addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._confirm) { this._confirm = null; this._renderList(); }
    });
  }

  _render() {
    const c = this._config, r = this.shadowRoot;
    this._t = tr(this._hass);
    const t = this._t;
    this.style.setProperty("--hc-accent", c.accent);
    r.querySelector(".disc ha-icon").setAttribute("icon", c.icon);
    r.querySelector(".htitle").textContent = c.title || t("title");
    const inp = r.querySelector('input[data-f="q"]');
    inp.placeholder = t("search"); inp.setAttribute("aria-label", t("search"));
    this._renderList();
  }

  _renderList() {
    if (!this._hass) return;
    const c = this._config, r = this.shadowRoot, t = this._t, ui = this._ui;
    const all = this._items().map((d) => this._model(d));
    const base = c.hide_stopped ? all.filter((m) => m.group !== "stopped") : all;

    /* Header summary */
    const running = all.filter((m) => m.group === "running").length;
    const problems = all.filter((m) => m.problem).length;
    const updates = all.filter((m) => m.update).length;
    r.querySelector(".hsub").innerHTML =
      '<b style="color:var(--hc-on)">' + esc(t("running_n", { n: running })) + "</b> / " + all.length +
      (problems ? ' · <b style="color:var(--hc-crit)">' + esc(t("problems_n", { n: problems })) + "</b>" : "");
    const badge = r.querySelector(".badge");
    badge.classList.toggle("hidden", !updates);
    badge.textContent = t("updates_n", { n: updates });
    badge.title = t("update_t");
    badge.setAttribute("aria-pressed", String(ui.state === "update"));

    /* Toolbar */
    const tb = r.querySelector(".toolbar");
    tb.classList.toggle("hidden", !all.length || (!c.show_search && !c.show_filters));
    r.querySelector(".search").classList.toggle("hidden", !c.show_search);
    const cnt = { all: base.length, running: 0, stopped: 0, paused: 0, problem: 0 };
    base.forEach((m) => { cnt[m.group]++; if (m.problem) cnt.problem++; });
    const segs = ["all", "running", "stopped"].concat(cnt.paused ? ["paused"] : [], cnt.problem ? ["problem"] : []);
    if (segs.indexOf(ui.state) === -1 && !(ui.state === "update" && updates)) ui.state = "all";
    const seg = r.querySelector(".seg");
    seg.classList.toggle("hidden", !c.show_filters);
    seg.setAttribute("aria-label", t("s_state"));
    seg.innerHTML = segs.map((k) =>
      '<button type="button" data-act="state" data-v="' + k + '" data-fk="seg:' + k + '" aria-pressed="' + (ui.state === k) + '">' +
      esc(t("f_" + k)) + '<span class="cnt">' + cnt[k] + "</span></button>").join("");
    const eps = [...new Map(base.filter((m) => m.d.endpoint).map((m) => [m.d.endpoint, m.d.endpointName])).entries()];
    const sts = [...new Map(base.filter((m) => m.d.stack).map((m) => [m.d.stack, m.d.stackName])).entries()];
    this._fillSelect("endpoint", c.show_filters && eps.length > 1, [["", t("all_endpoints")]].concat(eps));
    this._fillSelect("stack", c.show_filters && sts.length > 0, [["", t("all_stacks")], ["_none", t("no_stack")]].concat(sts));
    this._fillSelect("sort", c.show_filters, SORTS.map((k) => [k, t("sort") + " : " + t("s_" + k)]));

    /* UI filters */
    const q = lc(ui.q).trim();
    let view = base.filter((m) =>
      (ui.state === "all" || (ui.state === "problem" ? m.problem : ui.state === "update" ? m.update : m.group === ui.state)) &&
      (!ui.endpoint || m.d.endpoint === ui.endpoint) &&
      (!ui.stack || (ui.stack === "_none" ? !m.d.stack : m.d.stack === ui.stack)) &&
      (!q || [m.d.name, m.image, m.d.stackName, m.d.endpointName].some((x) => lc(x).indexOf(q) !== -1)));
    const byName = (a, b) => a.d.name.localeCompare(b.d.name, langCode(this._hass), { numeric: true, sensitivity: "base" });
    const nz = (v) => (isNaN(v) ? -1 : v);
    const cmp = {
      name: byName,
      state: (a, b) => RANK[a.tone] - RANK[b.tone] || byName(a, b),
      cpu: (a, b) => nz(b.cpu) - nz(a.cpu) || byName(a, b),
      memory: (a, b) => nz(b.mem) - nz(a.mem) || byName(a, b),
      uptime: (a, b) => nz(b.started) - nz(a.started) || byName(a, b),
    }[ui.sort] || byName;
    view = view.sort(cmp);
    this._index = new Map(view.map((m) => [m.d.id, m]));

    /* List (focus is restored after the rebuild so keyboard users don't lose their place) */
    const list = r.querySelector(".list");
    list.style.maxHeight = c.max_height > 0 ? c.max_height + "px" : "";
    list.style.overflowY = c.max_height > 0 ? "auto" : "";
    const act = r.activeElement;
    const fks = [].concat(this._focusKeys || [], act && act.dataset && act.dataset.fk ? [act.dataset.fk] : []);
    this._focusKeys = null;
    let html;
    if (!all.length) {
      html = '<div class="empty"><ha-icon icon="mdi:docker"></ha-icon><div class="e-t">' + esc(t("empty_t")) +
        "</div><div>" + esc(t("empty_h")) + "</div></div>";
    } else if (!view.length) {
      html = '<div class="empty"><ha-icon icon="mdi:filter-remove-outline"></ha-icon><div class="e-t">' +
        esc(t("nomatch_t")) + '</div><button type="button" class="cbtn" data-act="reset" data-fk="reset">' +
        esc(t("reset")) + "</button></div>";
    } else if (c.group_by_stack) {
      const groups = new Map();
      view.forEach((m) => {
        const g = m.d.stack || "_none";
        if (!groups.has(g)) groups.set(g, { name: m.d.stack ? m.d.stackName : t("no_stack"), items: [] });
        groups.get(g).items.push(m);
      });
      const keys = [...groups.keys()].sort((a, b) => (a === "_none") - (b === "_none") ||
        groups.get(a).name.localeCompare(groups.get(b).name, undefined, { numeric: true, sensitivity: "base" }));
      html = keys.map((g) => {
        const G = groups.get(g), open = !this._collapsed.has(g), gid = "g-" + esc(g);
        const run = G.items.filter((m) => m.group === "running").length;
        return '<button type="button" class="grp" data-act="group" data-g="' + esc(g) + '" data-fk="grp:' + esc(g) +
          '" aria-expanded="' + open + '" aria-controls="' + gid + '"><ha-icon icon="mdi:chevron-right"></ha-icon>' +
          '<span class="gname">' + esc(G.name) + '</span><span class="gcount">' + run + "/" + G.items.length + "</span></button>" +
          '<div class="gbody" id="' + gid + '"' + (open ? "" : " hidden") + ">" +
          (open ? G.items.map((m) => this._row(m)).join("") : "") + "</div>";
      }).join("");
    } else html = view.map((m) => this._row(m)).join("");
    list.innerHTML = html;
    for (const fk of fks) {
      const el = list.querySelector('[data-fk="' + fk + '"]') || tb.querySelector('[data-fk="' + fk + '"]');
      if (el) { el.focus(); break; }
    }
    if (this._confirm && this._confirm.focus) {
      this._confirm.focus = false;
      const go = list.querySelector(".cbtn.go"); if (go) go.focus();
    }
    if (all.length) setTimeout(() => list.classList.remove("first"), 400);
  }

  _fillSelect(f, show, opts) {
    const s = this.shadowRoot.querySelector('select[data-f="' + f + '"]');
    s.classList.toggle("hidden", !show);
    const sig = JSON.stringify(opts);
    if (s._sig !== sig) {
      s._sig = sig;
      s.innerHTML = opts.map((o) => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>").join("");
    }
    if (!opts.some((o) => o[0] === this._ui[f])) this._ui[f] = opts[0][0];
    s.value = this._ui[f];
    s.setAttribute("aria-label", f === "sort" ? this._t("sort") : opts[0][1]);
  }

  _bar(label, pct, val, base, eid, fk) {
    const c = this._config;
    const col = isNaN(pct) ? "var(--hc-off)" : pct >= c.critical_at ? "var(--hc-crit)" : pct >= c.warn_at ? "var(--hc-warn)" : base;
    return '<button type="button" class="bar" data-act="more" data-eid="' + esc(eid || "") + '" data-fk="' + fk + '" aria-label="' +
      esc(label + " " + val) + '"><div class="bar-top"><span>' + esc(label) + "</span><span>" + esc(val) + "</span></div>" +
      '<div class="bar-t"><div class="bar-f" style="width:' + (isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100)).toFixed(1) +
      "%;background:" + col + '"></div></div></button>';
  }

  _row(m) {
    const h = this._hass, c = this._config, t = this._t, d = m.d, id = esc(d.id);
    const on = m.group !== "stopped";
    const tone = TONE[m.tone];
    const sub = [c.show_image ? m.image : "", c.group_by_stack ? "" : d.stackName, d.endpointName]
      .filter(Boolean).map(esc).join(" · ");
    let html = '<div class="ct' + (on ? "" : " dim") + '" style="--tone:' + tone + '">' +
      '<div class="top"><span class="dot' + (m.raw === "restarting" || m.tone === "warn" ? " pulse" : "") + '"></span>' +
      '<button type="button" class="name" data-act="more" data-eid="' + esc(d.ents.container_state || d.ents.status || d.ents.container || "") +
      '" data-fk="name:' + id + '"><span class="n1">' + esc(d.name) + "</span>" + (sub ? '<span class="n2">' + sub + "</span>" : "") + "</button>" +
      '<span class="chip">' + esc(m.label) + "</span>";
    if (m.update) {
      html += '<button type="button" class="upd" data-act="more" data-eid="' + esc(m.updE) + '" data-fk="upd:' + id +
        '" title="' + esc(t("update_t")) + '"><ha-icon icon="mdi:arrow-up-bold-circle-outline"></ha-icon>' + esc(t("update")) + "</button>";
    }
    const swE = d.ents.container, swS = swE ? h.states[swE] : null;
    if (c.show_actions && swE) {
      const checked = swS ? swS.state === "on" : on;
      html += '<button type="button" class="sw' + (this._pending[swE] ? " busy" : "") + '" role="switch" aria-checked="' + checked +
        '" data-act="switch" data-cid="' + id + '" data-fk="sw:' + id + '" aria-label="' + esc((checked ? t("a_stop") : t("a_start")) + " " + d.name) +
        '" title="' + esc(checked ? t("a_stop") : t("a_start")) + '"' + (bad(swS) ? " disabled" : "") + "></button>";
    }
    html += "</div>";

    if (c.show_bars && on && (d.ents.cpu_usage_total || d.ents.memory_usage || d.ents.memory_usage_percentage)) {
      let memVal = !bad(m.memU) ? fmt(h, m.memU) : "";
      if (memVal && m.memL && num(m.memL) > 0) memVal += " / " + fmt(h, m.memL);
      if (!isNaN(m.mem)) memVal = (memVal ? memVal + " · " : "") + nf(h, { maximumFractionDigits: 0 }).format(m.mem) + " %";
      html += '<div class="bars">' +
        (d.ents.cpu_usage_total ? this._bar(t("cpu"), m.cpu, isNaN(m.cpu) ? "—" : fmt(h, m.cpuS), "var(--hc-info)", d.ents.cpu_usage_total, "cpu:" + id) : "") +
        (d.ents.memory_usage || d.ents.memory_usage_percentage
          ? this._bar(t("mem"), m.mem, memVal || "—", "var(--hc-pause)", d.ents.memory_usage || d.ents.memory_usage_percentage, "mem:" + id) : "") +
        "</div>";
    }

    if (this._confirm && this._confirm.cid === d.id) {
      return html + '<div class="confirm" role="alertdialog" aria-label="' + esc(this._confirm.q) + '"><span>' + esc(this._confirm.q) + "</span>" +
        '<button type="button" class="cbtn" data-act="cancel" data-fk="cancel:' + id + '">' + esc(t("cancel")) + "</button>" +
        '<button type="button" class="cbtn go" data-act="confirm" data-fk="go:' + id + '">' + esc(t("confirm")) + "</button></div></div>";
    }

    const metas = [];
    if (on && !isNaN(m.started)) {
      const s = since(h, m.startS.state);
      if (s) metas.push('<span class="meta" title="' + esc(t("started")) + '"><ha-icon icon="mdi:clock-outline"></ha-icon>' + esc(s) + "</span>");
    }
    if (m.health && m.health !== "none" && m.hS) {
      const ok = m.health === "healthy";
      metas.push('<span class="meta' + (m.health === "unhealthy" ? " bad" : "") + '" title="' + esc(t("health")) + '"><ha-icon icon="' +
        (ok ? "mdi:heart-pulse" : m.health === "unhealthy" ? "mdi:heart-broken" : "mdi:heart-outline") + '"></ha-icon>' + esc(fmt(h, m.hS)) + "</span>");
    }
    if (m.restarts > 0) {
      metas.push('<span class="meta" title="' + esc(t("restarts")) + '"><ha-icon icon="mdi:restart"></ha-icon>' +
        esc(nf(h, { maximumFractionDigits: 0 }).format(m.restarts)) + "</span>");
    }
    if (m.oom) metas.push('<span class="meta bad" title="' + esc(t("oom")) + '"><ha-icon icon="mdi:memory"></ha-icon>OOM</span>');

    let btns = "";
    if (c.show_actions) {
      ACTS.forEach((a) => {
        const e = d.ents[a.key];
        if (!e || a.when.indexOf(m.group) === -1) return;
        const st = h.states[e];
        btns += '<button type="button" class="btn' + (this._pending[e] ? " busy" : "") + '" style="--tone:' + TONE[a.tone] +
          '" data-act="' + a.id + '" data-cid="' + id + '" data-fk="' + a.id + ":" + id + '" title="' + esc(t("a_" + a.id)) +
          '" aria-label="' + esc(t("a_" + a.id) + " " + d.name) + '"' + (st && st.state === "unavailable" ? " disabled" : "") +
          '><ha-icon icon="' + a.icon + '"></ha-icon></button>';
      });
    }
    if (metas.length || btns) html += '<div class="foot">' + metas.join("") + (btns ? '<div class="btns">' + btns + "</div>" : "") + "</div>";
    return html + "</div>";
  }

  _onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, t = this._t;
    if (act === "more") { this._more(b.dataset.eid); return; }
    if (act === "state") { this._ui.state = b.dataset.v; this._renderList(); return; }
    if (act === "filter-upd") { this._ui.state = this._ui.state === "update" ? "all" : "update"; this._renderList(); return; }
    if (act === "group") {
      const g = b.dataset.g;
      if (this._collapsed.has(g)) this._collapsed.delete(g); else this._collapsed.add(g);
      this._renderList(); return;
    }
    if (act === "reset") {
      Object.assign(this._ui, { q: "", state: "all", endpoint: "", stack: "" });
      this.shadowRoot.querySelector('input[data-f="q"]').value = "";
      this._renderList(); return;
    }
    if (act === "cancel" || act === "confirm") {
      const p = this._confirm; this._confirm = null;
      // Give focus back to the control that opened the confirmation (or the row name).
      if (p) this._focusKeys = [(p.domain === "switch" ? "sw:" : p.id + ":") + p.cid, "name:" + p.cid];
      if (act === "confirm") this._run(p); else this._renderList();
      return;
    }

    const m = this._index && this._index.get(b.dataset.cid);
    if (!m) return;
    let p;
    if (act === "switch") {
      const entity = m.d.ents.container, st = this._hass.states[entity];
      const isOn = st ? st.state === "on" : m.group !== "stopped";
      p = { cid: m.d.id, id: isOn ? "stop" : "start", entity, domain: "switch", service: isOn ? "turn_off" : "turn_on" };
    } else {
      const a = ACTS.find((x) => x.id === act);
      if (!a) return;
      p = { cid: m.d.id, id: a.id, entity: m.d.ents[a.key], domain: "button", service: "press" };
    }
    if (!p.entity || this._pending[p.entity]) return;
    if (this._config.confirm_actions.indexOf(p.id) !== -1) {
      p.q = t("confirm_q", { a: t("a_" + p.id), n: m.d.name });
      p.focus = true;
      this._confirm = p;
      clearTimeout(this._cTimer);
      this._cTimer = setTimeout(() => { if (this._confirm === p) { this._confirm = null; this._renderList(); } }, 8000);
      this._renderList();
      return;
    }
    this._run(p);
  }

  _run(p) {
    if (!p || !p.entity || this._pending[p.entity]) return;
    this._pending[p.entity] = true;
    Promise.resolve(this._hass.callService(p.domain, p.service, { entity_id: p.entity })).catch((err) => {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: this._t("failed", { e: (err && err.message) || err }) }, bubbles: true, composed: true }));
    });
    setTimeout(() => { delete this._pending[p.entity]; this._renderList(); }, 3000);
    this._renderList();
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 3 + Math.min(((this._list && this._list.length) || 1) * 2, 30); }
  static getStubConfig() { return {}; }
  static getConfigElement() { return document.createElement(TAG + "-editor"); }
}
if (!customElements.get(TAG)) customElements.define(TAG, PortainerContainersCard);

/* ================= EDITOR ================= */
// Section open/closed state survives editor re-renders (module level, key `${tagName}:${sectionId}`).
const OPEN = new Map();
const clean = (cfg) => {
  Object.keys(cfg).forEach((k) => {
    const v = cfg[k];
    if (v === "" || v == null || (k in DEF && JSON.stringify(v) === JSON.stringify(DEF[k]))) delete cfg[k];
  });
  return cfg;
};
const sections = (hass, t) => {
  const s = scan(hass);
  const opts = (list, withEp) => list.map((d) => ({ value: d.id, label: d.name + (withEp && d.endpointName ? " · " + d.endpointName : "") }));
  const multi = (o) => ({ select: { multiple: true, custom_value: true, mode: "dropdown", options: o } });
  return [
    { id: "gen", title: t("sec_gen"), hint: t("hint_gen"), schema: [
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ]},
      { name: "endpoints", selector: multi(opts(s.endpoints.filter((e) => s.containers.some((c) => c.endpoint === e.id)))) },
      { name: "stacks", selector: multi(opts(s.stacks, true)) },
      { name: "exclude", selector: multi(opts(s.containers, true)) },
    ]},
    { id: "display", title: t("sec_display"), schema: [
      { name: "sort", selector: { select: { mode: "dropdown", options: SORTS.map((k) => ({ value: k, label: t("s_" + k) })) } } },
      { name: "group_by_stack", selector: { boolean: {} } },
      { name: "hide_stopped", selector: { boolean: {} } },
      { name: "max_height", selector: { number: { min: 0, max: 2000, step: 20, unit_of_measurement: "px", mode: "box" } } },
      { name: "show_search", selector: { boolean: {} } },
      { name: "show_filters", selector: { boolean: {} } },
      { name: "show_image", selector: { boolean: {} } },
      { name: "show_bars", selector: { boolean: {} } },
      { type: "grid", name: "", schema: [
        { name: "warn_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
        { name: "critical_at", selector: { number: { min: 1, max: 100, mode: "box" } } },
      ]},
    ]},
    { id: "colors", title: t("sec_colors"), colors: [{ key: "accent", label: t("l_accent") }] },
    { id: "actions", title: t("sec_actions"), schema: [
      { name: "show_actions", selector: { boolean: {} } },
      { name: "confirm_actions", selector: { select: { multiple: true, options:
        ["stop", "restart", "pause", "kill", "recreate"].map((k) => ({ value: k, label: t("a_" + k) })) } } },
    ]},
  ];
};

class PortainerContainersCardEditor extends HTMLElement {
  setConfig(cfg) { this._config = Object.assign({}, cfg || {}); this._ensure(); this._update(); }
  set hass(h) {
    const first = !this._hass; this._hass = h; this._ensure();
    if (first) this._update();
    else if (this._built) this.shadowRoot.querySelectorAll("ha-form").forEach((f) => { f.hass = h; });
  }
  _emit() {
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
  }
  _ensure() {
    if (this._built || !this._hass || !this._config) return;
    this._built = true;
    const t = tr(this._hass); this._t = t;
    this._secs = sections(this._hass, t);
    this.attachShadow({ mode: "open" });
    const r = this.shadowRoot;
    r.innerHTML = `
      <style>
        .top { display:flex; justify-content:flex-end; margin-bottom:2px; }
        .all { border:none; background:none; color:var(--secondary-text-color); font:inherit; font-size:12px;
          cursor:pointer; padding:4px 6px; border-radius:6px; }
        .all:hover { color:var(--primary-text-color); }
        .sec { border-bottom:1px solid var(--divider-color); }
        .sec-head { all:unset; box-sizing:border-box; width:100%; display:flex; align-items:center; gap:8px;
          padding:12px 2px; cursor:pointer; font-size:15px; font-weight:600; color:var(--primary-text-color); border-radius:6px; }
        .sec-head:focus-visible, .all:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; }
        .chev { --mdc-icon-size:20px; color:var(--secondary-text-color); transition:transform .2s ease; }
        .sec-head[aria-expanded="true"] .chev { transform:rotate(90deg); }
        .sec-body { padding:0 2px 16px; }
        .sec-body[hidden] { display:none; }
        .hint { font-size:12px; color:var(--secondary-text-color); margin:0 0 10px; line-height:1.4; }
        .colors { display:flex; gap:14px; flex-wrap:wrap; }
        .color-field { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--primary-text-color); }
        .color-field input { width:42px; height:30px; padding:0; border:none; border-radius:6px; cursor:pointer; background:none; }
        ha-form { display:block; }
        @media (prefers-reduced-motion: reduce) { .chev { transition:none; } }
      </style>
      <div class="top"><button type="button" class="all"></button></div>
      ${this._secs.map((s, i) => {
        const k = this.localName + ":" + s.id;
        if (!OPEN.has(k)) OPEN.set(k, i === 0);
        const o = OPEN.get(k);
        return '<div class="sec"><button type="button" class="sec-head" data-sec="' + s.id + '" aria-expanded="' + o +
          '" aria-controls="b-' + s.id + '"><ha-icon class="chev" icon="mdi:chevron-right"></ha-icon><span>' + esc(s.title) +
          '</span></button><div class="sec-body" id="b-' + s.id + '"' + (o ? "" : " hidden") + ">" +
          (s.hint ? '<div class="hint">' + esc(s.hint) + "</div>" : "") +
          (s.schema ? '<ha-form data-form="' + s.id + '"></ha-form>' : "") +
          (s.colors ? '<div class="colors">' + s.colors.map((x) => '<label class="color-field"><input type="color" data-color="' +
            x.key + '">' + esc(x.label) + "</label>").join("") + "</div>" : "") + "</div></div>";
      }).join("")}`;
    this._secs.forEach((s) => {
      if (!s.schema) return;
      const f = r.querySelector('ha-form[data-form="' + s.id + '"]');
      f.schema = s.schema;
      f.computeLabel = (x) => t("l_" + x.name);
      f.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        this._config = clean(Object.assign({}, this._config, e.detail.value));
        this._emit();
      });
    });
    r.querySelectorAll("input[data-color]").forEach((el) => {
      let tm = null;
      const apply = (v) => { this._config = clean(Object.assign({}, this._config, { [el.dataset.color]: v })); this._emit(); };
      el.addEventListener("input", (e) => { const v = e.target.value; clearTimeout(tm); tm = setTimeout(() => apply(v), 200); });
      el.addEventListener("change", (e) => { clearTimeout(tm); apply(e.target.value); });
    });
    const setOpen = (id, o) => {
      OPEN.set(this.localName + ":" + id, o);
      r.querySelector('.sec-head[data-sec="' + id + '"]').setAttribute("aria-expanded", String(o));
      r.querySelector("#b-" + id).hidden = !o;
    };
    const allBtn = r.querySelector(".all");
    const syncAll = () => {
      const allOpen = this._secs.every((s) => OPEN.get(this.localName + ":" + s.id));
      allBtn.textContent = allOpen ? t("close_all") : t("open_all");
      return allOpen;
    };
    r.querySelectorAll(".sec-head").forEach((b) => b.addEventListener("click", () => {
      setOpen(b.dataset.sec, b.getAttribute("aria-expanded") !== "true"); syncAll();
    }));
    allBtn.addEventListener("click", () => { const o = !syncAll(); this._secs.forEach((s) => setOpen(s.id, o)); syncAll(); });
    syncAll();
  }
  _update() {
    if (!this._built) return;
    const r = this.shadowRoot, data = Object.assign({ title: "" }, DEF, this._config);
    r.querySelectorAll("ha-form").forEach((f) => { f.hass = this._hass; f.data = data; });
    r.querySelectorAll("input[data-color]").forEach((el) => {
      const v = data[el.dataset.color];
      if (r.activeElement !== el && /^#[0-9a-f]{6}$/i.test(v) && el.value !== v) el.value = v;
    });
  }
}
if (!customElements.get(TAG + "-editor")) customElements.define(TAG + "-editor", PortainerContainersCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === TAG)) {
  window.customCards.push({
    type: TAG,
    name: "Portainer Containers Card",
    description: "Portainer containers: state, health, resources, image updates, filters and actions.",
    preview: true,
  });
}
console.info("%c PORTAINER-CONTAINERS-CARD %c v" + VERSION + " ",
  "color:#fff;background:#2496ED;font-weight:700", "color:#2496ED;background:#222");
}

/* ============================================================
EXAMPLES

# Auto (default): every Portainer container, grouped by stack
type: custom:portainer-containers-card
group_by_stack: true

# Restricted to one endpoint (device id or device name), problems first
type: custom:portainer-containers-card
title: Docker
endpoints:
  - example-endpoint
sort: state
hide_stopped: true
confirm_actions: [stop, kill, recreate]

# Explicit list: by device (id or name) and/or by entities (translation_key → entity_id)
type: custom:portainer-containers-card
containers:
  - example-container
  - name: Example app
    entities:
      container_state: sensor.example_container_state
      cpu_usage_total: sensor.example_cpu_usage_total
      memory_usage_percentage: sensor.example_memory_usage_percentage
      container: switch.example_container
      restart_container: button.example_restart_container
============================================================ */
