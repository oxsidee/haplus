import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent } from "../../../../common/dom/fire_event";
import "../../../../components/ha-button";
import "../../../../components/ha-dialog";
import "../../../../components/ha-dialog-footer";
import "../../../../components/ha-picture-upload";
import type { HaPictureUpload } from "../../../../components/ha-picture-upload";
import type { CropOptions } from "../../../../dialogs/image-cropper-dialog/show-image-cropper-dialog";
import type { HassDialog } from "../../../../dialogs/make-dialog-manager";
import { haStyleDialog } from "../../../../resources/styles";
import type { HomeAssistant } from "../../../../types";
import type { EditHomePictureDialogParams } from "./show-dialog-edit-home-picture";

const CROP_OPTIONS: CropOptions = { round: false, aspectRatio: 16 / 9 };

@customElement("dialog-edit-home-picture")
export class DialogEditHomePicture
  extends LitElement
  implements HassDialog<EditHomePictureDialogParams>
{
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: EditHomePictureDialogParams;

  @state() private _picture: string | null = null;

  @state() private _open = false;

  @state() private _submitting = false;

  public showDialog(params: EditHomePictureDialogParams): void {
    this._params = params;
    this._picture = params.picture ?? null;
    this._open = true;
  }

  public closeDialog(): boolean {
    this._open = false;
    return true;
  }

  private _dialogClosed(): void {
    this._params = undefined;
    this._submitting = false;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  private _t(key: string) {
    return this.hass.localize(
      `ui.panel.lovelace.cards.home_scene.picture_editor.${key}` as any
    );
  }

  protected render() {
    if (!this._params) {
      return nothing;
    }
    return html`
      <ha-dialog
        .open=${this._open}
        .headerTitle=${this._t("title")}
        .headerSubtitle=${this._t("description")}
        @closed=${this._dialogClosed}
      >
        <ha-picture-upload
          .value=${this._picture}
          crop
          select-media
          .cropOptions=${CROP_OPTIONS}
          @change=${this._pictureChanged}
        ></ha-picture-upload>
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
            .disabled=${
              this._submitting ||
              this._picture === (this._params.picture ?? null)
            }
          >
            ${this.hass.localize("ui.common.save")}
          </ha-button>
        </ha-dialog-footer>
      </ha-dialog>
    `;
  }

  private _pictureChanged(ev: Event) {
    this._picture = (ev.target as HaPictureUpload).value;
  }

  private async _save() {
    if (!this._params) {
      return;
    }
    this._submitting = true;
    try {
      await this._params.savePicture(this._picture);
      this.closeDialog();
    } finally {
      this._submitting = false;
    }
  }

  static styles = [
    haStyleDialog,
    css`
      ha-picture-upload {
        display: block;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-edit-home-picture": DialogEditHomePicture;
  }
}
