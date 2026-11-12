import {
  mdiLightbulbGroup,
  mdiMinus,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiPower,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiThermostat,
  mdiTune,
  mdiWindowShutter,
} from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import { fireEvent } from "../../../common/dom/fire_event";
import { computeDomain } from "../../../common/entity/compute_domain";
import { stateActive } from "../../../common/entity/state_active";
import { stateColorCss } from "../../../common/entity/state_color";
import { supportsFeature } from "../../../common/entity/supports-feature";
import { navigate } from "../../../common/navigate";
import { formatNumber } from "../../../common/number/format_number";
import "../../../components/ha-state-icon";
import "../../../components/ha-svg-icon";
import { CoverEntityFeature } from "../../../data/cover";
import type { ClimateEntity } from "../../../data/climate";
import { lightSupportsBrightness, type LightEntity } from "../../../data/light";
import "../../../state-control/climate/ha-state-control-climate-temperature";
import "../../../state-control/light/ha-state-control-light-brightness";
import type { HomeAssistant } from "../../../types";
import { getAreaGroupedEntities } from "../strategies/areas/helpers/areas-strategy-helper";
import type { LovelaceCard } from "../types";
import { renderRoom } from "./scene/scene-illustrations";
import {
  brightnessPct,
  callToggle,
  dashboardBasePath,
  getSceneIndex,
  isLightOn,
  isToggleable,
  numericState,
  statesOf,
} from "./scene/scene-index";
import { sceneStyles } from "./scene/scene-styles";
import type { AreaSceneCardConfig } from "./types";

const FOCUS_DOMAINS = ["light", "climate", "cover", "media_player"];
const CT_COLORS = ["#F7D3A0", "#F6E1BF", "#F3EEE4", "#E8EFF7", "#D6E5F8"];
const SENSOR_DOMAINS = ["sensor", "binary_sensor"];

interface RowGroup {
  key: string;
  title: string;
  meta?: string;
  rows: HassEntity[];
}

@customElement("hui-area-scene-card")
export class HuiAreaSceneCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public layout?: string;

  @state() private _config?: AreaSceneCardConfig;

  @state() private _focus = "room";

  public setConfig(config: AreaSceneCardConfig): void {
    if (!config.area) {
      throw new Error("Area required");
    }
    this._config = config;
  }

  public getCardSize(): number {
    return 12;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("hass") && this.hass) {
      this.toggleAttribute("dark", !!this.hass.themes?.darkMode);
      if (this._focus !== "room" && !this.hass.states[this._focus]) {
        this._focus = "room";
      }
      const oldHass = changed.get("hass") as HomeAssistant | undefined;
      const areaId = this._config?.area;
      if (areaId && oldHass?.areas[areaId] && !this.hass.areas[areaId]) {
        navigate(`${dashboardBasePath()}/overview`, { replace: true });
      }
    }
  }

  private _t(key: string, values?: Record<string, string | number>) {
    return this.hass!.localize(
      `ui.panel.lovelace.cards.home_scene.${key}` as any,
      values
    );
  }

  private _fmt(value: number, digits = 1) {
    return formatNumber(value, this.hass!.locale, {
      maximumFractionDigits: digits,
    });
  }

  private _moreInfo(entityId: string) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  private _entities() {
    const hass = this.hass!;
    const areaId = this._config!.area;
    const grouped = getAreaGroupedEntities(areaId, hass);
    const index = getSceneIndex(hass);
    const used = new Set(Object.values(grouped).flat());
    const sensors = statesOf(hass, index.byArea[areaId]).filter(
      (s) =>
        SENSOR_DOMAINS.includes(computeDomain(s.entity_id)) &&
        !used.has(s.entity_id)
    );
    return { grouped, sensors };
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const hass = this.hass;
    const area = hass.areas[this._config.area];
    if (!area) {
      return html`<p class="summary">${this._t("unknown_area")}</p>`;
    }
    const { grouped, sensors } = this._entities();
    const lights = statesOf(hass, grouped.lights) as LightEntity[];
    const lightsOn = lights.filter(isLightOn);
    const covers = statesOf(hass, grouped.covers).filter(
      (s) => computeDomain(s.entity_id) === "cover"
    );
    const climates = statesOf(hass, grouped.climate).filter(
      (s) => computeDomain(s.entity_id) === "climate"
    );
    const floor = area.floor_id ? hass.floors[area.floor_id] : undefined;
    const focusObj =
      this._focus !== "room" ? hass.states[this._focus] : undefined;
    const focusDomain = focusObj ? computeDomain(focusObj.entity_id) : "room";

    const temp = area.temperature_entity_id
      ? numericState(hass.states[area.temperature_entity_id])
      : undefined;
    const hum = area.humidity_entity_id
      ? numericState(hass.states[area.humidity_entity_id])
      : undefined;

    let title = area.name;
    let subtitle: string;
    if (focusObj) {
      title = hass.formatEntityName(focusObj, undefined);
      subtitle = hass.formatEntityState(focusObj);
    } else {
      const parts: string[] = [];
      if (temp !== undefined) {
        parts.push(`${this._fmt(temp)}°`);
      }
      if (hum !== undefined) {
        parts.push(this._t("humidity", { value: this._fmt(hum, 0) }));
      }
      if (lights.length) {
        parts.push(
          this._t("lights_of", { on: lightsOn.length, total: lights.length })
        );
      }
      subtitle = parts.join(" · ");
    }

    const stageCenter = lightsOn.length
      ? "color-mix(in srgb, #f2b45a 9%, var(--card-background-color))"
      : "var(--card-background-color)";

    return html`
      <div class="layout">
        <section
          class="stage"
          style=${styleMap({ "--scene-stage-center": stageCenter })}
        >
          <div class="intro">
            <span class="overline">
              ${floor ? `${floor.name} · ${area.name}` : area.name}
            </span>
            <h1>${title}</h1>
            ${subtitle ? html`<p class="summary">${subtitle}</p>` : nothing}
          </div>
          <div class="visual focus">
            ${
              focusDomain === "light"
                ? this._renderLight(focusObj as LightEntity)
                : focusDomain === "climate"
                  ? this._renderClimate(focusObj!)
                  : focusDomain === "cover"
                    ? this._renderCover(focusObj!)
                    : focusDomain === "media_player"
                      ? this._renderMedia(focusObj!)
                      : this._renderRoomVisual(area.picture, lights, covers)
            }
          </div>
          ${this._renderDock(lights, lightsOn, climates, covers)}
        </section>
        <aside class="rail">
          <div class="rail-head">
            <h2>${this._t("devices")}</h2>
            <button
              class="chip small"
              aria-pressed=${this._focus === "room" ? "true" : "false"}
              @click=${this._focusRoom}
            >
              ${this._t("whole_area")}
            </button>
          </div>
          ${this._groups(grouped, sensors).map((g) => this._renderGroup(g))}
        </aside>
      </div>
    `;
  }

  private _groups(
    grouped: ReturnType<typeof getAreaGroupedEntities>,
    sensors: HassEntity[]
  ): RowGroup[] {
    const hass = this.hass!;
    const lights = statesOf(hass, grouped.lights);
    const defs: RowGroup[] = [
      {
        key: "lights",
        title: this._t("lights"),
        meta: lights.length
          ? this._t("lights_of", {
              on: lights.filter(isLightOn).length,
              total: lights.length,
            })
          : undefined,
        rows: lights,
      },
      {
        key: "climate",
        title: this._t("climate"),
        rows: statesOf(hass, grouped.climate),
      },
      {
        key: "covers",
        title: this._t("covers"),
        rows: statesOf(hass, grouped.covers),
      },
      {
        key: "media",
        title: this._t("media"),
        rows: statesOf(hass, grouped.media_players),
      },
      {
        key: "security",
        title: this._t("security"),
        rows: statesOf(hass, grouped.security),
      },
      {
        key: "others",
        title: this._t("other_devices"),
        rows: statesOf(hass, grouped.others),
      },
      { key: "sensors", title: this._t("sensors"), rows: sensors.slice(0, 12) },
    ];
    return defs.filter((g) => g.rows.length);
  }

  private _renderGroup(g: RowGroup) {
    return html`
      <div class="group">
        <div class="group-head">
          <span class="title">${g.title}</span>
          ${g.meta ? html`<span class="meta">${g.meta}</span>` : nothing}
        </div>
        <div class="rows">${g.rows.map((s) => this._renderRow(s))}</div>
      </div>
    `;
  }

  private _renderRow(s: HassEntity) {
    const hass = this.hass!;
    const domain = computeDomain(s.entity_id);
    const focusable = FOCUS_DOMAINS.includes(domain);
    const selected = this._focus === s.entity_id;
    const active = stateActive(s);
    const sensor = SENSOR_DOMAINS.includes(domain);
    const toggleable =
      isToggleable(s.entity_id) && !sensor && domain !== "cover";
    const color = active ? stateColorCss(s) : undefined;
    return html`
      <div class="row ${selected ? "selected" : ""}">
        <button
          class="row-main"
          aria-pressed=${selected ? "true" : "false"}
          data-entity=${s.entity_id}
          data-focusable=${focusable ? "1" : ""}
          @click=${this._rowClicked}
        >
          <span
            class="row-icon"
            style=${styleMap({
              "--icon-color": color || "var(--scene-text2)",
              "--icon-bg": color
                ? `color-mix(in srgb, ${color} 16%, transparent)`
                : "var(--scene-well)",
            })}
          >
            <ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>
          </span>
          <span class="row-text">
            <span class="primary">${hass.formatEntityName(s, undefined)}</span>
            <span class="secondary">
              ${
                sensor
                  ? hass.formatEntityName(s, [{ type: "device" }])
                  : hass.formatEntityState(s)
              }
            </span>
          </span>
          ${
            sensor || domain === "climate" || domain === "cover"
              ? html`<span class="row-value">${this._rowValue(s)}</span>`
              : nothing
          }
        </button>
        ${
          toggleable
            ? html`<button
                class="toggle"
                style=${styleMap({ "--toggle-color": stateColorCss(s, "on") || "var(--scene-light)" })}
                aria-label=${this._t("toggle_entity", {
                  name: hass.formatEntityName(s, undefined),
                })}
                aria-pressed=${active ? "true" : "false"}
                data-entity=${s.entity_id}
                @click=${this._toggleClicked}
              >
                <span class="track"><span class="knob"></span></span>
              </button>`
            : nothing
        }
      </div>
    `;
  }

  private _rowValue(s: HassEntity) {
    const domain = computeDomain(s.entity_id);
    if (domain === "climate") {
      const t = s.attributes.temperature;
      return typeof t === "number" ? `${this._fmt(t)}°` : "";
    }
    if (domain === "cover") {
      const p = s.attributes.current_position;
      return typeof p === "number" ? `${p} %` : "";
    }
    return this.hass!.formatEntityState(s);
  }

  private _renderRoomVisual(
    picture: string | null | undefined,
    lights: HassEntity[],
    covers: HassEntity[]
  ) {
    const glowOf = (l?: HassEntity) =>
      l && isLightOn(l) ? 0.35 + (0.65 * (brightnessPct(l) ?? 100)) / 100 : 0;
    const cover = covers[0];
    const coverOpen = cover
      ? typeof cover.attributes.current_position === "number"
        ? cover.attributes.current_position
        : cover.state === "closed"
          ? 0
          : 100
      : 100;
    if (picture) {
      return html`<div
        class="picture ${lights.some(isLightOn) ? "lit" : ""}"
        style=${styleMap({ backgroundImage: `url(${picture})` })}
      ></div>`;
    }
    return renderRoom({
      ceiling: glowOf(lights[0]),
      floor: glowOf(lights[1]),
      strip: glowOf(lights[2]),
      wall: glowOf(lights[3]),
      coverOpen,
    });
  }

  private _renderLight(light: LightEntity) {
    const on = isLightOn(light);
    const bri = brightnessPct(light) ?? (on ? 100 : 0);
    const dimmable = lightSupportsBrightness(light);
    const modes: string[] = light.attributes.supported_color_modes || [];
    const ctSupported = modes.includes("color_temp");
    const minK: number = light.attributes.min_color_temp_kelvin ?? 2700;
    const maxK: number = light.attributes.max_color_temp_kelvin ?? 6500;
    const curK: number | undefined = light.attributes.color_temp_kelvin;
    const stops = CT_COLORS.map((color, i) => ({
      color,
      kelvin: Math.round((minK + ((maxK - minK) * i) / 4) / 100) * 100,
    }));
    const curStop =
      curK !== undefined
        ? stops.reduce(
            (best, s, i) =>
              Math.abs(s.kelvin - curK) < Math.abs(stops[best].kelvin - curK)
                ? i
                : best,
            0
          )
        : -1;
    return html`
      <div class="light-focus">
        ${
          dimmable
            ? html`<ha-state-control-light-brightness
                class="brightness"
                .stateObj=${light}
              ></ha-state-control-light-brightness>`
            : nothing
        }
        <div class="light-side">
          <div class="big-block">
            <span class="overline">${this._t("brightness")}</span>
            <span class="big"
              >${on ? (dimmable ? `${bri} %` : this._t("on")) : this._t("off")}</span
            >
          </div>
          ${
            ctSupported
              ? html`<div class="ct">
                  <div class="ct-head">
                    <span class="overline"
                      >${this._t("color_temperature")}</span
                    >
                    <span>${curK ? `${curK} K` : ""}</span>
                  </div>
                  <div
                    class="swatches"
                    role="group"
                    aria-label=${this._t("color_temperature")}
                  >
                    ${stops.map(
                      (s, i) =>
                        html`<button
                          class="swatch"
                          aria-label=${`${s.kelvin} K`}
                          aria-pressed=${i === curStop ? "true" : "false"}
                          data-domain="light"
                          data-service="turn_on"
                          data-entity=${light.entity_id}
                          data-payload=${JSON.stringify({
                            color_temp_kelvin: s.kelvin,
                          })}
                          @click=${this._serviceClicked}
                        >
                          <span
                            style=${styleMap({ background: s.color })}
                          ></span>
                        </button>`
                    )}
                  </div>
                </div>`
              : nothing
          }
          <div class="actions">
            <button
              class="pill-btn ${on ? "" : "inverted"}"
              data-domain="light"
              data-service=${on ? "turn_off" : "turn_on"}
              data-entity=${light.entity_id}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${mdiPower}></ha-svg-icon>
              <span>${on ? this._t("turn_off") : this._t("turn_on")}</span>
            </button>
            <button
              class="circle-btn"
              aria-label=${this._t("more_settings")}
              data-entity=${light.entity_id}
              @click=${this._moreInfoClicked}
            >
              <ha-svg-icon .path=${mdiTune}></ha-svg-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderClimate(s: HassEntity) {
    const hass = this.hass!;
    const mode = s.state;
    const modes: string[] = s.attributes.hvac_modes || [];
    return html`
      <div class="climate-focus">
        <ha-state-control-climate-temperature
          .stateObj=${s as ClimateEntity}
          show-secondary
        ></ha-state-control-climate-temperature>
        ${
          modes.length
            ? html`<div
                class="segmented"
                role="group"
                aria-label=${this._t("mode")}
              >
                ${modes.map(
                  (m) =>
                    html`<button
                      aria-pressed=${m === mode ? "true" : "false"}
                      data-domain="climate"
                      data-service="set_hvac_mode"
                      data-entity=${s.entity_id}
                      data-payload=${JSON.stringify({ hvac_mode: m })}
                      @click=${this._serviceClicked}
                    >
                      ${hass.formatEntityState(s, m)}
                    </button>`
                )}
              </div>`
            : nothing
        }
      </div>
    `;
  }

  private _renderCover(s: HassEntity) {
    const pos: number =
      typeof s.attributes.current_position === "number"
        ? s.attributes.current_position
        : s.state === "closed"
          ? 0
          : 100;
    const canPos = supportsFeature(s, CoverEntityFeature.SET_POSITION);
    const opts = [
      { v: 100, label: this._t("open_action"), service: "open_cover" },
      ...(canPos
        ? [{ v: 50, label: "50 %", service: "set_cover_position" }]
        : []),
      { v: 0, label: this._t("close_action"), service: "close_cover" },
    ];
    return html`
      <div class="cover-focus">
        <div class="window" aria-hidden="true">
          <div
            class="blind"
            style=${styleMap({ height: `${100 - pos}%` })}
          ></div>
          <div class="mullion"></div>
        </div>
        <div class="light-side">
          <div class="big-block">
            <span class="overline">${this._t("position")}</span>
            <span class="big">${pos} %</span>
          </div>
          <div
            class="cover-buttons"
            role="group"
            aria-label=${this._t("position")}
          >
            ${opts.map(
              (o) =>
                html`<button
                  aria-pressed=${pos === o.v ? "true" : "false"}
                  data-domain="cover"
                  data-service=${o.service}
                  data-entity=${s.entity_id}
                  data-payload=${
                    o.service === "set_cover_position"
                      ? JSON.stringify({ position: o.v })
                      : ""
                  }
                  @click=${this._serviceClicked}
                >
                  ${o.label}
                </button>`
            )}
          </div>
        </div>
      </div>
    `;
  }

  private _renderMedia(s: HassEntity) {
    const hass = this.hass!;
    const playing = s.state === "playing";
    const pic: string | undefined =
      s.attributes.entity_picture_local || s.attributes.entity_picture;
    const vol: number | undefined =
      typeof s.attributes.volume_level === "number"
        ? Math.round(s.attributes.volume_level * 100)
        : undefined;
    return html`
      <div class="media-focus">
        <div
          class="art ${playing ? "playing" : ""}"
          style=${styleMap(pic ? { backgroundImage: `url(${pic})` } : {})}
        >
          ${pic ? nothing : html`<ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>`}
        </div>
        <div class="light-side">
          <div class="big-block">
            <span class="overline">${hass.formatEntityState(s)}</span>
            <span class="media-title"
              >${s.attributes.media_title || hass.formatEntityName(s, undefined)}</span
            >
            ${
              s.attributes.media_artist
                ? html`<span class="summary"
                    >${s.attributes.media_artist}</span
                  >`
                : nothing
            }
          </div>
          <div class="media-controls">
            <button
              class="big-circle small"
              aria-label=${this._t("previous")}
              data-domain="media_player"
              data-service="media_previous_track"
              data-entity=${s.entity_id}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${mdiSkipPrevious}></ha-svg-icon>
            </button>
            <button
              class="big-circle inverted"
              aria-label=${this._t("play_pause")}
              data-domain="media_player"
              data-service="media_play_pause"
              data-entity=${s.entity_id}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${playing ? mdiPause : mdiPlay}></ha-svg-icon>
            </button>
            <button
              class="big-circle small"
              aria-label=${this._t("next")}
              data-domain="media_player"
              data-service="media_next_track"
              data-entity=${s.entity_id}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${mdiSkipNext}></ha-svg-icon>
            </button>
          </div>
          ${
            vol !== undefined
              ? html`<div class="volume">
                  <button
                    class="circle-btn"
                    aria-label=${this._t("volume_down")}
                    data-domain="media_player"
                    data-service="volume_down"
                    data-entity=${s.entity_id}
                    @click=${this._serviceClicked}
                  >
                    <ha-svg-icon .path=${mdiMinus}></ha-svg-icon>
                  </button>
                  <div class="vol-track" aria-hidden="true">
                    <div style=${styleMap({ width: `${vol}%` })}></div>
                  </div>
                  <button
                    class="circle-btn"
                    aria-label=${this._t("volume_up")}
                    data-domain="media_player"
                    data-service="volume_up"
                    data-entity=${s.entity_id}
                    @click=${this._serviceClicked}
                  >
                    <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                  </button>
                  <span class="vol-value">${vol} %</span>
                </div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderDock(
    lights: HassEntity[],
    lightsOn: HassEntity[],
    climates: HassEntity[],
    covers: HassEntity[]
  ) {
    const hass = this.hass!;
    const scenes = statesOf(
      hass,
      getSceneIndex(hass).byArea[this._config!.area]
    ).filter((s) => computeDomain(s.entity_id) === "scene");
    const items: {
      key: string;
      name: string;
      state: string;
      on: boolean;
      icon?: string;
      stateObj?: HassEntity;
      action: () => void;
    }[] = [];
    if (lights.length) {
      items.push({
        key: "lights",
        name: this._t("all_lights"),
        state: this._t("lights_of", {
          on: lightsOn.length,
          total: lights.length,
        }),
        on: lightsOn.length > 0,
        icon: mdiLightbulbGroup,
        action: () =>
          hass.callService("light", lightsOn.length ? "turn_off" : "turn_on", {
            entity_id: lights.map((l) => l.entity_id),
          }),
      });
    }
    if (climates.length) {
      const c = climates[0];
      items.push({
        key: "climate",
        name: this._t("climate"),
        state:
          typeof c.attributes.temperature === "number"
            ? `${this._fmt(c.attributes.temperature)}°`
            : hass.formatEntityState(c),
        on: c.state !== "off",
        icon: mdiThermostat,
        action: () => {
          this._focus = c.entity_id;
        },
      });
    }
    if (covers.length) {
      const closed = covers.every((c) => c.state === "closed");
      items.push({
        key: "covers",
        name: this._t("covers"),
        state: closed ? this._t("closed") : this._t("open"),
        on: closed,
        icon: mdiWindowShutter,
        action: () =>
          hass.callService("cover", closed ? "open_cover" : "close_cover", {
            entity_id: covers.map((c) => c.entity_id),
          }),
      });
    }
    for (const sc of scenes.slice(0, 4)) {
      items.push({
        key: sc.entity_id,
        name: hass.formatEntityName(sc, [{ type: "entity" }]),
        state: this._t("scene"),
        on: false,
        stateObj: sc,
        action: () =>
          hass.callService("scene", "turn_on", { entity_id: sc.entity_id }),
      });
    }
    if (!items.length) {
      return nothing;
    }
    return html`<nav class="dock" aria-label=${this._t("area_actions")}>
      ${items.map(
        (d) =>
          html`<button
            class="dock-item"
            aria-pressed=${d.on ? "true" : "false"}
            @click=${d.action}
          >
            ${
              d.stateObj
                ? html`<ha-state-icon
                    .hass=${hass}
                    .stateObj=${d.stateObj}
                  ></ha-state-icon>`
                : html`<ha-svg-icon .path=${d.icon}></ha-svg-icon>`
            }
            <span class="name">${d.name}</span>
            <span class="state">${d.state}</span>
          </button>`
      )}
    </nav>`;
  }

  private _rowClicked(ev: Event) {
    const el = ev.currentTarget as HTMLElement;
    const entityId = el.dataset.entity!;
    if (el.dataset.focusable) {
      this._focus = entityId;
    } else {
      this._moreInfo(entityId);
    }
  }

  private _toggleClicked(ev: Event) {
    callToggle(this.hass!, (ev.currentTarget as HTMLElement).dataset.entity!);
  }

  private _moreInfoClicked(ev: Event) {
    this._moreInfo((ev.currentTarget as HTMLElement).dataset.entity!);
  }

  private _serviceClicked(ev: Event) {
    const { domain, service, entity, payload } = (
      ev.currentTarget as HTMLElement
    ).dataset;
    this.hass!.callService(domain!, service!, {
      entity_id: entity,
      ...(payload ? JSON.parse(payload) : {}),
    });
  }

  private _focusRoom = () => {
    this._focus = "room";
  };

  static styles = [
    sceneStyles,
    css`
      .visual.focus {
        min-height: 360px;
      }

      .chip.small {
        height: 36px;
        padding: 0 14px;
        font-size: 13px;
      }

      .rows {
        display: flex;
        flex-direction: column;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 4px;
        border-radius: 18px;
        transition: background 200ms ease;
      }

      .row.selected {
        background: var(--scene-sel);
      }

      .row-main {
        flex: 1;
        min-width: 0;
        min-height: 64px;
        display: flex;
        align-items: center;
        gap: 14px;
        border: 0;
        background: transparent;
        color: var(--scene-text);
        padding: 8px 6px;
        text-align: start;
        cursor: pointer;
        border-radius: 18px;
      }

      .row-icon {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: 20px;
        background: var(--icon-bg);
        color: var(--icon-color);
        display: flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 20px;
        transition:
          background 240ms ease,
          color 240ms ease;
      }

      .row-value {
        font-size: 20px;
        font-weight: 300;
        letter-spacing: -0.01em;
        padding-inline-end: 8px;
        white-space: nowrap;
      }

      .group-head {
        padding: 0 6px;
      }

      .picture {
        width: 100%;
        max-width: 760px;
        aspect-ratio: 16 / 9;
        border-radius: 28px;
        background-size: cover;
        background-position: center;
        filter: brightness(0.7) saturate(0.85);
        transition: filter 600ms ease;
      }

      .picture.lit {
        filter: brightness(1) saturate(1);
      }

      .light-focus,
      .cover-focus,
      .media-focus {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 56px;
      }

      .pill {
        width: 128px;
        height: 440px;
        max-height: 60vh;
        border-radius: 42px;
        overflow: hidden;
        background: var(--scene-well);
        border: 1px solid var(--scene-bd);
        display: flex;
        flex-direction: column;
      }

      .pill button {
        flex: 1;
        border: 0;
        padding: 0;
        margin: 0;
        cursor: pointer;
        transition: background 240ms ease;
      }

      ha-state-control-light-brightness.brightness {
        --ha-brightness-slider-max-height: 440px;
        filter: drop-shadow(
          0 30px 60px color-mix(in srgb, #f2b45a 18%, transparent)
        );
      }

      ha-state-control-climate-temperature {
        width: min(400px, 80vw);
      }

      .light-side {
        width: 340px;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: 32px;
      }

      .big-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .big {
        font-size: 104px;
        line-height: 0.95;
        font-weight: var(--ha-font-weight-thin, 200);
        letter-spacing: -0.045em;
      }

      .ct {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .ct-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 15px;
      }

      .swatches {
        display: flex;
        gap: 10px;
      }

      .swatch {
        width: 56px;
        height: 56px;
        border-radius: 28px;
        border: 2px solid var(--scene-bd);
        background: transparent;
        padding: 4px;
        cursor: pointer;
        box-sizing: border-box;
      }

      .swatch[aria-pressed="true"] {
        border-color: var(--scene-text);
      }

      .swatch span {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 50%;
      }

      .actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .pill-btn {
        height: 52px;
        padding: 0 24px;
        border-radius: 26px;
        border: 1px solid var(--scene-bd);
        background: transparent;
        color: var(--scene-text);
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        --mdc-icon-size: 18px;
      }

      .pill-btn.inverted,
      .big-circle.inverted {
        background: var(--scene-inv-bg);
        color: var(--scene-inv);
        border-color: var(--scene-inv-bg);
      }

      .climate-focus {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 28px;
      }

      .dial-row {
        display: flex;
        align-items: center;
        gap: 32px;
      }

      .big-circle {
        width: 72px;
        height: 72px;
        border-radius: 36px;
        border: 1px solid var(--scene-bd);
        background: var(--scene-well);
        color: var(--scene-text);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        --mdc-icon-size: 26px;
      }

      .big-circle.small {
        width: 56px;
        height: 56px;
        background: transparent;
        --mdc-icon-size: 22px;
      }

      .dial {
        position: relative;
        width: min(380px, 60vw);
        aspect-ratio: 1;
      }

      .dial svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .dial-face {
        fill: var(--scene-well);
        stroke: var(--scene-bd);
      }

      .dial-track {
        fill: none;
        stroke: var(--scene-bd);
        stroke-width: 12;
        stroke-linecap: round;
      }

      .dial-arc {
        fill: none;
        stroke-width: 12;
        stroke-linecap: round;
        transition:
          stroke-dasharray 300ms ease,
          stroke 300ms ease;
      }

      .dial-knob {
        fill: #ffffff;
        stroke: var(--scene-bg);
        stroke-width: 3;
      }

      .dial-text {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        text-align: center;
      }

      .dial-text .big {
        font-size: clamp(56px, 8vw, 92px);
      }

      .dial-mode {
        font-size: 14px;
        font-weight: 500;
      }

      .segmented {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px;
        padding: 4px;
        border-radius: 18px;
        background: var(--scene-well);
        border: 1px solid var(--scene-bd);
      }

      .segmented button {
        height: 46px;
        padding: 0 20px;
        border-radius: 14px;
        border: 0;
        background: transparent;
        color: var(--scene-text);
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
      }

      .segmented button[aria-pressed="true"],
      .cover-buttons button[aria-pressed="true"] {
        background: var(--scene-inv-bg);
        color: var(--scene-inv);
        border-color: var(--scene-inv-bg);
      }

      .window {
        width: 280px;
        height: 400px;
        max-height: 55vh;
        border-radius: 28px;
        border: 6px solid var(--scene-bd2);
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
        background: linear-gradient(180deg, #0b1522 0%, #22374d 100%);
      }

      .window .blind {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        background: repeating-linear-gradient(
          180deg,
          #dcd7cd 0px,
          #dcd7cd 14px,
          #a9a399 14px,
          #a9a399 16px
        );
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        transition: height 600ms ease;
      }

      .window .mullion {
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 4px;
        margin-left: -2px;
        background: var(--scene-bd2);
      }

      .cover-buttons {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: 8px;
      }

      .cover-buttons button {
        height: 52px;
        border-radius: 16px;
        border: 1px solid var(--scene-bd);
        background: transparent;
        color: var(--scene-text);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }

      .art {
        width: 300px;
        height: 300px;
        max-width: 70vw;
        max-height: 70vw;
        border-radius: 32px;
        background: linear-gradient(
          145deg,
          #3b4a8c 0%,
          #1a1f3a 60%,
          #0e1020 100%
        );
        background-size: cover;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.85);
        --mdc-icon-size: 48px;
        box-shadow: 0 40px 90px
          color-mix(in srgb, var(--scene-media) 5%, transparent);
        transition: box-shadow 400ms ease;
      }

      .art.playing {
        box-shadow: 0 40px 90px
          color-mix(in srgb, var(--scene-media) 25%, transparent);
      }

      .media-title {
        font-size: 30px;
        font-weight: 400;
        letter-spacing: -0.02em;
      }

      .media-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .volume {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .vol-track {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: var(--scene-well);
        overflow: hidden;
      }

      .vol-track div {
        height: 100%;
        background: var(--scene-media);
        transition: width 200ms ease;
      }

      .vol-value {
        width: 44px;
        text-align: end;
        font-size: 14px;
        color: var(--scene-text2);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-area-scene-card": HuiAreaSceneCard;
  }
}
