import {
  mdiAccount,
  mdiChevronRight,
  mdiCommentProcessingOutline,
  mdiDeleteOutline,
  mdiDevices,
  mdiDragHorizontalVariant,
  mdiImageEditOutline,
  mdiLockOpenVariant,
  mdiMagnify,
  mdiMenu,
  mdiPencilOutline,
  mdiPlus,
  mdiRobot,
  mdiShieldCheck,
  mdiSofa,
} from "@mdi/js";
import type { HassEntity, UnsubscribeFunc } from "home-assistant-js-websocket";
import type { PropertyValues } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { styleMap } from "lit/directives/style-map";
import {
  type AreasFloorHierarchy,
  getAreasFloorHierarchy,
  getAreasOrder,
} from "../../../common/areas/areas-floor-hierarchy";
import { formatDateWeekdayDay } from "../../../common/datetime/format_date";
import { formatTime } from "../../../common/datetime/format_time";
import type { HASSDomEvent } from "../../../common/dom/fire_event";
import { fireEvent } from "../../../common/dom/fire_event";
import { computeDomain } from "../../../common/entity/compute_domain";
import { stateActive } from "../../../common/entity/state_active";
import { navigate } from "../../../common/navigate";
import { formatNumber } from "../../../common/number/format_number";
import "../../../components/ha-dropdown";
import type { HaDropdownSelectEvent } from "../../../components/ha-dropdown";
import "../../../components/ha-dropdown-item";
import "../../../components/ha-icon-button";
import "../../../components/ha-sortable";
import type { HaSortableOptions } from "../../../components/ha-sortable";
import "../../../components/ha-state-icon";
import "../../../components/ha-svg-icon";
import type { RepairsIssue } from "../../../data/repairs";
import { subscribeRepairsIssueRegistry } from "../../../data/repairs";
import { SubscribeMixin } from "../../../mixins/subscribe-mixin";
import type { HomeAssistant } from "../../../types";
import type { LovelaceCard } from "../types";
import { showAreaRegistryDetailDialog } from "../../config/areas/show-dialog-area-registry-detail";
import type { AreaRegistryEntry } from "../../../data/area/area_registry";
import {
  createAreaRegistryEntry,
  deleteAreaRegistryEntry,
  reorderAreaRegistryEntries,
  updateAreaRegistryEntry,
} from "../../../data/area/area_registry";
import type { FloorRegistryEntry } from "../../../data/floor_registry";
import {
  createFloorRegistryEntry,
  deleteFloorRegistryEntry,
  reorderFloorRegistryEntries,
  updateFloorRegistryEntry,
} from "../../../data/floor_registry";
import { showConfirmationDialog } from "../../../dialogs/generic/show-dialog-box";
import { showFloorRegistryDetailDialog } from "../../config/areas/show-dialog-floor-registry-detail";
import {
  fetchFrontendSystemData,
  saveFrontendSystemData,
} from "../../../data/frontend";
import {
  DEFAULT_DOCK_ITEMS,
  DOCK_GROUP_ICONS,
  DOCK_GROUP_PREFIX,
  type DockGroup,
  dockGroupOf,
} from "./scene/dock-items";
import { type HouseModel, renderHouse } from "./scene/scene-illustrations";
import { showEditHomeDockDialog } from "./scene/show-dialog-edit-home-dock";
import { showEditHomePictureDialog } from "./scene/show-dialog-edit-home-picture";
import {
  averageBrightness,
  callToggle,
  dashboardBasePath,
  getSceneIndex,
  greetingKey,
  isLightOn,
  isAvailable,
  isOpening,
  isToggleable,
  numericState,
  statesOf,
} from "./scene/scene-index";
import { sceneStyles } from "./scene/scene-styles";
import type { HomeSceneCardConfig } from "./types";

interface DockItem {
  key: string;
  name: string;
  state: string;
  on: boolean;
  icon?: string;
  stateObj?: HassEntity;
  action: () => void;
}

interface Metric {
  key: string;
  value: string;
  label: string;
  color: string;
  action?: () => void;
}

interface Alert {
  key: string;
  title: string;
  sub: string;
  color: string;
  icon?: string;
  stateObj?: HassEntity;
  action: () => void;
}

const UNASSIGNED = "__unassigned";

let editAreasActive = false;

const SORT_OPTIONS: HaSortableOptions = {
  sort: true,
  delay: 300,
  delayOnTouchOnly: true,
};

type RootAction =
  "add_device" | "create_automation" | "create_area" | "add_person";

const ADD_ITEMS: { action: RootAction; icon: string; key: string }[] = [
  {
    action: "add_device",
    icon: mdiDevices,
    key: "ui.panel.lovelace.menu.add_device",
  },
  {
    action: "create_automation",
    icon: mdiRobot,
    key: "ui.panel.lovelace.menu.create_automation",
  },
  {
    action: "create_area",
    icon: mdiSofa,
    key: "ui.panel.lovelace.menu.create_area",
  },
  {
    action: "add_person",
    icon: mdiAccount,
    key: "ui.panel.lovelace.menu.add_person",
  },
];

const capitalize = (text: string) =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

const COVER_DOCK_CLASSES = ["blind", "curtain", "shade", "shutter", "awning"];
const GATE_CLASSES = ["garage", "gate"];

@customElement("hui-home-scene-card")
export class HuiHomeSceneCard
  extends SubscribeMixin(LitElement)
  implements LovelaceCard
{
  @property({ attribute: false }) public override hass?: HomeAssistant;

  @property({ attribute: false }) public layout?: string;

  @state() private _config?: HomeSceneCardConfig;

  @state() private _now = new Date();

  @state() private _repairs: RepairsIssue[] = [];

  @state() private _editAreas = editAreasActive;

  private _timer?: number;

  public setConfig(config: HomeSceneCardConfig): void {
    this._config = config;
  }

  public getCardSize(): number {
    return 12;
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => {
      this._now = new Date();
    }, 30000);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._timer);
  }

  public hassSubscribe(): (UnsubscribeFunc | Promise<UnsubscribeFunc>)[] {
    if (!this.hass?.user?.is_admin) {
      return [];
    }
    return [
      subscribeRepairsIssueRegistry(this.hass.connection, (repairs) => {
        this._repairs = repairs.issues.filter((i) => !i.ignored);
      }),
    ];
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has("hass") && this.hass) {
      this.toggleAttribute("dark", !!this.hass.themes?.darkMode);
    }
  }

  private _t(key: string, values?: Record<string, string | number>) {
    return this.hass!.localize(
      `ui.panel.lovelace.cards.home_scene.${key}` as any,
      values
    );
  }

  private _moreInfo(entityId: string) {
    fireEvent(this, "hass-more-info", { entityId });
  }

  private _fmt(value: number, digits = 1) {
    return formatNumber(value, this.hass!.locale, {
      maximumFractionDigits: digits,
    });
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const hass = this.hass;
    const index = getSceneIndex(hass);
    const lights = statesOf(hass, index.byDomain.light);
    const lightsOn = lights.filter(isLightOn);
    const locks = statesOf(hass, index.byDomain.lock).filter(isAvailable);
    const alarms = statesOf(hass, index.byDomain.alarm_control_panel).filter(
      isAvailable
    );
    const persons = statesOf(hass, index.byDomain.person);
    const openings = statesOf(hass, index.byDomain.binary_sensor).filter(
      isOpening
    );
    const alarm = alarms[0];
    const alarmArmed =
      !!alarm && alarm.state !== "disarmed" && alarm.state !== "unavailable";
    const unlocked = locks.filter(
      (l) => l.state === "unlocked" || l.state === "open"
    );

    const dot = alarmArmed
      ? "var(--scene-cool)"
      : unlocked.length || openings.length
        ? "var(--scene-warn)"
        : "var(--scene-ok)";

    const summary: string[] = [];
    const peopleHome = persons.filter((p) => p.state === "home").length;
    if (peopleHome) {
      summary.push(this._t("people_home", { count: peopleHome }));
    }
    if (alarm) {
      summary.push(
        alarmArmed ? this._t("alarm_armed") : this._t("alarm_disarmed")
      );
    }
    if (locks.length) {
      summary.push(
        unlocked.length === 0
          ? this._t("doors_locked")
          : unlocked.length === 1
            ? this._t("entity_unlocked", {
                name: hass.formatEntityName(unlocked[0], { type: "entity" }),
              })
            : this._t("locks_unlocked", { count: unlocked.length })
      );
    }
    if (openings.length === 1) {
      summary.push(
        this._t("entity_open", {
          name: hass.formatEntityName(openings[0], [
            { type: "area" },
            { type: "entity" },
          ]),
        })
      );
    } else if (openings.length > 1) {
      summary.push(this._t("openings_open", { count: openings.length }));
    }

    const isAdmin = !!hass.user?.is_admin;
    const metrics = this._metrics(lightsOn.length, alarm, alarmArmed);
    const house = this._houseModel(lightsOn);
    const dock = this._dock();

    return html`
      <div class="layout">
        <section class="stage">
          <div class="topbar">
            <div class="topbar-start">
              <button
                class="circle-btn"
                aria-label=${hass.localize("ui.sidebar.sidebar_toggle")}
                title=${hass.localize("ui.sidebar.sidebar_toggle")}
                @click=${this._toggleMenu}
              >
                <ha-svg-icon .path=${mdiMenu}></ha-svg-icon>
              </button>
              <div class="overline">
                <span
                  class="status-dot"
                  style=${styleMap({ "--dot": dot })}
                ></span>
                <span>
                  ${formatDateWeekdayDay(this._now, hass.locale, hass.config)} ·
                  ${formatTime(this._now, hass.locale, hass.config)}
                </span>
              </div>
            </div>
            <div class="topbar-actions">
              ${
                isAdmin
                  ? html`<ha-dropdown @wa-select=${this._addSelected}>
                      <button
                        slot="trigger"
                        class="circle-btn"
                        aria-label=${hass.localize("ui.panel.lovelace.menu.add")}
                        title=${hass.localize("ui.panel.lovelace.menu.add")}
                      >
                        <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                      </button>
                      ${ADD_ITEMS.map(
                        (item) => html`
                          <ha-dropdown-item .value=${item.action}>
                            <ha-svg-icon
                              slot="icon"
                              .path=${item.icon}
                            ></ha-svg-icon>
                            ${hass.localize(item.key as any)}
                          </ha-dropdown-item>
                        `
                      )}
                    </ha-dropdown>`
                  : nothing
              }
              <button
                class="circle-btn"
                aria-label=${hass.localize(
                  "ui.panel.lovelace.menu.search_home_assistant"
                )}
                title=${hass.localize(
                  "ui.panel.lovelace.menu.search_home_assistant"
                )}
                @click=${this._search}
              >
                <ha-svg-icon .path=${mdiMagnify}></ha-svg-icon>
              </button>
              <button
                class="circle-btn"
                aria-label=${hass.localize("ui.panel.lovelace.menu.assist_tooltip")}
                title=${hass.localize("ui.panel.lovelace.menu.assist_tooltip")}
                @click=${this._assist}
              >
                <ha-svg-icon .path=${mdiCommentProcessingOutline}></ha-svg-icon>
              </button>
            </div>
          </div>
          <div class="intro">
            <h1>${this._t(`greeting.${greetingKey(this._now)}`)}</h1>
            ${
              summary.length
                ? html`<p class="summary">
                    ${capitalize(summary.join(" · "))}
                  </p>`
                : nothing
            }
          </div>

          ${
            metrics.length
              ? html`<div class="metrics">
                  ${metrics.map(
                    (m) => html`
                      <button
                        class="metric"
                        @click=${m.action}
                        ?disabled=${!m.action}
                      >
                        <span class="value">${m.value}</span>
                        <span class="label">
                          <span
                            class="dot"
                            style=${styleMap({ "--dot": m.color })}
                          ></span>
                          ${m.label}
                        </span>
                      </button>
                    `
                  )}
                </div>`
              : nothing
          }

          <div class="visual">
            ${
              this._config.home_picture
                ? html`<div
                    class="home-photo ${house.any ? "lit" : ""}"
                    style=${styleMap({
                      backgroundImage: `url(${this._config.home_picture})`,
                    })}
                  ></div>`
                : renderHouse(house)
            }
            ${
              isAdmin
                ? html`<button
                    class="visual-edit"
                    aria-label=${this._t("edit_picture")}
                    title=${this._t("edit_picture")}
                    @click=${this._editPicture}
                  >
                    <ha-svg-icon .path=${mdiImageEditOutline}></ha-svg-icon>
                  </button>`
                : nothing
            }
          </div>

          ${
            dock.length || isAdmin
              ? html`<nav class="dock" aria-label=${this._t("favorites")}>
                  ${dock.map(
                    (d) => html`
                      <button
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
                      </button>
                    `
                  )}
                  ${
                    isAdmin
                      ? html`<button
                          class="dock-edit"
                          aria-label=${this._t("edit_dock")}
                          title=${this._t("edit_dock")}
                          @click=${this._editDock}
                        >
                          <ha-svg-icon
                            .path=${dock.length ? mdiPencilOutline : mdiPlus}
                          ></ha-svg-icon>
                        </button>`
                      : nothing
                  }
                </nav>`
              : nothing
          }
        </section>

        <aside class="rail">
          <div class="rail-head">
            <h2>${this._t("areas")}</h2>
            <div class="rail-actions">
              ${
                isAdmin
                  ? html`<button
                      class="link ${this._editAreas ? "active" : ""}"
                      aria-pressed=${this._editAreas ? "true" : "false"}
                      @click=${this._toggleEditAreas}
                    >
                      ${this._editAreas ? this._t("done") : this._t("edit_areas")}
                    </button>`
                  : nothing
              }
              <button class="link" @click=${this._openDevices}>
                ${this._t("all_devices")} ›
              </button>
            </div>
          </div>
          ${this._renderFloors()} ${this._renderScenes()}
          ${this._renderAlerts(openings)}
        </aside>
      </div>
    `;
  }

  private _metrics(
    lightsOnCount: number,
    alarm: HassEntity | undefined,
    alarmArmed: boolean
  ): Metric[] {
    const hass = this.hass!;
    const index = getSceneIndex(hass);
    const metrics: Metric[] = [];

    if (index.byDomain.light?.length) {
      metrics.push({
        key: "light",
        value: lightsOnCount
          ? this._t("on_count", { count: lightsOnCount })
          : this._t("off"),
        label: this._t("lights"),
        color: lightsOnCount ? "var(--scene-light)" : "var(--scene-text3)",
        action: hass.panels.light ? () => navigate("/light") : undefined,
      });
    }

    const temps = Object.values(hass.areas)
      .map((a) =>
        a.temperature_entity_id
          ? hass.states[a.temperature_entity_id]
          : undefined
      )
      .filter((s): s is HassEntity => !!s);
    const tempValues = temps
      .map((s) => numericState(s))
      .filter((v): v is number => v !== undefined);
    if (tempValues.length) {
      const avg = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;
      const climates = statesOf(hass, index.byDomain.climate);
      const heating = climates.some(
        (c) => c.attributes.hvac_action === "heating"
      );
      const cooling = climates.some(
        (c) => c.attributes.hvac_action === "cooling"
      );
      metrics.push({
        key: "inside",
        value: `${this._fmt(avg)}°`,
        label: heating
          ? this._t("inside_heating")
          : cooling
            ? this._t("inside_cooling")
            : this._t("inside"),
        color: heating
          ? "var(--scene-heat)"
          : cooling
            ? "var(--scene-cool)"
            : "var(--scene-text3)",
        action: hass.panels.climate ? () => navigate("/climate") : undefined,
      });
    }

    const weather = statesOf(hass, index.byDomain.weather)[0];
    if (weather && typeof weather.attributes.temperature === "number") {
      metrics.push({
        key: "outside",
        value: `${this._fmt(weather.attributes.temperature)}°`,
        label: `${this._t("outside")} · ${hass.formatEntityState(weather)}`,
        color: "var(--scene-cool)",
        action: () => this._moreInfo(weather.entity_id),
      });
    }

    const powerId = this._config?.power_entity;
    const power = powerId ? hass.states[powerId] : undefined;
    if (power) {
      metrics.push({
        key: "power",
        value: hass.formatEntityState(power),
        label: this._t("power"),
        color: "var(--scene-energy)",
        action: () => this._moreInfo(power.entity_id),
      });
    }

    if (alarm) {
      metrics.push({
        key: "alarm",
        value: hass.formatEntityState(alarm),
        label: this._t("security"),
        color: alarmArmed ? "var(--scene-cool)" : "var(--scene-text3)",
        action: () => this._moreInfo(alarm.entity_id),
      });
    }
    return metrics;
  }

  private _houseModel(lightsOn: HassEntity[]): HouseModel {
    const hass = this.hass!;
    const index = getSceneIndex(hass);
    const areaGlow = (areaId: string) => {
      const on = statesOf(hass, index.byArea[areaId]).filter(
        (s) => computeDomain(s.entity_id) === "light" && isLightOn(s)
      );
      if (!on.length) {
        return 0;
      }
      const bri = averageBrightness(on) ?? 100;
      return 0.45 + (0.55 * bri) / 100;
    };
    const hierarchy = getAreasFloorHierarchy(
      Object.values(hass.floors),
      Object.values(hass.areas)
    );
    const levelOf = (floorId: string) => hass.floors[floorId]?.level ?? 0;
    const floors = hierarchy.floors
      .filter((f) => levelOf(f.id) >= 0)
      .map((f) => ({
        id: f.id,
        rooms: f.areas.map((a) => ({ id: a, glow: areaGlow(a) })),
      }));
    let outside = 0;
    if (!floors.length) {
      floors.push({
        id: "_",
        rooms: hierarchy.areas.map((a) => ({ id: a, glow: areaGlow(a) })),
      });
    } else {
      outside = Math.max(0, ...hierarchy.areas.map(areaGlow));
    }
    if (lightsOn.some((l) => !index.areaOf[l.entity_id])) {
      outside = Math.max(outside, 1);
    }
    return { floors, outside, any: lightsOn.length > 0 };
  }

  private _dockItems(): string[] {
    if (this._config?.dock_items) {
      return this._config.dock_items;
    }
    if (this._config?.favorite_entities?.length) {
      return this._config.favorite_entities;
    }
    return DEFAULT_DOCK_ITEMS;
  }

  private _dock(): DockItem[] {
    return this._dockItems()
      .map((item) => {
        const group = dockGroupOf(item);
        return group ? this._dockGroup(group) : this._dockEntity(item);
      })
      .filter((d): d is DockItem => d !== undefined);
  }

  private _dockEntity(entityId: string): DockItem | undefined {
    const hass = this.hass!;
    const s = hass.states[entityId];
    if (!s) {
      return undefined;
    }
    return {
      key: entityId,
      name:
        hass.formatEntityName(s, [{ type: "entity" }]) ||
        hass.formatEntityName(s, undefined),
      state: hass.formatEntityState(s),
      on: stateActive(s),
      stateObj: s,
      action: () =>
        isToggleable(entityId)
          ? callToggle(hass, entityId)
          : this._moreInfo(entityId),
    };
  }

  private _dockGroup(group: DockGroup): DockItem | undefined {
    const hass = this.hass!;
    const index = getSceneIndex(hass);
    const byDomain = (domain: string) =>
      statesOf(hass, index.byDomain[domain]).filter(isAvailable);
    const icon = DOCK_GROUP_ICONS[group];
    const name = this._t(`dock_groups.${group}`);
    const key = `${DOCK_GROUP_PREFIX}${group}`;

    if (group === "lights") {
      const lights = byDomain("light");
      if (!lights.length) {
        return undefined;
      }
      const on = lights.filter(isLightOn);
      return {
        key,
        name,
        icon,
        on: on.length > 0,
        state: on.length
          ? this._t("on_count", { count: on.length })
          : this._t("off"),
        action: () => {
          if (on.length) {
            hass.callService("light", "turn_off", {
              entity_id: on.map((l) => l.entity_id),
            });
          } else if (hass.panels.light) {
            navigate("/light");
          }
        },
      };
    }

    if (group === "climate") {
      const climates = byDomain("climate");
      if (!climates.length) {
        return undefined;
      }
      const active = climates.filter((c) => c.state !== "off");
      const cur = climates
        .map((c) => c.attributes.current_temperature)
        .find((v) => typeof v === "number");
      return {
        key,
        name,
        icon,
        on: active.length > 0,
        state: active.length
          ? cur !== undefined
            ? `${this._fmt(cur)}°`
            : this._t("on_count", { count: active.length })
          : this._t("off"),
        action: () =>
          hass.panels.climate
            ? navigate("/climate")
            : this._moreInfo(climates[0].entity_id),
      };
    }

    if (group === "locks") {
      const locks = byDomain("lock");
      if (!locks.length) {
        return undefined;
      }
      const allLocked = locks.every((l) => l.state === "locked");
      return {
        key,
        name,
        icon: allLocked ? icon : mdiLockOpenVariant,
        on: allLocked,
        state: allLocked ? this._t("locked") : this._t("unlocked"),
        action: () =>
          this._moreInfo(
            locks.find((l) => l.state !== "locked")?.entity_id ??
              locks[0].entity_id
          ),
      };
    }

    if (group === "covers" || group === "gates") {
      const covers = byDomain("cover").filter((c) =>
        group === "gates"
          ? GATE_CLASSES.includes(c.attributes.device_class || "")
          : !c.attributes.device_class ||
            COVER_DOCK_CLASSES.includes(c.attributes.device_class)
      );
      if (!covers.length) {
        return undefined;
      }
      const closed = covers.every((c) => c.state === "closed");
      if (group === "gates") {
        return {
          key,
          name,
          icon,
          on: !closed,
          state: closed ? this._t("closed") : this._t("open"),
          action: () =>
            this._moreInfo(
              covers.find((c) => c.state !== "closed")?.entity_id ??
                covers[0].entity_id
            ),
        };
      }
      return {
        key,
        name,
        icon,
        on: closed,
        state: closed ? this._t("closed") : this._t("open"),
        action: () =>
          hass.callService("cover", closed ? "open_cover" : "close_cover", {
            entity_id: covers.map((c) => c.entity_id),
          }),
      };
    }

    if (group === "security") {
      const alarm = byDomain("alarm_control_panel")[0];
      if (!alarm) {
        return undefined;
      }
      return {
        key,
        name,
        icon,
        on: alarm.state !== "disarmed",
        state: hass.formatEntityState(alarm),
        action: () => this._moreInfo(alarm.entity_id),
      };
    }

    const players = byDomain("media_player");
    if (!players.length) {
      return undefined;
    }
    const playing = players.filter((p) => p.state === "playing");
    return {
      key,
      name,
      icon,
      on: playing.length > 0,
      state: playing.length
        ? this._t("playing_count", { count: playing.length })
        : this._t("off"),
      action: () => this._moreInfo((playing[0] ?? players[0]).entity_id),
    };
  }

  private _editDock = () => {
    showEditHomeDockDialog(this, {
      items: this._dockItems(),
      saveItems: async (items) => {
        const conn = this.hass!.connection;
        const current = (await fetchFrontendSystemData(conn, "home")) ?? {};
        await saveFrontendSystemData(conn, "home", {
          ...current,
          dock_items: items,
        });
      },
    });
  };

  private _editPicture = () => {
    showEditHomePictureDialog(this, {
      picture: this._config?.home_picture,
      savePicture: async (picture) => {
        const conn = this.hass!.connection;
        const current = (await fetchFrontendSystemData(conn, "home")) ?? {};
        await saveFrontendSystemData(conn, "home", {
          ...current,
          home_picture: picture ?? undefined,
        });
      },
    });
  };

  private _addArea = async () => {
    const hass = this.hass!;
    await hass.loadFragmentTranslation("config");
    showAreaRegistryDetailDialog(this, {
      createEntry: (values) => createAreaRegistryEntry(hass, values),
    });
  };

  private _hierarchy(): AreasFloorHierarchy {
    const hass = this.hass!;
    return getAreasFloorHierarchy(
      Object.values(hass.floors),
      Object.values(hass.areas)
    );
  }

  private _renderFloors() {
    const hass = this.hass!;
    const index = getSceneIndex(hass);
    const hierarchy = this._hierarchy();
    const edit = this._editAreas;
    const floorGroups = hierarchy.floors
      .map((f) => ({
        key: f.id,
        name: hass.floors[f.id]?.name ?? "",
        areas: f.areas,
        floor: hass.floors[f.id] as FloorRegistryEntry | undefined,
      }))
      .filter((g) => edit || g.areas.length);
    const showOther = edit || hierarchy.areas.length > 0;
    if (!floorGroups.length && !showOther) {
      return html`<p class="summary">${this._t("no_areas")}</p>`;
    }

    const renderGroup = (g: {
      key: string;
      name: string;
      areas: string[];
      floor?: FloorRegistryEntry;
    }) => {
      const withLights = g.areas.filter((a) =>
        statesOf(hass, index.byArea[a]).some(
          (s) => computeDomain(s.entity_id) === "light"
        )
      );
      const lit = withLights.filter((a) =>
        statesOf(hass, index.byArea[a]).some(
          (s) => computeDomain(s.entity_id) === "light" && isLightOn(s)
        )
      );
      return html`
        <div class="group floor-group" .sortableData=${g.floor}>
          <div class="group-head">
            ${
              edit && g.floor
                ? html`<span class="floor-handle" title=${this._t("drag")}>
                    <ha-svg-icon
                      .path=${mdiDragHorizontalVariant}
                    ></ha-svg-icon>
                  </span>`
                : nothing
            }
            <span class="title">${g.name}</span>
            ${
              edit
                ? html`<span class="edit-actions">
                    <button
                      class="mini-btn"
                      data-floor=${g.key}
                      @click=${this._addAreaToFloor}
                    >
                      + ${this._t("add_area")}
                    </button>
                    ${
                      g.floor
                        ? html`<ha-icon-button
                              .label=${this._t("edit_floor")}
                              .path=${mdiPencilOutline}
                              data-floor=${g.key}
                              @click=${this._editFloor}
                            ></ha-icon-button>
                            <ha-icon-button
                              .label=${this._t("delete_floor")}
                              .path=${mdiDeleteOutline}
                              data-floor=${g.key}
                              @click=${this._deleteFloor}
                            ></ha-icon-button>`
                        : nothing
                    }
                  </span>`
                : html`<span class="meta">
                    ${
                      withLights.length
                        ? lit.length
                          ? this._t("lit_in", {
                              lit: lit.length,
                              total: withLights.length,
                            })
                          : this._t("lights_off")
                        : nothing
                    }
                  </span>`
            }
          </div>
          ${
            edit
              ? html`<ha-sortable
                  group="scene-areas"
                  draggable-selector=".area-card"
                  .options=${SORT_OPTIONS}
                  .floor=${g.key}
                  @item-moved=${this._areaMoved}
                  @item-added=${this._areaAdded}
                >
                  <div class="areas editing">
                    ${g.areas.map((a) => this._renderArea(a))}
                    ${
                      g.areas.length
                        ? nothing
                        : html`<p class="drop-hint">${this._t("drop_here")}</p>`
                    }
                  </div>
                </ha-sortable>`
              : html`<div class="areas">
                  ${g.areas.map((a) => this._renderArea(a))}
                </div>`
          }
        </div>
      `;
    };

    return html`
      ${
        edit
          ? html`<ha-sortable
              handle-selector=".floor-handle"
              draggable-selector=".floor-group"
              @item-moved=${this._floorMoved}
            >
              <div class="floors">${floorGroups.map(renderGroup)}</div>
            </ha-sortable>`
          : floorGroups.map(renderGroup)
      }
      ${
        showOther
          ? renderGroup({
              key: UNASSIGNED,
              name: floorGroups.length ? this._t("other_areas") : "",
              areas: hierarchy.areas,
            })
          : nothing
      }
      ${
        edit
          ? html`<div class="edit-footer">
              <button class="chip" @click=${this._addFloor}>
                <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                <span>${this._t("add_floor")}</span>
              </button>
              <button class="chip" @click=${this._addArea}>
                <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                <span>${this._t("add_area")}</span>
              </button>
            </div>`
          : nothing
      }
    `;
  }

  private _renderArea(areaId: string) {
    const hass = this.hass!;
    const area = hass.areas[areaId];
    if (!area) {
      return nothing;
    }
    const edit = this._editAreas;
    const index = getSceneIndex(hass);
    const all = statesOf(hass, index.byArea[areaId]);
    const lights = all.filter((s) => computeDomain(s.entity_id) === "light");
    const lightsOn = lights.filter(isLightOn);
    const on = lightsOn.length > 0;
    const opening = all.find(isOpening);
    const cover = all.find((s) => computeDomain(s.entity_id) === "cover");
    const temp = area.temperature_entity_id
      ? hass.states[area.temperature_entity_id]
      : undefined;
    const tempValue = numericState(temp);

    const info: string[] = [];
    if (on) {
      const bri = averageBrightness(lightsOn);
      info.push(
        bri !== undefined
          ? this._t("light_pct", { value: bri })
          : this._t("light_on")
      );
    }
    if (opening) {
      info.push(
        this._t("entity_open", {
          name: hass.formatEntityName(opening, [{ type: "entity" }]),
        })
      );
    }
    if (!info.length) {
      const deviceCount = Object.values(hass.devices).filter(
        (d) => d.area_id === areaId
      ).length;
      if (deviceCount) {
        info.push(this._t("devices_count", { count: deviceCount }));
      }
    }
    if (cover && info.length < 2) {
      info.push(
        `${hass.formatEntityName(cover, [{ type: "entity" }])} ${hass.formatEntityState(cover).toLowerCase()}`
      );
    }

    return html`
      <div
        class="area-card ${on ? "lit" : ""} ${edit ? "edit" : ""}"
        .sortableData=${area}
      >
        ${
          edit
            ? nothing
            : html`<button
                class="area-hit"
                aria-label=${area.name}
                data-area=${areaId}
                @click=${this._areaClicked}
              ></button>`
        }
        <div class="area-top">
          <div class="area-text">
            <span class="area-name">${area.name}</span>
            <span class="area-info ${opening ? "warn" : ""}">
              ${info.join(" · ")}
            </span>
          </div>
          ${
            edit
              ? html`<span class="area-edit">
                  <ha-icon-button
                    .label=${this._t("edit_area")}
                    .path=${mdiPencilOutline}
                    data-area=${areaId}
                    @click=${this._editArea}
                  ></ha-icon-button>
                  <ha-icon-button
                    .label=${this._t("delete_area")}
                    .path=${mdiDeleteOutline}
                    data-area=${areaId}
                    @click=${this._deleteArea}
                  ></ha-icon-button>
                </span>`
              : lights.length
                ? html`<button
                    class="toggle"
                    aria-label=${this._t("toggle_area_lights", {
                      area: area.name,
                    })}
                    aria-pressed=${on ? "true" : "false"}
                    data-area=${areaId}
                    @click=${this._toggleAreaLights}
                  >
                    <span class="track"><span class="knob"></span></span>
                  </button>`
                : nothing
          }
        </div>
        <div class="area-bottom">
          <span class="area-temp">
            ${tempValue !== undefined ? `${this._fmt(tempValue)}°` : "\u00a0"}
          </span>
          ${
            lights.length && !edit
              ? html`<span class="area-label">
                  ${on ? this._t("light_label") : this._t("off_label")}
                </span>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _toggleAreaLights(ev: Event) {
    ev.stopPropagation();
    const hass = this.hass!;
    const areaId = (ev.currentTarget as HTMLElement).dataset.area!;
    const lights = statesOf(hass, getSceneIndex(hass).byArea[areaId]).filter(
      (s) => computeDomain(s.entity_id) === "light"
    );
    const on = lights.filter(isLightOn);
    hass.callService("light", on.length ? "turn_off" : "turn_on", {
      entity_id: (on.length ? on : lights).map((l) => l.entity_id),
    });
  }

  private _toggleMenu() {
    fireEvent(this, "hass-toggle-menu");
  }

  private _search() {
    fireEvent(this, "hui-root-action", { action: "search" });
  }

  private _assist() {
    fireEvent(this, "hui-root-action", { action: "assist" });
  }

  private _addSelected(ev: HaDropdownSelectEvent<RootAction>) {
    const action = ev.detail.item.value;
    if (action) {
      fireEvent(this, "hui-root-action", { action });
    }
  }

  private _toggleEditAreas() {
    this._editAreas = !this._editAreas;
    editAreasActive = this._editAreas;
  }

  private async _loadConfigTranslations() {
    await this.hass!.loadFragmentTranslation("config");
  }

  private async _addAreaToFloor(ev: Event) {
    const floor = (ev.currentTarget as HTMLElement).dataset.floor;
    const hass = this.hass!;
    await this._loadConfigTranslations();
    showAreaRegistryDetailDialog(this, {
      createEntry: (values) =>
        createAreaRegistryEntry(hass, {
          ...values,
          floor_id: floor === UNASSIGNED ? null : (floor ?? null),
        }),
    });
  }

  private async _editArea(ev: Event) {
    const hass = this.hass!;
    const area = hass.areas[(ev.currentTarget as HTMLElement).dataset.area!];
    if (!area) {
      return;
    }
    await this._loadConfigTranslations();
    showAreaRegistryDetailDialog(this, {
      entry: area,
      updateEntry: (values) =>
        updateAreaRegistryEntry(hass.callWS, area.area_id, values),
    });
  }

  private async _deleteArea(ev: Event) {
    const hass = this.hass!;
    const area = hass.areas[(ev.currentTarget as HTMLElement).dataset.area!];
    if (!area) {
      return;
    }
    await this._loadConfigTranslations();
    const confirmed = await showConfirmationDialog(this, {
      title: hass.localize("ui.panel.config.areas.delete.confirmation_title", {
        name: area.name,
      }),
      text: hass.localize("ui.panel.config.areas.delete.confirmation_text"),
      confirmText: hass.localize("ui.common.delete"),
      dismissText: hass.localize("ui.common.cancel"),
      destructive: true,
    });
    if (confirmed) {
      await deleteAreaRegistryEntry(hass, area.area_id);
    }
  }

  private async _addFloor() {
    await this._openFloorDialog();
  }

  private async _editFloor(ev: Event) {
    const floor =
      this.hass!.floors[(ev.currentTarget as HTMLElement).dataset.floor!];
    await this._openFloorDialog(floor);
  }

  private async _openFloorDialog(entry?: FloorRegistryEntry) {
    const hass = this.hass!;
    await this._loadConfigTranslations();
    showFloorRegistryDetailDialog(this, {
      entry,
      createEntry: async (values, addedAreas) => {
        const floor = await createFloorRegistryEntry(hass.callWS, {
          ...values,
          level: values.level ?? Object.keys(hass.floors).length,
        });
        addedAreas.forEach((areaId) => {
          updateAreaRegistryEntry(hass.callWS, areaId, {
            floor_id: floor.floor_id,
          });
        });
      },
      updateEntry: async (values, addedAreas, removedAreas) => {
        const floor = await updateFloorRegistryEntry(
          hass,
          entry!.floor_id,
          values
        );
        addedAreas.forEach((areaId) => {
          updateAreaRegistryEntry(hass.callWS, areaId, {
            floor_id: floor.floor_id,
          });
        });
        removedAreas.forEach((areaId) => {
          updateAreaRegistryEntry(hass.callWS, areaId, { floor_id: null });
        });
      },
    });
  }

  private async _deleteFloor(ev: Event) {
    const hass = this.hass!;
    const floor = hass.floors[(ev.currentTarget as HTMLElement).dataset.floor!];
    if (!floor) {
      return;
    }
    await this._loadConfigTranslations();
    const confirmed = await showConfirmationDialog(this, {
      title: hass.localize("ui.panel.config.areas.picker.floor.confirm_delete"),
      text: hass.localize(
        "ui.panel.config.areas.picker.floor.confirm_delete_text"
      ),
      confirmText: hass.localize("ui.common.delete"),
      dismissText: hass.localize("ui.common.cancel"),
      destructive: true,
    });
    if (confirmed) {
      await deleteFloorRegistryEntry(hass, floor.floor_id);
    }
  }

  private async _floorMoved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>) {
    ev.stopPropagation();
    const hass = this.hass!;
    const { oldIndex, newIndex } = ev.detail;
    const ids = this._hierarchy().floors.map((f) => f.id);
    const [moved] = ids.splice(oldIndex, 1);
    ids.splice(newIndex, 0, moved);
    await reorderFloorRegistryEntries(hass, ids);
    await Promise.all(
      ids.map((id, level) =>
        hass.floors[id]?.level === level
          ? undefined
          : updateFloorRegistryEntry(hass, id, { level })
      )
    );
  }

  private async _areaMoved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>) {
    ev.stopPropagation();
    const floor = (ev.currentTarget as HTMLElement & { floor: string }).floor;
    const { oldIndex, newIndex } = ev.detail;
    const hierarchy = this._hierarchy();
    const move = (areas: string[]) => {
      const next = [...areas];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    };
    const updated: AreasFloorHierarchy = {
      floors: hierarchy.floors.map((f) =>
        f.id === floor ? { ...f, areas: move(f.areas) } : f
      ),
      areas: floor === UNASSIGNED ? move(hierarchy.areas) : hierarchy.areas,
    };
    await reorderAreaRegistryEntries(this.hass!, getAreasOrder(updated));
  }

  private async _areaAdded(ev: HASSDomEvent<HASSDomEvents["item-added"]>) {
    ev.stopPropagation();
    const floor = (ev.currentTarget as HTMLElement & { floor: string }).floor;
    const area = ev.detail.data as AreaRegistryEntry;
    const newFloor = floor === UNASSIGNED ? null : floor;
    const hierarchy = this._hierarchy();
    const insert = (areas: string[]) => {
      const next = areas.filter((id) => id !== area.area_id);
      next.splice(ev.detail.index, 0, area.area_id);
      return next;
    };
    const updated: AreasFloorHierarchy = {
      floors: hierarchy.floors.map((f) =>
        f.id === newFloor
          ? { ...f, areas: insert(f.areas) }
          : { ...f, areas: f.areas.filter((id) => id !== area.area_id) }
      ),
      areas:
        newFloor === null
          ? insert(hierarchy.areas)
          : hierarchy.areas.filter((id) => id !== area.area_id),
    };
    await reorderAreaRegistryEntries(this.hass!, getAreasOrder(updated));
    await updateAreaRegistryEntry(this.hass!.callWS, area.area_id, {
      floor_id: newFloor,
    });
  }

  private _renderScenes() {
    const hass = this.hass!;
    const scenes = statesOf(hass, getSceneIndex(hass).byDomain.scene);
    if (!scenes.length) {
      return nothing;
    }
    const recent = scenes
      .filter((s) => !Number.isNaN(Date.parse(s.state)))
      .sort((a, b) => Date.parse(b.state) - Date.parse(a.state))[0];
    const activeId =
      recent && Date.now() - Date.parse(recent.state) < 4 * 3600 * 1000
        ? recent.entity_id
        : undefined;
    return html`
      <div class="group">
        <div class="group-head">
          <span class="title">${this._t("scenes")}</span>
        </div>
        <div class="chips">
          ${scenes.slice(0, 10).map(
            (s) => html`
              <button
                class="chip"
                aria-pressed=${s.entity_id === activeId ? "true" : "false"}
                data-entity=${s.entity_id}
                @click=${this._sceneClicked}
              >
                <ha-state-icon .hass=${hass} .stateObj=${s}></ha-state-icon>
                <span>${hass.formatEntityName(s, [{ type: "entity" }])}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  private _renderAlerts(openings: HassEntity[]) {
    const hass = this.hass!;
    const index = getSceneIndex(hass);
    const alerts: Alert[] = [];

    for (const o of openings.slice(0, 3)) {
      alerts.push({
        key: o.entity_id,
        title: this._t("entity_open", {
          name: hass.formatEntityName(o, [
            { type: "area" },
            { type: "entity" },
          ]),
        }),
        sub: hass.formatEntityState(o),
        color: "var(--scene-warn)",
        stateObj: o,
        action: () => this._moreInfo(o.entity_id),
      });
    }

    const lowBattery = statesOf(hass, index.byDomain.sensor).filter(
      (s) =>
        s.attributes.device_class === "battery" && (numericState(s) ?? 100) < 20
    );
    for (const b of lowBattery.slice(0, 3)) {
      alerts.push({
        key: b.entity_id,
        title: hass.formatEntityName(b, undefined),
        sub: this._t("battery", { value: hass.formatEntityState(b) }),
        color: "var(--scene-alert)",
        stateObj: b,
        action: () => this._moreInfo(b.entity_id),
      });
    }

    const updates = statesOf(hass, index.byDomain.update).filter(
      (u) => u.state === "on"
    );
    if (updates.length && hass.user?.is_admin) {
      alerts.push({
        key: "updates",
        title: this._t("updates_available"),
        sub: this._t("updates_count", { count: updates.length }),
        color: "var(--scene-cool)",
        stateObj: updates[0],
        action: () => navigate("/config/updates"),
      });
    }

    if (this._repairs.length) {
      alerts.push({
        key: "repairs",
        title: this._t("repairs"),
        sub: this._t("repairs_count", { count: this._repairs.length }),
        color: "var(--scene-alert)",
        icon: mdiShieldCheck,
        action: () => navigate("/config/repairs"),
      });
    }

    if (!alerts.length) {
      return nothing;
    }

    return html`
      <div class="group alerts">
        <div class="group-head">
          <span class="title">${this._t("attention")}</span>
        </div>
        <div>
          ${alerts.map(
            (a) => html`
              <button class="list-row" @click=${a.action}>
                <span
                  class="round-icon"
                  style=${styleMap({ "--icon-color": a.color })}
                >
                  ${
                    a.stateObj
                      ? html`<ha-state-icon
                          .hass=${hass}
                          .stateObj=${a.stateObj}
                        ></ha-state-icon>`
                      : html`<ha-svg-icon .path=${a.icon}></ha-svg-icon>`
                  }
                </span>
                <span class="row-text">
                  <span class="primary">${a.title}</span>
                  <span class="secondary">${a.sub}</span>
                </span>
                <ha-svg-icon
                  class="chevron"
                  .path=${mdiChevronRight}
                ></ha-svg-icon>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  private _areaClicked(ev: Event) {
    const areaId = (ev.currentTarget as HTMLElement).dataset.area;
    navigate(`${dashboardBasePath()}/areas-${areaId}`);
  }

  private _sceneClicked(ev: Event) {
    this.hass!.callService("scene", "turn_on", {
      entity_id: (ev.currentTarget as HTMLElement).dataset.entity,
    });
  }

  private _openDevices = () => {
    navigate("/config/devices/dashboard");
  };

  static styles = [
    sceneStyles,
    css`
      :host {
        --scene-min-height: calc(
          100vh - var(--safe-area-inset-top, 0px) - var(
              --view-container-padding-top,
              0px
            )
        );
      }

      .intro {
        padding-top: 0;
      }

      .dock {
        flex-wrap: nowrap;
        justify-content: safe center;
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: 2px;
      }

      .dock::-webkit-scrollbar {
        display: none;
      }

      .dock-item,
      .dock-edit {
        flex: none;
      }

      @media (min-width: 1101px) and (min-height: 640px) {
        .layout {
          height: var(--scene-min-height);
        }

        .stage {
          min-height: 0;
          gap: var(--ha-space-4);
        }

        .rail {
          max-height: 100%;
        }

        .visual {
          flex: 1 1 0;
          min-height: 0;
        }

        .visual svg.house {
          width: 100%;
          height: 100%;
          max-height: 100%;
        }

        .home-photo {
          width: auto;
          height: 100%;
          max-width: 100%;
        }
      }

      .areas {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
        gap: 10px;
      }

      .area-card {
        position: relative;
        height: 136px;
        box-sizing: border-box;
        padding: 14px 8px 14px 16px;
        border-radius: var(--ha-area-card-border-radius, 24px);
        border: 1px solid var(--scene-bd);
        background: var(--ha-card-background, var(--card-background-color));
        box-shadow: var(--scene-shadow);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 6px;
        overflow: hidden;
        transition:
          background 300ms ease,
          border-color 300ms ease,
          transform 150ms ease;
      }

      .area-card:not(.edit):hover {
        border-color: var(--scene-bd2);
      }

      .area-card.lit {
        background: linear-gradient(
          160deg,
          color-mix(in srgb, #f2b45a 17%, var(--card-background-color)) 0%,
          var(--card-background-color) 70%
        );
        border-color: color-mix(in srgb, #f2b45a 38%, transparent);
      }

      .area-card.edit {
        cursor: grab;
        border-style: dashed;
      }

      .area-hit {
        position: absolute;
        inset: 0;
        border: 0;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
        border-radius: inherit;
        z-index: 0;
      }

      .area-top {
        position: relative;
        z-index: 1;
        pointer-events: none;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 6px;
        min-width: 0;
      }

      .area-top .toggle,
      .area-edit {
        pointer-events: auto;
      }

      .area-edit {
        display: flex;
        margin: -6px -2px 0 0;
        --ha-icon-button-size: 36px;
        --mdc-icon-size: 18px;
        color: var(--scene-text2);
      }

      .area-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding-top: 4px;
      }

      .area-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--scene-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .area-info {
        font-size: 12px;
        color: var(--scene-text2);
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .area-info.warn {
        color: var(--scene-warn);
      }

      .area-bottom {
        position: relative;
        z-index: 1;
        pointer-events: none;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        padding-inline-end: 8px;
        min-height: 36px;
      }

      .area-temp {
        font-size: 30px;
        font-weight: 300;
        letter-spacing: -0.02em;
      }

      .area-label {
        font-size: 11px;
        letter-spacing: 0.14em;
        font-weight: 600;
        color: var(--scene-text3);
        text-transform: uppercase;
      }

      .area-card.lit .area-label {
        color: var(--scene-light);
      }

      .floors {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-7);
      }

      .floor-handle {
        cursor: grab;
        color: var(--scene-text2);
        display: flex;
        --mdc-icon-size: 18px;
        margin-inline-end: 6px;
      }

      .group-head .title {
        flex: 1;
      }

      .edit-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        --ha-icon-button-size: 32px;
        --mdc-icon-size: 18px;
        color: var(--scene-text2);
      }

      .mini-btn {
        height: 28px;
        padding: 0 10px;
        border-radius: 14px;
        border: 1px solid var(--scene-bd);
        background: transparent;
        color: var(--scene-text2);
        font-size: 12px;
        cursor: pointer;
      }

      .areas.editing {
        min-height: 60px;
        border-radius: 24px;
        outline: 1px dashed var(--scene-bd);
        outline-offset: 4px;
      }

      .drop-hint {
        grid-column: 1 / -1;
        margin: 0;
        padding: 18px 0;
        text-align: center;
        font-size: 13px;
        color: var(--scene-text3);
      }

      .edit-footer {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ha-space-2);
      }

      .link.active {
        color: var(--scene-text);
        font-weight: 500;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ha-space-3);
      }

      .topbar-start,
      .topbar-actions {
        display: flex;
        align-items: center;
        gap: var(--ha-space-3);
        min-width: 0;
      }

      .topbar-start {
        flex: 1 1 auto;
      }

      .topbar-actions {
        flex: none;
        gap: var(--ha-space-2);
      }

      @media (max-width: 600px) {
        .topbar-start,
        .topbar-actions {
          gap: var(--ha-space-1);
        }
      }

      .topbar .circle-btn {
        color: var(--scene-text2);
        flex: none;
      }

      .topbar .overline {
        min-width: 0;
      }

      .topbar .overline span:last-child {
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .alerts .group-head {
        padding-bottom: 6px;
      }

      .metric[disabled] {
        cursor: default;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-home-scene-card": HuiHomeSceneCard;
  }
}
