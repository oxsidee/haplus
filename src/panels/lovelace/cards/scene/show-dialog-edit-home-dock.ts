import { fireEvent } from "../../../../common/dom/fire_event";

export interface EditHomeDockDialogParams {
  items: string[];
  saveItems: (items: string[]) => Promise<void>;
}

export const loadEditHomeDockDialog = () => import("./dialog-edit-home-dock");

export const showEditHomeDockDialog = (
  element: HTMLElement,
  params: EditHomeDockDialogParams
): void => {
  fireEvent(element, "show-dialog", {
    dialogTag: "dialog-edit-home-dock",
    dialogImport: loadEditHomeDockDialog,
    dialogParams: params,
  });
};
