import { getDayNotes, setDayNotes } from "../settings.js";

/**
 * A GM's own text for one in-world day, keyed the same way weather is: `dayKey` names the day
 * without saying anything about a time within it.
 *
 * Blank text never counts as a note, on read or on write — a hand-edited world file could carry one
 * anyway, and a day cannot look empty in the grid while a marker would say otherwise.
 */
const isNoteText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function noteFor(dayKey: string): string | null {
  const note = getDayNotes()[dayKey];
  return isNoteText(note) ? note : null;
}

export function hasNote(notes: Record<string, string>, dayKey: string): boolean {
  return isNoteText(notes[dayKey]);
}

/** An empty result clears the day's note rather than storing nothing worth showing. */
export function setNote(dayKey: string, text: string): Promise<unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return clearNote(dayKey);
  return setDayNotes({ ...getDayNotes(), [dayKey]: trimmed });
}

export function clearNote(dayKey: string): Promise<unknown> {
  const notes = { ...getDayNotes() };
  delete notes[dayKey];
  return setDayNotes(notes);
}
