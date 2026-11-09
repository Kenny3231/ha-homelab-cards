/**
 * Portainer Endpoint Card — one Docker endpoint of the native Home Assistant "portainer" integration
 * Version 1.0.0
 *
 * System info (Docker / API / OS / kernel / architecture / CPU / memory), container counters,
 * images, disk usage (containers / images / volumes, reclaimable) and prune buttons.
 * Auto mode (default): picks the first endpoint that has containers. `endpoint:` accepts a
 * device id or a device name; `entities:` (translation_key → entity_id) overrides any entity.
 * Discovery uses hass.entities (platform + translation_key + device_id) and hass.devices only.
 */
// Block scope keeps helpers private even if the file is loaded as a classic script.
{
const VERSION = "1.0.0";
const TAG = "portainer-endpoint-card";

/* ---------- i18n ---------- */
const I18N = {
  en: {
    title: "Docker endpoint", online: "Online", offline: "Offline", update: "Portainer update",
    os: "OS", kernel: "Kernel", arch: "Architecture", docker: "Docker", api: "API", cpu: "CPU", memory: "Memory",
    c_total: "Containers", c_running: "Running", c_stopped: "Stopped", c_paused: "Paused", images: "Images",
    disk: "Disk usage", d_containers: "Containers", d_images: "Images", d_volumes: "Volumes",
    reclaimable: "{v} reclaimable", prune: "Cleanup",
    p_images: "Images", p_volumes: "Volumes", p_build: "Build cache", p_networks: "Networks",
    p_images_q: "Remove unused images on “{n}”?", p_volumes_q: "Remove unused volumes on “{n}”? Their data will be lost.",
    p_build_q: "Clear the build cache on “{n}”?", p_networks_q: "Remove unused networks on “{n}”?",
    cancel: "Cancel", confirm: "Confirm", failed: "Action failed: {e}", done: "Sent",
    empty_t: "No Portainer endpoint found",
    empty_h: "Check that the Portainer integration is set up, or set the endpoint in the card options.",
    sec_gen: "General", sec_display: "Display", sec_colors: "Colors", sec_actions: "Actions",
    open_all: "Expand all", close_all: "Collapse all",
    hint_gen: "Leave the endpoint empty to pick the first one that has containers. Any entity can be overridden with the YAML key `entities` (translation_key → entity_id).",
    l_title: "Title (empty = endpoint name)", l_icon: "Icon", l_endpoint: "Endpoint",
    l_show_system: "System information", l_show_counts: "Container counters", l_show_disk: "Disk usage",
    l_show_prune: "Cleanup buttons", l_confirm_prune: "Ask for confirmation before a cleanup", l_accent: "Accent",
  },
  fr: {
    title: "Endpoint Docker", online: "En ligne", offline: "Hors ligne", update: "MAJ Portainer",
    os: "OS", kernel: "Noyau", arch: "Architecture", docker: "Docker", api: "API", cpu: "CPU", memory: "Mémoire",
    c_total: "Conteneurs", c_running: "En marche", c_stopped: "Arrêtés", c_paused: "En pause", images: "Images",
    disk: "Utilisation disque", d_containers: "Conteneurs", d_images: "Images", d_volumes: "Volumes",
    reclaimable: "{v} récupérables", prune: "Nettoyage",
    p_images: "Images", p_volumes: "Volumes", p_build: "Cache de build", p_networks: "Réseaux",
    p_images_q: "Supprimer les images inutilisées sur « {n} » ?", p_volumes_q: "Supprimer les volumes inutilisés sur « {n} » ? Leurs données seront perdues.",
    p_build_q: "Vider le cache de build sur « {n} » ?", p_networks_q: "Supprimer les réseaux inutilisés sur « {n} » ?",
    cancel: "Annuler", confirm: "Confirmer", failed: "Échec de l'action : {e}", done: "Envoyé",
    empty_t: "Aucun endpoint Portainer trouvé",
    empty_h: "Vérifiez que l'intégration Portainer est configurée, ou choisissez l'endpoint dans les options de la carte.",
    sec_gen: "Général", sec_display: "Affichage", sec_colors: "Couleurs", sec_actions: "Actions",
    open_all: "Tout déplier", close_all: "Tout replier",
    hint_gen: "Laissez l'endpoint vide pour prendre le premier qui a des conteneurs. Chaque entité peut être forcée avec la clé YAML `entities` (translation_key → entity_id).",
    l_title: "Titre (vide = nom de l'endpoint)", l_icon: "Icône", l_endpoint: "Endpoint",
    l_show_system: "Informations système", l_show_counts: "Compteurs de conteneurs", l_show_disk: "Utilisation disque",
    l_show_prune: "Boutons de nettoyage", l_confirm_prune: "Demander confirmation avant un nettoyage", l_accent: "Accent",
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
  // Only plain numbers get locale formatting ("27.0.1" is a version, not 27).
  const n = /^-?\d+(\.\d+)?$/.test(st.state) ? parseFloat(st.state) : NaN;
  return (isNaN(n) ? st.state : nf(h, { maximumFractionDigits: 1 }).format(n)) + (u ? " " + u : "");
};
const UNITS = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1048576, gib: 1073741824, tib: 1099511627776 };
const bytes = (st) => {
  const n = num(st); if (isNaN(n)) return NaN;
  const f = UNITS[String((st.attributes || {}).unit_of_measurement || "B").toLowerCase()];
  return f ? n * f : NaN;
};
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
  icon: "mdi:docker", accent: "#2496ED", endpoint: "", show_system: true, show_counts: true,
  show_disk: true, show_prune: true, confirm_prune: true,
};
const PRUNES = [
  { id: "images", key: "images_prune", icon: "mdi:layers-remove", tone: "var(--hc-warn)" },
  { id: "volumes", key: "volumes_prune", icon: "mdi:database-remove-outline", tone: "var(--hc-crit)" },
  { id: "build", key: "build_cache_prune", icon: "mdi:hammer-wrench", tone: "var(--hc-warn)" },
  { id: "networks", key: "networks_prune", icon: "mdi:lan-disconnect", tone: "var(--hc-info)" },
];

class PortainerEndpointCard extends HTMLElement {
  setConfig(config) {
    const c = Object.assign({}, DEF, config || {});
    c.entities = config && config.entities && typeof config.entities === "object" ? config.entities : {};
    this._config = c;
    this._pending = this._pending || {};
    this._key = null;
    if (this._built) this._render();
  }
  disconnectedCallback() { clearTimeout(this._cTimer); }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (!this._built) this._build();
    const ep = this._endpoint();
    let changed = ep !== this._lastEp;
    this._lastEp = ep;
    const seen = this._seen || (this._seen = new Map());
    if (ep) Object.keys(ep.ents).forEach((k) => {
      const id = ep.ents[k], st = hass.states[id];
      if (seen.get(id) !== st) { seen.set(id, st); changed = true; }
    });
    if (changed) this._render();
  }

  /* Resolved endpoint: explicit (id / name) or the first one with containers; cached per registry/config */
  _endpoint() {
    const h = this._hass, c = this._config, s = scan(h);
    if (this._key === s) return this._ep;
    let d = c.endpoint ? s.endpoints.find((x) => matchAny([c.endpoint], x.id, x.name)) : null;
    if (!d && !c.endpoint) {
      d = s.endpoints.find((x) => num(h.states[x.ents.containers_count]) > 0) ||
        s.endpoints.find((x) => s.containers.some((k) => k.endpoint === x.id)) || s.endpoints[0] || null;
    }
    let ep = null;
    if (d || Object.keys(c.entities).length) {
      ep = Object.assign({ id: "cfg", name: "", entries: [] }, d || {}, { ents: Object.assign({}, d ? d.ents : {}, c.entities) });
      if (!ep.ents.server_update) {
        // Portainer server device of the same config entry (or the only one).
        const srv = s.servers.find((x) => x.entries.some((e) => ep.entries.indexOf(e) !== -1)) ||
          (s.servers.length === 1 ? s.servers[0] : null);
        if (srv && srv.ents.server_update) ep.ents.server_update = srv.ents.server_update;
      }
    }
    this._key = s; this._ep = ep;
    return ep;
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
          border:1px solid color-mix(in srgb, var(--hc-state) 30%, transparent);
          box-shadow:0 0 24px color-mix(in srgb, var(--hc-state) 10%, transparent);
          background:var(--card-background-color,#181a1b); transition:border-color .3s ease, box-shadow .3s ease; }
        .header { all:unset; box-sizing:border-box; width:100%; padding:15px 15px 4px; display:flex; align-items:center;
          gap:12px; cursor:pointer; }
        .header:focus-visible { outline:2px solid var(--hc-accent); outline-offset:-2px; }
        .disc { width:46px; height:46px; border-radius:50%; flex-shrink:0; display:flex; align-items:center;
          justify-content:center; color:var(--hc-state); background:color-mix(in srgb, var(--hc-state) 14%, transparent);
          transition:background .3s ease, color .3s ease; }
        .disc ha-icon { --mdc-icon-size:24px; }
        .htext { flex:1; min-width:0; }
        .htitle { font-size:15px; font-weight:600; color:var(--primary-text-color);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .hsub { font-size:11px; color:var(--secondary-text-color); margin-top:2px; }
        .hsub b { font-weight:600; color:var(--hc-state); }
        .badge { border:none; font:inherit; padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600;
          flex-shrink:0; cursor:pointer; color:var(--hc-warn); background:color-mix(in srgb, var(--hc-warn) 15%, transparent); }
        button:focus-visible { outline:2px solid var(--hc-accent); outline-offset:1px; }
        .sec { padding:12px 15px 0; }
        .sec-l { font-size:10.5px; color:var(--disabled-text-color, var(--secondary-text-color)); letter-spacing:.3px;
          margin-bottom:7px; display:flex; align-items:center; gap:6px; }
        .sec-l ha-icon { --mdc-icon-size:13px; }
        .sys { display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:6px; }
        .kv { background:var(--hc-surface); border-radius:8px; padding:6px 8px; min-width:0; }
        .kv .k { font-size:9.5px; color:var(--secondary-text-color); }
        .kv .v { font-size:11.5px; font-weight:600; color:var(--primary-text-color); margin-top:1px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(58px, 1fr)); gap:6px; }
        .tile { all:unset; box-sizing:border-box; background:var(--hc-surface); border-radius:9px; padding:8px 6px;
          text-align:center; cursor:pointer; transition:background .2s ease; min-width:0; }
        .tile:hover { background:var(--hc-surface2); }
        .tile:focus-visible { outline:2px solid var(--hc-accent); }
        .tile .n { font-size:17px; font-weight:700; color:var(--tone, var(--primary-text-color)); line-height:1.15; }
        .tile .l { font-size:9.5px; color:var(--secondary-text-color); margin-top:2px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ratio { display:flex; height:4px; border-radius:2px; overflow:hidden; background:var(--hc-track); margin-top:8px; }
        .ratio span { height:100%; transition:width .4s ease; }
        .disk { display:flex; flex-direction:column; gap:9px; }
        .g { all:unset; box-sizing:border-box; display:flex; align-items:center; gap:9px; cursor:pointer; border-radius:4px; }
        .g:focus-visible { outline:2px solid var(--hc-accent); outline-offset:2px; }
        .g-n { font-size:10.5px; color:var(--secondary-text-color); width:72px; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .g-t { flex:1; height:6px; border-radius:3px; background:var(--hc-track); overflow:hidden; }
        .g-f { display:block; height:100%; border-radius:3px; background:var(--hc-warn); transition:width .4s ease; }
        .g-v { font-size:11px; color:var(--primary-text-color); width:120px; text-align:right; flex-shrink:0;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .g-v b { font-weight:600; }
        .g-v small { color:var(--secondary-text-color); font-size:9.5px; display:block; }
        .footer { margin-top:12px; padding:11px 15px 14px; border-top:1px solid var(--hc-surface2);
          background:color-mix(in srgb, var(--primary-text-color,#888) 1.5%, transparent); }
        .actions { display:flex; gap:6px; flex-wrap:wrap; }
        .action { flex:1; min-width:72px; display:flex; align-items:center; justify-content:center; gap:5px;
          padding:8px 5px; border-radius:8px; border:none; cursor:pointer; font:inherit; font-size:11px; font-weight:600;
          color:var(--primary-text-color); background:var(--hc-surface); transition:background .2s ease, transform .1s ease; }
        .action:hover:not(:disabled) { background:var(--hc-surface2); }
        .action:active:not(:disabled) { transform:scale(.95); }
        .action:disabled { opacity:.4; cursor:default; }
        .action ha-icon { --mdc-icon-size:14px; color:var(--tone); }
        .busy { animation:hc-pulse 1s ease-in-out infinite; pointer-events:none; }
        .confirm { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; flex-wrap:wrap;
          font-size:11.5px; color:var(--primary-text-color); animation:hc-in .2s ease both;
          background:color-mix(in srgb, var(--hc-crit) 12%, transparent); }
        .confirm span { flex:1 1 160px; min-width:0; line-height:1.4; }
        .cbtn { border:none; border-radius:6px; padding:5px 10px; font:inherit; font-size:11px; font-weight:600;
          cursor:pointer; background:var(--hc-surface2); color:var(--primary-text-color); }
        .cbtn.go { background:var(--hc-crit); color:#fff; }
        .empty { text-align:center; padding:26px 14px; color:var(--secondary-text-color); font-size:12px; line-height:1.45; }
        .empty ha-icon { --mdc-icon-size:34px; opacity:.45; display:block; margin:0 auto 8px; }
        .empty .e-t { font-weight:600; color:var(--primary-text-color); font-size:13px; margin-bottom:4px; }
        .pad { height:14px; }
        .hidden { display:none !important; }
        @keyframes hc-in { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
        @keyframes hc-pulse { 50% { opacity:.4; } }
        @media (prefers-reduced-motion: reduce) { *, *::after { animation:none !important; transition:none !important; } }
      </style>
      <ha-card><div class="body"></div></ha-card>`;
    const card = this.shadowRoot.querySelector("ha-card");
    card.addEventListener("click", (e) => this._onClick(e));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._confirm) { this._confirm = null; this._render(); }
    });
  }

  _render() {
    if (!this._hass) return;
    const h = this._hass, c = this._config, t = (this._t = tr(h));
    const ep = this._endpoint(), body = this.shadowRoot.querySelector(".body");
    this.style.setProperty("--hc-accent", c.accent);
    const act = this.shadowRoot.activeElement;
    const fks = [].concat(this._focusKeys || [], act && act.dataset && act.dataset.fk ? [act.dataset.fk] : []);
    this._focusKeys = null;
    if (!ep) {
      this.style.setProperty("--hc-state", c.accent);
      body.innerHTML = '<div class="empty"><ha-icon icon="' + esc(c.icon) + '"></ha-icon><div class="e-t">' + esc(t("empty_t")) +
        "</div><div>" + esc(t("empty_h")) + "</div></div>";
      return;
    }
    const S = (k) => (ep.ents[k] ? h.states[ep.ents[k]] : null);
    const val = (k) => (bad(S(k)) ? "" : fmt(h, S(k)));
    const statusS = S("status");
    const online = statusS ? statusS.state === "on" : true;
    this.style.setProperty("--hc-state", online ? c.accent : "var(--hc-crit)");

    /* Header */
    const sub = ['<b>' + esc(online ? t("online") : t("offline")) + "</b>"];
    if (val("docker_version")) sub.push(esc(t("docker") + " " + val("docker_version")));
    const upd = S("server_update"), hasUpd = !!upd && upd.state === "on";
    let html = '<button type="button" class="header" data-act="more" data-eid="' + esc(ep.ents.status || ep.ents.containers_count || "") + '" data-fk="hdr">' +
      '<div class="disc"><ha-icon icon="' + esc(c.icon) + '"></ha-icon></div>' +
      '<div class="htext"><div class="htitle">' + esc(c.title || ep.name || t("title")) + '</div><div class="hsub">' + sub.join(" · ") + "</div></div></button>";
    if (hasUpd) {
      // Outside the header button: nested buttons are invalid HTML.
      html += '<div style="padding:0 15px;display:flex;justify-content:flex-end"><button type="button" class="badge" data-act="more" data-eid="' +
        esc(ep.ents.server_update) + '" data-fk="upd">' + esc(t("update")) + "</button></div>";
    }

    /* System */
    if (c.show_system) {
      const os = [val("operating_system"), val("operating_system_version")].filter(Boolean).join(" ");
      const kv = [
        [t("os"), os], [t("kernel"), val("kernel_version")], [t("arch"), val("architecture")],
        [t("docker"), val("docker_version")], [t("api"), val("api_version")],
        [t("cpu"), val("cpu_total")], [t("memory"), val("memory_total")],
      ].filter((x) => x[1]);
      if (kv.length) {
        html += '<div class="sec"><div class="sys">' + kv.map((x) =>
          '<div class="kv"><div class="k">' + esc(x[0]) + '</div><div class="v" title="' + esc(x[1]) + '">' + esc(x[1]) + "</div></div>").join("") +
          "</div></div>";
      }
    }

    /* Counters */
    if (c.show_counts) {
      const defs = [
        ["containers_count", t("c_total"), ""], ["containers_running", t("c_running"), "var(--hc-on)"],
        ["containers_stopped", t("c_stopped"), "var(--hc-off)"], ["containers_paused", t("c_paused"), "var(--hc-pause)"],
        ["images_count", t("images"), "var(--hc-info)"],
      ].filter((x) => ep.ents[x[0]]);
      if (defs.length) {
        const n0 = nf(h, { maximumFractionDigits: 0 });
        html += '<div class="sec"><div class="tiles">' + defs.map((x) => {
          const n = num(S(x[0]));
          return '<button type="button" class="tile" style="' + (x[2] ? "--tone:" + x[2] : "") + '" data-act="more" data-eid="' + esc(ep.ents[x[0]]) +
            '" data-fk="t:' + x[0] + '" aria-label="' + esc(x[1] + " " + (isNaN(n) ? "—" : n)) + '"><div class="n">' + (isNaN(n) ? "—" : esc(n0.format(n))) +
            '</div><div class="l">' + esc(x[1]) + "</div></button>";
        }).join("") + "</div>";
        const tot = num(S("containers_count")), run = num(S("containers_running")), pau = num(S("containers_paused")), sto = num(S("containers_stopped"));
        if (tot > 0 && !isNaN(run)) {
          const w = (v) => (isNaN(v) ? 0 : Math.min(100, (v / tot) * 100)).toFixed(1) + "%";
          html += '<div class="ratio" aria-hidden="true"><span style="width:' + w(run) + ';background:var(--hc-on)"></span>' +
            '<span style="width:' + w(pau) + ';background:var(--hc-pause)"></span><span style="width:' + w(sto) + ';background:var(--hc-off)"></span></div>';
        }
        html += "</div>";
      }
    }

    /* Disk usage: bar = reclaimable share of the total */
    if (c.show_disk) {
      const rows = [
        ["container_disk_usage_total_size", "container_disk_usage_reclaimable", t("d_containers")],
        ["image_disk_usage_total_size", "image_disk_usage_reclaimable", t("d_images")],
        ["volume_disk_usage_total_size", null, t("d_volumes")],
      ].filter((x) => ep.ents[x[0]]);
      if (rows.length) {
        html += '<div class="sec"><div class="sec-l"><ha-icon icon="mdi:harddisk"></ha-icon>' + esc(t("disk")) + '</div><div class="disk">' + rows.map((x) => {
          const totS = S(x[0]), recS = x[1] ? S(x[1]) : null;
          const tb = bytes(totS), rb = bytes(recS);
          const pct = tb > 0 && !isNaN(rb) ? (rb / tb) * 100 : NaN;
          const rec = recS && !bad(recS) ? t("reclaimable", { v: fmt(h, recS) }) : "";
          return '<button type="button" class="g" data-act="more" data-eid="' + esc(ep.ents[x[0]]) + '" data-fk="d:' + x[0] + '" aria-label="' +
            esc(x[2] + " " + fmt(h, totS) + (rec ? ", " + rec : "")) + '"><span class="g-n">' + esc(x[2]) + '</span><span class="g-t"><span class="g-f" style="width:' +
            (isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100)).toFixed(1) + '%"></span></span><span class="g-v"><b>' + esc(fmt(h, totS)) + "</b>" +
            (rec ? "<small>" + esc(rec) + "</small>" : "") + "</span></button>";
        }).join("") + "</div></div>";
      }
    }

    /* Prune buttons, with inline confirmation */
    const prunes = c.show_prune ? PRUNES.filter((p) => ep.ents[p.key]) : [];
    if (prunes.length) {
      html += '<div class="footer"><div class="sec-l"><ha-icon icon="mdi:broom"></ha-icon>' + esc(t("prune")) + "</div>";
      if (this._confirm) {
        html += '<div class="confirm" role="alertdialog" aria-label="' + esc(this._confirm.q) + '"><span>' + esc(this._confirm.q) + "</span>" +
          '<button type="button" class="cbtn" data-act="cancel" data-fk="cancel">' + esc(t("cancel")) + "</button>" +
          '<button type="button" class="cbtn go" data-act="confirm" data-fk="go">' + esc(t("confirm")) + "</button></div>";
      } else {
        html += '<div class="actions">' + prunes.map((p) => {
          const e = ep.ents[p.key], st = h.states[e];
          return '<button type="button" class="action' + (this._pending[e] ? " busy" : "") + '" style="--tone:' + p.tone + '" data-act="prune" data-p="' + p.id +
            '" data-fk="p:' + p.id + '"' + (st && st.state === "unavailable" ? " disabled" : "") + '><ha-icon icon="' + p.icon + '"></ha-icon><span>' +
            esc(t("p_" + p.id)) + "</span></button>";
        }).join("") + "</div>";
      }
      html += "</div>";
    } else html += '<div class="pad"></div>';

    body.innerHTML = html;
    const r = this.shadowRoot;
    for (const fk of fks) { const el = r.querySelector('[data-fk="' + fk + '"]'); if (el) { el.focus(); break; } }
    if (this._confirm && this._confirm.focus) {
      this._confirm.focus = false;
      const go = r.querySelector(".cbtn.go"); if (go) go.focus();
    }
  }

  _onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, t = this._t, ep = this._ep;
    if (act === "more") { this._more(b.dataset.eid); return; }
    if (act === "cancel" || act === "confirm") {
      const p = this._confirm; this._confirm = null;
      if (p) this._focusKeys = ["p:" + p.id];
      if (act === "confirm") this._run(p); else this._render();
      return;
    }
    if (act !== "prune" || !ep) return;
    const def = PRUNES.find((x) => x.id === b.dataset.p);
    const entity = def && ep.ents[def.key];
    if (!entity || this._pending[entity]) return;
    const p = { id: def.id, entity };
    if (this._config.confirm_prune) {
      p.q = t("p_" + def.id + "_q", { n: ep.name || t("title") });
      p.focus = true;
      this._confirm = p;
      clearTimeout(this._cTimer);
      this._cTimer = setTimeout(() => { if (this._confirm === p) { this._confirm = null; this._render(); } }, 10000);
      this._render();
      return;
    }
    this._run(p);
  }

  _run(p) {
    if (!p || !p.entity || this._pending[p.entity]) return;
    this._pending[p.entity] = true;
    Promise.resolve(this._hass.callService("button", "press", { entity_id: p.entity })).catch((err) => {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: this._t("failed", { e: (err && err.message) || err }) }, bubbles: true, composed: true }));
    });
    setTimeout(() => { delete this._pending[p.entity]; this._render(); }, 3000);
    this._render();
  }

  _more(id) {
    if (!id) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: id };
    this.dispatchEvent(ev);
  }

  getCardSize() { return 6; }
  static getStubConfig() { return {}; }
  static getConfigElement() { return document.createElement(TAG + "-editor"); }
}
if (!customElements.get(TAG)) customElements.define(TAG, PortainerEndpointCard);

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
  const count = (d) => s.containers.filter((x) => x.endpoint === d.id).length;
  return [
    { id: "gen", title: t("sec_gen"), hint: t("hint_gen"), schema: [
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ]},
      { name: "endpoint", selector: { select: { mode: "dropdown", custom_value: true,
        options: s.endpoints.map((d) => ({ value: d.id, label: d.name + " (" + count(d) + ")" })) } } },
    ]},
    { id: "display", title: t("sec_display"), schema: [
      { name: "show_system", selector: { boolean: {} } },
      { name: "show_counts", selector: { boolean: {} } },
      { name: "show_disk", selector: { boolean: {} } },
    ]},
    { id: "colors", title: t("sec_colors"), colors: [{ key: "accent", label: t("l_accent") }] },
    { id: "actions", title: t("sec_actions"), schema: [
      { name: "show_prune", selector: { boolean: {} } },
      { name: "confirm_prune", selector: { boolean: {} } },
    ]},
  ];
};

class PortainerEndpointCardEditor extends HTMLElement {
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
if (!customElements.get(TAG + "-editor")) customElements.define(TAG + "-editor", PortainerEndpointCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((x) => x.type === TAG)) {
  window.customCards.push({
    type: TAG,
    name: "Portainer Endpoint Card",
    description: "Docker endpoint: system info, container counters, disk usage and cleanup.",
    preview: true,
  });
}
console.info("%c PORTAINER-ENDPOINT-CARD %c v" + VERSION + " ",
  "color:#fff;background:#2496ED;font-weight:700", "color:#2496ED;background:#222");
}

/* ============================================================
EXAMPLES

# Auto (default): first endpoint that has containers
type: custom:portainer-endpoint-card

# A given endpoint (device id or device name), no cleanup buttons
type: custom:portainer-endpoint-card
endpoint: example-endpoint
show_prune: false

# Override one entity (translation_key → entity_id)
type: custom:portainer-endpoint-card
endpoint: example-endpoint
entities:
  docker_version: sensor.example_docker_version
============================================================ */
