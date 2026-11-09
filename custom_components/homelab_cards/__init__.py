"""Homelab Cards: serves the Lovelace cards and loads the selected ones on every dashboard."""
from __future__ import annotations

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import CARDS_DIR, CONF_CARDS, DOMAIN, URL_BASE, load_catalog


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not hass.data.get(f"{DOMAIN}_static"):
        # Registering the same path twice raises, so it is done once per HA run.
        await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(CARDS_DIR), False)])
        hass.data[f"{DOMAIN}_static"] = True

    version = (await async_get_integration(hass, DOMAIN)).version
    cards = load_catalog()["cards"]
    # Selection holds card ids; v2.0 stored "category/file-stem", still accepted. No selection saved: every card.
    selected = set(entry.options.get(CONF_CARDS, [c["id"] for c in cards]))
    urls = [
        f"{URL_BASE}/{c['file']}?v={version}"
        for c in cards
        if c["id"] in selected or c["file"].removesuffix(".js") in selected
    ]
    for url in urls:
        add_extra_js_url(hass, url)
    entry.runtime_data = urls
    entry.async_on_unload(entry.add_update_listener(_reload))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    for url in entry.runtime_data:
        remove_extra_js_url(hass, url)
    return True


async def _reload(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
