import { MODULE_ID } from "../constants.js";
import { clearNote, noteFor, setNote } from "../time/notes.js";

const t = (key: string): string => game.i18n?.localize(key) ?? key;

/**
 * Escapes text for interpolation into the dialog's HTML — the one point a GM's own free text crosses
 * into markup, unlike the grid, which only ever renders a note's presence as a CSS class.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Lets the GM write, edit or delete the note for one in-world day.
 *
 * `label` names the day for the dialog's title. The caller already has it formatted for the grid's
 * own heading, so this does not format a date of its own.
 */
export async function openDayNoteEditor(dayKey: string, label: string): Promise<void> {
  if (!game.user.isGM) return;

  const current = noteFor(dayKey) ?? "";

  const content = `
    <form class="kronos-note">
      <textarea name="note" rows="6">${escapeHtml(current)}</textarea>
    </form>`;

  const dialog = foundry.applications.api.DialogV2;
  if (!dialog?.wait) {
    console.error(`${MODULE_ID} | DialogV2 is unavailable; cannot open the day note editor`);
    return;
  }

  const buttons: Record<string, unknown>[] = [
    {
      action: "save",
      icon: "fa-solid fa-check",
      label: t("KRONOS.Note.Save"),
      default: true,
      callback: (_event: unknown, button: { form?: HTMLFormElement }): void => {
        const form = button.form;
        if (!form) return;
        const text = new FormData(form).get("note");
        if (typeof text === "string") void setNote(dayKey, text);
      },
    },
  ];

  if (current) {
    buttons.push({
      action: "clear",
      icon: "fa-solid fa-trash",
      label: t("KRONOS.Note.Clear"),
      callback: (): void => void clearNote(dayKey),
    });
  }

  // `wait` rather than `prompt`: prompt injects a confirmation button of its own, which submits
  // the dialog without running any of our callbacks — so it silently discards the form.
  await dialog.wait({
    window: { title: game.i18n?.format("KRONOS.Note.Title", { day: label }) ?? label },
    // The dialog renders outside the panel, so the stylesheet cannot reach it through
    // `#foundry-kronos`. This class is the hook that gives it the panel's look.
    classes: ["kronos-modal"],
    content,
    buttons,
    rejectClose: false,
  });
}
