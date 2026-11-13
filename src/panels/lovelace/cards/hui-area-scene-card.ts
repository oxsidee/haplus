import {
  mdiChevronLeft,
  mdiChevronRight,
  mdiClose,
  mdiCreation,
  mdiDeleteOutline,
  mdiDragHorizontalVariant,
  mdiFileWordBox,
  mdiLightbulbGroup,
  mdiLightbulbOff,
  mdiLightbulbOn,
  mdiMinus,
  mdiPause,
  mdiPencilOutline,
  mdiPlay,
  mdiPlus,
  mdiPower,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiThermostat,
  mdiWindowShutter,
} from "@mdi/js";
import type { HassEntity } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import type { HASSDomEvent } from "../../../common/dom/fire_event";
import { fireEvent } from "../../../common/dom/fire_event";
import { computeDomain } from "../../../common/entity/compute_domain";
import { stateActive } from "../../../common/entity/state_active";
import { stateColorCss } from "../../../common/entity/state_color";
import { supportsFeature } from "../../../common/entity/supports-feature";
import { navigate } from "../../../common/navigate";
import { formatNumber } from "../../../common/number/format_number";
import "../../../components/entity/ha-entity-picker";
import type { HaEntityPicker } from "../../../components/entity/ha-entity-picker";
import "../../../components/ha-control-select-menu";
import type { HaDropdownSelectEvent } from "../../../components/ha-dropdown";
import "../../../components/ha-icon-button";
import "../../../components/ha-sortable";
import type { HaSortableOptions } from "../../../components/ha-sortable";
import "../../../components/ha-state-icon";
import "../../../components/ha-svg-icon";
import type { ClimateEntity } from "../../../data/climate";
import { CoverEntityFeature } from "../../../data/cover";
import type { ExtEntityRegistryEntry } from "../../../data/entity/entity_registry";
import {
  getExtendedEntityRegistryEntry,
  shouldShowFavoriteOptions,
} from "../../../data/entity/entity_registry";
import type {
  AreaPanelConfig,
  AreaPanelGroupConfig,
} from "../../../data/frontend";
import {
  fetchFrontendSystemData,
  saveFrontendSystemData,
} from "../../../data/frontend";
import type { LightEntity } from "../../../data/light";
import {
  LightColorMode,
  LightEntityFeature,
  lightSupportsBrightness,
  lightSupportsColor,
  lightSupportsColorMode,
  lightSupportsFavoriteColors,
} from "../../../data/light";
import "../../../dialogs/more-info/components/lights/ha-more-info-light-favorite-colors";
import "../../../dialogs/more-info/components/lights/light-color-rgb-picker";
import "../../../dialogs/more-info/components/lights/light-color-temp-picker";
import {
  showConfirmationDialog,
  showPromptDialog,
} from "../../../dialogs/generic/show-dialog-box";
import "../../../state-control/climate/ha-state-control-climate-temperature";
import "../../../state-control/ha-state-control-toggle";
import "../../../state-control/light/ha-state-control-light-brightness";
import type { HomeAssistant, ValueChangedEvent } from "../../../types";
import { getAreaGroupedEntities } from "../strategies/areas/helpers/areas-strategy-helper";
import type { LovelaceCard } from "../types";
import type { GroupKind } from "./scene/area-panel";
import {
  combineLights,
  combineStates,
  newGroupId,
  resolveAreaPanel,
  SENSOR_DOMAINS,
  splitByKind,
} from "./scene/area-panel";
import { renderRoom } from "./scene/scene-illustrations";
import "./scene/scene-group-target";
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
const GROUP_PREFIX = "group:";
const SORT_OPTIONS: HaSortableOptions = {
  animation: 180,
  delay: 120,
  delayOnTouchOnly: true,
};

const PRESET_TITLES: Record<string, string> = {
  lights: "lights",
  climate: "climate",
  covers: "covers",
  media: "media",
  security: "security",
  others: "other_devices",
  sensors: "sensors",
};

const KIND_TITLES: Record<GroupKind, string> = {
  light: "lights",
  climate: "climate",
  cover: "covers",
  media_player: "media",
  toggle: "switches",
  sensor: "sensors",
};

type LightMode = "brightness" | "color" | "color_temp";

interface AreaUiState {
  focus: string;
  edit: boolean;
}

const uiStates = new Map<string, AreaUiState>();

const scrollStates = new Map<
  string,
  { rail: number; page: number; at: number }
>();

@customElement("hui-area-scene-card")
export class HuiAreaSceneCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @property({ attribute: false }) public layout?: string;

  @state() private _config?: AreaSceneCardConfig;

  @state() private _focus = "room";

  @state() private _edit = false;

  @state() private _panel?: AreaPanelConfig;

  @state() private _adding?: string;

  @state() private _page = 0;

  @state() private _lightMode: LightMode = "brightness";

  @state() private _entry?: ExtEntityRegistryEntry | null;

  @state() private _favoritesEdit = false;

  @query(".gallery") private _gallery?: HTMLElement;

  @query(".rail") private _rail?: HTMLElement;

  public setConfig(config: AreaSceneCardConfig): void {
    if (!config.area) {
      throw new Error("Area required");
    }
    this._config = config;
    this._panel = config.panel;
    const saved = uiStates.get(config.area);
    if (saved) {
      this._focus = saved.focus;
      this._edit = saved.edit;
    }
  }

  public getCardSize(): number {
    return 12;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has("hass") && this.hass) {
      this.toggleAttribute("dark", !!this.hass.themes?.darkMode);
      if (this._focus.startsWith(GROUP_PREFIX)) {
        if (!this._findGroup(this._focus.slice(GROUP_PREFIX.length))) {
          this._focus = "room";
        }
      } else if (this._focus !== "room" && !this.hass.states[this._focus]) {
        this._focus = "room";
      }
      const oldHass = changed.get("hass") as HomeAssistant | undefined;
      const areaId = this._config?.area;
      if (areaId && oldHass?.areas[areaId] && !this.hass.areas[areaId]) {
        navigate(`${dashboardBasePath()}/overview`, { replace: true });
      }
    }
    if (changed.has("_focus")) {
      this._page = 0;
      this._lightMode = "brightness";
      this._favoritesEdit = false;
      this._loadEntry();
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    const saved = this._config && scrollStates.get(this._config.area);
    if (!saved || Date.now() - saved.at > 2000) {
      this._scrollReady = true;
      return;
    }
    requestAnimationFrame(() => {
      this._scrollReady = true;
      if (this._rail) {
        this._rail.scrollTop = saved.rail;
      }
      if (saved.page) {
        window.scrollTo({ top: saved.page });
      }
    });
  }

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("scroll", this._pageScrolled, { passive: true });
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("scroll", this._pageScrolled);
    const saved = this._config && scrollStates.get(this._config.area);
    if (saved) {
      saved.at = Date.now();
    }
  }

  private _rememberScroll(rail?: number, page?: number) {
    if (!this._config) {
      return;
    }
    if (!this._scrollReady) {
      return;
    }
    const current = scrollStates.get(this._config.area) ?? {
      rail: 0,
      page: 0,
      at: 0,
    };
    scrollStates.set(this._config.area, {
      rail: rail ?? current.rail,
      page: page ?? current.page,
      at: 0,
    });
  }

  private _scrollReady = false;

  private _railScrolled(ev: Event) {
    this._rememberScroll((ev.currentTarget as HTMLElement).scrollTop);
  }

  private _pageScrolled = () => {
    if (this.isConnected && this.offsetParent !== null) {
      this._rememberScroll(undefined, window.scrollY);
    }
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if ((changed.has("_focus") || changed.has("_edit")) && this._config) {
      uiStates.set(this._config.area, { focus: this._focus, edit: this._edit });
    }
    if (changed.has("_focus") && this._gallery) {
      this._gallery.scrollLeft = 0;
    }
  }

  private async _loadEntry() {
    this._entry = undefined;
    const id = this._focus;
    if (!this.hass || computeDomain(id) !== "light" || !this.hass.states[id]) {
      return;
    }
    try {
      const entry = await getExtendedEntityRegistryEntry(this.hass, id);
      if (this._focus === id) {
        this._entry = entry;
      }
    } catch (_err) {
      this._entry = null;
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

  private _defaults(): AreaPanelGroupConfig[] {
    const hass = this.hass!;
    const areaId = this._config!.area;
    const grouped = getAreaGroupedEntities(areaId, hass);
    const used = new Set(Object.values(grouped).flat());
    const sensors = (getSceneIndex(hass).byArea[areaId] || []).filter(
      (id) => SENSOR_DOMAINS.includes(computeDomain(id)) && !used.has(id)
    );
    return [
      { id: "lights", entities: grouped.lights },
      { id: "climate", entities: grouped.climate },
      { id: "covers", entities: grouped.covers },
      { id: "media", entities: grouped.media_players },
      { id: "security", entities: grouped.security },
      { id: "others", entities: grouped.others },
      { id: "sensors", entities: sensors },
    ];
  }

  private _groups(): AreaPanelGroupConfig[] {
    const hass = this.hass!;
    return resolveAreaPanel(
      this._defaults(),
      this._panel,
      (id) => hass.states[id] !== undefined
    );
  }

  private _findGroup(id: string) {
    return this._groups().find((g) => g.id === id && g.entities.length);
  }

  private _groupName(g: AreaPanelGroupConfig) {
    if (g.name) {
      return g.name;
    }
    const preset = PRESET_TITLES[g.id];
    return preset ? this._t(preset) : this._t("dock_editor.group");
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
    const groups = this._groups();
    const { lights, covers, climates } = this._roomDevices();
    const lightsOn = lights.filter(isLightOn);
    const floor = area.floor_id ? hass.floors[area.floor_id] : undefined;
    const focusGroup = this._focus.startsWith(GROUP_PREFIX)
      ? groups.find((g) => g.id === this._focus.slice(GROUP_PREFIX.length))
      : undefined;
    const focusObj =
      !focusGroup && this._focus !== "room"
        ? hass.states[this._focus]
        : undefined;
    const focusDomain = focusObj ? computeDomain(focusObj.entity_id) : "room";
    const isRoom = !focusGroup && !focusObj;

    let title = area.name;
    let subtitle: string;
    if (focusGroup) {
      title = this._groupName(focusGroup);
      subtitle = this._t("devices_count", {
        count: statesOf(hass, focusGroup.entities).length,
      });
    } else if (focusObj) {
      title = hass.formatEntityName(focusObj, undefined);
      subtitle = hass.formatEntityState(focusObj);
    } else {
      const temp = area.temperature_entity_id
        ? numericState(hass.states[area.temperature_entity_id])
        : undefined;
      const hum = area.humidity_entity_id
        ? numericState(hass.states[area.humidity_entity_id])
        : undefined;
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

    const lit = focusGroup
      ? statesOf(hass, focusGroup.entities).some(isLightOn)
      : focusObj
        ? isLightOn(focusObj)
        : lightsOn.length > 0;
    const stageCenter = lit
      ? "color-mix(in srgb, #f2b45a 9%, var(--card-background-color))"
      : "var(--card-background-color)";

    let visual: unknown;
    if (focusGroup) {
      visual = this._renderGroupControl(focusGroup);
    } else if (focusObj && focusDomain === "light") {
      visual = this._renderLight(focusObj as LightEntity, [focusObj.entity_id]);
    } else if (focusObj && focusDomain === "climate") {
      visual = this._renderClimate(focusObj, [focusObj.entity_id]);
    } else if (focusObj && focusDomain === "cover") {
      visual = this._renderCover(focusObj, [focusObj.entity_id]);
    } else if (focusObj && focusDomain === "media_player") {
      visual = this._renderMedia(focusObj, [focusObj.entity_id]);
    } else {
      visual = this._renderRoomVisual(area.picture, lights, covers);
    }

    return html`
      <div class="layout">
        <section
          class="stage ${isRoom ? "" : "focused"}"
          style=${styleMap({ "--scene-stage-center": stageCenter })}
        >
          <div class="intro">
            <span class="overline">
              ${floor ? `${floor.name} · ${area.name}` : area.name}
            </span>
            <h1>${title}</h1>
            ${subtitle ? html`<p class="summary">${subtitle}</p>` : nothing}
          </div>
          <div class="visual focus">${visual}</div>
          ${
            isRoom
              ? this._renderDock(lights, lightsOn, climates, covers)
              : nothing
          }
        </section>
        <aside class="rail" @scroll=${this._railScrolled}>
          ${this._renderRail(groups)}
        </aside>
      </div>
    `;
  }

  private _roomDevices() {
    const hass = this.hass!;
    const grouped = getAreaGroupedEntities(this._config!.area, hass);
    return {
      lights: statesOf(hass, grouped.lights) as LightEntity[],
      covers: statesOf(hass, grouped.covers).filter(
        (s) => computeDomain(s.entity_id) === "cover"
      ),
      climates: statesOf(hass, grouped.climate).filter(
        (s) => computeDomain(s.entity_id) === "climate"
      ),
    };
  }

  private _renderRail(groups: AreaPanelGroupConfig[]) {
    const edit = this._edit;
    const visible = edit ? groups : groups.filter((g) => g.entities.length);
    return html`
      <div class="rail-head">
        <h2>${this._t("devices")}</h2>
        <div class="rail-buttons">
          ${
            edit
              ? html`<button class="link" @click=${this._resetPanel}>
                    ${this._t("panel_editor.reset")}
                  </button>
                  <button
                    class="chip small"
                    aria-pressed="true"
                    @click=${this._toggleEdit}
                  >
                    ${this._t("done")}
                  </button>`
              : html`<button
                    class="chip small"
                    aria-pressed=${this._focus === "room" ? "true" : "false"}
                    @click=${this._focusRoom}
                  >
                    ${this._t("whole_area")}
                  </button>
                  <ha-icon-button
                    class="edit-btn"
                    .label=${this._t("panel_editor.edit")}
                    .path=${mdiPencilOutline}
                    @click=${this._toggleEdit}
                  ></ha-icon-button>`
          }
        </div>
      </div>
      ${
        edit
          ? html`<ha-sortable
              handle-selector=".group-handle"
              draggable-selector=".group"
              .options=${SORT_OPTIONS}
              @item-moved=${this._groupMoved}
            >
              <div class="groups">
                ${visible.map((g) => this._renderGroup(g))}
              </div>
            </ha-sortable>`
          : html`<div class="groups">
              ${visible.map((g) => this._renderGroup(g))}
            </div>`
      }
      ${
        edit
          ? html`<button class="add-group" @click=${this._addGroup}>
              <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
              <span>${this._t("panel_editor.add_group")}</span>
            </button>`
          : nothing
      }
    `;
  }

  private _groupMeta(states: HassEntity[]) {
    const lights = states.filter((s) => computeDomain(s.entity_id) === "light");
    if (lights.length === states.length) {
      return this._t("lights_of", {
        on: lights.filter(isLightOn).length,
        total: lights.length,
      });
    }
    return this._t("devices_count", { count: states.length });
  }

  private _renderGroup(g: AreaPanelGroupConfig) {
    const hass = this.hass!;
    const states = statesOf(hass, g.entities);
    const edit = this._edit;
    const name = this._groupName(g);
    const selected = this._focus === GROUP_PREFIX + g.id;
    const rows = html`<div class="rows">
      ${states.map((s) => this._renderRow(s, g.id))}
      ${
        edit && !states.length
          ? html`<p class="drop-hint">
              ${this._t("panel_editor.empty_group")}
            </p>`
          : nothing
      }
    </div>`;
    return html`
      <div class="group" .sortableData=${g.id}>
        ${
          edit
            ? html`<div class="group-head editing">
                <span class="group-handle" title=${this._t("drag")}>
                  <ha-svg-icon .path=${mdiDragHorizontalVariant}></ha-svg-icon>
                </span>
                <span class="title">${name}</span>
                <span class="edit-actions">
                  <ha-icon-button
                    .label=${this._t("panel_editor.rename_group")}
                    .path=${mdiPencilOutline}
                    data-group=${g.id}
                    @click=${this._renameGroup}
                  ></ha-icon-button>
                  <ha-icon-button
                    .label=${this._t("panel_editor.delete_group")}
                    .path=${mdiDeleteOutline}
                    data-group=${g.id}
                    @click=${this._deleteGroup}
                  ></ha-icon-button>
                </span>
              </div>`
            : html`<button
                class="group-head group-button ${selected ? "selected" : ""}"
                aria-pressed=${selected ? "true" : "false"}
                data-group=${g.id}
                @click=${this._groupClicked}
              >
                <span class="title">${name}</span>
                <span class="meta">${this._groupMeta(states)}</span>
                <ha-svg-icon
                  class="chevron"
                  .path=${mdiChevronRight}
                ></ha-svg-icon>
              </button>`
        }
        ${
          edit
            ? html`<ha-sortable
                group="area-panel-rows"
                handle-selector=".row-handle"
                draggable-selector=".row"
                .options=${SORT_OPTIONS}
                .groupId=${g.id}
                @item-moved=${this._rowMoved}
                @item-added=${this._rowAdded}
              >
                ${rows}
              </ha-sortable>`
            : rows
        }
        ${
          edit
            ? this._adding === g.id
              ? html`<ha-entity-picker
                  .hass=${hass}
                  .excludeEntities=${g.entities}
                  data-group=${g.id}
                  @value-changed=${this._entityPicked}
                ></ha-entity-picker>`
              : html`<button
                  class="mini-btn add-device"
                  data-group=${g.id}
                  @click=${this._startAdding}
                >
                  + ${this._t("panel_editor.add_device")}
                </button>`
            : nothing
        }
      </div>
    `;
  }

  private _renderRow(s: HassEntity, groupId: string) {
    const hass = this.hass!;
    const domain = computeDomain(s.entity_id);
    const focusable = FOCUS_DOMAINS.includes(domain);
    const selected = this._focus === s.entity_id;
    const active = stateActive(s);
    const sensor = SENSOR_DOMAINS.includes(domain);
    const toggleable =
      isToggleable(s.entity_id) && !sensor && domain !== "cover";
    const color = active ? stateColorCss(s) : undefined;
    const edit = this._edit;
    const icon = html`<span
      class="row-icon"
      style=${styleMap({
        "--icon-color": color || "var(--scene-text2)",
        "--icon-bg": color
          ? `color-mix(in srgb, ${color} 16%, transparent)`
          : "var(--scene-well)",
      })}
    >
      <ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>
    </span>`;
    const text = html`<span class="row-text">
      <span class="primary">${hass.formatEntityName(s, undefined)}</span>
      <span class="secondary">
        ${
          sensor
            ? hass.formatEntityName(s, [{ type: "device" }])
            : hass.formatEntityState(s)
        }
      </span>
    </span>`;
    if (edit) {
      return html`
        <div class="row editing" .sortableData=${s.entity_id}>
          <span class="row-handle" title=${this._t("drag")}>
            <ha-svg-icon .path=${mdiDragHorizontalVariant}></ha-svg-icon>
          </span>
          <span class="row-main static">${icon}${text}</span>
          <ha-icon-button
            .label=${this._t("panel_editor.remove_device")}
            .path=${mdiClose}
            data-group=${groupId}
            data-entity=${s.entity_id}
            @click=${this._removeRow}
          ></ha-icon-button>
        </div>
      `;
    }
    return html`
      <div class="row ${selected ? "selected" : ""}">
        <button
          class="row-main"
          aria-pressed=${selected ? "true" : "false"}
          data-entity=${s.entity_id}
          data-focusable=${focusable ? "1" : ""}
          @click=${this._rowClicked}
        >
          ${icon}${text}
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

  private _renderGroupControl(g: AreaPanelGroupConfig) {
    const hass = this.hass!;
    const name = this._groupName(g);
    const parts = splitByKind(statesOf(hass, g.entities));
    if (parts.length === 1) {
      return this._renderKind(parts[0].kind, parts[0].states, name);
    }
    const page = Math.min(this._page, parts.length - 1);
    return html`
      <div class="gallery-wrap">
        <div class="gallery-tabs" role="group">
          ${parts.map(
            (p, i) =>
              html`<button
                class="chip small"
                aria-pressed=${i === page ? "true" : "false"}
                data-page=${i}
                @click=${this._pageClicked}
              >
                ${this._t(KIND_TITLES[p.kind])}
                <span class="count">${p.states.length}</span>
              </button>`
          )}
        </div>
        <div class="gallery-frame">
          <button
            class="nav prev"
            aria-label=${this._t("previous")}
            ?disabled=${page === 0}
            data-step="-1"
            @click=${this._stepPage}
          >
            <ha-svg-icon .path=${mdiChevronLeft}></ha-svg-icon>
          </button>
          <div class="gallery" @scroll=${this._galleryScrolled}>
            ${parts.map(
              (p) =>
                html`<div class="page">
                  ${this._renderKind(p.kind, p.states, name)}
                </div>`
            )}
          </div>
          <button
            class="nav next"
            aria-label=${this._t("next")}
            ?disabled=${page === parts.length - 1}
            data-step="1"
            @click=${this._stepPage}
          >
            <ha-svg-icon .path=${mdiChevronRight}></ha-svg-icon>
          </button>
        </div>
      </div>
    `;
  }

  private _renderKind(kind: GroupKind, states: HassEntity[], name: string) {
    const hass = this.hass!;
    const ids = states.map((s) => s.entity_id);
    let content: unknown;
    if (kind === "light") {
      content = this._renderLight(
        combineLights(states as LightEntity[], name),
        ids
      );
    } else if (kind === "climate") {
      content = this._renderClimate(combineStates(states, name), ids);
    } else if (kind === "cover") {
      content = this._renderCover(combineStates(states, name), ids);
    } else if (kind === "media_player") {
      content = this._renderMedia(combineStates(states, name), ids);
    } else if (kind === "toggle") {
      content = this._renderToggles(states);
    } else {
      content = this._renderSensors(states);
    }
    if (ids.length === 1) {
      return content;
    }
    return html`<scene-group-target .hass=${hass} .targets=${ids}
      >${content}</scene-group-target
    >`;
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

  private _lightModes(light: LightEntity): LightMode[] {
    const modes: LightMode[] = [];
    if (lightSupportsBrightness(light)) {
      modes.push("brightness");
    }
    if (lightSupportsColor(light)) {
      modes.push("color");
    }
    if (lightSupportsColorMode(light, LightColorMode.COLOR_TEMP)) {
      modes.push("color_temp");
    }
    return modes;
  }

  private _renderLight(light: LightEntity, ids: string[]) {
    const hass = this.hass!;
    const on = isLightOn(light);
    const bri = brightnessPct(light) ?? (on ? 100 : 0);
    const dimmable = lightSupportsBrightness(light);
    const modes = this._lightModes(light);
    const mode = modes.includes(this._lightMode) ? this._lightMode : modes[0];
    const single = ids.length === 1;
    const entity = ids.join(",");
    const supportsWhite = lightSupportsColorMode(light, LightColorMode.WHITE);
    const effects =
      single &&
      supportsFeature(light, LightEntityFeature.EFFECT) &&
      light.attributes.effect_list?.length
        ? light.attributes.effect_list
        : undefined;
    const showFavorites = Boolean(
      single &&
      this._entry &&
      this._entry.entity_id === light.entity_id &&
      (this._favoritesEdit ||
        (lightSupportsFavoriteColors(light) &&
          shouldShowFavoriteOptions(
            this._entry.options?.light?.favorite_colors
          )))
    );
    const modeLabels: Record<LightMode, string> = {
      brightness: this._t("brightness"),
      color: this._t("color"),
      color_temp: this._t("temperature_short"),
    };

    let main: unknown;
    if (mode === "brightness") {
      main = html`<ha-state-control-light-brightness
        class="brightness"
        .stateObj=${light}
      ></ha-state-control-light-brightness>`;
    } else if (mode === "color") {
      main = html`<light-color-rgb-picker
        class="color-picker"
        .stateObj=${light}
      ></light-color-rgb-picker>`;
    } else if (mode === "color_temp") {
      main = html`<light-color-temp-picker
        class="temp-picker"
        .stateObj=${light}
      ></light-color-temp-picker>`;
    } else {
      main = html`<ha-state-control-toggle
        class="big-toggle"
        .stateObj=${light}
        .iconPathOn=${mdiLightbulbOn}
        .iconPathOff=${mdiLightbulbOff}
      ></ha-state-control-toggle>`;
    }

    let bigValue: string;
    if (!on) {
      bigValue = this._t("off");
    } else if (mode === "color_temp" && light.attributes.color_temp_kelvin) {
      bigValue = `${light.attributes.color_temp_kelvin} K`;
    } else if (dimmable) {
      bigValue = `${bri} %`;
    } else {
      bigValue = this._t("on");
    }

    return html`
      <div class="light-focus">
        <div class="main-control">${main}</div>
        <div class="light-side">
          <div class="big-block">
            <span class="overline"
              >${mode === "color_temp" ? modeLabels.color_temp : dimmable ? modeLabels.brightness : this._t("light_label")}</span
            >
            <span class="big">${bigValue}</span>
          </div>
          ${
            modes.length > 1
              ? html`<div
                  class="segmented"
                  role="group"
                  aria-label=${this._t("mode")}
                >
                  ${modes.map(
                    (m) =>
                      html`<button
                        aria-pressed=${m === mode ? "true" : "false"}
                        data-mode=${m}
                        @click=${this._lightModeClicked}
                      >
                        ${
                          m === "brightness"
                            ? nothing
                            : html`<span class="wheel ${m}"></span>`
                        }
                        ${modeLabels[m]}
                      </button>`
                  )}
                </div>`
              : nothing
          }
          ${
            showFavorites
              ? html`<ha-more-info-light-favorite-colors
                  class="favorites"
                  .stateObj=${light}
                  .entry=${this._entry}
                  .editMode=${this._favoritesEdit}
                  @toggle-edit-mode=${this._favoritesEditToggled}
                  @entity-entry-updated=${this._entryUpdated}
                  @favorite-color-edit-started=${this._favoriteEditStarted}
                ></ha-more-info-light-favorite-colors>`
              : nothing
          }
          ${
            effects
              ? html`<ha-control-select-menu
                  class="effects"
                  .label=${hass.formatEntityAttributeName(light, "effect")}
                  .value=${light.attributes.effect}
                  .options=${effects.map((effect) => ({
                    value: effect,
                    label: hass.formatEntityAttributeValue(
                      light,
                      "effect",
                      effect
                    ),
                  }))}
                  data-entity=${light.entity_id}
                  @wa-select=${this._effectSelected}
                >
                  <ha-svg-icon slot="icon" .path=${mdiCreation}></ha-svg-icon>
                </ha-control-select-menu>`
              : nothing
          }
          <div class="actions">
            <button
              class="pill-btn ${on ? "" : "inverted"}"
              data-domain="light"
              data-service=${on ? "turn_off" : "turn_on"}
              data-entity=${entity}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${mdiPower}></ha-svg-icon>
              <span>${on ? this._t("turn_off") : this._t("turn_on")}</span>
            </button>
            ${
              supportsWhite
                ? html`<button
                    class="pill-btn"
                    data-domain="light"
                    data-service="turn_on"
                    data-entity=${entity}
                    data-payload=${JSON.stringify({ white: true })}
                    @click=${this._serviceClicked}
                  >
                    <ha-svg-icon .path=${mdiFileWordBox}></ha-svg-icon>
                    <span>${this._t("white")}</span>
                  </button>`
                : nothing
            }
          </div>
        </div>
      </div>
    `;
  }

  private _renderClimate(s: HassEntity, ids: string[]) {
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
                      data-entity=${ids.join(",")}
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

  private _renderCover(s: HassEntity, ids: string[]) {
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
                  data-entity=${ids.join(",")}
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

  private _renderMedia(s: HassEntity, ids: string[]) {
    const hass = this.hass!;
    const playing = s.state === "playing";
    const entity = ids.join(",");
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
              data-entity=${entity}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${mdiSkipPrevious}></ha-svg-icon>
            </button>
            <button
              class="big-circle inverted"
              aria-label=${this._t("play_pause")}
              data-domain="media_player"
              data-service=${ids.length > 1 ? (playing ? "media_pause" : "media_play") : "media_play_pause"}
              data-entity=${entity}
              @click=${this._serviceClicked}
            >
              <ha-svg-icon .path=${playing ? mdiPause : mdiPlay}></ha-svg-icon>
            </button>
            <button
              class="big-circle small"
              aria-label=${this._t("next")}
              data-domain="media_player"
              data-service="media_next_track"
              data-entity=${entity}
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
                    data-entity=${entity}
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
                    data-entity=${entity}
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

  private _renderToggles(states: HassEntity[]) {
    const hass = this.hass!;
    const onCount = states.filter((s) => stateActive(s)).length;
    const anyOn = onCount > 0;
    return html`
      <div class="toggle-focus">
        <button
          class="power-orb ${anyOn ? "on" : ""}"
          aria-label=${anyOn ? this._t("turn_off") : this._t("turn_on")}
          aria-pressed=${anyOn ? "true" : "false"}
          data-domain="homeassistant"
          data-service=${anyOn ? "turn_off" : "turn_on"}
          data-entity=${states.map((s) => s.entity_id).join(",")}
          @click=${this._serviceClicked}
        >
          <ha-svg-icon .path=${mdiPower}></ha-svg-icon>
        </button>
        <div class="light-side">
          <div class="big-block">
            <span class="overline">
              ${this._t("lights_of", { on: onCount, total: states.length })}
            </span>
            <span class="big">${anyOn ? this._t("on") : this._t("off")}</span>
          </div>
          <div class="mini-list">
            ${states.map(
              (s) =>
                html`<div class="row">
                  <span class="row-main static">
                    <span class="row-text">
                      <span class="primary"
                        >${hass.formatEntityName(s, undefined)}</span
                      >
                      <span class="secondary"
                        >${hass.formatEntityState(s)}</span
                      >
                    </span>
                  </span>
                  <button
                    class="toggle"
                    aria-label=${this._t("toggle_entity", {
                      name: hass.formatEntityName(s, undefined),
                    })}
                    aria-pressed=${stateActive(s) ? "true" : "false"}
                    data-entity=${s.entity_id}
                    @click=${this._toggleClicked}
                  >
                    <span class="track"><span class="knob"></span></span>
                  </button>
                </div>`
            )}
          </div>
        </div>
      </div>
    `;
  }

  private _renderSensors(states: HassEntity[]) {
    const hass = this.hass!;
    return html`
      <div class="sensor-grid">
        ${states.map(
          (s) =>
            html`<button
              class="sensor-tile"
              data-entity=${s.entity_id}
              @click=${this._moreInfoClicked}
            >
              <span class="sensor-name"
                >${hass.formatEntityName(s, undefined)}</span
              >
              <span class="sensor-value">${hass.formatEntityState(s)}</span>
            </button>`
        )}
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

  private _groupClicked(ev: Event) {
    const id = (ev.currentTarget as HTMLElement).dataset.group!;
    const key = GROUP_PREFIX + id;
    this._focus = this._focus === key ? "room" : key;
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
    const ids = entity!.split(",");
    this.hass!.callService(domain!, service!, {
      entity_id: ids.length === 1 ? ids[0] : ids,
      ...(payload ? JSON.parse(payload) : {}),
    });
  }

  private _lightModeClicked(ev: Event) {
    this._lightMode = (ev.currentTarget as HTMLElement).dataset
      .mode as LightMode;
  }

  private _effectSelected(ev: HaDropdownSelectEvent) {
    const effect = ev.detail.item.value;
    const entity = (ev.currentTarget as HTMLElement).dataset.entity!;
    if (!effect || this.hass!.states[entity]?.attributes.effect === effect) {
      return;
    }
    this.hass!.callService("light", "turn_on", { entity_id: entity, effect });
  }

  private _favoritesEditToggled(ev: HASSDomEvent<boolean>) {
    ev.stopPropagation();
    this._favoritesEdit = ev.detail;
  }

  private _entryUpdated(ev: HASSDomEvent<ExtEntityRegistryEntry>) {
    ev.stopPropagation();
    this._entry = ev.detail;
  }

  private _favoriteEditStarted(ev: Event) {
    ev.stopPropagation();
    this._lightMode = "brightness";
  }

  private _pageClicked(ev: Event) {
    this._scrollToPage(Number((ev.currentTarget as HTMLElement).dataset.page));
  }

  private _stepPage(ev: Event) {
    const step = Number((ev.currentTarget as HTMLElement).dataset.step);
    this._scrollToPage(this._page + step);
  }

  private _scrollToPage(page: number) {
    const gallery = this._gallery;
    if (!gallery) {
      return;
    }
    const count = gallery.children.length;
    const next = Math.max(0, Math.min(count - 1, page));
    const rtl = getComputedStyle(gallery).direction === "rtl";
    gallery.scrollTo({
      left: (rtl ? -1 : 1) * next * gallery.clientWidth,
      behavior: "smooth",
    });
    this._page = next;
  }

  private _galleryScrolled(ev: Event) {
    const gallery = ev.currentTarget as HTMLElement;
    if (!gallery.clientWidth) {
      return;
    }
    const page = Math.round(Math.abs(gallery.scrollLeft) / gallery.clientWidth);
    if (page !== this._page) {
      this._page = page;
    }
  }

  private _focusRoom = () => {
    this._focus = "room";
  };

  private _toggleEdit = () => {
    this._edit = !this._edit;
    this._adding = undefined;
    if (this._edit) {
      this._focus = "room";
    }
  };

  private _materialize(): AreaPanelConfig {
    return {
      groups: this._groups().map((g) => ({
        ...g,
        entities: [...g.entities],
      })),
      hidden: [...(this._panel?.hidden ?? [])],
    };
  }

  private async _save(panel: AreaPanelConfig | undefined) {
    this._panel = panel;
    const conn = this.hass!.connection;
    const areaId = this._config!.area;
    const current = (await fetchFrontendSystemData(conn, "home")) ?? {};
    const panels = { ...current.area_panels };
    if (panel) {
      panels[areaId] = panel;
    } else {
      delete panels[areaId];
    }
    await saveFrontendSystemData(conn, "home", {
      ...current,
      area_panels: panels,
    });
  }

  private _groupMoved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>) {
    ev.stopPropagation();
    const panel = this._materialize();
    const { oldIndex, newIndex } = ev.detail;
    const [moved] = panel.groups.splice(oldIndex, 1);
    panel.groups.splice(newIndex, 0, moved);
    this._save(panel);
  }

  private _rowMoved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>) {
    ev.stopPropagation();
    const groupId = (ev.currentTarget as HTMLElement & { groupId: string })
      .groupId;
    const panel = this._materialize();
    const group = panel.groups.find((g) => g.id === groupId);
    if (!group) {
      return;
    }
    const visible = group.entities.filter((id) => this.hass!.states[id]);
    const { oldIndex, newIndex } = ev.detail;
    const [moved] = visible.splice(oldIndex, 1);
    visible.splice(newIndex, 0, moved);
    group.entities = visible;
    this._save(panel);
  }

  private _rowAdded(ev: HASSDomEvent<HASSDomEvents["item-added"]>) {
    ev.stopPropagation();
    const groupId = (ev.currentTarget as HTMLElement & { groupId: string })
      .groupId;
    const entityId = ev.detail.data as string;
    this._placeEntity(entityId, groupId, ev.detail.index);
  }

  private _placeEntity(entityId: string, groupId: string, index?: number) {
    const panel = this._materialize();
    for (const g of panel.groups) {
      g.entities = g.entities.filter((id) => id !== entityId);
    }
    panel.hidden = (panel.hidden ?? []).filter((id) => id !== entityId);
    const group = panel.groups.find((g) => g.id === groupId);
    if (!group) {
      return;
    }
    group.entities.splice(index ?? group.entities.length, 0, entityId);
    this._save(panel);
  }

  private _removeRow(ev: Event) {
    const { group: groupId, entity } = (ev.currentTarget as HTMLElement)
      .dataset;
    const panel = this._materialize();
    const group = panel.groups.find((g) => g.id === groupId);
    if (!group || !entity) {
      return;
    }
    group.entities = group.entities.filter((id) => id !== entity);
    panel.hidden = [...(panel.hidden ?? []), entity];
    this._save(panel);
  }

  private _startAdding(ev: Event) {
    this._adding = (ev.currentTarget as HTMLElement).dataset.group;
  }

  private _entityPicked(ev: ValueChangedEvent<string | undefined>) {
    ev.stopPropagation();
    const picker = ev.currentTarget as HaEntityPicker;
    const entityId = ev.detail.value;
    const groupId = picker.dataset.group!;
    picker.value = "";
    this._adding = undefined;
    if (entityId) {
      this._placeEntity(entityId, groupId);
    }
  }

  private async _renameGroup(ev: Event) {
    const groupId = (ev.currentTarget as HTMLElement).dataset.group!;
    const panel = this._materialize();
    const group = panel.groups.find((g) => g.id === groupId);
    if (!group) {
      return;
    }
    const name = await showPromptDialog(this, {
      title: this._t("panel_editor.rename_group"),
      inputLabel: this._t("panel_editor.group_name"),
      defaultValue: this._groupName(group),
      confirmText: this.hass!.localize("ui.common.save"),
    });
    if (name === null || !name.trim()) {
      return;
    }
    group.name = name.trim();
    this._save(panel);
  }

  private async _deleteGroup(ev: Event) {
    const groupId = (ev.currentTarget as HTMLElement).dataset.group!;
    const panel = this._materialize();
    const group = panel.groups.find((g) => g.id === groupId);
    if (!group) {
      return;
    }
    if (group.entities.length) {
      const confirmed = await showConfirmationDialog(this, {
        title: this._t("panel_editor.delete_group"),
        text: this._t("panel_editor.delete_group_text"),
        confirmText: this.hass!.localize("ui.common.delete"),
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
    }
    panel.groups = panel.groups.filter((g) => g.id !== groupId);
    panel.hidden = [...(panel.hidden ?? []), ...group.entities];
    this._save(panel);
  }

  private _addGroup = async () => {
    const name = await showPromptDialog(this, {
      title: this._t("panel_editor.new_group"),
      inputLabel: this._t("panel_editor.group_name"),
      confirmText: this.hass!.localize("ui.common.add"),
    });
    if (name === null || !name.trim()) {
      return;
    }
    const panel = this._materialize();
    panel.groups.push({ id: newGroupId(), name: name.trim(), entities: [] });
    this._save(panel);
  };

  private _resetPanel = async () => {
    const confirmed = await showConfirmationDialog(this, {
      title: this._t("panel_editor.reset"),
      text: this._t("panel_editor.reset_text"),
      confirmText: this._t("panel_editor.reset"),
    });
    if (confirmed) {
      this._save(undefined);
    }
  };

  static styles = [
    sceneStyles,
    css`
      .visual.focus {
        min-height: 360px;
        min-width: 0;
      }

      @media (min-width: 1101px) and (min-height: 640px) {
        .stage {
          height: var(--scene-min-height);
          overflow: hidden;
        }
        .visual.focus {
          min-height: 0;
          container-type: size;
        }
        .page {
          container-type: size;
        }
        .visual .light-focus,
        .visual .cover-focus,
        .visual .media-focus,
        .visual .toggle-focus {
          flex-wrap: nowrap;
        }
        .visual .light-side {
          flex: none;
          width: 320px;
        }
        .visual .light-focus {
          flex: none;
        }
        .visual svg.room,
        .picture {
          max-height: 100cqh;
        }
        .picture {
          width: auto;
          max-width: 100%;
        }
      }

      .stage {
        flex-basis: 560px;
      }

      .rail {
        flex-basis: 360px;
      }

      .stage.focused {
        gap: var(--ha-space-4);
      }

      .rail-buttons {
        display: flex;
        align-items: center;
        gap: var(--ha-space-2);
      }

      .edit-btn {
        --ha-icon-button-size: 36px;
        --mdc-icon-size: 18px;
        color: var(--scene-text2);
      }

      .groups {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-7);
      }

      .group-button {
        width: 100%;
        min-height: 36px;
        gap: 10px;
        border: 0;
        background: transparent;
        color: inherit;
        padding: 6px 8px 6px 6px;
        margin: -6px 0;
        border-radius: 12px;
        cursor: pointer;
        text-align: start;
        font-size: 12px;
        transition: background 200ms ease;
      }

      .group-button:hover,
      .group-button.selected {
        background: var(--scene-sel);
      }

      .group-button .title {
        flex: 1;
      }

      .group-button .chevron {
        --mdc-icon-size: 16px;
      }

      .group-head.editing {
        gap: 6px;
        min-height: 32px;
      }

      .group-head.editing .title {
        flex: 1;
      }

      .group-handle,
      .row-handle {
        cursor: grab;
        color: var(--scene-text2);
        display: flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 18px;
        touch-action: none;
      }

      .row-handle {
        width: 32px;
        height: 44px;
        flex: none;
      }

      .edit-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        --ha-icon-button-size: 32px;
        --mdc-icon-size: 18px;
        color: var(--scene-text2);
      }

      .row.editing {
        gap: 0;
        --ha-icon-button-size: 36px;
        --mdc-icon-size: 18px;
        color: var(--scene-text2);
      }

      .row-main.static {
        cursor: default;
        padding-inline-start: 0;
      }

      ha-sortable .rows {
        min-height: 52px;
        border-radius: 18px;
        outline: 1px dashed var(--scene-bd);
        outline-offset: 4px;
      }

      .drop-hint {
        margin: 0;
        padding: 16px 0;
        text-align: center;
        font-size: 13px;
        color: var(--scene-text3);
      }

      .mini-btn {
        align-self: flex-start;
        height: 32px;
        padding: 0 14px;
        border-radius: 16px;
        border: 1px solid var(--scene-bd);
        background: transparent;
        color: var(--scene-text2);
        font-size: 13px;
        cursor: pointer;
      }

      .add-group {
        height: 52px;
        border-radius: 18px;
        border: 1px dashed var(--scene-bd2);
        background: transparent;
        color: var(--scene-text2);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        --mdc-icon-size: 18px;
      }

      .add-group:hover {
        color: var(--scene-text);
        border-color: var(--scene-text2);
      }

      .main-control {
        flex: none;
        width: min(360px, 100%);
        height: min(440px, 100cqh);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .main-control > * {
        animation: control-in 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      @keyframes control-in {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .segmented button {
        transition:
          background 240ms ease,
          color 240ms ease;
      }

      .big {
        transition: opacity 200ms ease;
      }

      light-color-rgb-picker,
      light-color-temp-picker {
        display: block;
        max-width: min(360px, 80vw);
      }

      ha-state-control-toggle.big-toggle {
        display: block;
        height: min(320px, 70cqh);
      }

      .wheel {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex: none;
      }

      .wheel.color {
        background-image: url("/static/images/color_wheel.png");
        background-size: cover;
      }

      .wheel.color_temp {
        background: linear-gradient(
          0deg,
          rgb(255, 160, 0) 0%,
          white 50%,
          rgb(166, 209, 255) 100%
        );
      }

      .segmented button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .light-side .segmented {
        flex-wrap: nowrap;
      }

      .light-side .segmented button {
        flex: 1;
        padding: 0 12px;
      }

      .favorites {
        display: block;
        --ha-favorite-color-button-size: 44px;
      }

      ha-control-select-menu.effects {
        width: 100%;
      }

      .gallery-wrap {
        width: 100%;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-3);
      }

      .gallery-tabs {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--ha-space-2);
      }

      .gallery-tabs .count {
        font-size: 12px;
        opacity: 0.6;
      }

      .gallery-frame {
        position: relative;
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: stretch;
      }

      .gallery {
        flex: 1;
        min-width: 0;
        display: flex;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
      }

      .gallery::-webkit-scrollbar {
        display: none;
      }

      .page {
        flex: 0 0 100%;
        min-width: 0;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .nav {
        position: absolute;
        top: 50%;
        z-index: 1;
        width: 48px;
        height: 48px;
        margin-top: -24px;
        border-radius: 24px;
        border: 1px solid var(--scene-bd);
        background: var(--card-background-color);
        color: var(--scene-text);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        box-shadow: var(--ha-box-shadow-m, none);
        transition: opacity 200ms ease;
        --mdc-icon-size: 24px;
      }

      .nav.prev {
        inset-inline-start: 0;
      }

      .nav.next {
        inset-inline-end: 0;
      }

      .nav[disabled] {
        opacity: 0;
        pointer-events: none;
      }

      :host([dir="rtl"]) .nav ha-svg-icon {
        transform: scaleX(-1);
      }

      .toggle-focus {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: clamp(24px, 6cqh, 56px);
      }

      .power-orb {
        width: min(220px, 50cqh);
        height: min(220px, 50cqh);
        min-width: 140px;
        min-height: 140px;
        border-radius: 50%;
        border: 1px solid var(--scene-bd);
        background: var(--scene-well);
        color: var(--scene-text2);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
        transition:
          background 240ms ease,
          color 240ms ease,
          box-shadow 240ms ease;
        --mdc-icon-size: 56px;
      }

      .power-orb.on {
        background: var(--scene-light);
        border-color: var(--scene-light);
        color: #141517;
        box-shadow: 0 30px 80px
          color-mix(in srgb, var(--scene-light) 35%, transparent);
      }

      .mini-list {
        display: flex;
        flex-direction: column;
        max-height: 40cqh;
        overflow-y: auto;
      }

      .mini-list .row-main {
        min-height: 52px;
      }

      .sensor-grid {
        width: 100%;
        max-width: 760px;
        max-height: 100cqh;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 10px;
        align-content: center;
      }

      .sensor-tile {
        min-height: 104px;
        border-radius: 22px;
        border: 1px solid var(--scene-bd);
        background: var(--scene-dock-bg);
        color: var(--scene-text);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 10px;
        padding: 16px;
        text-align: start;
        cursor: pointer;
      }

      .sensor-name {
        font-size: 13px;
        color: var(--scene-text2);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .sensor-value {
        font-size: 26px;
        font-weight: 300;
        letter-spacing: -0.02em;
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
        gap: clamp(24px, 7cqh, 56px);
      }

      ha-state-control-light-brightness.brightness {
        --ha-brightness-slider-max-height: min(440px, 100cqh - 8px);
        filter: drop-shadow(
          0 30px 60px color-mix(in srgb, #f2b45a 18%, transparent)
        );
      }

      ha-state-control-climate-temperature {
        width: min(400px, 80vw, 100cqh - 100px);
        min-width: 220px;
      }

      .light-side {
        width: 340px;
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: clamp(14px, 3.6cqh, 32px);
      }

      .big-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .big {
        font-size: clamp(52px, 15cqh, 104px);
        line-height: 0.95;
        font-weight: var(--ha-font-weight-thin, 200);
        letter-spacing: -0.045em;
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
        gap: clamp(14px, 3.6cqh, 28px);
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
        aspect-ratio: 7 / 10;
        height: min(400px, 100cqh);
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
        width: min(300px, 80cqh);
        height: min(300px, 80cqh);
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

      @media (max-width: 600px) {
        .big {
          font-size: 64px;
        }
        ha-state-control-light-brightness.brightness {
          --ha-brightness-slider-max-height: 300px;
        }
        .light-side .segmented button {
          padding: 0 8px;
          font-size: 14px;
        }
        .visual .light-focus,
        .visual .cover-focus,
        .visual .media-focus,
        .visual .toggle-focus {
          gap: 24px;
        }
        .visual.focus {
          min-height: 0;
        }
        .main-control {
          width: 100%;
          height: 470px;
        }
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-area-scene-card": HuiAreaSceneCard;
  }
}
