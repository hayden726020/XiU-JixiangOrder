import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { DECK_SPRINGS, stepDeckSpring } from '../utils/profileOrderDeck';
import type { DeckSpring } from '../utils/profileOrderDeck';

interface DeckItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface CardState {
  id: string;
  el: HTMLElement;
  x: DeckSpring;
  y: DeckSpring;
  depth: DeckSpring;
  flying: boolean;
  flightZ: number;
}

function spring(x: number, [k, c]: readonly [number, number]): DeckSpring {
  return { x, v: 0, t: x, k, c };
}

function tune(s: DeckSpring, [k, c]: readonly [number, number], reduced: boolean): void {
  s.k = k;
  s.c = reduced ? 2 * Math.sqrt(k) : c;
}

export default function ProfileOrderDeck({ items }: { items: DeckItem[] }) {
  const elements = useRef(new Map<string, HTMLElement>());
  const container = useRef<HTMLElement | null>(null);
  const advance = useRef<((id: string) => void) | null>(null);
  const ids = items.map((item) => item.id).join('\u0000');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cards: CardState[] = items.flatMap((item, index) => {
      const el = elements.current.get(item.id);
      return el ? [{
        id: item.id,
        el,
        x: spring(0, DECK_SPRINGS.follow),
        y: spring(0, DECK_SPRINGS.follow),
        depth: spring(index, DECK_SPRINGS.depth),
        flying: false,
        flightZ: 0,
      }] : [];
    });
    let order = [...cards];
    let flightZ = 50;
    let frameId = 0;
    const recycleIds = new Set<number>();
    let last = performance.now();
    const resizeObserver = new ResizeObserver(() => {
      if (container.current) {
        container.current.style.height = `${Math.max(...cards.map((card) => card.el.offsetHeight)) + (cards.length > 1 ? 30 : 8)}px`;
      }
    });
    cards.forEach((card) => resizeObserver.observe(card.el));

    function render() {
      const top = order[0];
      for (const card of cards) {
        const isTop = card === top;
        const depth = Math.max(0, card.depth.x);
        const visibleDepth = Math.min(depth, 2);
        const scale = 1 - visibleDepth * 0.028;
        const y = visibleDepth * 13;
        card.el.style.transform = `translate(${card.x.x}px, ${card.y.x + y}px) rotate(${card.x.x * 0.065}deg) scale(${scale})`;
        card.el.style.opacity = String(Math.max(0, Math.min(1, 3.8 - depth)));
        card.el.style.setProperty('--deck-brightness', String(1 - visibleDepth * 0.1));
        card.el.style.zIndex = String(card.flying ? card.flightZ : 40 - Math.round(card.depth.t));
        const pointerEvents = isTop && !card.flying ? 'auto' : 'none';
        if (card.el.style.pointerEvents !== pointerEvents) card.el.style.pointerEvents = pointerEvents;
        const tabIndex = isTop ? 0 : -1;
        if (card.el.tabIndex !== tabIndex) card.el.tabIndex = tabIndex;
        const hidden = String(!isTop);
        if (card.el.getAttribute('aria-hidden') !== hidden) card.el.setAttribute('aria-hidden', hidden);
      }
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (let sub = 0; sub < 4; sub += 1) {
        for (const card of cards) {
          stepDeckSpring(card.x, dt / 4);
          stepDeckSpring(card.y, dt / 4);
          stepDeckSpring(card.depth, dt / 4);
        }
      }
      order.forEach((card, index) => { card.depth.t = index; });
      render();
      frameId = requestAnimationFrame(frame);
    }

    advance.current = (id) => {
      const card = order[0];
      if (!card || card.id !== id || card.flying) return;
      if (reduced) {
        order = [...order.slice(1), card];
        order.forEach((item, index) => { item.depth.x = item.depth.t = index; });
        render();
        return;
      }
      card.flying = true;
      card.flightZ = ++flightZ;
      tune(card.x, DECK_SPRINGS.fly, reduced);
      tune(card.y, DECK_SPRINGS.fly, reduced);
      card.x.v = 1500;
      card.x.t = Math.max(window.innerWidth / 2 + 360, card.x.x + 420);
      card.y.t = -26;
      order = [...order.slice(1), card];
      if (document.activeElement === card.el && order[0] !== card) {
        order[0].el.focus({ preventScroll: true });
      }
      render();
      const recycleId = window.setTimeout(() => {
        card.flying = false;
        card.x.x = 30;
        card.x.v = 0;
        card.x.t = 0;
        card.y.x = card.y.v = card.y.t = 0;
        card.depth.x = order.length + 0.5;
        tune(card.x, DECK_SPRINGS.return, reduced);
        tune(card.y, DECK_SPRINGS.return, reduced);
        recycleIds.delete(recycleId);
        render();
      }, 420);
      recycleIds.add(recycleId);
    };

    render();
    frameId = requestAnimationFrame(frame);
    return () => {
      advance.current = null;
      cancelAnimationFrame(frameId);
      recycleIds.forEach((id) => window.clearTimeout(id));
      resizeObserver.disconnect();
    };
  }, [ids]);

  return (
    <section ref={container} className="profile-ticket-deck" aria-label="当前订单">
      {items.map((item) => (
        <article
          key={item.id}
          ref={(el) => { if (el) elements.current.set(item.id, el); else elements.current.delete(item.id); }}
          className="profile-ticket profile-ticket-deck__card"
          aria-label={`${item.label}，单击切换下一张订单`}
          onClick={() => advance.current?.(item.id)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              advance.current?.(item.id);
            }
          }}
        >
          {item.content}
        </article>
      ))}
    </section>
  );
}