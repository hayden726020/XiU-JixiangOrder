import { conflict, notFound, validationError } from './errors.mjs';
import { readSetting, writeSetting } from './db.mjs';
import { runIdempotent, transaction } from './orders.mjs';
import {
  asRecord,
  requestHash,
  requireEnum,
  requireInteger,
  requireString,
  toShanghaiIso,
} from './util.mjs';

const SECTIONS = ['dining', 'crowd'];

function settingKey(section) {
  return section === 'dining' ? 'dining_config' : 'crowd_thresholds';
}

function validateDining(value) {
  const record = asRecord(value);
  const center = asRecord(record.center);
  const latitude = center.latitude;
  const longitude = center.longitude;
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    throw validationError('center.latitude 必须是 -90 到 90 的数字。');
  }
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    throw validationError('center.longitude 必须是 -180 到 180 的数字。');
  }
  const radiusMeters = requireInteger(record.radiusMeters, 'radiusMeters', { min: 1, max: 5000 });
  const accuracyToleranceMeters = requireInteger(record.accuracyToleranceMeters, 'accuracyToleranceMeters', {
    min: 0,
    max: 500,
  });
  return {
    canteenId: requireString(record.canteenId, 'canteenId', { max: 120 }),
    name: requireString(record.name, 'name', { max: 120 }),
    center: { latitude, longitude },
    radiusMeters,
    accuracyToleranceMeters,
    demo: record.demo === true,
  };
}

function validateCrowd(value) {
  const record = asRecord(value);
  return {
    crowdedAt: requireInteger(record.crowdedAt, 'crowdedAt', { min: 1, max: 1000 }),
    demo: record.demo === true,
  };
}

function sectionView(setting) {
  return { ...setting.value, version: setting.version };
}

export function getAdminSettings({ db }) {
  const dining = readSetting(db, 'dining_config');
  const crowd = readSetting(db, 'crowd_thresholds');
  if (!dining || !crowd) {
    throw notFound('SETTING_NOT_FOUND', '配置尚未初始化。');
  }
  return {
    status: 200,
    body: { data: { dining: sectionView(dining), crowd: sectionView(crowd) } },
  };
}

export function putAdminSettings({ db, clock, user, body }) {
  const input = asRecord(body);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const section = requireEnum(input.section, 'section', SECTIONS);
  const expectedVersion = requireInteger(input.expectedVersion, 'expectedVersion', { min: 1, max: 1_000_000 });
  const value = section === 'dining' ? validateDining(input.value) : validateCrowd(input.value);
  const now = clock();
  const key = settingKey(section);
  const hash = requestHash(input);

  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: `update-settings:${section}`, requestId, hash, now }, () => {
      const current = readSetting(db, key);
      if (!current) {
        throw notFound('SETTING_NOT_FOUND', '配置尚未初始化。');
      }
      if (current.version !== expectedVersion) {
        throw conflict('SETTING_VERSION_CONFLICT', '配置已被修改，请刷新后再保存。');
      }
      const storedValue = section === 'dining' ? { ...value, updatedAt: toShanghaiIso(now) } : value;
      const nextVersion = writeSetting(db, key, storedValue, expectedVersion, now);
      if (nextVersion === null) {
        throw conflict('SETTING_VERSION_CONFLICT', '配置已被修改，请刷新后再保存。');
      }
      return {
        status: 200,
        body: { data: { section, ...storedValue, version: nextVersion } },
      };
    }),
  );
}