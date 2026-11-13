import { mdiMenu } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import type { DateRange } from "../../../../common/datetime/calc_date_range";
import { calcDateRange } from "../../../../common/datetime/calc_date_range";
import { formatRangeTitle } from "../../../../common/datetime/format_range_title";
import { fireEvent } from "../../../../common/dom/fire_event";
import { formatNumber } from "../../../../common/number/format_number";
import "../../../../components/ha-svg-icon";
import type { EnergyData } from "../../../../data/energy";
import { computeConsumptionData, getSummedData } from "../../../../data/energy";
import { EnergyCollectionController } from "../../../../data/energy-collection-controller";
import type { HomeAssistant } from "../../../../types";
import "../../components/hui-energy-period-selector";
import type { LovelaceCard, LovelaceGridOptions } from "../../types";
import type { EnergyHeadingCardConfig } from "../types";

const PERIODS: { id: string; range: DateRange }[] = [
  { id: "day", range: "today" },
  { id: "week", range: "this_week" },
  { id: "month", range: "this_month" },
  { id: "year", range: "this_year" },
];

@customElement("hui-energy-heading-card")
export class HuiEnergyHeadingCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: EnergyHeadingCardConfig;

  @state() private _data?: EnergyData;

  private _collection: EnergyCollectionController;

  constructor() {
    super();
    this._collection = new EnergyCollectionController(this, {
      config: () => this._config,
      onData: (data) => {
        this._data = data;
      },
    });
  }

  public setConfig(config: EnergyHeadingCardConfig): void {
    this._config = config;
  }

  public getCardSize(): number {
    return 2;
  }

  public getGridOptions(): LovelaceGridOptions {
    return { columns: "full", rows: "auto" };
  }

  private _fmt(value: number) {
    return formatNumber(value, this.hass!.locale, {
      maximumFractionDigits: value < 100 ? 1 : 0,
    });
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    const hass = this.hass;
    const data = this._data;
    let total: number | undefined;
    const parts: string[] = [];
    if (data) {
      const { summedData } = getSummedData(data);
      const { consumption } = computeConsumptionData(summedData);
      total = consumption.total.used_total;
      const sources: [number, string][] = [
        [
          consumption.total.used_grid,
          "ui.panel.lovelace.cards.energy.energy_distribution.grid",
        ],
        [
          consumption.total.used_solar,
          "ui.panel.lovelace.cards.energy.energy_distribution.solar",
        ],
        [
          consumption.total.used_battery,
          "ui.panel.lovelace.cards.energy.energy_distribution.battery",
        ],
      ];
      for (const [value, key] of sources) {
        if (value > 0) {
          parts.push(`${hass.localize(key as any)} ${this._fmt(value)} kWh`);
        }
      }
    }
    const period = data
      ? formatRangeTitle(
          data.start,
          data.end ?? new Date(),
          hass.locale,
          hass.config
        )
      : "";

    return html`
      <div class="heading">
        <div class="text">
          <div class="overline">
            ${
              this._config.show_menu
                ? html`<button
                    class="menu"
                    aria-label=${hass.localize("ui.sidebar.sidebar_toggle")}
                    title=${hass.localize("ui.sidebar.sidebar_toggle")}
                    @click=${this._toggleMenu}
                  >
                    <ha-svg-icon .path=${mdiMenu}></ha-svg-icon>
                  </button>`
                : nothing
            }
            <span>
              ${hass.localize("panel.energy")}${period ? ` · ${period}` : ""}
            </span>
          </div>
          <div class="total">
            <span class="big">
              ${total !== undefined ? this._fmt(total) : "—"}
            </span>
            <span class="unit">kWh</span>
          </div>
          ${
            parts.length
              ? html`<p class="sub">${parts.join(" · ")}</p>`
              : nothing
          }
        </div>
        <div class="controls">
          <div
            class="pills"
            role="group"
            aria-label=${hass.localize(
              "ui.panel.lovelace.cards.energy_heading.period"
            )}
          >
            ${PERIODS.map(
              (p) =>
                html`<button
                  aria-pressed=${this._activePeriod() === p.id ? "true" : "false"}
                  data-range=${p.range}
                  @click=${this._pickPeriod}
                >
                  ${hass.localize(
                    `ui.panel.lovelace.cards.energy_heading.${p.id}` as any
                  )}
                </button>`
            )}
          </div>
          <hui-energy-period-selector
            .collectionKey=${this._config.collection_key}
            allow-compare
          ></hui-energy-period-selector>
        </div>
      </div>
    `;
  }

  private _activePeriod(): string | undefined {
    if (!this._data) {
      return undefined;
    }
    const end = this._data.end ?? new Date();
    const days = (end.getTime() - this._data.start.getTime()) / 86400000;
    if (days <= 1.05) {
      return "day";
    }
    if (days <= 7.05) {
      return "week";
    }
    if (days <= 31.05) {
      return "month";
    }
    if (days <= 366.05) {
      return "year";
    }
    return undefined;
  }

  private _pickPeriod(ev: Event) {
    const range = (ev.currentTarget as HTMLElement).dataset.range as DateRange;
    const collection = this._collection.collection;
    if (!collection || !this.hass) {
      return;
    }
    const [start, end] = calcDateRange(
      this.hass.locale,
      this.hass.config,
      range
    );
    collection.setPeriod(start, end);
    collection.refresh();
  }

  private _toggleMenu() {
    fireEvent(this, "hass-toggle-menu");
  }

  static styles = css`
    :host {
      display: block;
    }

    .heading {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--ha-space-5);
      padding: var(--ha-space-2) 0 var(--ha-space-3);
    }

    .text {
      display: flex;
      flex-direction: column;
      gap: var(--ha-space-2);
      min-width: 0;
    }

    .overline {
      display: flex;
      align-items: center;
      gap: var(--ha-space-3);
      font-size: 12px;
      letter-spacing: var(--ha-letter-spacing-overline, 0.24em);
      color: var(--secondary-text-color);
      font-weight: var(--ha-font-weight-medium);
      text-transform: uppercase;
    }

    .menu {
      width: 40px;
      height: 40px;
      border-radius: 20px;
      border: 1px solid var(--divider-color);
      background: transparent;
      color: var(--secondary-text-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      --mdc-icon-size: 20px;
    }

    .total {
      display: flex;
      align-items: baseline;
      gap: 14px;
      flex-wrap: wrap;
    }

    .big {
      font-size: clamp(44px, 5vw, 68px);
      line-height: 1;
      font-weight: var(--ha-font-weight-thin, 200);
      letter-spacing: -0.04em;
    }

    .unit {
      font-size: 20px;
      font-weight: 300;
      color: var(--secondary-text-color);
    }

    .sub {
      margin: 0;
      font-size: 15px;
      color: var(--secondary-text-color);
    }

    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ha-space-3);
    }

    .pills {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 22px;
      background: rgba(var(--rgb-primary-text-color), 0.05);
      border: 1px solid var(--divider-color);
    }

    .pills button {
      height: 36px;
      padding: 0 16px;
      border-radius: 18px;
      border: 0;
      background: transparent;
      color: var(--primary-text-color);
      font-family: inherit;
      font-size: 14px;
      font-weight: var(--ha-font-weight-medium);
      cursor: pointer;
    }

    .pills button[aria-pressed="true"] {
      background: var(--primary-text-color);
      color: var(--primary-background-color);
    }

    hui-energy-period-selector {
      flex: 0 1 auto;
      min-width: min(100%, 300px);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hui-energy-heading-card": HuiEnergyHeadingCard;
  }
}
