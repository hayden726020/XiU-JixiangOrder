import {
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const HEIGHT = 52;
const INSET = 4;
const THUMB = HEIGHT - INSET * 2;
/** Share of the track the thumb must cross before letting go commits. */
const COMMIT_AT = 0.9;
/** A flick this fast (px/s) commits from FLICK_FROM of the way along. */
const FLICK_SPEED = 900;
const FLICK_FROM = 0.45;
/** How far past either end the thumb stretches, at most. */
const OVERDRAG = 8;
/** A press that moves less than this is a tap. */
const TAP_SLOP = 4;

type Phase = 'idle' | 'dragging' | 'confirming' | 'done';
type StageKey = 'slide' | 'busy' | 'done';

export interface SlideToConfirmProps {
  /** What sliding does, e.g. "确认下单". */
  label?: string;
  /** Read out while `onConfirm` runs. */
  confirmingLabel?: string;
  /** Shown once it's done, e.g. "已下单". */
  doneLabel?: string;
  /**
   * The real work. Return a promise to keep the spinner up until it settles;
   * a rejected promise sends the thumb back to the start.
   */
  onConfirm?: () => Promise<unknown> | unknown;
  /** Called right after entering `done` (after a brief visual beat) so callers can navigate if desired. */
  onConfirmed?: () => void;
  /** Notifies parent when busy state (confirming / done hold) changes. */
  onBusyChange?: (busy: boolean) => void;
  /** Hold time in ms on the `done` state before firing `onConfirmed`. */
  doneHoldMs?: number;
  /** Go back to the start this many ms after `done`. `null` stays done. */
  resetAfter?: number | null;
  disabled?: boolean;
  className?: string;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Past the ends the thumb follows less and less, so it stretches instead of
// stopping dead against the edge.
function band(raw: number, max: number): number {
  if (raw > max) {
    return max + OVERDRAG * (1 - Math.exp(-(raw - max) / 40));
  }
  if (raw < 0) {
    return -OVERDRAG * (1 - Math.exp(raw / 40));
  }
  return raw;
}

function cubicBezier(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): (t: number) => number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDerivX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  const solveCurveX = (x: number) => {
    let u = x;
    for (let i = 0; i < 8; i += 1) {
      const dx = sampleX(u) - x;
      if (Math.abs(dx) < 1e-6) {
        return u;
      }
      const d = sampleDerivX(u);
      if (Math.abs(d) < 1e-6) {
        break;
      }
      u -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < 12; i += 1) {
      const val = sampleX(u);
      if (Math.abs(val - x) < 1e-6) {
        return u;
      }
      if (x > val) {
        lo = u;
      } else {
        hi = u;
      }
      u = (lo + hi) * 0.5;
    }
    return u;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveCurveX(t));
  };
}

const easeOutFn = cubicBezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);
const easeInOutFn = cubicBezier(
  EASE_IN_OUT[0],
  EASE_IN_OUT[1],
  EASE_IN_OUT[2],
  EASE_IN_OUT[3],
);

interface VelocitySample {
  v: number;
  t: number;
}

class ScalarMotion {
  private current: number;
  private samples: VelocitySample[] = [];
  private rafId: number | null = null;
  private resolveActive: (() => void) | null = null;
  private onUpdate: () => void;

  constructor(initial: number, onUpdate: () => void) {
    this.current = initial;
    this.onUpdate = onUpdate;
  }

  get(): number {
    return this.current;
  }

  set(next: number, recordVelocity = false): void {
    this.current = next;
    if (recordVelocity) {
      const now = performance.now();
      this.samples.push({ v: next, t: now });
      while (this.samples.length > 1 && now - this.samples[0].t > 90) {
        this.samples.shift();
      }
    }
    this.onUpdate();
  }

  resetVelocity(atValue = this.current): void {
    this.samples = [{ v: atValue, t: performance.now() }];
  }

  getVelocity(): number {
    const now = performance.now();
    while (this.samples.length > 0 && now - this.samples[0].t > 100) {
      this.samples.shift();
    }
    if (this.samples.length < 2) {
      return 0;
    }
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0.001) {
      return 0;
    }
    return (last.v - first.v) / dt;
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.resolveActive) {
      const finish = this.resolveActive;
      this.resolveActive = null;
      finish();
    }
  }

  tweenTo(
    target: number,
    durationSec: number,
    ease: (t: number) => number,
  ): Promise<void> {
    this.stop();
    const from = this.current;
    if (durationSec <= 0 || Math.abs(target - from) < 0.001) {
      this.set(target, false);
      return Promise.resolve();
    }
    const durationMs = durationSec * 1000;
    const start = performance.now();
    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = ease(progress);
        this.set(from + (target - from) * eased, true);
        if (progress < 1) {
          this.rafId = requestAnimationFrame(tick);
        } else {
          this.rafId = null;
          this.resolveActive = null;
          this.set(target, false);
          resolve();
        }
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  springTo(
    target: number,
    stiffness = 520,
    damping = 42,
    initialVelocity = 0,
  ): Promise<void> {
    this.stop();
    const delta0 = this.current - target;
    if (Math.abs(delta0) < 0.2 && Math.abs(initialVelocity) < 4) {
      this.set(target, false);
      return Promise.resolve();
    }
    const omega0 = Math.sqrt(stiffness);
    const zeta = damping / (2 * omega0);
    const omegaD = omega0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
    const start = performance.now();

    return new Promise<void>((resolve) => {
      this.resolveActive = resolve;
      const tick = (now: number) => {
        const t = Math.max(0, (now - start) / 1000);
        const envelope = Math.exp(-zeta * omega0 * t);
        let offset: number;
        let velocity: number;
        if (zeta < 1) {
          const b = (initialVelocity + zeta * omega0 * delta0) / omegaD;
          const cos = Math.cos(omegaD * t);
          const sin = Math.sin(omegaD * t);
          offset = envelope * (delta0 * cos + b * sin);
          velocity =
            envelope *
            ((b * omegaD - zeta * omega0 * delta0) * cos -
              (delta0 * omegaD + zeta * omega0 * b) * sin);
        } else {
          const b = initialVelocity + omega0 * delta0;
          offset = envelope * (delta0 + b * t);
          velocity = envelope * (b - omega0 * (delta0 + b * t));
        }
        const next = target + offset;
        this.set(next, true);
        if (Math.abs(offset) < 0.25 && Math.abs(velocity) < 5) {
          this.rafId = null;
          this.resolveActive = null;
          this.set(target, false);
          resolve();
        } else {
          this.rafId = requestAnimationFrame(tick);
        }
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export default function SlideToConfirm({
  label = '确认下单',
  confirmingLabel = '提交中',
  doneLabel = '已下单',
  onConfirm = () => wait(1200),
  onConfirmed,
  onBusyChange,
  doneHoldMs = 420,
  resetAfter = 2200,
  disabled = false,
  className,
}: SlideToConfirmProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [armed, setArmed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const emptyLabelRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);

  const dragRef = useRef({ pointer: 0, from: 0, moved: false });
  const runRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  const busyChangeRef = useRef(onBusyChange);
  busyChangeRef.current = onBusyChange;

  const widthRef = useRef(0);
  const xMotionRef = useRef<ScalarMotion | null>(null);
  const coverMotionRef = useRef<ScalarMotion | null>(null);

  const syncVisuals = useCallback(() => {
    const xVal = xMotionRef.current?.get() ?? 0;
    const coverVal = coverMotionRef.current?.get() ?? 0;
    const total = widthRef.current;
    const maxTravel = Math.max(1, total - THUMB - INSET * 2);

    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate3d(${xVal}px, 0, 0)`;
    }
    if (fillRef.current) {
      const rightInset =
        (1 - coverVal) * Math.max(0, total - xVal - INSET - THUMB / 2);
      fillRef.current.style.clipPath = `inset(0px ${rightInset}px 0px 0px round ${HEIGHT}px)`;
      const rawOpacity = Math.min(1, Math.max(0, xVal) / 20);
      fillRef.current.style.opacity = String(Math.max(coverVal, rawOpacity));
    }
    if (emptyLabelRef.current) {
      const progress = Math.max(0, xVal) / maxTravel;
      emptyLabelRef.current.style.opacity = String(
        Math.max(0, 1 - progress * 0.55),
      );
    }
  }, []);

  if (!xMotionRef.current) {
    xMotionRef.current = new ScalarMotion(0, syncVisuals);
  }
  if (!coverMotionRef.current) {
    coverMotionRef.current = new ScalarMotion(0, syncVisuals);
  }

  const x = xMotionRef.current;
  const cover = coverMotionRef.current;

  const max = useCallback(
    () => Math.max(0, widthRef.current - THUMB - INSET * 2),
    [],
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    widthRef.current = track.offsetWidth;
    syncVisuals();

    const observer = new ResizeObserver(() => {
      const before = widthRef.current;
      const nextWidth = track.offsetWidth;
      widthRef.current = nextWidth;
      // Keep a thumb that sits at the end at the end when the track resizes.
      if (before > 0 && x.get() >= before - THUMB - INSET * 2) {
        x.set(Math.max(0, nextWidth - THUMB - INSET * 2), false);
      } else {
        syncVisuals();
      }
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncVisuals, x]);

  useEffect(
    () => () => {
      runRef.current += 1;
      x.stop();
      cover.stop();
    },
    [cover, x],
  );

  const animateSpringX = (target: number, velocity = 0) =>
    reduceMotion
      ? x.tweenTo(target, 0.15, easeOutFn)
      : x.springTo(target, 520, 42, velocity);

  // The ink drains back behind the thumb as it springs home.
  const settleBack = (velocity = 0) => {
    setArmed(false);
    setPhase('idle');
    phaseRef.current = 'idle';
    busyChangeRef.current?.(false);
    void cover.tweenTo(0, reduceMotion ? 0 : 0.3, easeOutFn);
    void animateSpringX(0, velocity);
  };

  // The reset nobody asked for runs slower, so it reads as a rewind.
  const rewind = () => {
    setArmed(false);
    setPhase('idle');
    phaseRef.current = 'idle';
    busyChangeRef.current?.(false);
    const duration = reduceMotion ? 0 : 0.6;
    void cover.tweenTo(0, duration * 0.6, easeOutFn);
    void x.tweenTo(0, duration, easeInOutFn);
  };

  // One motion from release to result: the thumb carries on to the end while
  // the ink floods the track and the label turns to "提交中…", and the work
  // starts at once instead of waiting for the thumb to land.
  const commit = async (velocity: number, glide = false) => {
    const run = ++runRef.current;
    const alive = () => runRef.current === run;
    setPhase('confirming');
    phaseRef.current = 'confirming';
    setArmed(true);
    busyChangeRef.current?.(true);

    const landing =
      glide && !reduceMotion
        ? x.tweenTo(max(), 0.42, easeInOutFn)
        : animateSpringX(max(), velocity);
    const flooding = cover.tweenTo(1, reduceMotion ? 0 : 0.36, easeOutFn);
    const minRejectDelay = wait(reduceMotion ? 0 : 340);

    try {
      // A floor on the wait, so a fast handler doesn't flash the spinner.
      await Promise.all([
        Promise.resolve().then(() => confirmRef.current()),
        wait(reduceMotion ? 120 : 800),
        landing,
        flooding,
      ]);
    } catch {
      await minRejectDelay;
      if (alive()) {
        settleBack();
      }
      return;
    }
    if (!alive()) {
      return;
    }
    setPhase('done');
    phaseRef.current = 'done';

    if (doneHoldMs > 0 && !reduceMotion) {
      await wait(doneHoldMs);
    }
    if (!alive()) {
      return;
    }
    confirmedRef.current?.();

    if (resetAfter === null) {
      busyChangeRef.current?.(false);
      return;
    }
    await wait(resetAfter);
    if (alive()) {
      rewind();
    }
  };

  const playTapNudge = async () => {
    if (disabled || phaseRef.current !== 'idle' || reduceMotion) {
      return;
    }
    // A tap shows which way to go: a short nudge that springs back.
    const nudgeTarget = Math.min(28, Math.max(12, max() * 0.24));
    await x.tweenTo(nudgeTarget, 0.18, easeOutFn);
    if (phaseRef.current === 'idle') {
      void animateSpringX(0);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || phase !== 'idle' || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    x.stop();
    x.resetVelocity(x.get());
    dragRef.current = { pointer: event.clientX, from: x.get(), moved: false };
    setPhase('dragging');
    phaseRef.current = 'dragging';
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'dragging') {
      return;
    }
    const drag = dragRef.current;
    const delta = event.clientX - drag.pointer;
    if (Math.abs(delta) > TAP_SLOP) {
      drag.moved = true;
    }
    const raw = drag.from + delta;
    x.set(band(raw, max()), true);
    const isArmed = raw >= max() * COMMIT_AT;
    if (isArmed !== armed) {
      setArmed(isArmed);
    }
  };

  const onPointerUp = () => {
    if (phaseRef.current !== 'dragging') {
      return;
    }
    if (!dragRef.current.moved) {
      setPhase('idle');
      phaseRef.current = 'idle';
      return;
    }
    const velocity = x.getVelocity();
    const progress = x.get() / Math.max(1, max());
    const flicked = velocity > FLICK_SPEED && progress > FLICK_FROM;
    if (progress >= COMMIT_AT || flicked) {
      void commit(velocity);
    } else {
      settleBack(velocity);
    }
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled || phaseRef.current !== 'idle') {
      return;
    }
    // Enter, Space, or programmatic button.click() fire with detail === 0, and confirm in one go.
    if (event.detail === 0) {
      void commit(0, true);
      return;
    }
    if (dragRef.current.moved || reduceMotion) {
      return;
    }
    void playTapNudge();
  };

  const onTrackClick = () => {
    if (disabled || phaseRef.current !== 'idle') {
      return;
    }
    void playTapNudge();
  };

  const done = phase === 'done';
  const busy = phase === 'confirming';
  let stage: StageKey = 'slide';
  let stageLabel = label;
  if (busy) {
    stage = 'busy';
    stageLabel = `${confirmingLabel}…`;
  } else if (done) {
    stage = 'done';
    stageLabel = doneLabel;
  }

  // Crossfade exiting stage label with blur + vertical shift (AnimatePresence popLayout parity)
  const [exitingStage, setExitingStage] = useState<{
    key: StageKey;
    text: string;
    alignRight: boolean;
  } | null>(null);
  const prevStageRef = useRef<{
    key: StageKey;
    text: string;
    alignRight: boolean;
  }>({
    key: stage,
    text: stageLabel,
    alignRight: false,
  });
  const stageTransitionMountedRef = useRef(false);

  useEffect(() => {
    const alignRight = stage === 'busy' || stage === 'done';
    const prev = prevStageRef.current;
    if (prev.key !== stage) {
      stageTransitionMountedRef.current = true;
      if (!reduceMotion) {
        setExitingStage(prev);
        const timer = window.setTimeout(() => {
          setExitingStage((curr) => (curr?.key === prev.key ? null : curr));
        }, 260);
        prevStageRef.current = { key: stage, text: stageLabel, alignRight };
        return () => window.clearTimeout(timer);
      }
      setExitingStage(null);
      prevStageRef.current = { key: stage, text: stageLabel, alignRight };
    } else {
      prevStageRef.current = { key: stage, text: stageLabel, alignRight };
    }
    return undefined;
  }, [reduceMotion, stage, stageLabel]);

  const stageAlignRight = stage === 'busy' || stage === 'done';

  return (
    <div
      className={`confirm-slide${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-disabled={disabled ? 'true' : 'false'}
    >
      <div
        ref={trackRef}
        className={`confirm-slide__track${disabled ? ' is-disabled' : ''}${done ? ' is-done' : ''}`}
        style={{ height: HEIGHT }}
        onClick={onTrackClick}
      >
        {/* Empty track label: nudged off the left-docked thumb so it reads centered */}
        <span
          ref={emptyLabelRef}
          aria-hidden="true"
          className="confirm-slide__label confirm-slide__label--empty"
        >
          {label}
        </span>

        {/* Ink trail left behind the thumb; turns warm jade-green when done */}
        <div
          ref={fillRef}
          aria-hidden="true"
          className={`confirm-slide__fill${done ? ' is-done' : ''}`}
        >
          {exitingStage ? (
            <span
              key={`exit-${exitingStage.key}`}
              className={`confirm-slide__label confirm-slide__label--fill is-exiting${
                exitingStage.alignRight ? ' is-docked-right' : ' is-docked-left'
              }`}
            >
              {exitingStage.text}
            </span>
          ) : null}
          <span
            key={`enter-${stage}`}
            className={`confirm-slide__label confirm-slide__label--fill${
              stageTransitionMountedRef.current && !reduceMotion ? ' is-entering' : ''
            }${stageAlignRight ? ' is-docked-right' : ' is-docked-left'}${
              done ? ' is-done' : ''
            }`}
          >
            {stageLabel}
          </span>
        </div>

        <button
          ref={thumbRef}
          type="button"
          disabled={disabled}
          aria-disabled={disabled || phase !== 'idle'}
          aria-busy={busy}
          aria-label={`${label}，向右滑动或按回车确认`}
          className={`confirm-slide__thumb${
            phase === 'idle' && !disabled ? ' is-grab' : ''
          }${phase === 'dragging' ? ' is-grabbing' : ''}`}
          style={{
            left: INSET - 1,
            top: INSET - 1,
            width: THUMB,
            height: THUMB,
          }}
          onClick={onClick}
          onPointerCancel={onPointerUp}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <span className="confirm-slide__sr-only">
            {busy ? `${confirmingLabel}…` : done ? doneLabel : label}
          </span>
          <span className="confirm-slide__icon-box" aria-hidden="true">
            {/* ArrowRight */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`confirm-slide__arrow${
                armed && !busy && !done ? ' is-armed' : ''
              }${busy || done ? ' is-hidden' : ''}`}
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>

            {/* Check */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`confirm-slide__check${done ? ' is-visible' : ''}`}
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>

            {/* Spinner: paused when not busy so it fades out without snapping */}
            <svg
              viewBox="0 0 24 24"
              className={`confirm-slide__spinner${busy ? ' is-visible' : ''}`}
            >
              <circle
                className="confirm-slide__spinner-track"
                cx="12"
                cy="12"
                fill="none"
                r="9"
                strokeWidth="2.5"
              />
              <circle
                className="confirm-slide__spinner-arc"
                cx="12"
                cy="12"
                fill="none"
                r="9"
                strokeDasharray="14 43"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
            </svg>
          </span>
        </button>
      </div>

      <span aria-live="polite" className="confirm-slide__sr-only">
        {busy ? `${confirmingLabel}…` : ''}
        {done ? doneLabel : ''}
      </span>
    </div>
  );
}
