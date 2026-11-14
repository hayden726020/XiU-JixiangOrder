import type { SlotDto, StudentMode } from '../types';
import { SLOT_CLOSED_TEXT, SLOT_OPEN_TEXT } from './submitTexts';

export function isSlotSelectable(slot: SlotDto, _mode?: StudentMode): boolean {
  return slot.enabled === true;
}

export function slotMetaText(slot: SlotDto, _mode?: StudentMode): string {
  return slot.enabled === true ? SLOT_OPEN_TEXT : SLOT_CLOSED_TEXT;
}