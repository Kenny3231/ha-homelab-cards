# Homelab Cards for Home Assistant

[English](README.md) · [Site](https://kenny3231.github.io/ha-homelab-cards/) · [![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)

Cartes Lovelace pour homelab Home Assistant : UniFi, Proxmox, Synology, Transmission, Technitium DNS, Android TV et plus. Zéro dépendance, éditeur visuel inclus, une seule installation HACS.

## Installation (HACS)

1. Dans HACS, ouvrez le menu (⋮) → **Dépôts personnalisés**.
2. Ajoutez `https://github.com/Kenny3231/ha-homelab-cards` avec le type **Tableau de bord** (*Lovelace*).
3. Cherchez **Homelab Cards** puis cliquez sur **Télécharger**.
4. Rechargez le navigateur (Ctrl+Shift+R). HACS déclare la ressource lui-même : **rien à ajouter dans `configuration.yaml`**.
5. Modifiez un tableau de bord → **Ajouter une carte** → cherchez le nom de la carte (ex. « UniFi Gateway »).

**Tableaux de bord en mode YAML** : HACS ne peut pas déclarer la ressource. Ajoutez-la vous-même dans `lovelace: resources:` de `configuration.yaml`, puis redémarrez :

```yaml
- url: /local/community/ha-homelab-cards/ha-homelab-cards.js
  type: module
```

Installation manuelle : copiez `dist/ha-homelab-cards.js` dans `/config/www/` et ajoutez la ressource `/local/ha-homelab-cards.js` (type *Module JavaScript*).

## Intégrations requises

| | |
|---|---|
| [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | native |
| [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | intégration personnalisée HACS |
| [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | native |
| [Transmission](https://www.home-assistant.io/integrations/transmission/) | native |
| [Technitium DNS](https://github.com/Amateur-God/home-assistant-technitiumdns) | intégration personnalisée HACS |
| [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | native |
| [Intex Spa](https://github.com/mathieu-mp/homeassistant-intex-spa) | intégration personnalisée HACS |

Les intégrations « HACS » sont à installer au préalable ; les « natives » sont fournies avec Home Assistant.

## Cartes

### Réseau

| Card | Nécessite | |
|---|---|---|
| `custom:unifi-gateway-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Passerelle UniFi (UCG / UDM / USG) : état, clients, uptime, latences WAN, ports et mises à jour. |
| `custom:unifi-switch-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Switch UniFi : grille de ports avec vitesse de lien et état. |
| `custom:unifi-ap-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Bornes WiFi UniFi : plusieurs AP dans une seule carte. |
| `custom:unifi-clients-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Équipements connectés : liste manuelle ou découverte automatique filtrable par plage IP. ⚠️ Le filtre par plage IP exige que vos device_tracker exposent un attribut IP (réglable via auto.ip_attribute). |
| `custom:unifi-wifi-card` | [UniFi Network](https://www.home-assistant.io/integrations/unifi/) | Active / désactive chaque réseau WiFi (SSID) et affiche le nombre de clients. ⚠️ Les switches de réseau WiFi ne sont créés par l'intégration UniFi que si l'option correspondante est activée. |
| `custom:dns-status-card` | [Technitium DNS](https://github.com/Amateur-God/home-assistant-technitiumdns) | Statut DNS Technitium : requêtes, blocage de pubs (pause temporisée) et historique en sparkline. |

### Virtualisation

| Card | Nécessite | |
|---|---|---|
| `custom:proxmox-node-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | Nœud PVE : CPU, mémoire, disque, swap et actions (tout démarrer/arrêter, redémarrer, éteindre). |
| `custom:proxmox-guests-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | VM (QEMU) et conteneurs (LXC) avec boutons contextuels démarrer / éteindre / forcer / redémarrer. |
| `custom:proxmox-storage-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | Volumes de stockage Proxmox : occupation et état. |
| `custom:proxmox-disks-card` | [Proxmox VE](https://github.com/dougiteixeira/proxmoxve) | Disques physiques : santé S.M.A.R.T., température et usure SSD. ⚠️ L'usure SSD est ambiguë selon le firmware : réglez wearout_mode par disque (used = usure, remaining = vie restante). |

### Stockage

| Card | Nécessite | |
|---|---|---|
| `custom:synology-nas-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | Système DSM : CPU, mémoire, charge, débits, mise à jour et actions (redémarrer / éteindre). |
| `custom:synology-volumes-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | Volumes DSM : espace utilisé et état. |
| `custom:synology-drives-card` | [Synology DSM](https://www.home-assistant.io/integrations/synology_dsm/) | Disques DSM : état, température et alarmes S.M.A.R.T. (secteurs défectueux, durée de vie). |

### Média & téléchargements

| Card | Nécessite | |
|---|---|---|
| `custom:transmission-status-card` | [Transmission](https://www.home-assistant.io/integrations/transmission/) | Client Transmission : débits, torrents actifs, mode tortue, liste détaillée des torrents. ⚠️ Lit l'attribut torrent_info des capteurs *_torrents. power_entity est requis. |
| `custom:perso-remote-card` | [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | Télécommande « physique » : D-pad circulaire, touches en relief, volume via un media_player. |
| `custom:perso-apps-card` | [Android TV Remote](https://www.home-assistant.io/integrations/androidtv_remote/) | Grille de lancement d'applications pour une entité remote (Android TV / Shield). ⚠️ Les logos sont à déposer dans /config/www/apps/ (ex. netflix.webp) ; ils ne sont pas fournis. |

### Maison

| Card | Nécessite | |
|---|---|---|
| `custom:intex-spa-card` | [Intex Spa](https://github.com/mathieu-mp/homeassistant-intex-spa) | Spa Intex : température, chauffage, filtration, bulles, jets, animations bulles et vapeur. |

## Exemple

```yaml
type: custom:unifi-gateway-card
title: Gateway
```

Chaque carte possède un éditeur visuel : utilisez-le pour choisir vos entités.

## Contribuer

Issues et pull requests bienvenues. Les cartes sont dans `src/cards/<catégorie>/` ; `npm run build` régénère `dist/`, `npm run docs` les README.

## Licence

MIT
