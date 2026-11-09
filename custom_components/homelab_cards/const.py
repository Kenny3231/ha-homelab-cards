"""Constants and card discovery for Homelab Cards."""
from __future__ import annotations

from pathlib import Path

DOMAIN = "homelab_cards"
CONF_CARDS = "cards"
CARDS_DIR = Path(__file__).parent / "cards"
URL_BASE = f"/{DOMAIN}"


def available_cards() -> dict[str, str]:
    """Return {"network/unifi-gateway-card": "network/unifi-gateway-card.js"} for every shipped card."""
    return {
        p.relative_to(CARDS_DIR).with_suffix("").as_posix(): p.relative_to(CARDS_DIR).as_posix()
        for p in sorted(CARDS_DIR.glob("*/*.js"))
    }
