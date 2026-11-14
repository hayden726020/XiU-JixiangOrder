export const LOCATION_USAGE_SUMMARY = '用于判断是否在食堂附近，不影响下单';

export const LOCATION_USAGE_ITEMS = [
  '用途：仅用于辅助判断你是否在食堂附近，帮助展示堂食参考。',
  '频率：进入选餐页时自动获取一次，不持续跟踪；可手动重新获取。',
  '范围：坐标只在手机内完成范围判断，不上传、不保存、不写日志。',
  '影响：拒绝或定位失败不影响选餐、堂食和外带下单。',
  '清除：可随时清除本人的位置判断记录；清除不会删除订单。',
];

export const PRESENCE_TEXT = {
  loading: '正在获取位置…',
  inside: '已判断在食堂附近',
  outside: '判断为不在食堂附近',
  unknown: '无法判断位置，请以现场为准',
  denied: '未获取到位置，不影响选餐与下单',
  restricted: '定位权限已关闭，可在系统设置中开启；不影响下单',
  unavailable: '暂无法自动获取位置，不影响下单',
  sample: '样例模式不获取真实位置',
  cleared: '已清除位置判断记录；不会删除订单',
} as const;

export const PRESENCE_RETRY_LABEL = '重新获取位置';
export const PRESENCE_CLEAR_LABEL = '清除我的位置判断记录';