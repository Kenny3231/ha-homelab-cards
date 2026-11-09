"""Constants and catalog for Homelab Cards."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DOMAIN = "homelab_cards"
CONF_CARDS = "cards"
CARDS_DIR = Path(__file__).parent / "cards"
URL_BASE = f"/{DOMAIN}"


def load_catalog() -> dict[str, Any]:
    """Catalog shipped with the integration (categories + cards), keeping only cards whose file exists."""
    data = json.loads((Path(__file__).parent / "cards.json").read_text(encoding="utf8"))
    data["cards"] = [c for c in data["cards"] if (CARDS_DIR / c["file"]).is_file()]
    return data
