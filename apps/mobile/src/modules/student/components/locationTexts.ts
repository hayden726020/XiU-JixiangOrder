import type { PresenceReasonKey } from '../data/presenceAdapter';
import type { PresenceSyncKind } from '../state/presenceRuntime';

export const LOCATION_USAGE_SUMMARY = '用于判断是否在食堂附近，不影响下单';

const USAGE_USE = '用途：仅用于辅助判断你是否在食堂附近，帮助展示堂食参考。';
const USAGE_RANGE = '范围：坐标只在手机内完成范围判断，不上传、不保存、不写日志。';
const USAGE_IMPACT =
  '影响：拒绝或定位失败不影响选餐、堂食和外带下单；判断仅为近似依据。';
const USAGE_CLEAR = '清除：可随时清除本人的位置判断记录；清除不会删除订单。';

export const LOCATION_USAGE_ITEMS_REAL = [
  USAGE_USE,
  '频率：进入时段与用餐方式页时自动获取一次（每次进入最多一次），不持续跟踪；也可点击“重新获取位置”。',
  USAGE_RANGE,
  USAGE_IMPACT,
  USAGE_CLEAR,
];

export const LOCATION_USAGE_ITEMS_SAMPLE = [
  USAGE_USE,
  '频率：样例模式不获取真实位置；真实模式下进入时段与用餐方式页时自动获取一次，不持续跟踪。',
  USAGE_RANGE,
  USAGE_IMPACT,
  USAGE_CLEAR,
];

export const LOCATION_USAGE_ITEMS = LOCATION_USAGE_ITEMS_REAL;

export function locationUsageItems(mode: 'sample' | 'real'): string[] {
  return (mode === 'real' ? LOCATION_USAGE_ITEMS_REAL : LOCATION_USAGE_ITEMS_SAMPLE).slice();
}

export const LOCATION_NO_PROMISE_TEXT =
  '位置判断只是近似依据，不提供精确人数，也不保证有座位；与拥挤参考各自独立。';

export const LOCATION_SAMPLE_TEXT = '样例模式不获取真实位置，也不产生可清除的位置记录。';

export const PRESENCE_TEXT = {
  loading: '正在获取位置…',
  inside: '已判断在食堂附近',
  outside: '判断为不在食堂附近',
  unknown: '无法判断位置，请以现场为准；不影响选餐与下单。',
  expired: '位置判断已过期，可重新获取',
  cleared: '已清除位置判断记录；不会删除订单',
  sample: '样例模式不获取真实位置',
  denied: '未获取到位置，不影响选餐与下单',
  restricted: '定位权限已关闭，可在系统设置中开启；不影响下单',
  unavailable: '暂无法自动获取位置，不影响下单',
} as const;

export const EMPTY_LOCATION_HINT = '尚未获取位置，可点击重新获取位置。';

export const PRESENCE_REASON_TEXT: Record<PresenceReasonKey, string> = {
  OK: '',
  PERMISSION_DENIED:
    '未获取到位置：定位权限被拒绝，可在系统设置开启后重试；不影响选餐与下单。',
  PERMISSION_RESTRICTED:
    '定位权限或系统定位服务已关闭，可在系统设置开启后重试；不影响选餐与下单。',
  POSITION_UNAVAILABLE:
    '暂无法获取位置：定位服务暂不可用，可稍后重试；不影响选餐与下单。',
  TIMEOUT: '获取位置超时，可点击重新获取位置重试；不影响选餐与下单。',
  ACCURACY_TOO_LOW: '定位精度不足，无法判断是否在食堂附近；不影响选餐与下单。',
  BOUNDARY_UNCERTAIN: '靠近食堂边界，无法确定是否在范围内；不影响选餐与下单。',
  CONFIG_UNAVAILABLE:
    '暂无法获取食堂范围（配置不可用），无法判断位置；不影响选餐与下单。',
  CAPABILITY_UNAVAILABLE: '定位能力暂不可用，无法判断位置；不影响选餐与下单。',
  SAMPLE_MODE: '',
};

export const DEMO_RANGE_TEXT =
  '演示范围参数：范围配置为演示值、未经现场核准，仅用于本机参考；不影响下单。';

export const SYNC_TEXT: Record<PresenceSyncKind, string> = {
  none: '',
  'not-signed-in': '登录后才会同步位置判断（当前仅在本机生效）。',
  pending: '正在同步位置判断…',
  synced: '',
  failed: '位置判断已在本机完成，但未同步到服务端，堂食参考可能未更新。',
  conflict: '位置判断未更新，请重试同步。',
};

export const SYNC_LOGIN_EXPIRED_TEXT =
  '登录已失效，请重新登录后同步位置判断；已选时段与用餐方式保留。';

export const CLEAR_PENDING_TEXT = '正在清除位置判断记录…';

export const CLEAR_FAILED_TEXT = '清除未完成，请重试；现有位置判断仍在。';

export const PRESENCE_RETRY_LABEL = '重新获取位置';
export const PRESENCE_RETRY_SYNC_LABEL = '重试同步';
export const PRESENCE_CLEAR_LABEL = '清除我的位置判断记录';