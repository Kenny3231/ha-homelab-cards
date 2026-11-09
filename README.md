# Homelab Cards for Home Assistant

[Français](README.fr.md) · [Website](https://kenny3231.github.io/ha-homelab-cards/) · [![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)

Lovelace cards for Home Assistant homelabs: UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV and more. Zero dependency, visual editor included, one HACS install.

## Installation (HACS)

1. In HACS, open the menu (⋮) → **Custom repositories**.
2. Add `https://github.com/Kenny3231/ha-homelab-cards` with type **Dashboard** (a.k.a. *Lovelace*).
3. Search for **Homelab Cards**, click **Download**.
4. Reload your browser (Ctrl+Shift+R). HACS registers the resource itself: **nothing to add in `configuration.yaml`**.
5. Edit a dashboard → **Add card** → search the card name (e.g. “UniFi Gateway”).

**YAML-mode dashboards**: HACS cannot register the resource. Add it yourself under `lovelace: resources:` in `configuration.yaml`, then restart:

```yaml
- url: /local/community/ha-homelab-cards/ha-homelab-cards.js
  type: module
```

Manual install: copy `dist/ha-homelab-cards.js` to `/config/www/` and add the resource `/local/ha-homelab-cards.js` (type *JavaScript module*).

## Required integrations

| | |
|---|---|
| [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | built-in |
| [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | HACS custom integration |
| [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | built-in |
| [Transmission](https://www.home-assistant.io/integrations/transmission/) | built-in |
| [Technitium DNS](https://github.com/Amateur-God/home-assistant-technitiumdns) | HACS custom integration |
| [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | built-in |
| [Intex Spa](https://github.com/mathieu-mp/homeassistant-intex-spa) | HACS custom integration |

“HACS” integrations must be installed first; “built-in” ones ship with Home Assistant.

## Cards

### Network

| Card | Requires | |
|---|---|---|
| `custom:unifi-gateway-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | UniFi gateway (UCG / UDM / USG): status, clients, uptime, WAN latency, ports and updates. |
| `custom:unifi-switch-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | UniFi switch: port grid with link speed and status. |
| `custom:unifi-ap-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | UniFi access points: several APs in one card. |
| `custom:unifi-clients-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Connected devices: manual list or auto-discovery filterable by IP range. ⚠️ The IP range filter requires your device_tracker entities to expose an IP attribute (configurable via auto.ip_attribute). |
| `custom:unifi-wifi-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Enable / disable each WiFi network (SSID) and show connected clients. ⚠️ WiFi network switches are only created by the UniFi integration when the matching option is enabled. |
| `custom:dns-status-card` | [Technitium DNS](https://github.com/Amateur-God/home-assistant-technitiumdns) | Technitium DNS status: queries, ad blocking (timed pause) and history sparkline. |

### Virtualization

| Card | Requires | |
|---|---|---|
| `custom:proxmox-node-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | PVE node: CPU, memory, disk, swap and actions (start/stop all, reboot, shutdown). |
| `custom:proxmox-guests-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | VMs (QEMU) and containers (LXC) with contextual start / shutdown / force stop / reboot buttons. |
| `custom:proxmox-storage-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | Proxmox storage volumes: usage and status. |
| `custom:proxmox-disks-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | Physical disks: S.M.A.R.T. health, temperature and SSD wear. ⚠️ SSD wearout is ambiguous depending on firmware: set wearout_mode per disk (used = wear, remaining = life left). |

### Storage

| Card | Requires | |
|---|---|---|
| `custom:synology-nas-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | DSM system: CPU, memory, load, throughput, update and actions (reboot / shutdown). |
| `custom:synology-volumes-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | DSM volumes: used space and status. |
| `custom:synology-drives-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | DSM drives: status, temperature and S.M.A.R.T. alarms (bad sectors, remaining life). |

### Media & downloads

| Card | Requires | |
|---|---|---|
| `custom:transmission-status-card` | [Transmission](https://www.home-assistant.io/integrations/transmission/) | Transmission client: speeds, active torrents, turtle mode, detailed torrent list. ⚠️ Reads the torrent_info attribute of the *_torrents sensors. power_entity is required. |
| `custom:perso-remote-card` | [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | “Physical” remote: circular D-pad, embossed keys, volume through a media_player. |
| `custom:perso-apps-card` | [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | App launcher grid for a remote entity (Android TV / Shield). ⚠️ Put your logos in /config/www/apps/ (e.g. netflix.webp); they are not bundled. |

### Home

| Card | Requires | |
|---|---|---|
| `custom:intex-spa-card` | [Intex Spa](https://github.com/mathieu-mp/homeassistant-intex-spa) | Intex spa: temperature, heating, filtration, bubbles, jets, bubble and steam animations. |

## Example

```yaml
type: custom:unifi-gateway-card
title: Gateway
```

Every card has a visual editor: use it to pick your entities.

## Contributing

Issues and pull requests are welcome. Cards live in `src/cards/<category>/`; run `npm run build` to regenerate `dist/` and `npm run docs` for the READMEs.

## License

MIT
