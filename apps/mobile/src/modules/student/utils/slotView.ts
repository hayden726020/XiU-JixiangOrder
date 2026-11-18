import type { SlotDto } from '../types';
import { SLOT_CLOSED_TEXT, SLOT_OPEN_TEXT } from './submitTexts';
import { isFutureSlotStart } from './slotAvailability';

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

export function toSlotView(slot: SlotDto, now: number = Date.now()): SlotView {
  const future = isFutureSlotStart(slot.slotStart, now);
  const selectable = slot.enabled === true && future;
  return {
    selectable,
    metaText: !future ? '该时段已开始' : selectable ? SLOT_OPEN_TEXT : SLOT_CLOSED_TEXT,
    selectedText: formatSlotRange(slot),
  };
}
