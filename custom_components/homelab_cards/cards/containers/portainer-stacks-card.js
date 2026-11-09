/**
 * Portainer Stacks Card — stacks of the native Home Assistant "portainer" integration
 * Version 1.0.0
 *
 * Auto mode (default): every stack is discovered through hass.entities
 * (platform "portainer" + translation_key + device_id) and hass.devices (via_device_id).
 * Each stack shows its type, container count, a start/stop switch, the update (redeploy)
 * button and a summary of its containers (expandable). Entity ids are never parsed.
 */
// Block scope keeps helpers private even if the file is loaded as a classic script.
{
const VERSION = "1.0.0";
const TAG = "portainer-stacks-card";

/* ---------- i18n ---------- */
const I18N = {
  en: {
    title: "Stacks", active_n: "{n} active", problems_n: "{n} issue(s)",
    search: "Search…", f_all: "All", f_active: "Active", f_inactive: "Inactive", f_problem: "Issues",
    all_endpoints: "All endpoints", sort: "Sort", s_name: "Name", s_state: "State", s_count: "Containers",
    st_active: "active", st_inactive: "inactive", st_unavailable: "unavailable",
    running_of: "{r}/{n} running", containers_n: "{n} container(s)", show_containers: "Show containers",
    a_start: "Start", a_stop: "Stop", a_update: "Update (redeploy)", confirm_q: "{a} “{n}”?",
    cancel: "Cancel", confirm: "Confirm", failed: "Action failed: {e}",
    empty_t: "No Portainer stack found",
    empty_h: "Check that the Portainer integration is set up and that its entities are enabled.",
    nomatch_t: "No stack matches", reset: "Reset filters", no_ct: "No container linked to this stack.",
    sec_gen: "General", sec_display: "Display", sec_colors: "Colors", sec_actions: "Actions",
    open_all: "Expand all", close_all: "Collapse all",
    hint_gen: "Leave the filters empty to show every stack.",
    l_title: "Title (empty = automatic)", l_icon: "Icon", l_endpoints: "Endpoints (empty = all)",
    l_stacks: "Stacks (empty = all)", l_exclude: "Stacks to hide", l_sort: "Default sort",
    l_hide_stopped: "Hide inactive stacks", l_max_height: "Max list height (0 = unlimited)", l_show_search: "Search bar", l_show_filters: "Filters (state, endpoint, sort)",
    l_show_containers: "Container summary", l_show_actions: "Action buttons",
    l_confirm_actions: "Ask for confirmation before", l_accent: "Accent",
  },
  fr: {
    title: "Stacks", active_n: "{n} actives", problems_n: "{n} problème(s)",
    search: "Rechercher…", f_all: "Toutes", f_active: "Actives", f_inactive: "Inactives", f_problem: "Problèmes",
    all_endpoints: "Tous les endpoints", sort: "Tri", s_name: "Nom", s_state: "État", s_count: "Conteneurs",
    st_active: "active", st_inactive: "inactive", st_unavailable: "indisponible",
    running_of: "{r}/{n} en marche", containers_n: "{n} conteneur(s)", show_containers: "Afficher les conteneurs",
    a_start: "Démarrer", a_stop: "Arrêter", a_update: "Mettre à jour (redéployer)", confirm_q: "{a} « {n} » ?",
    cancel: "Annuler", confirm: "Confirmer", failed: "Échec de l'action : {e}",
    empty_t: "Aucune stack Portainer trouvée",
    empty_h: "Vérifiez que l'intégration Portainer est configurée et que ses entités sont activées.",
    nomatch_t: "Aucune stack ne correspond", reset: "Réinitialiser les filtres", no_ct: "Aucun conteneur rattaché à cette stack.",
    sec_gen: "Général", sec_display: "Affichage", sec_colors: "Couleurs", sec_actions: "Actions",
    open_all: "Tout déplier", close_all: "Tout replier",
    hint_gen: "Laissez les filtres vides pour afficher toutes les stacks.",
    l_title: "Titre (vide = automatique)", l_icon: "Icône", l_endpoints: "Endpoints (vide = tous)",
    l_stacks: "Stacks (vide = toutes)", l_exclude: "Stacks à masquer", l_sort: "Tri par défaut",
    l_hide_stopped: "Masquer les stacks inactives", l_max_height: "Hauteur max. de la liste (0 = illimitée)", l_show_search: "Barre de recherche", l_show_filters: "Filtres (état, endpoint, tri)",
    l_show_containers: "Résumé des conteneurs", l_show_actions: "Boutons d'action",
    l_confirm_actions: "Demander confirmation avant", l_accent: "Accent",
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
const fmt = (h, st) => {
  if (bad(st)) return "—";
  if (h.formatEntityState) { try { return h.formatEntityState(st); } catch (e) { /* older HA: raw state */ } }
  return String(st.state);
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
  icon: "mdi:layers-outline", accent: "#2496ED", endpoints: [], stacks: [], exclude: [], sort: "name",
  hide_stopped: false, show_search: true, show_filters: true, show_containers: true, show_actions: true, max_height: 560,
  confirm_actions: ["stop", "update"],
};
const TONE = {
  on: "var(--hc-on)", warn: "var(--hc-warn)", crit: "var(--hc-crit)", pause: "var(--hc-pause)",
  info: "var(--hc-info)", off: "var(--hc-off)", na: "var(--disabled-text-color,#8a8a86)",
};
const RANK = { crit: 0, warn: 1, info: 2, on: 3, pause: 4, off: 5, na: 6 };
const SORTS = ["name", "state", "count"];

/* Minimal container state, enough for the stack summary */
const ctState = (h, d) => {
  const S = (k) => (d.ents[k] ? h.states[d.ents[k]] : null);
  const stS = S("container_state"), hS = S("container_health_state"), oom = S("container_out_of_memory");
  let raw = !bad(stS) ? lc(stS.state) : null;
  if (!raw) { const b = S("status") || S("container"); raw = bad(b) ? "unavailable" : b.state === "on" ? "running" : "exited"; }
  const health = !bad(hS) ? lc(hS.state) : "";
  const tone = raw === "running" ? (health === "unhealthy" ? "crit" : health === "starting" ? "warn" : "on")
    : raw === "paused" ? "pause" : raw === "restarting" ? "info" : raw === "dead" ? "crit" : raw === "unavailable" ? "na" : "off";
  return {
    d, tone, running: raw === "running" || raw === "restarting",
    problem: tone === "crit" || raw === "restarting" || (!!oom && oom.state === "on"),
    label: raw === "running" && (tone === "crit" || tone === "warn") && hS ? fmt(h, hS) : stS ? fmt(h, stS) : raw,
  };
};

class PortainerStacksCard extends HTMLElement {
  setConfig(config) {
    const c = Object.assign({}, DEF, config || {});
    ["endpoints", "stacks", "exclude", "confirm_actions"].forEach((k) => { c[k] = arr(c[k]); });
    if (SORTS.indexOf(c.sort) === -1) c.sort = "name";
    this._config = c;
    this._ui = Object.assign({ q: "", state: "all", endpoint: "" }, this._ui, { sort: c.sort });
    this._pending = this._pending || {};
    this._open = this._open || new Set();
    this._listKey = null;
    if (this._built) this._render();
  }
  disconnectedCallback() { clearTimeout(this._cTimer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    const { stacks, cts } = this._items();
    let changed = stacks !== this._lastList;
    this._lastList = stacks;
    const seen = this._seen || (this._seen = new Map());
    const watch = (d, keys) => keys.forEach((k) => {
      const id = d.ents[k]; if (!id) return;
      const st = hass.states[id];
      if (seen.get(id) !== st) { seen.set(id, st); changed = true; }
    });
    stacks.forEach((d) => watch(d, Object.keys(d.ents)));
    cts.forEach((d) => watch(d, ["container_state", "status", "container", "container_health_state", "container_out_of_memory"]));
    if (changed) this._render();
  }

  /* Stacks in scope (config filters) and their containers, cached until the registry or the config changes */
  _items() {
    const c = this._config, s = scan(this._hass);
    if (this._listKey === s) return this._cache;
    const stacks = s.stacks.filter((d) =>
      (!c.endpoints.length || matchAny(c.endpoints, d.endpoint, d.endpointName)) &&
      (!c.stacks.length || matchAny(c.stacks, d.id, d.name)) &&
      !matchAny(c.exclude, d.id, d.name));
    const ids = new Set(stacks.map((d) => d.id));
    this._cache = { stacks, cts: s.containers.filter((d) => ids.has(d.stack)) };
    this._listKey = s;
    return this._cache;
  }

  _model(d, cts) {
    const h = this._hass, S = (k) => (d.ents[k] ? h.states[d.ents[k]] : null);
    const swS = S("stack"), typeS = S("stack_type");
    const kids = cts.filter((x) => x.stack === d.id).map((x) => ctState(h, x));
    const run = kids.filter((k) => k.running).length;
    let count = num(S("stack_containers_count"));
    if (isNaN(count)) count = kids.length;
    const active = swS ? swS.state === "on" : run > 0;
    const problems = kids.filter((k) => k.problem).length;
    let tone;
    if (swS && bad(swS)) tone = "na";
    else if (!active) tone = "off";
    else if (problems) tone = "crit";
    else if (kids.length && run < kids.length) tone = "warn";
    else tone = "on";
    return { d, swS, active, tone, kids, run, count, problems, type: !bad(typeS) ? fmt(h, typeS) : "" };
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
        .st { background:var(--hc-surface); border-radius:10px; padding:10px 12px;
          background:color-mix(in srgb, var(--tone) 8%, var(--hc-surface)); transition:background .2s ease; }
        .first .st { animation:hc-in .25s ease both; }
        .st.dim { opacity:.62; }
        .top { display:flex; align-items:center; gap:8px; }
        .dot { width:8px; height:8px; border-radius:50%; background:var(--tone); flex-shrink:0;
          box-shadow:0 0 0 3px color-mix(in srgb, var(--tone) 18%, transparent); }
        .name { all:unset; flex:1; min-width:0; cursor:pointer; display:flex; flex-direction:column; border-radius:4px; }
        .name:focus-visible { outline:2px solid var(--hc-accent); outline-offset:2px; }
        .n1 { font-size:12.5px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .n2 { font-size:10px; color:var(--secondary-text-color); margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chip { font-size:10px; padding:2px 7px; border-radius:20px; color:var(--tone); white-space:nowrap;
          flex-shrink:0; background:color-mix(in srgb, var(--tone) 14%, transparent); }
        .sw { position:relative; width:34px; height:20px; border-radius:10px; border:none; padding:0; flex-shrink:0;
          background:var(--hc-track); cursor:pointer; transition:background .2s ease; }
        .sw::after { content:""; position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%;
          background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.3); transition:transform .2s ease; }
        .sw[aria-checked="true"] { background:var(--hc-on); }
        .sw[aria-checked="true"]::after { transform:translateX(14px); }
        .sw:disabled, .btn:disabled { opacity:.35; cursor:default; }
        .foot { display:flex; align-items:center; gap:8px; margin-top:8px; font-size:10px; color:var(--secondary-text-color); }
        .sum { all:unset; flex:1; min-width:0; display:flex; align-items:center; gap:8px; cursor:pointer; border-radius:4px; }
        .sum:focus-visible { outline:2px solid var(--hc-accent); outline-offset:2px; }
        .sum > ha-icon { --mdc-icon-size:15px; transition:transform .2s ease; flex-shrink:0; }
        .sum[aria-expanded="true"] > ha-icon { transform:rotate(90deg); }
        .dots { display:flex; gap:3px; flex-wrap:wrap; min-width:0; }
        .cd { width:7px; height:7px; border-radius:2px; background:var(--tone); }
        .btn { width:28px; height:28px; border-radius:7px; border:none; padding:0; cursor:pointer; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; color:var(--tone);
          background:color-mix(in srgb, var(--tone) 14%, transparent); transition:transform .1s ease, background .2s ease; }
        .btn:hover:not(:disabled) { background:color-mix(in srgb, var(--tone) 26%, transparent); }
        .btn:active:not(:disabled) { transform:scale(.92); }
        .btn ha-icon { --mdc-icon-size:15px; }
        .busy { animation:hc-pulse 1s ease-in-out infinite; pointer-events:none; }
        .kids { margin-top:8px; display:flex; flex-direction:column; gap:2px; animation:hc-in .2s ease both; }
        .kid { all:unset; display:flex; align-items:center; gap:7px; padding:4px 6px; border-radius:6px; cursor:pointer;
          font-size:11px; color:var(--primary-text-color); }
        .kid:hover { background:var(--hc-surface2); }
        .kid:focus-visible { outline:2px solid var(--hc-accent); }
        .kid .kn { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .kid .ks { font-size:10px; color:var(--tone); }
        .kid .dot { width:6px; height:6px; box-shadow:none; }
        .none { font-size:11px; color:var(--secondary-text-color); font-style:italic; padding:4px 6px; }
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
        </div>
        <div class="toolbar">
          <label class="search"><ha-icon icon="mdi:magnify"></ha-icon><input type="search" data-f="q" autocomplete="off"></label>
          <div class="seg" role="group"></div>
          <select data-f="endpoint"></select>
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
    this.style.setProperty("--hc-accent", c.accent);
    r.querySelector(".disc ha-icon").setAttribute("icon", c.icon);
    r.querySelector(".htitle").textContent = c.title || this._t("title");
    const inp = r.querySelector('input[data-f="q"]');
    inp.placeholder = this._t("search"); inp.setAttribute("aria-label", this._t("search"));
    this._renderList();
  }

  _renderList() {
    if (!this._hass) return;
    const c = this._config, r = this.shadowRoot, t = this._t, ui = this._ui;
    const { stacks, cts } = this._items();
    const all = stacks.map((d) => this._model(d, cts));
    const base = c.hide_stopped ? all.filter((m) => m.active) : all;

    const active = all.filter((m) => m.active).length, problems = all.filter((m) => m.problems).length;
    r.querySelector(".hsub").innerHTML =
      '<b style="color:var(--hc-on)">' + esc(t("active_n", { n: active })) + "</b> / " + all.length +
      (problems ? ' · <b style="color:var(--hc-crit)">' + esc(t("problems_n", { n: problems })) + "</b>" : "");

    const tb = r.querySelector(".toolbar");
    tb.classList.toggle("hidden", !all.length || (!c.show_search && !c.show_filters));
    r.querySelector(".search").classList.toggle("hidden", !c.show_search);
    const cnt = { all: base.length, active: 0, inactive: 0, problem: 0 };
    base.forEach((m) => { cnt[m.active ? "active" : "inactive"]++; if (m.problems) cnt.problem++; });
    const segs = ["all", "active", "inactive"].concat(cnt.problem ? ["problem"] : []);
    if (segs.indexOf(ui.state) === -1) ui.state = "all";
    const seg = r.querySelector(".seg");
    seg.classList.toggle("hidden", !c.show_filters);
    seg.setAttribute("aria-label", t("s_state"));
    seg.innerHTML = segs.map((k) =>
      '<button type="button" data-act="state" data-v="' + k + '" data-fk="seg:' + k + '" aria-pressed="' + (ui.state === k) + '">' +
      esc(t("f_" + k)) + '<span class="cnt">' + cnt[k] + "</span></button>").join("");
    const eps = [...new Map(base.filter((m) => m.d.endpoint).map((m) => [m.d.endpoint, m.d.endpointName])).entries()];
    this._fillSelect("endpoint", c.show_filters && eps.length > 1, [["", t("all_endpoints")]].concat(eps));
    this._fillSelect("sort", c.show_filters, SORTS.map((k) => [k, t("sort") + " : " + t("s_" + k)]));

    const q = lc(ui.q).trim();
    const byName = (a, b) => a.d.name.localeCompare(b.d.name, langCode(this._hass), { numeric: true, sensitivity: "base" });
    const view = base.filter((m) =>
      (ui.state === "all" || (ui.state === "problem" ? m.problems : (ui.state === "active") === m.active)) &&
      (!ui.endpoint || m.d.endpoint === ui.endpoint) &&
      (!q || [m.d.name, m.type, m.d.endpointName].concat(m.kids.map((k) => k.d.name)).some((x) => lc(x).indexOf(q) !== -1)))
      .sort({
        name: byName,
        state: (a, b) => RANK[a.tone] - RANK[b.tone] || byName(a, b),
        count: (a, b) => (b.count || 0) - (a.count || 0) || byName(a, b),
      }[ui.sort] || byName);
    this._index = new Map(view.map((m) => [m.d.id, m]));

    const list = r.querySelector(".list");
    list.style.maxHeight = c.max_height > 0 ? c.max_height + "px" : "";
    list.style.overflowY = c.max_height > 0 ? "auto" : "";
    const act = r.activeElement;
    const fks = [].concat(this._focusKeys || [], act && act.dataset && act.dataset.fk ? [act.dataset.fk] : []);
    this._focusKeys = null;
    if (!all.length) {
      list.innerHTML = '<div class="empty"><ha-icon icon="mdi:layers-off-outline"></ha-icon><div class="e-t">' + esc(t("empty_t")) +
        "</div><div>" + esc(t("empty_h")) + "</div></div>";
    } else if (!view.length) {
      list.innerHTML = '<div class="empty"><ha-icon icon="mdi:filter-remove-outline"></ha-icon><div class="e-t">' +
        esc(t("nomatch_t")) + '</div><button type="button" class="cbtn" data-act="reset" data-fk="reset">' + esc(t("reset")) + "</button></div>";
    } else list.innerHTML = view.map((m) => this._row(m)).join("");
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

  _row(m) {
    const c = this._config, t = this._t, d = m.d, id = esc(d.id);
    const label = m.tone === "na" ? t("st_unavailable") : m.active ? t("st_active") : t("st_inactive");
    const sub = [m.type, d.endpointName].filter(Boolean).map(esc).join(" · ");
    const swE = d.ents.stack;
    let html = '<div class="st' + (m.active ? "" : " dim") + '" style="--tone:' + TONE[m.tone] + '">' +
      '<div class="top"><span class="dot"></span>' +
      '<button type="button" class="name" data-act="more" data-eid="' + esc(swE || d.ents.stack_type || "") + '" data-fk="name:' + id + '">' +
      '<span class="n1">' + esc(d.name) + "</span>" + (sub ? '<span class="n2">' + sub + "</span>" : "") + "</button>" +
      '<span class="chip">' + esc(label) + "</span>";
    if (c.show_actions && swE) {
      html += '<button type="button" class="sw' + (this._pending[swE] ? " busy" : "") + '" role="switch" aria-checked="' + m.active +
        '" data-act="switch" data-cid="' + id + '" data-fk="sw:' + id + '" aria-label="' + esc((m.active ? t("a_stop") : t("a_start")) + " " + d.name) +
        '" title="' + esc(m.active ? t("a_stop") : t("a_start")) + '"' + (bad(m.swS) ? " disabled" : "") + "></button>";
    }
    html += "</div>";

    if (this._confirm && this._confirm.cid === d.id) {
      return html + '<div class="confirm" role="alertdialog" aria-label="' + esc(this._confirm.q) + '"><span>' + esc(this._confirm.q) + "</span>" +
        '<button type="button" class="cbtn" data-act="cancel" data-fk="cancel:' + id + '">' + esc(t("cancel")) + "</button>" +
        '<button type="button" class="cbtn go" data-act="confirm" data-fk="go:' + id + '">' + esc(t("confirm")) + "</button></div></div>";
    }

    const open = this._open.has(d.id), kid = "k-" + id;
    const summary = m.kids.length ? t("running_of", { r: m.run, n: m.kids.length }) : t("containers_n", { n: isNaN(m.count) ? 0 : m.count });
    html += '<div class="foot">';
    if (c.show_containers) {
      html += '<button type="button" class="sum" data-act="expand" data-cid="' + id + '" data-fk="sum:' + id + '" aria-expanded="' + open +
        '" aria-controls="' + kid + '" title="' + esc(t("show_containers")) + '"><ha-icon icon="mdi:chevron-right"></ha-icon><span>' + esc(summary) +
        '</span><span class="dots" aria-hidden="true">' + m.kids.slice(0, 40).map((k) => '<span class="cd" style="--tone:' + TONE[k.tone] + '"></span>').join("") +
        "</span></button>";
    } else html += '<span style="flex:1">' + esc(summary) + "</span>";
    const upE = d.ents.update_stack;
    if (c.show_actions && upE) {
      const st = this._hass.states[upE];
      html += '<button type="button" class="btn' + (this._pending[upE] ? " busy" : "") + '" style="--tone:var(--hc-info)" data-act="update" data-cid="' + id +
        '" data-fk="update:' + id + '" title="' + esc(t("a_update")) + '" aria-label="' + esc(t("a_update") + " " + d.name) + '"' +
        (st && st.state === "unavailable" ? " disabled" : "") + '><ha-icon icon="mdi:cloud-download-outline"></ha-icon></button>';
    }
    html += "</div>";
    if (c.show_containers && open) {
      html += '<div class="kids" id="' + kid + '">' + (m.kids.length ? m.kids.map((k) =>
        '<button type="button" class="kid" style="--tone:' + TONE[k.tone] + '" data-act="more" data-eid="' +
        esc(k.d.ents.container_state || k.d.ents.status || k.d.ents.container || "") + '" data-fk="kid:' + esc(k.d.id) + '">' +
        '<span class="dot"></span><span class="kn">' + esc(k.d.name) + '</span><span class="ks">' + esc(k.label) + "</span></button>").join("")
        : '<div class="none">' + esc(t("no_ct")) + "</div>") + "</div>";
    }
    return html + "</div>";
  }

  _onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, t = this._t;
    if (act === "more") { this._more(b.dataset.eid); return; }
    if (act === "state") { this._ui.state = b.dataset.v; this._renderList(); return; }
    if (act === "reset") {
      Object.assign(this._ui, { q: "", state: "all", endpoint: "" });
      this.shadowRoot.querySelector('input[data-f="q"]').value = "";
      this._renderList(); return;
    }
    if (act === "expand") {
      const cid = b.dataset.cid;
      if (this._open.has(cid)) this._open.delete(cid); else this._open.add(cid);
      this._renderList(); return;
    }
    if (act === "cancel" || act === "confirm") {
      const p = this._confirm; this._confirm = null;
      if (p) this._focusKeys = [(p.domain === "switch" ? "sw:" : "update:") + p.cid, "name:" + p.cid];
      if (act === "confirm") this._run(p); else this._renderList();
      return;
    }
    const m = this._index && this._index.get(b.dataset.cid);
    if (!m) return;
    let p;
    if (act === "switch") {
      p = { cid: m.d.id, id: m.active ? "stop" : "start", entity: m.d.ents.stack, domain: "switch", service: m.active ? "turn_off" : "turn_on" };
    } else if (act === "update") {
      p = { cid: m.d.id, id: "update", entity: m.d.ents.update_stack, domain: "button", service: "press" };
    } else return;
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

  getCardSize() { return 3 + Math.min(((this._cache && this._cache.stacks.length) || 1) * 2, 30); }
  static getStubConfig() { return {}; }
  static getConfigElement() { return document.createElement(TAG + "-editor"); }
}
if (!customElements.get(TAG)) customElements.define(TAG, PortainerStacksCard);

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
      { name: "endpoints", selector: multi(opts(s.endpoints.filter((e) => s.stacks.some((x) => x.endpoint === e.id)))) },
      { name: "stacks", selector: multi(opts(s.stacks, true)) },
      { name: "exclude", selector: multi(opts(s.stacks, true)) },
    ]},
    { id: "display", title: t("sec_display"), schema: [
      { name: "sort", selector: { select: { mode: "dropdown", options: SORTS.map((k) => ({ value: k, label: t("s_" + k) })) } } },
      { name: "hide_stopped", selector: { boolean: {} } },
      { name: "max_height", selector: { number: { min: 0, max: 2000, step: 20, unit_of_measurement: "px", mode: "box" } } },
      { name: "show_search", selector: { boolean: {} } },
      { name: "show_filters", selector: { boolean: {} } },
      { name: "show_containers", selector: { boolean: {} } },
    ]},
    { id: "colors", title: t("sec_colors"), colors: [{ key: "accent", label: t("l_accent") }] },
    { id: "actions", title: t("sec_actions"), schema: [
      { name: "show_actions", selector: { boolean: {} } },
      { name: "confirm_actions", selector: { select: { multiple: true, options:
        ["start", "stop", "update"].map((k) => ({ value: k, label: t("a_" + k) })) } } },
    ]},
  ];
};

class PortainerStacksCardEditor extends HTMLElement {
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
if (!customElements.get(TAG + "-editor")) customElements.define(TAG + "-editor", PortainerStacksCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === TAG)) {
  window.customCards.push({
    type: TAG,
    name: "Portainer Stacks Card",
    description: "Portainer stacks: type, containers, start / stop and update (redeploy).",
    preview: true,
  });
}
console.info("%c PORTAINER-STACKS-CARD %c v" + VERSION + " ",
  "color:#fff;background:#2496ED;font-weight:700", "color:#2496ED;background:#222");
}

/* ============================================================
EXAMPLES

# Auto (default): every Portainer stack
type: custom:portainer-stacks-card

# One endpoint (device id or device name), problems first, no confirmation on stop
type: custom:portainer-stacks-card
endpoints:
  - example-endpoint
sort: state
confirm_actions: [update]
============================================================ */
