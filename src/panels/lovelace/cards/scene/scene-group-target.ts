import { ContextProvider } from "@lit/context";
import type { PropertyValues } from "lit";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { apiContext } from "../../../../data/context";
import type { HomeAssistant, HomeAssistantApi } from "../../../../types";

@customElement("scene-group-target")
export class SceneGroupTarget extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public targets: string[] = [];

  private _provider = new ContextProvider(this, { context: apiContext });

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hass || !(changed.has("hass") || changed.has("targets"))) {
      return;
    }
    const oldHass = changed.get("hass") as HomeAssistant | undefined;
    if (
      !changed.has("targets") &&
      oldHass &&
      oldHass.callService === this.hass.callService
    ) {
      return;
    }
    const hass = this.hass;
    const targets = this.targets;
    const value: HomeAssistantApi = {
      callService: (domain, service, data, target, notify, response) =>
        hass.callService(
          domain,
          service,
          { ...data, entity_id: targets },
          target,
          notify,
          response
        ),
      callApi: hass.callApi,
      callApiRaw: hass.callApiRaw,
      callWS: hass.callWS,
      sendWS: hass.sendWS,
      fetchWithAuth: hass.fetchWithAuth,
    };
    this._provider.setValue(value);
  }

  protected render() {
    return html`<slot></slot>`;
  }

  static styles = css`
    :host {
      display: contents;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "scene-group-target": SceneGroupTarget;
  }
}
