import { mdiMonitor } from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import memoizeOne from "memoize-one";
import { fireEvent } from "../../common/dom/fire_event";
import { computeDomain } from "../../common/entity/compute_domain";
import { supportsFeature } from "../../common/entity/supports-feature";
import "../../components/ha-state-icon";
import "../../components/ha-svg-icon";
import {
  BROWSER_PLAYER,
  MediaPlayerEntityFeature,
} from "../../data/media-player";
import type { HomeAssistant } from "../../types";

@customElement("ha-media-players-rail")
export class HaMediaPlayersRail extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public entityId?: string;

  private _players = memoizeOne(
    (states: HomeAssistant["states"], entities: HomeAssistant["entities"]) =>
      Object.values(states)
        .filter(
          (s) =>
            computeDomain(s.entity_id) === "media_player" &&
            supportsFeature(s, MediaPlayerEntityFeature.PLAY_MEDIA) &&
            !entities[s.entity_id]?.hidden
        )
        .sort((a, b) =>
          (a.attributes.friendly_name || a.entity_id).localeCompare(
            b.attributes.friendly_name || b.entity_id
          )
        )
  );

  protected render() {
    const players = this._players(this.hass.states, this.hass.entities);
    const playing = players.filter((p) => p.state === "playing").length;
    return html`
      <div class="head">
        <h2>
          ${this.hass.localize("ui.panel.media-browser.redesign.players")}
        </h2>
        ${
          playing
            ? html`<span class="meta"
                >${this.hass.localize(
                  "ui.panel.media-browser.redesign.playing_count",
                  { count: playing }
                )}</span
              >`
            : nothing
        }
      </div>
      <div
        class="list"
        role="listbox"
        aria-label=${this.hass.localize("ui.panel.media-browser.redesign.players")}
      >
        ${this._renderBrowser()} ${players.map((p) => this._renderPlayer(p))}
      </div>
    `;
  }

  private _renderBrowser() {
    const selected = this.entityId === BROWSER_PLAYER;
    return html`<button
      class="player"
      role="option"
      aria-selected=${selected ? "true" : "false"}
      data-entity=${BROWSER_PLAYER}
      @click=${this._pick}
    >
      <span class="icon">
        <ha-svg-icon .path=${mdiMonitor}></ha-svg-icon>
      </span>
      <span class="text">
        <span class="line">
          <span class="name"
            >${this.hass.localize(
              "ui.components.media-browser.web-browser"
            )}</span
          >
        </span>
      </span>
    </button>`;
  }

  private _renderPlayer(p: HassEntity) {
    const selected = this.entityId === p.entity_id;
    const active = p.state === "playing";
    const volume =
      typeof p.attributes.volume_level === "number"
        ? Math.round(p.attributes.volume_level * 100)
        : undefined;
    return html`<button
      class="player ${active ? "active" : ""}"
      role="option"
      aria-selected=${selected ? "true" : "false"}
      data-entity=${p.entity_id}
      @click=${this._pick}
    >
      <span class="icon">
        <ha-state-icon .hass=${this.hass} .stateObj=${p}></ha-state-icon>
      </span>
      <span class="text">
        <span class="line">
          <span class="name">${this.hass.formatEntityName(p, undefined)}</span>
          <span class="state">${this.hass.formatEntityState(p)}</span>
        </span>
        ${
          volume !== undefined
            ? html`<span class="vol"
                ><span style=${styleMap({ width: `${volume}%` })}></span
              ></span>`
            : nothing
        }
      </span>
    </button>`;
  }

  private _pick(ev: Event) {
    const entityId = (ev.currentTarget as HTMLElement).dataset.entity!;
    fireEvent(this, "player-picked", { entityId });
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 0 4px;
    }

    h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 400;
      letter-spacing: -0.015em;
    }

    .meta {
      font-size: 13px;
      color: var(--secondary-text-color);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .player {
      --accent: var(--state-media_player-active-color, var(--indigo-color));
      min-height: 76px;
      border-radius: 20px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--primary-text-color);
      padding: 12px;
      text-align: start;
      font-family: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 14px;
      transition:
        background 200ms ease,
        border-color 200ms ease;
    }

    .player:hover {
      background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
    }

    .player[aria-selected="true"] {
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      border-color: var(--divider-color);
    }

    .player:focus-visible {
      outline: 2px solid var(--ha-color-focus, var(--primary-color));
      outline-offset: 2px;
    }

    .icon {
      width: 44px;
      height: 44px;
      border-radius: 22px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
      color: var(--secondary-text-color);
      --mdc-icon-size: 20px;
    }

    .player.active .icon {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
    }

    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .line {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .name {
      font-size: 15px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .state {
      flex: none;
      font-size: 12px;
      color: var(--disabled-text-color, var(--secondary-text-color));
    }

    .player.active .state {
      color: var(--accent);
    }

    .vol {
      height: 3px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
      overflow: hidden;
    }

    .vol span {
      display: block;
      height: 100%;
      background: var(--secondary-text-color);
    }

    .player.active .vol span {
      background: var(--accent);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-media-players-rail": HaMediaPlayersRail;
  }
}
