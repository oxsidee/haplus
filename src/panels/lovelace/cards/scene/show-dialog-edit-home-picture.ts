import { fireEvent } from "../../../../common/dom/fire_event";

export interface EditHomePictureDialogParams {
  picture?: string | null;
  savePicture: (picture: string | null) => Promise<void>;
}

export const loadEditHomePictureDialog = () =>
  import("./dialog-edit-home-picture");

export const showEditHomePictureDialog = (
  element: HTMLElement,
  params: EditHomePictureDialogParams
): void => {
  fireEvent(element, "show-dialog", {
    dialogTag: "dialog-edit-home-picture",
    dialogImport: loadEditHomePictureDialog,
    dialogParams: params,
  });
};
