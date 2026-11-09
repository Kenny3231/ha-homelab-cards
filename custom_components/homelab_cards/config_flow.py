"""Config flow: pick which cards to load."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import SelectOptionDict, SelectSelector, SelectSelectorConfig, SelectSelectorMode

from .const import CONF_CARDS, DOMAIN, available_cards


def _schema(default: list[str]) -> vol.Schema:
    options = [SelectOptionDict(value=k, label=k.replace("/", " / ")) for k in available_cards()]
    return vol.Schema(
        {
            vol.Required(CONF_CARDS, default=default): SelectSelector(
                SelectSelectorConfig(options=options, multiple=True, mode=SelectSelectorMode.LIST)
            )
        }
    )


class HomelabCardsConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="Homelab Cards", data={}, options=user_input)
        return self.async_show_form(step_id="user", data_schema=_schema(list(available_cards())))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return HomelabCardsOptionsFlow()


class HomelabCardsOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        current = self.config_entry.options.get(CONF_CARDS, list(available_cards()))
        return self.async_show_form(step_id="init", data_schema=_schema([c for c in current if c in available_cards()]))
