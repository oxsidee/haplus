import {
  mdiMinus,
  mdiMusic,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiPower,
  mdiRepeat,
  mdiRepeatOff,
  mdiRepeatOnce,
  mdiShuffle,
  mdiShuffleDisabled,
  mdiSkipNext,
  mdiSkipPrevious,
} from "@mdi/js";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { supportsFeature } from "../../common/entity/supports-feature";
import "../../components/ha-svg-icon";
import type { MediaPlayerEntity } from "../../data/media-player";
import {
  BROWSER_PLAYER,
  formatMediaTime,
  getCurrentProgress,
  MediaPlayerEntityFeature,
} from "../../data/media-player";
import type { HomeAssistant } from "../../types";

const REPEAT_NEXT: Record<string, string> = {
  off: "all",
  all: "one",
  one: "off",
};

@customElement("ha-media-now-playing")
export class HaMediaNowPlaying extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ attribute: false }) public entityId?: string;

  @state() private _position?: number;

  private _timer?: number;

  private _t(key: string, values?: Record<string, string | number>) {
    return this.hass.localize(
      `ui.panel.media-browser.redesign.${key}` as any,
      values
    );
  }

  private get _stateObj(): MediaPlayerEntity | undefined {
    return this.entityId && this.entityId !== BROWSER_PLAYER
      ? (this.hass.states[this.entityId] as MediaPlayerEntity | undefined)
      : undefined;
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTimer();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const stateObj = this._stateObj;
    const tracking =
      stateObj?.state === "playing" &&
      typeof stateObj.attributes.media_duration === "number" &&
      typeof stateObj.attributes.media_position === "number";
    if (tracking && !this._timer) {
      this._timer = window.setInterval(() => this._tick(), 1000);
    } else if (!tracking) {
      this._stopTimer();
    }
    this._tick();
  }

  private _tick() {
    const stateObj = this._stateObj;
    this._position =
      stateObj && typeof stateObj.attributes.media_position === "number"
        ? getCurrentProgress(stateObj)
        : undefined;
  }

  private _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  protected render() {
    const stateObj = this._stateObj;
    const name = stateObj
      ? this.hass.formatEntityName(stateObj, undefined)
      : this.hass.localize("ui.components.media-browser.web-browser");
    if (!stateObj) {
      return html`
        <div class="hero">
          <div class="art">
            <ha-svg-icon .path=${mdiMusic}></ha-svg-icon>
          </div>
          <div class="info">
            <div class="titles">
              <span class="overline">${name}</span>
              <span class="title">${this._t("nothing_playing")}</span>
            </div>
          </div>
        </div>
      `;
    }
    const attr = stateObj.attributes;
    const playing = stateObj.state === "playing";
    const off = stateObj.state === "off";
    const picture = attr.entity_picture_local || attr.entity_picture;
    const title = attr.media_title || name;
    const sub = [
      attr.media_artist,
      attr.media_album_name || attr.media_series_title,
      attr.app_name || attr.source,
    ]
      .filter(Boolean)
      .join(" · ");
    const duration = attr.media_duration;
    const progress =
      duration && this._position !== undefined
        ? Math.min(100, (this._position / duration) * 100)
        : undefined;
    const volume =
      typeof attr.volume_level === "number"
        ? Math.round(attr.volume_level * 100)
        : undefined;
    const has = (feature: MediaPlayerEntityFeature) =>
      supportsFeature(stateObj, feature);
    const canVolume =
      has(MediaPlayerEntityFeature.VOLUME_SET) ||
      has(MediaPlayerEntityFeature.VOLUME_STEP);
    const repeat = attr.repeat ?? "off";

    return html`
      <div class="hero">
        <div
          class="art ${playing ? "playing" : ""}"
          style=${styleMap(picture ? { backgroundImage: `url(${picture})` } : {})}
        >
          ${picture ? nothing : html`<ha-svg-icon .path=${mdiMusic}></ha-svg-icon>`}
        </div>
        <div class="info">
          <div class="titles">
            <span class="overline">
              ${this.hass.formatEntityState(stateObj)} · ${name}
            </span>
            <span class="title">${title}</span>
            ${sub ? html`<span class="sub">${sub}</span>` : nothing}
          </div>
          ${
            progress !== undefined
              ? html`<div class="progress">
                  <div class="track">
                    <div style=${styleMap({ width: `${progress}%` })}></div>
                  </div>
                  <div class="times">
                    <span>${formatMediaTime(this._position)}</span>
                    <span>${formatMediaTime(duration)}</span>
                  </div>
                </div>`
              : nothing
          }
          <div class="controls">
            ${
              off && has(MediaPlayerEntityFeature.TURN_ON)
                ? this._button("main", mdiPower, this._t("turn_on"), "turn_on")
                : html`
                    ${
                      has(MediaPlayerEntityFeature.SHUFFLE_SET)
                        ? this._button(
                            `plain ${attr.shuffle ? "active" : ""}`,
                            attr.shuffle ? mdiShuffle : mdiShuffleDisabled,
                            this._t("shuffle"),
                            "shuffle_set",
                            { shuffle: !attr.shuffle }
                          )
                        : nothing
                    }
                    ${
                      has(MediaPlayerEntityFeature.PREVIOUS_TRACK)
                        ? this._button(
                            "round",
                            mdiSkipPrevious,
                            this._t("previous"),
                            "media_previous_track"
                          )
                        : nothing
                    }
                    ${
                      has(MediaPlayerEntityFeature.PAUSE) ||
                      has(MediaPlayerEntityFeature.PLAY)
                        ? this._button(
                            "main",
                            playing ? mdiPause : mdiPlay,
                            this._t("play_pause"),
                            "media_play_pause"
                          )
                        : nothing
                    }
                    ${
                      has(MediaPlayerEntityFeature.NEXT_TRACK)
                        ? this._button(
                            "round",
                            mdiSkipNext,
                            this._t("next"),
                            "media_next_track"
                          )
                        : nothing
                    }
                    ${
                      has(MediaPlayerEntityFeature.REPEAT_SET)
                        ? this._button(
                            `plain ${repeat !== "off" ? "active" : ""}`,
                            repeat === "one"
                              ? mdiRepeatOnce
                              : repeat === "all"
                                ? mdiRepeat
                                : mdiRepeatOff,
                            this._t("repeat"),
                            "repeat_set",
                            { repeat: REPEAT_NEXT[repeat] ?? "off" }
                          )
                        : nothing
                    }
                    ${
                      canVolume && volume !== undefined
                        ? html`<div class="volume">
                            ${this._button(
                              "small",
                              mdiMinus,
                              this._t("volume_down"),
                              "volume_set",
                              { volume_level: Math.max(0, volume - 5) / 100 }
                            )}
                            <div class="vol-track" aria-hidden="true">
                              <div
                                style=${styleMap({ width: `${volume}%` })}
                              ></div>
                            </div>
                            ${this._button(
                              "small",
                              mdiPlus,
                              this._t("volume_up"),
                              "volume_set",
                              { volume_level: Math.min(100, volume + 5) / 100 }
                            )}
                          </div>`
                        : nothing
                    }
                  `
            }
          </div>
        </div>
      </div>
    `;
  }

  private _button(
    kind: string,
    icon: string,
    label: string,
    service: string,
    data?: Record<string, unknown>
  ) {
    return html`<button
      class="btn ${kind}"
      aria-label=${label}
      title=${label}
      data-service=${service}
      data-payload=${data ? JSON.stringify(data) : ""}
      @click=${this._call}
    >
      <ha-svg-icon .path=${icon}></ha-svg-icon>
    </button>`;
  }

  private _call(ev: Event) {
    const { service, payload } = (ev.currentTarget as HTMLElement).dataset;
    if (!this.entityId || !service) {
      return;
    }
    this.hass.callService("media_player", service, {
      entity_id: this.entityId,
      ...(payload ? JSON.parse(payload) : {}),
    });
  }

  static styles = css`
    :host {
      display: block;
    }

    .hero {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 40px;
    }

    .art {
      width: 240px;
      height: 240px;
      flex: none;
      border-radius: 32px;
      background: linear-gradient(
        145deg,
        #5d6fd0 0%,
        #2d3770 55%,
        #12162e 100%
      );
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.85);
      box-shadow: 0 40px 90px
        color-mix(
          in srgb,
          var(--state-media_player-active-color, var(--indigo-color)) 8%,
          transparent
        );
      transition: box-shadow 400ms ease;
      --mdc-icon-size: 44px;
    }

    .art.playing {
      box-shadow: 0 40px 90px
        color-mix(
          in srgb,
          var(--state-media_player-active-color, var(--indigo-color)) 30%,
          transparent
        );
    }

    .info {
      flex: 1 1 320px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .titles {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .overline {
      font-size: 12px;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--secondary-text-color);
      font-weight: var(--ha-font-weight-medium);
    }

    .title {
      font-size: clamp(30px, 3.4vw, 44px);
      font-weight: 300;
      letter-spacing: -0.025em;
      line-height: 1.05;
      overflow-wrap: anywhere;
    }

    .sub {
      font-size: 16px;
      color: var(--secondary-text-color);
    }

    .progress {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 520px;
    }

    .track,
    .vol-track {
      height: 4px;
      border-radius: 2px;
      background: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
      overflow: hidden;
    }

    .track div {
      height: 100%;
      background: var(--primary-text-color);
      transition: width 1s linear;
    }

    .times {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--secondary-text-color);
      font-variant-numeric: tabular-nums;
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
    }

    .btn {
      border: 0;
      padding: 0;
      background: transparent;
      color: var(--primary-text-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-family: inherit;
    }

    .btn:focus-visible {
      outline: 2px solid var(--ha-color-focus, var(--primary-color));
      outline-offset: 2px;
    }

    .btn.plain {
      width: 48px;
      height: 48px;
      border-radius: 24px;
      color: var(--secondary-text-color);
      --mdc-icon-size: 20px;
    }

    .btn.plain.active {
      color: var(--primary-text-color);
    }

    .btn.round {
      width: 56px;
      height: 56px;
      border-radius: 28px;
      border: 1px solid var(--divider-color);
      --mdc-icon-size: 22px;
    }

    .btn.main {
      width: 76px;
      height: 76px;
      border-radius: 38px;
      background: var(--primary-text-color);
      color: var(--primary-background-color);
      --mdc-icon-size: 28px;
    }

    .btn.small {
      width: 40px;
      height: 40px;
      border-radius: 20px;
      border: 1px solid var(--divider-color);
      --mdc-icon-size: 16px;
    }

    .volume {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-inline-start: 12px;
    }

    .vol-track {
      width: 110px;
    }

    .vol-track div {
      height: 100%;
      background: var(--state-media_player-active-color, var(--indigo-color));
      transition: width 200ms ease;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-media-now-playing": HaMediaNowPlaying;
  }
}
