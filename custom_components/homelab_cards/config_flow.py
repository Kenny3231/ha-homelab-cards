"""Config flow: one collapsible section per category, pick the cards to load."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers.selector import SelectOptionDict, SelectSelector, SelectSelectorConfig, SelectSelectorMode

from .const import CONF_CARDS, DOMAIN, load_catalog


def _lang(hass: HomeAssistant) -> str:
    return "fr" if hass.config.language.startswith("fr") else "en"


def _schema(hass: HomeAssistant, selected: set[str] | None) -> vol.Schema:
    """selected=None means every card ticked (first setup)."""
    lang, catalog, fields = _lang(hass), load_catalog(), {}
    for cat_id in catalog["categories"]:
        cards = [c for c in catalog["cards"] if c["category"] == cat_id]
        if not cards:
            continue
        options = [SelectOptionDict(value=c["id"], label=c["name"][lang]) for c in cards]
        default = [c["id"] for c in cards if selected is None or c["id"] in selected or c["file"].removesuffix(".js") in selected]
        fields[vol.Required(cat_id)] = section(
            vol.Schema(
                {
                    vol.Required(CONF_CARDS, default=default): SelectSelector(
                        SelectSelectorConfig(options=options, multiple=True, mode=SelectSelectorMode.LIST)
                    )
                }
            ),
            {"collapsed": False},
        )
    return vol.Schema(fields)


def _flatten(user_input: dict[str, Any]) -> dict[str, list[str]]:
    return {CONF_CARDS: [card for sec in user_input.values() for card in sec[CONF_CARDS]]}


class HomelabCardsConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Homelab Cards", data={}, options=_flatten(user_input))
        return self.async_show_form(step_id="user", data_schema=_schema(self.hass, None))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return HomelabCardsOptionsFlow()


class HomelabCardsOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=_flatten(user_input))
        current = self.config_entry.options.get(CONF_CARDS)
        return self.async_show_form(step_id="init", data_schema=_schema(self.hass, None if current is None else set(current)))
