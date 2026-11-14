import type { SlotDto } from '../types';
import { SLOT_CLOSED_TEXT, SLOT_OPEN_TEXT } from './submitTexts';

export interface SlotView {
  selectable: boolean;
  metaText: string;
  selectedText: string;
}

function timeOf(iso: string): string {
  const matched = /T(\d{2}:\d{2})/.exec(iso);
  return matched ? matched[1] : iso;
}

export function formatSlotRange(slot: SlotDto): string {
  return `${timeOf(slot.slotStart)}—${timeOf(slot.slotEnd)}`;
}

export function toSlotView(slot: SlotDto): SlotView {
  const selectable = slot.enabled === true;
  return {
    selectable,
    metaText: selectable ? SLOT_OPEN_TEXT : SLOT_CLOSED_TEXT,
    selectedText: formatSlotRange(slot),
  };
}