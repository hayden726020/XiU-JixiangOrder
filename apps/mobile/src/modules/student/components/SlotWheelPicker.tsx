import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import type { SlotDto } from '../types';
import { formatSlotRange } from '../utils/slotView';
import { getWheelTarget } from '../utils/slotWheelModel';
import '../slot-wheel.css';

// Motion and geometry adapted from Kokonut UI Wheel Picker (MIT).
// https://github.com/kokonut-labs/kokonutui/blob/main/components/kokonutui/wheel-picker.tsx
const ITEM_HEIGHT = 36;
const ITEM_ANGLE = 20;
const RADIUS = Math.round((ITEM_HEIGHT / 2 / Math.tan((ITEM_ANGLE / 2) * Math.PI / 180)) * 100) / 100;
const VIEW_HEIGHT = Math.round(RADIUS * 2) + ITEM_HEIGHT / 2;
const WINDOW = Math.ceil(90 / ITEM_ANGLE);
const VELOCITY_WINDOW_MS = 80;

interface DragState {
  id: number;
  startY: number;
  startPosition: number;
  moved: boolean;
  samples: { time: number; position: number }[];
}

interface SlotWheelPickerProps {
  slots: SlotDto[];
  selectedId: string | null;
  onSelect: (slot: SlotDto) => void;
}

export default function SlotWheelPicker({ slots, selectedId, onSelect }: SlotWheelPickerProps) {
  const selectedIndex = Math.max(0, slots.findIndex((slot) => slot.slotId === selectedId));
  const slotSignature = slots.map((slot) => slot.slotId).join('|');
  const position = useRef(selectedIndex);
  const [center, setCenter] = useState(selectedIndex);
  const centerRef = useRef(selectedIndex);
  const mutedDrum = useRef<HTMLDivElement>(null);
  const activeDrum = useRef<HTMLDivElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const wheelTimer = useRef<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const pointerType = useRef('mouse');
  const previousSlotSignature = useRef(slotSignature);
  const latest = useRef({ slots, selectedId, onSelect });
  latest.current = { slots, selectedId, onSelect };

  function setPosition(next: number) {
    position.current = next;
    const transform = `translateZ(${-RADIUS}px) rotateX(${next * ITEM_ANGLE}deg)`;
    if (mutedDrum.current) mutedDrum.current.style.transform = transform;
    if (activeDrum.current) activeDrum.current.style.transform = transform;
    const rounded = Math.round(next);
    if (rounded !== centerRef.current) {
      centerRef.current = rounded;
      setCenter(rounded);
      if (pointerType.current === 'touch') navigator.vibrate?.(1);
    }
  }

  function stopAnimation() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }

  function settle(index: number) {
    stopAnimation();
    setPosition(index);
    const slot = latest.current.slots[index];
    if (slot && slot.slotId !== latest.current.selectedId) latest.current.onSelect(slot);
  }

  function animateTo(target: number, velocity = 0, flick = false) {
    stopAnimation();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle(target);
      return;
    }
    let last = performance.now();
    const start = last;
    const stiffness = flick ? 140 : 260;
    const damping = flick ? 24 : 30;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      velocity += (stiffness * (target - position.current) - damping * velocity) * dt;
      setPosition(position.current + velocity * dt);
      if ((Math.abs(target - position.current) < 0.005 && Math.abs(velocity) < 0.05) || now - start > 1300) {
        settle(target);
      } else {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (previousSlotSignature.current !== slotSignature) {
      previousSlotSignature.current = slotSignature;
      stopAnimation();
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
      drag.current = null;
      setPosition(selectedIndex);
      return;
    }
    if (!drag.current && frame.current === null && Math.round(position.current) !== selectedIndex) {
      setPosition(selectedIndex);
    }
  }, [selectedIndex, slotSignature]);

  useEffect(() => () => {
    stopAnimation();
    if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
  }, []);

  useEffect(() => {
    const node = wheel.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopAnimation();
      pointerType.current = 'mouse';
      const count = latest.current.slots.length;
      setPosition(Math.min(Math.max(position.current + event.deltaY / ITEM_HEIGHT * 0.4, -0.4), count - 0.6));
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        animateTo(Math.min(Math.max(Math.round(position.current), 0), count - 1));
      }, 120);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    stopAnimation();
    if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
    pointerType.current = event.pointerType;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      startPosition: position.current,
      moved: false,
      samples: [{ time: event.timeStamp, position: position.current }],
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dy) < 4) return;
    current.moved = true;
    const raw = current.startPosition - dy / ITEM_HEIGHT;
    const end = latest.current.slots.length - 1;
    const damp = (distance: number) => 1.2 * (1 - Math.exp(-distance / 1.2));
    setPosition(raw < 0 ? -damp(-raw) : raw > end ? end + damp(raw - end) : raw);
    current.samples.push({ time: event.timeStamp, position: raw });
    while (current.samples.length > 2 && event.timeStamp - current.samples[0].time > VELOCITY_WINDOW_MS) {
      current.samples.shift();
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    const end = latest.current.slots.length - 1;
    if (!current.moved && event.type === 'pointerup') {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = Math.min(Math.max((event.clientY - rect.top - rect.height / 2) / RADIUS, -1), 1);
      const rows = Math.round(Math.asin(ratio) * 180 / Math.PI / ITEM_ANGLE);
      animateTo(Math.min(Math.max(Math.round(position.current) + rows, 0), end));
      return;
    }
    const first = current.samples[0];
    const last = current.samples.at(-1) ?? first;
    const elapsed = (last.time - first.time) / 1000;
    const paused = event.timeStamp - last.time > VELOCITY_WINDOW_MS;
    const velocity = elapsed > 0 && !paused && event.type === 'pointerup'
      ? (last.position - first.position) / elapsed : 0;
    const outOfBounds = position.current < 0 || position.current > end;
    if (outOfBounds || Math.abs(velocity) < 2) {
      animateTo(Math.min(Math.max(Math.round(position.current), 0), end));
    } else {
      animateTo(getWheelTarget(position.current, velocity, latest.current.slots.length), velocity, true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = Math.round(position.current);
    const last = slots.length - 1;
    const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 };
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? last
      : event.key in steps ? Math.min(Math.max(index + steps[event.key], 0), last) : null;
    if (target === null) return;
    event.preventDefault();
    pointerType.current = 'keyboard';
    settle(target);
  }

  const rows = slots.map((slot, index) => ({ slot, index }))
    .filter(({ index }) => Math.abs(index - center) <= WINDOW);
  const drum = (active: boolean) => (
    <div className={`slot-wheel__drum-mask${active ? ' slot-wheel__drum-mask--active' : ''}`} aria-hidden="true">
      <div
        ref={active ? activeDrum : mutedDrum}
        className="slot-wheel__drum"
        style={{ transform: `translateZ(${-RADIUS}px) rotateX(${position.current * ITEM_ANGLE}deg)` }}
      >
        {rows.map(({ slot, index }) => (
          <span
            className="slot-wheel__row"
            key={slot.slotId}
            style={{ transform: `rotateX(${-index * ITEM_ANGLE}deg) translateZ(${RADIUS}px)` }}
          >
            {formatSlotRange(slot)}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="slot-wheel" role="group" aria-label="选择取餐时段">
      <div className="slot-wheel__band" aria-hidden="true" />
      <div
        ref={wheel}
        className="slot-wheel__control"
        role="spinbutton"
        tabIndex={0}
        aria-label="可预约取餐时段"
        aria-valuemin={0}
        aria-valuemax={slots.length - 1}
        aria-valuenow={Math.min(Math.max(center, 0), slots.length - 1)}
        aria-valuetext={slots[Math.min(Math.max(center, 0), slots.length - 1)] ? formatSlotRange(slots[Math.min(Math.max(center, 0), slots.length - 1)]) : ''}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={handleKeyDown}
        style={{ height: VIEW_HEIGHT }}
      >
        {drum(false)}
        {drum(true)}
      </div>
    </div>
  );
}
