import {
  mdiAlphaABoxOutline,
  mdiDotsVertical,
  mdiGrid,
  mdiListBoxOutline,
} from "@mdi/js";
import type { CSSResultGroup, PropertyValues, TemplateResult } from "lit";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { storage } from "../../common/decorators/storage";
import type { HASSDomEvent } from "../../common/dom/fire_event";
import { fireEvent } from "../../common/dom/fire_event";
import { navigate } from "../../common/navigate";
import "../../components/ha-dropdown";
import "../../components/ha-dropdown-item";
import "../../components/ha-icon-button";
import "../../components/ha-icon-button-arrow-prev";
import "../../components/ha-top-app-bar-fixed";
import "../../components/media-player/ha-media-manage-button";
import "../../components/media-player/ha-media-player-browse";
import type {
  HaMediaPlayerBrowse,
  MediaPlayerItemId,
} from "../../components/media-player/ha-media-player-browse";
import {
  getEntityIdFromCameraMediaSource,
  isCameraMediaSource,
} from "../../data/camera";
import type {
  MediaPickedEvent,
  MediaPlayerItem,
  MediaPlayerLayoutType,
} from "../../data/media-player";
import {
  BROWSER_PLAYER,
  MediaPlayerEntityFeature,
  mediaPlayerPlayMedia,
} from "../../data/media-player";
import { supportsFeature } from "../../common/entity/supports-feature";
import type { ResolvedMediaSource } from "../../data/media_source";
import { resolveMediaSource } from "../../data/media_source";
import { showAlertDialog } from "../../dialogs/generic/show-dialog-box";
import { haStyle } from "../../resources/styles";
import type { HomeAssistant, Route } from "../../types";
import "../../components/ha-page-heading";
import "./ha-bar-media-player";
import "./ha-media-now-playing";
import "./ha-media-players-rail";
import type { BarMediaPlayer } from "./ha-bar-media-player";
import { showWebBrowserPlayMediaDialog } from "./show-media-player-dialog";
import type { HaDropdownSelectEvent } from "../../components/ha-dropdown";

const createMediaPanelUrl = (entityId: string, items: MediaPlayerItemId[]) => {
  let path = `/media-browser/${entityId}`;
  for (const item of items.slice(1)) {
    path +=
      "/" +
      encodeURIComponent(`${item.media_content_type},${item.media_content_id}`);
  }
  return path;
};

@customElement("ha-panel-media-browser")
class PanelMediaBrowser extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean, reflect: true }) public narrow = false;

  @property({ attribute: false }) public route!: Route;

  @state() _currentItem?: MediaPlayerItem;

  @state()
  @storage({
    key: "mediaBrowserPreferredLayout",
    state: true,
    subscribe: false,
  })
  private _preferredLayout: MediaPlayerLayoutType = "auto";

  private _navigateIds: MediaPlayerItemId[] = [
    {
      media_content_id: undefined,
      media_content_type: undefined,
    },
  ];

  @state()
  @storage({
    key: "mediaBrowseEntityId",
    state: true,
    subscribe: false,
  })
  private _entityId = BROWSER_PLAYER;

  @query("ha-media-player-browse") private _browser?: HaMediaPlayerBrowse;

  @query("ha-bar-media-player") private _player!: BarMediaPlayer;

  protected render(): TemplateResult {
    const atRoot = this._navigateIds.length === 1;
    const showHero =
      !this.narrow && atRoot && this._entityId !== BROWSER_PLAYER;
    const showBar = !showHero;
    const playerState = this.hass.states[this._entityId];
    const canBrowse =
      this._entityId === BROWSER_PLAYER ||
      (playerState !== undefined &&
        supportsFeature(playerState, MediaPlayerEntityFeature.BROWSE_MEDIA));
    return html`
      <ha-top-app-bar-fixed .narrow=${this.narrow}>
        ${
          this._navigateIds.length > 1
            ? html`
                <ha-icon-button-arrow-prev
                  slot="navigationIcon"
                  @click=${this._goBack}
                ></ha-icon-button-arrow-prev>
              `
            : nothing
        }
        <ha-media-manage-button
          slot="actionItems"
          .currentItem=${this._currentItem}
          @media-refresh=${this._refreshMedia}
        ></ha-media-manage-button>
        <ha-dropdown slot="actionItems" @wa-select=${this._handleMenuAction}>
          <ha-icon-button
            slot="trigger"
            .label=${this.hass.localize("ui.common.menu")}
            .path=${mdiDotsVertical}
          ></ha-icon-button>
          <ha-dropdown-item
            value="auto"
            class=${
              this._preferredLayout === "auto" ? "selected_menu_item" : ""
            }
          >
            ${this.hass.localize("ui.components.media-browser.auto")}
            <ha-svg-icon slot="icon" .path=${mdiAlphaABoxOutline}></ha-svg-icon>
          </ha-dropdown-item>
          <ha-dropdown-item
            value="grid"
            class=${
              this._preferredLayout === "grid" ? "selected_menu_item" : ""
            }
          >
            ${this.hass.localize("ui.components.media-browser.grid")}
            <ha-svg-icon slot="icon" .path=${mdiGrid}></ha-svg-icon>
          </ha-dropdown-item>
          <ha-dropdown-item
            value="list"
            class=${
              this._preferredLayout === "list" ? "selected_menu_item" : ""
            }
          >
            ${this.hass.localize("ui.components.media-browser.list")}
            <ha-svg-icon slot="icon" .path=${mdiListBoxOutline}></ha-svg-icon>
          </ha-dropdown-item>
        </ha-dropdown>
        <div class="layout">
          <div class="main ${showBar ? "with-bar" : ""}">
            <ha-page-heading
              class="page-heading ${showHero ? "compact" : ""}"
              .overline=${this.hass.localize("panel.media_browser")}
              .heading=${
                showHero
                  ? ""
                  : !this._currentItem
                    ? this.hass.localize(
                        "ui.components.media-browser.media-player-browser"
                      )
                    : this._currentItem.title
              }
            ></ha-page-heading>
            ${
              showHero
                ? html`<ha-media-now-playing
                      class="hero"
                      .hass=${this.hass}
                      .entityId=${this._entityId}
                    ></ha-media-now-playing>
                    ${
                      canBrowse
                        ? html`<div class="sources-head">
                            <h2>
                              ${this.hass.localize(
                                "ui.panel.media-browser.redesign.sources"
                              )}
                            </h2>
                          </div>`
                        : nothing
                    }`
                : nothing
            }
            ${
              canBrowse || !showHero
                ? html`<ha-media-player-browse
                    .entityId=${this._entityId}
                    .navigateIds=${this._navigateIds}
                    .preferredLayout=${this._preferredLayout}
                    @media-picked=${this._mediaPicked}
                    @media-browsed=${this._mediaBrowsed}
                  ></ha-media-player-browse>`
                : nothing
            }
          </div>
          ${
            this.narrow
              ? nothing
              : html`<aside class="rail">
                  <ha-media-players-rail
                    .hass=${this.hass}
                    .entityId=${this._entityId}
                    @player-picked=${this._playerPicked}
                  ></ha-media-players-rail>
                </aside>`
          }
        </div>
      </ha-top-app-bar-fixed>
      <ha-bar-media-player
        class=${showBar ? "" : "hidden"}
        .hass=${this.hass}
        .entityId=${this._entityId}
        .narrow=${this.narrow}
        @player-picked=${this._playerPicked}
      ></ha-bar-media-player>
    `;
  }

  private _handleMenuAction(ev: HaDropdownSelectEvent) {
    const value = ev.detail.item.value;

    if (["auto", "grid", "list"].includes(value)) {
      this._preferredLayout = value as MediaPlayerLayoutType;
    }
  }

  public willUpdate(changedProps: PropertyValues<this>): void {
    super.willUpdate(changedProps);

    if (
      !this.hasUpdated &&
      this._entityId !== BROWSER_PLAYER &&
      !(this._entityId in this.hass.states)
    ) {
      this._entityId = BROWSER_PLAYER;
    }

    if (!changedProps.has("route")) {
      return;
    }

    if (this.route.path === "") {
      navigate(`/media-browser/${this._entityId}`, { replace: true });
      return;
    }

    const [routePlayer, ...navigateIdsEncoded] = this.route.path
      .substring(1)
      .split("/");

    if (routePlayer !== this._entityId) {
      // Detect if picked player doesn't exist (anymore)
      // Can happen if URL bookmarked or stored in local storage
      if (
        routePlayer !== BROWSER_PLAYER &&
        this.hass.states[routePlayer] === undefined
      ) {
        navigate(`/media-browser/${BROWSER_PLAYER}`, { replace: true });
        showAlertDialog(this, {
          text: this.hass.localize(
            "ui.panel.media-browser.error.player_not_exist",
            {
              name: routePlayer,
            }
          ),
        });
        return;
      }
      this._entityId = routePlayer;
    }

    this._navigateIds = [
      {
        media_content_type: undefined,
        media_content_id: undefined,
      },
      ...navigateIdsEncoded.map((navigateId) => {
        const decoded = decodeURIComponent(navigateId);
        // Don't use split because media_content_id could contain commas
        const delimiter = decoded.indexOf(",");
        return {
          media_content_type: decoded.substring(0, delimiter),
          media_content_id: decoded.substring(delimiter + 1),
        };
      }),
    ];
    this._currentItem = undefined;
  }

  private _goBack() {
    navigate(
      createMediaPanelUrl(this._entityId, this._navigateIds.slice(0, -1))
    );
  }

  private _mediaBrowsed(ev: { detail: HASSDomEvents["media-browsed"] }) {
    if (ev.detail.ids === this._navigateIds) {
      this._currentItem = ev.detail.current;
      return;
    }

    navigate(createMediaPanelUrl(this._entityId, ev.detail.ids), {
      replace: ev.detail.replace,
    });
  }

  private async _mediaPicked(
    ev: HASSDomEvent<MediaPickedEvent>
  ): Promise<void> {
    const item = ev.detail.item;

    if (this._entityId !== BROWSER_PLAYER) {
      this._player.showResolvingNewMediaPicked();
      try {
        await mediaPlayerPlayMedia(
          this.hass,
          this._entityId,
          item.media_content_id,
          item.media_content_type
        );
      } catch (_err) {
        this._player.hideResolvingNewMediaPicked();
      }
      return;
    }

    // We won't cancel current media being played if we're going to
    // open a camera.
    if (isCameraMediaSource(item.media_content_id)) {
      fireEvent(this, "hass-more-info", {
        entityId: getEntityIdFromCameraMediaSource(item.media_content_id),
      });
      return;
    }

    this._player.showResolvingNewMediaPicked();
    let resolvedUrl: ResolvedMediaSource;
    try {
      resolvedUrl = await resolveMediaSource(this.hass, item.media_content_id);
    } catch (err: any) {
      showAlertDialog(this, {
        title: this.hass.localize(
          "ui.components.media-browser.media_browsing_error"
        ),
        text: err.message,
      });
      this._player.hideResolvingNewMediaPicked();
      return;
    }

    if (resolvedUrl.mime_type.startsWith("audio/")) {
      this._player.playItem(item, resolvedUrl);
      return;
    }

    showWebBrowserPlayMediaDialog(this, {
      sourceUrl: resolvedUrl.url,
      sourceType: resolvedUrl.mime_type,
      title: item.title,
      can_play: item.can_play,
    });
    this._player.hideResolvingNewMediaPicked();
  }

  private _playerPicked(ev) {
    const entityId: string = ev.detail.entityId;
    if (entityId === this._entityId) {
      return;
    }
    navigate(createMediaPanelUrl(entityId, this._navigateIds));
  }

  private _refreshMedia() {
    this._browser?.refresh();
  }

  static get styles(): CSSResultGroup {
    return [
      haStyle,
      css`
        ha-media-manage-button {
          --mdc-theme-primary: var(--app-header-text-color);
        }

        .layout {
          display: flex;
          height: calc(
            100vh - var(--header-height, 0px) - var(
                --safe-area-inset-top,
                0px
              ) - var(--safe-area-inset-bottom, 0px)
          );
        }

        .main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: radial-gradient(
            900px 600px at 20% 20%,
            color-mix(
              in srgb,
              var(--state-media_player-active-color, var(--indigo-color)) 8%,
              transparent
            ),
            transparent 70%
          );
        }

        .main.with-bar {
          padding-bottom: 100px;
        }

        .rail {
          flex: 0 0 340px;
          box-sizing: border-box;
          padding: 36px 24px 40px;
          background: var(--sidebar-background-color);
          border-inline-start: 1px solid var(--divider-color);
          overflow-y: auto;
        }

        .page-heading {
          display: flex;
          flex: none;
          height: 112px;
          box-sizing: border-box;
          padding: var(--ha-space-2) clamp(16px, 3vw, 48px) var(--ha-space-5);
        }

        .page-heading.compact {
          height: auto;
          padding-bottom: 0;
          padding-top: var(--ha-space-4);
        }

        .hero {
          flex: none;
          padding: var(--ha-space-7) clamp(16px, 3vw, 48px) var(--ha-space-6);
        }

        .sources-head {
          flex: none;
          padding: var(--ha-space-2) clamp(16px, 3vw, 48px) 0;
        }

        .sources-head h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.015em;
        }

        :host([narrow]) .page-heading {
          height: auto;
          --ha-page-heading-size: 32px;
          padding: var(--ha-space-2) var(--ha-space-4) var(--ha-space-3);
        }

        ha-media-player-browse {
          flex: 1;
          min-height: 0;
        }

        ha-bar-media-player.hidden {
          display: none;
        }

        .page-title {
          font-size: inherit;
          margin: inherit;
          line-height: inherit;
        }

        .selected_menu_item {
          color: var(--primary-color);
        }

        .selected_menu_item ha-svg-icon {
          color: currentColor;
        }

        ha-bar-media-player {
          position: fixed;
          bottom: calc(var(--safe-area-inset-bottom, 0px) + 16px);
          margin-inline-start: 16px;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid var(--divider-color);
          box-shadow: var(--ha-box-shadow-l);
          width: calc(
            var(--ha-top-app-bar-width, 100%) - 32px -
              340px - var(--safe-area-inset-right, 0px)
          );
        }
        :host([narrow]) ha-bar-media-player {
          width: calc(
            var(--ha-top-app-bar-width, 100%) - var(
                --safe-area-inset-left,
                0px
              ) - var(--safe-area-inset-right, 0px)
          );
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-panel-media-browser": PanelMediaBrowser;
  }
}
