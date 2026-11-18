import type { SlotDto, StudentSource } from '../types';
import { SLOT_CLOSED_TEXT, SLOT_EXPIRED_TEXT, SLOT_OPEN_TEXT } from './submitTexts';

const SAMPLE_DEFAULT_NOW_MS = Date.parse('2026-11-13T11:45:00+08:00');

export interface SlotView {
  selectable: boolean;
  metaText: string;
  selectedText: string;
}

export function resolveSourceNowMs(source: Pick<StudentSource, 'mode' | 'getNow'>): number {
  if (source.getNow) {
    return source.getNow().getTime();
  }
  return source.mode === 'sample' ? SAMPLE_DEFAULT_NOW_MS : Date.now();
}

function timeOf(iso: string): string {
  const matched = /T(\d{2}:\d{2})/.exec(iso);
  return matched ? matched[1] : iso;
}

export function formatSlotRange(slot: SlotDto): string {
  return `${timeOf(slot.slotStart)}—${timeOf(slot.slotEnd)}`;
}

/**
 * 判断时段是否已结束（位于当前时段之前）。
 */
export function isSlotPast(slot: SlotDto, now: Date | number = new Date()): boolean {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const endMs = Date.parse(slot.slotEnd);
  return Number.isFinite(nowMs) && Number.isFinite(endMs) && endMs <= nowMs;
}

export function toSlotView(slot: SlotDto, now: Date | number = new Date()): SlotView {
  const past = isSlotPast(slot, now);
  const selectable = slot.enabled === true && !past;
  return {
    selectable,
    metaText: past ? SLOT_EXPIRED_TEXT : selectable ? SLOT_OPEN_TEXT : SLOT_CLOSED_TEXT,
    selectedText: formatSlotRange(slot),
  };
}