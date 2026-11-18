import { useCallback, useEffect, useState } from 'react';

import type { StudentSource } from '../types';
import { resolveSourceNowMs } from '../utils/slotView';

const CLOCK_REFRESH_INTERVAL_MS = 15000;

/**
 * 追踪当前数据源对应的参考时间，真实模式下定时及回到前台时自动刷新。
 */
export function useSourceNowMs(
  source: Pick<StudentSource, 'mode' | 'getNow'>,
): [number, () => number] {
  const [nowMs, setNowMs] = useState(() => resolveSourceNowMs(source));

  const syncNow = useCallback(() => {
    const next = resolveSourceNowMs(source);
    setNowMs(next);
    return next;
  }, [source]);

  useEffect(() => {
    syncNow();
    if (source.mode !== 'real') {
      return;
    }
    const timer = window.setInterval(syncNow, CLOCK_REFRESH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [source, syncNow]);

  return [nowMs, syncNow];
}
