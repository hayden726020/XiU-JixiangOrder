import { STAY_THRESHOLD_MS } from '../state/stayRuntime';

export const STAY_THRESHOLD_MINUTES = STAY_THRESHOLD_MS / 60_000;

export const STAY_USAGE_TEXT = `停留计时：仅统计本页前台可见时间，累计满 ${STAY_THRESHOLD_MINUTES} 分钟会再判断一次位置；离开页面期间不计时。`;

export const STAY_TRIGGERED_TEXT = '已重新判断位置。';

export const STAY_FAILED_TEXT = '本次自动判断未完成，可手动重新获取位置。';

export const STAY_PAUSED_TEXT = '离开页面期间不计时。';

export const STAY_SIGNED_OUT_TEXT = '登录后才会同步位置判断。';