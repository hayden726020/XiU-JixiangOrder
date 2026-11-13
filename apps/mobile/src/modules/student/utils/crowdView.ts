import type { CrowdLevel, CrowdReference } from '../types';

const LEVEL_TEXT: Record<CrowdLevel, { title: string; detail: string }> = {
  CROWDED: { title: '可能较拥挤', detail: '仍需以现场为准，可继续堂食或改选时段' },
  NO_ALERT: { title: '暂未触发提醒', detail: '不代表有座位' },
  UNKNOWN: { title: '信息不足', detail: '请以现场为准' },
};

const BASIS_TEXT = {
  RESERVATION: '预约需求',
  LOCATION: '近期位置判断',
  PICKUP: '近期取餐记录',
} as const;

export interface CrowdView {
  level: CrowdLevel;
  isEmpty: boolean;
  expired: boolean;
  numbersVisible: boolean;
  title: string;
  detail: string;
  reservedText: string;
  currentText: string;
  basisText: string;
  updatedText: string;
  demoText: string;
}

export interface CrowdViewOptions {
  now?: Date;
}

function timeOf(iso: string | null | undefined): string {
  const matched = /T(\d{2}:\d{2})/.exec(typeof iso === 'string' ? iso : '');
  return matched ? matched[1] : '';
}

function emptyView(overrides: Partial<CrowdView> = {}): CrowdView {
  return {
    level: 'UNKNOWN',
    isEmpty: true,
    expired: false,
    numbersVisible: false,
    title: '信息不足',
    detail: '请以现场为准',
    reservedText: '',
    currentText: '',
    basisText: '',
    updatedText: '',
    demoText: '演示数据',
    ...overrides,
  };
}

export function toCrowdView(
  crowd: CrowdReference | null,
  { now = new Date('2026-11-13T11:45:00+08:00') }: CrowdViewOptions = {},
): CrowdView {
  if (!crowd) {
    return emptyView();
  }

  const expiresAt = typeof crowd.expiresAt === 'string' ? new Date(crowd.expiresAt).getTime() : Number.NaN;
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
    return emptyView({ level: crowd.level, expired: true, title: '信息已过期', detail: '请以现场为准' });
  }

  const text = LEVEL_TEXT[crowd.level] ?? LEVEL_TEXT.UNKNOWN;
  const numbersVisible = crowd.level !== 'UNKNOWN';
  const reservedText =
    numbersVisible && Number.isInteger(crowd.reservedDineInUsers)
      ? `预约堂食 ${crowd.reservedDineInUsers} 人`
      : '';
  let currentText = '';
  if (numbersVisible) {
    currentText = Number.isInteger(crowd.currentReferenceUsers)
      ? `当前参考 ${crowd.currentReferenceUsers} 人`
      : '当前参考：不适用';
  }
  const basis =
    numbersVisible && Array.isArray(crowd.basis)
      ? crowd.basis.filter((item) => item in BASIS_TEXT)
      : [];
  const basisText = basis.length > 0 ? `依据：${basis.map((item) => BASIS_TEXT[item]).join('、')}` : '';
  const updatedTime = timeOf(crowd.updatedAt);

  return {
    level: crowd.level,
    isEmpty: false,
    expired: false,
    numbersVisible,
    title: text.title,
    detail: text.detail,
    reservedText,
    currentText,
    basisText,
    updatedText: updatedTime ? `更新于 ${updatedTime}` : '',
    demoText: crowd.demo ? '演示数据' : '',
  };
}