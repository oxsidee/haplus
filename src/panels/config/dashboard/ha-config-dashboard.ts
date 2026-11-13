import {
  mdiCloudLock,
  mdiDotsVertical,
  mdiMagnify,
  mdiPower,
  mdiRefresh,
} from "@mdi/js";
import type { UnsubscribeFunc } from "home-assistant-js-websocket";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import memoizeOne from "memoize-one";
import { isComponentLoaded } from "../../../common/config/is_component_loaded";
import { ctrlOrCmdLabel } from "../../../common/keyboard/ctrl-or-cmd";
import "../../../components/ha-card";
import "../../../components/ha-page-heading";
import "../../../components/ha-dropdown";
import type { HaDropdownSelectEvent } from "../../../components/ha-dropdown";
import "../../../components/ha-dropdown-item";
import "../../../components/ha-icon-button";
import "../../../components/ha-icon-next";
import "../../../components/ha-svg-icon";
import "../../../components/ha-tip";
import "../../../components/ha-tooltip";
import "../../../components/ha-top-app-bar-fixed";
import type { CloudStatus } from "../../../data/cloud";
import type { RepairsIssue } from "../../../data/repairs";
import {
  severitySort,
  subscribeRepairsIssueRegistry,
} from "../../../data/repairs";
import type { UpdateEntity } from "../../../data/update";
import {
  checkForEntityUpdates,
  filterUpdateEntitiesParameterized,
} from "../../../data/update";
import { showQuickBar } from "../../../dialogs/quick-bar/show-dialog-quick-bar";
import { showRestartDialog } from "../../../dialogs/restart/show-dialog-restart";
import { showShortcutsDialog } from "../../../dialogs/shortcuts/show-shortcuts-dialog";
import type { PageNavigation } from "../../../layouts/hass-tabs-subpage";
import { ChildPanelReady } from "../../../layouts/panel-ready";
import { SubscribeMixin } from "../../../mixins/subscribe-mixin";
import { haStyle } from "../../../resources/styles";
import type { HomeAssistant } from "../../../types";
import { documentationUrl } from "../../../util/documentation-url";
import { isMobileClient } from "../../../util/is_mobile";
import "../ha-config-section";
import { configSections } from "../config-sections";
import "../repairs/ha-config-repairs";
import "./ha-config-navigation";
import "./ha-config-updates";

type DashboardSummary<Key extends string, Item> = Record<Key, Item[]> & {
  total: number;
};

const randomTip = (openFn: any, hass: HomeAssistant, narrow: boolean) => {
  const weighted: string[] = [];
  let tips = [
    {
      content: hass.localize("ui.panel.config.tips.join", {
        forums: html`<a
          href="https://community.home-assistant.io"
          target="_blank"
          rel="noreferrer"
          >${hass.localize("ui.panel.config.tips.join_forums")}</a
        >`,
        social_media: html`<a
          href=${documentationUrl(hass, `/socials`)}
          target="_blank"
          rel="noreferrer"
          >${hass.localize("ui.panel.config.tips.social_media")}</a
        >`,
        discord: html`<a
          href=${documentationUrl(hass, `/join-chat`)}
          target="_blank"
          rel="noreferrer"
          >${hass.localize("ui.panel.config.tips.join_chat")}</a
        >`,
        blog: html`<a
          href=${documentationUrl(hass, `/blog`)}
          target="_blank"
          rel="noreferrer"
          >${hass.localize("ui.panel.config.tips.join_blog")}</a
        >`,
        newsletter: html`<span class="keep-together"
          ><a
            href="https://newsletter.openhomefoundation.org/"
            target="_blank"
            rel="noreferrer"
            >${hass.localize("ui.panel.config.tips.join_newsletter")}</a
          >
        </span>`,
      }),
      weight: 2,
      narrow: true,
    },
  ];

  if (hass?.enableShortcuts && !isMobileClient) {
    const localizeParam = {
      keyboard_shortcut: html`<a href="#" @click=${openFn}
        >${hass.localize("ui.tips.keyboard_shortcut")}</a
      >`,
    };

    if (hass.user?.is_admin) {
      tips.push({
        content: hass.localize("ui.tips.key_c_tip", localizeParam),
        weight: 1,
        narrow: false,
      });
    }
    tips.push(
      {
        content: hass.localize("ui.tips.key_m_tip", localizeParam),
        weight: 1,
        narrow: false,
      },
      {
        content: hass.localize("ui.tips.key_a_tip", localizeParam),
        weight: 1,
        narrow: false,
      },
      {
        content: hass.localize("ui.tips.key_shortcut_quick_search", {
          ...localizeParam,
          modifier: ctrlOrCmdLabel(hass.localize),
        }),
        weight: 1,
        narrow: false,
      }
    );
  }

  if (narrow) {
    tips = tips.filter((tip) => tip.narrow);
  }

  tips.forEach((tip) => {
    for (let i = 0; i < tip.weight; i++) {
      weighted.push(tip.content);
    }
  });

  return weighted[Math.floor(Math.random() * weighted.length)];
};

@customElement("ha-config-dashboard")
class HaConfigDashboard extends SubscribeMixin(LitElement) {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean, reflect: true }) public narrow = false;

  @property({ attribute: "is-wide", type: Boolean }) public isWide = false;

  @property({ attribute: false }) public cloudStatus?: CloudStatus;

  @state() private _tip?: string;

  @state() private _repairsIssues: DashboardSummary<"issues", RepairsIssue> = {
    issues: [],
    total: 0,
  };

  public constructor() {
    super();
    new ChildPanelReady(this);
  }

  private _pages = memoizeOne(
    (
      cloudStatus,
      isCloudLoaded,
      hasExternalSettings,
      isAppsInfoDismissed,
      isHassioLoaded
    ) => {
      const filterApps = (pages: PageNavigation[]) =>
        isAppsInfoDismissed && !isHassioLoaded
          ? pages.filter((page) => page.path !== "/config/apps")
          : pages;
      return [
        isCloudLoaded
          ? filterApps([
              {
                component: "cloud",
                path: "/config/cloud",
                name: "Home Assistant Cloud",
                info: cloudStatus,
                iconPath: mdiCloudLock,
                iconColor: "#3B808E",
                translationKey: "cloud",
              },
              ...configSections.dashboard,
            ])
          : filterApps(configSections.dashboard),
        hasExternalSettings ? configSections.dashboard_external_settings : [],
        configSections.dashboard_2,
        configSections.dashboard_3,
      ];
    }
  );

  public hassSubscribe(): UnsubscribeFunc[] {
    return [
      subscribeRepairsIssueRegistry(this.hass.connection!, (repairs) => {
        const repairsIssues = repairs.issues.filter((issue) => !issue.ignored);

        this._repairsIssues = {
          issues: repairsIssues
            .sort((a, b) => severitySort[a.severity] - severitySort[b.severity])
            .slice(0, repairsIssues.length === 3 ? repairsIssues.length : 2),
          total: repairsIssues.length,
        };

        const integrations = new Set<string>();
        for (const issue of this._repairsIssues.issues) {
          integrations.add(issue.domain);
        }
        this.hass.loadBackendTranslation("issues", [...integrations]);
      }),
    ];
  }

  protected render(): TemplateResult {
    const { updates: canInstallUpdates, total: totalUpdates } =
      this._filterUpdateEntitiesParameterized(
        this.hass.states,
        this.hass.entities,
        this.hass.formatEntityName
      );

    const { issues: repairsIssues, total: totalRepairIssues } =
      this._repairsIssues;

    return html`
      <ha-top-app-bar-fixed .narrow=${this.narrow}>
        <ha-dropdown slot="actionItems" @wa-select=${this._handleMenuAction}>
          <ha-icon-button
            slot="trigger"
            .label=${this.hass.localize("ui.common.menu")}
            .path=${mdiDotsVertical}
          ></ha-icon-button>

          <ha-dropdown-item value="check-updates">
            ${this.hass.localize("ui.panel.config.updates.check_updates")}
            <ha-svg-icon slot="icon" .path=${mdiRefresh}></ha-svg-icon>
          </ha-dropdown-item>

          <ha-dropdown-item value="restart">
            ${this.hass.localize(
              "ui.panel.config.system_dashboard.restart_homeassistant"
            )}
            <ha-svg-icon slot="icon" .path=${mdiPower}></ha-svg-icon>
          </ha-dropdown-item>
        </ha-dropdown>

        <div class="page">
          <ha-page-heading
            .overline=${this.hass.localize("panel.config")}
            .heading=${this.hass.localize(
              "ui.panel.config.dashboard.system.main"
            )}
            .subtitle=${`Home Assistant ${this.hass.connection.haVersion}`}
          >
            <button class="search-pill" @click=${this._showQuickBar}>
              <ha-svg-icon .path=${mdiMagnify}></ha-svg-icon>
              <span>${this.hass.localize("ui.dialogs.quick-bar.title")}</span>
            </button>
          </ha-page-heading>
          ${
            canInstallUpdates.length
              ? html`
                  <ha-card outlined class="updates-card">
                    <a
                      class="updates-head"
                      href="/config/updates?historyBack=1"
                    >
                      <span class="big-count">${totalUpdates}</span>
                      <span class="updates-title">
                        ${this.hass.localize(
                          "ui.panel.config.dashboard.redesign.updates_title"
                        )}
                      </span>
                      <ha-icon-next></ha-icon-next>
                    </a>
                    <ha-config-updates
                      .narrow=${this.narrow}
                      .updateEntities=${canInstallUpdates}
                    ></ha-config-updates>
                  </ha-card>
                `
              : nothing
          }
          ${
            repairsIssues.length
              ? html`
                  <ha-card outlined class="repairs-card">
                    <a
                      class="repairs-head"
                      href="/config/repairs?historyBack=1"
                    >
                      ${this.hass.localize("ui.panel.config.repairs.title", {
                        count: totalRepairIssues,
                      })}
                      <ha-icon-next></ha-icon-next>
                    </a>
                    <ha-config-repairs
                      .hass=${this.hass}
                      .narrow=${this.narrow}
                      .repairsIssues=${repairsIssues}
                    ></ha-config-repairs>
                  </ha-card>
                `
              : nothing
          }
          <ha-config-navigation
            class="sections"
            .hass=${this.hass}
            .narrow=${this.narrow}
            .pages=${this._pages(
              this.cloudStatus,
              isComponentLoaded(this.hass.config, "cloud"),
              this.hass.auth.external?.config.hasSettingsScreen,
              this.hass.userData?.apps_info_dismissed,
              isComponentLoaded(this.hass.config, "hassio")
            ).flat()}
          ></ha-config-navigation>
          <ha-tip>${this._tip}</ha-tip>
        </div>
      </ha-top-app-bar-fixed>
    `;
  }

  protected override updated(changedProps: PropertyValues<this>): void {
    super.updated(changedProps);

    if (!this._tip && changedProps.has("hass")) {
      this._tip = randomTip(this._openShortcutDialog, this.hass, this.narrow);
    }
  }

  private _openShortcutDialog(ev: Event) {
    ev.preventDefault();

    showShortcutsDialog(this);
  }

  private _filterUpdateEntitiesParameterized = memoizeOne(
    (
      entities: HomeAssistant["states"],
      entityRegistry: HomeAssistant["entities"],
      formatEntityName: HomeAssistant["formatEntityName"]
    ): DashboardSummary<"updates", UpdateEntity> => {
      const updates = filterUpdateEntitiesParameterized(
        entities,
        formatEntityName,
        false,
        false
      ).filter((entity) => !entityRegistry[entity.entity_id]?.hidden);

      return {
        updates: updates.slice(0, updates.length === 3 ? updates.length : 2),
        total: updates.length,
      };
    }
  );

  private _showQuickBar(): void {
    showQuickBar(this, { showHint: this.hass.enableShortcuts });
  }

  private async _handleMenuAction(ev: HaDropdownSelectEvent) {
    const action = ev.detail.item.value;
    switch (action) {
      case "check-updates":
        checkForEntityUpdates(this, this.hass);
        break;
      case "restart":
        showRestartDialog(this);
        break;
    }
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        :host {
          display: block;
          background: radial-gradient(
              1100px 700px at 50% 0%,
              var(--card-background-color) 0%,
              transparent 70%
            )
            var(--primary-background-color);
          min-height: 100vh;
        }

        .page {
          max-width: 1040px;
          margin: 0 auto;
          box-sizing: border-box;
          padding: var(--ha-space-2) clamp(16px, 3vw, 48px) var(--ha-space-14);
          display: flex;
          flex-direction: column;
          gap: var(--ha-space-8);
        }

        .search-pill {
          height: 48px;
          width: 320px;
          max-width: 100%;
          box-sizing: border-box;
          padding: 0 18px;
          border-radius: 24px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--secondary-text-color);
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: inherit;
          font-size: 15px;
          cursor: pointer;
          --mdc-icon-size: 18px;
        }

        ha-card {
          overflow: hidden;
          margin-bottom: 0;
          --ha-card-border-radius: 30px;
        }

        ha-card a {
          text-decoration: none;
          color: var(--primary-text-color);
        }

        .updates-head {
          display: flex;
          align-items: baseline;
          gap: 14px;
          padding: 26px 26px 10px;
        }

        .big-count {
          font-size: 56px;
          line-height: 0.9;
          font-weight: var(--ha-font-weight-thin, 200);
          letter-spacing: -0.04em;
        }

        .updates-title {
          flex: 1;
          font-size: 18px;
          font-weight: var(--ha-font-weight-medium);
        }

        .repairs-card {
          --ha-card-border-color: color-mix(
            in srgb,
            var(--error-color) 35%,
            transparent
          );
          background: color-mix(
            in srgb,
            var(--error-color) 7%,
            var(--card-background-color)
          );
        }

        .repairs-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 20px 22px 6px;
          font-size: 16px;
          font-weight: var(--ha-font-weight-medium);
        }

        ha-icon-next {
          color: var(--secondary-text-color);
          width: 20px;
          height: 20px;
        }

        .sections {
          --ha-config-nav-columns: repeat(
            auto-fit,
            minmax(min(420px, 100%), 1fr)
          );
          --ha-config-nav-row-height: 82px;
        }

        ha-tip {
          margin-bottom: 8px;
        }

        .new {
          color: var(--primary-color);
        }

        .keep-together {
          display: inline-block;
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-config-dashboard": HaConfigDashboard;
  }
}
