import { mdiClose, mdiDragHorizontalVariant, mdiPlus } from "@mdi/js";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import type { HASSDomEvent } from "../../../../common/dom/fire_event";
import { fireEvent } from "../../../../common/dom/fire_event";
import "../../../../components/entity/ha-entity-picker";
import type { HaEntityPicker } from "../../../../components/entity/ha-entity-picker";
import "../../../../components/ha-button";
import "../../../../components/ha-dialog";
import "../../../../components/ha-dialog-footer";
import "../../../../components/ha-icon-button";
import "../../../../components/ha-sortable";
import "../../../../components/ha-state-icon";
import "../../../../components/ha-svg-icon";
import type { HassDialog } from "../../../../dialogs/make-dialog-manager";
import { haStyleDialog } from "../../../../resources/styles";
import type { HomeAssistant, ValueChangedEvent } from "../../../../types";
import {
  DOCK_GROUP_ICONS,
  DOCK_GROUP_PREFIX,
  DOCK_GROUPS,
  dockGroupOf,
} from "./dock-items";
import type { EditHomeDockDialogParams } from "./show-dialog-edit-home-dock";

@customElement("dialog-edit-home-dock")
export class DialogEditHomeDock
  extends LitElement
  implements HassDialog<EditHomeDockDialogParams>
{
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: EditHomeDockDialogParams;

  @state() private _items: string[] = [];

  @state() private _open = false;

  @state() private _submitting = false;

  @state() private _dirty = false;

  public showDialog(params: EditHomeDockDialogParams): void {
    this._params = params;
    this._items = [...params.items];
    this._dirty = false;
    this._open = true;
  }

  public closeDialog(): boolean {
    this._open = false;
    return true;
  }

  private _dialogClosed(): void {
    this._params = undefined;
    this._items = [];
    this._submitting = false;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  private _t(key: string) {
    return this.hass.localize(
      `ui.panel.lovelace.cards.home_scene.dock_editor.${key}` as any
    );
  }

  private _groupName(group: string) {
    return this.hass.localize(
      `ui.panel.lovelace.cards.home_scene.dock_groups.${group}` as any
    );
  }

  protected render() {
    if (!this._params) {
      return nothing;
    }
    const freeGroups = DOCK_GROUPS.filter(
      (g) => !this._items.includes(`${DOCK_GROUP_PREFIX}${g}`)
    );
    return html`
      <ha-dialog
        .open=${this._open}
        .headerTitle=${this._t("title")}
        .headerSubtitle=${this._t("description")}
        .preventScrimClose=${this._dirty}
        @closed=${this._dialogClosed}
      >
        <ha-sortable handle-selector=".handle" @item-moved=${this._moved}>
          <div class="list">
            ${repeat(
              this._items,
              (item) => item,
              (item, index) => this._renderRow(item, index)
            )}
          </div>
        </ha-sortable>
        ${
          this._items.length
            ? nothing
            : html`<p class="empty">${this._t("empty")}</p>`
        }

        <ha-entity-picker
          .hass=${this.hass}
          add-button
          .addButtonLabel=${this._t("add_entity")}
          .excludeEntities=${this._items}
          @value-changed=${this._addEntity}
        ></ha-entity-picker>

        ${
          freeGroups.length
            ? html`<p class="label">${this._t("add_group")}</p>
                <div class="chips">
                  ${freeGroups.map(
                    (g) => html`
                      <button
                        class="chip"
                        data-group=${g}
                        @click=${this._addGroup}
                      >
                        <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
                        <ha-svg-icon .path=${DOCK_GROUP_ICONS[g]}></ha-svg-icon>
                        <span>${this._groupName(g)}</span>
                      </button>
                    `
                  )}
                </div>`
            : nothing
        }

        <ha-dialog-footer slot="footer">
          <ha-button
            appearance="plain"
            slot="secondaryAction"
            @click=${this.closeDialog}
            .disabled=${this._submitting}
          >
            ${this.hass.localize("ui.common.cancel")}
          </ha-button>
          <ha-button
            slot="primaryAction"
            @click=${this._save}
            .disabled=${this._submitting || !this._dirty}
          >
            ${this.hass.localize("ui.common.save")}
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  private _renderRow(item: string, index: number) {
    const group = dockGroupOf(item);
    const stateObj = group ? undefined : this.hass.states[item];
    const name = group
      ? this._groupName(group)
      : stateObj
        ? this.hass.formatEntityName(stateObj, undefined)
        : item;
    const secondary = group
      ? this._t("group")
      : stateObj
        ? this.hass.formatEntityState(stateObj)
        : this._t("missing");
    return html`
      <div class="row">
        <div class="handle">
          <ha-svg-icon .path=${mdiDragHorizontalVariant}></ha-svg-icon>
        </div>
        <span class="icon">
          ${
            group
              ? html`<ha-svg-icon
                  .path=${DOCK_GROUP_ICONS[group]}
                ></ha-svg-icon>`
              : html`<ha-state-icon
                  .hass=${this.hass}
                  .stateObj=${stateObj}
                ></ha-state-icon>`
          }
        </span>
        <span class="text">
          <span class="primary">${name}</span>
          <span class="secondary">${secondary}</span>
        </span>
        <ha-icon-button
          .label=${this.hass.localize("ui.common.remove")}
          .path=${mdiClose}
          data-index=${index}
          @click=${this._remove}
        ></ha-icon-button>
      </div>
    `;
  }

  private _set(items: string[]) {
    this._items = items;
    this._dirty = true;
  }

  private _addEntity(ev: ValueChangedEvent<string | undefined>) {
    ev.stopPropagation();
    const entityId = ev.detail.value;
    (ev.currentTarget as HaEntityPicker).value = "";
    if (!entityId || this._items.includes(entityId)) {
      return;
    }
    this._set([...this._items, entityId]);
  }

  private _addGroup(ev: Event) {
    const group = (ev.currentTarget as HTMLElement).dataset.group;
    this._set([...this._items, `${DOCK_GROUP_PREFIX}${group}`]);
  }

  private _remove(ev: Event) {
    const index = Number((ev.currentTarget as HTMLElement).dataset.index);
    const next = [...this._items];
    next.splice(index, 1);
    this._set(next);
  }

  private _moved(ev: HASSDomEvent<HASSDomEvents["item-moved"]>) {
    ev.stopPropagation();
    const { oldIndex, newIndex } = ev.detail;
    const next = [...this._items];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    this._set(next);
  }

  private async _save() {
    if (!this._params) {
      return;
    }
    this._submitting = true;
    try {
      await this._params.saveItems(this._items);
      this.closeDialog();
    } finally {
      this._submitting = false;
    }
  }

  static styles = [
    haStyleDialog,
    css`
      .list {
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-1);
      }

      .row {
        display: flex;
        align-items: center;
        gap: var(--ha-space-3);
        min-height: 56px;
        padding: 0 var(--ha-space-1) 0 var(--ha-space-2);
        border-radius: var(--ha-border-radius-xl);
        background: rgba(var(--rgb-primary-text-color), 0.04);
      }

      .handle {
        cursor: grab;
        color: var(--secondary-text-color);
        display: flex;
      }

      .icon {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: var(--ha-border-radius-lg);
        background: rgba(var(--rgb-primary-text-color), 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
        --mdc-icon-size: 20px;
      }

      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }

      .primary,
      .secondary {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .secondary {
        font-size: var(--ha-font-size-s);
        color: var(--secondary-text-color);
      }

      .empty {
        color: var(--secondary-text-color);
      }

      .label {
        margin: var(--ha-space-6) 0 var(--ha-space-2);
        font-size: var(--ha-font-size-s);
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        font-weight: var(--ha-font-weight-medium);
      }

      ha-entity-picker {
        display: block;
        margin-top: var(--ha-space-3);
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ha-space-2);
      }

      .chip {
        height: 40px;
        padding: 0 14px 0 10px;
        border-radius: var(--ha-border-radius-pill);
        border: 1px solid var(--divider-color);
        background: transparent;
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: var(--ha-font-size-m);
        font-weight: var(--ha-font-weight-medium);
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        --mdc-icon-size: 18px;
      }

      .chip:hover {
        background: rgba(var(--rgb-primary-text-color), 0.05);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-edit-home-dock": DialogEditHomeDock;
  }
}
