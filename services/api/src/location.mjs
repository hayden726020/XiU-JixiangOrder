import { notFound, unavailable } from './errors.mjs';
import { readSetting } from './db.mjs';
import { runIdempotent, transaction } from './orders.mjs';
import {
  asRecord,
  nowIso,
  requestHash,
  requireEnum,
  requireOnlyFields,
  requireString,
  toShanghaiIso,
} from './util.mjs';

export const LOCATION_TTL_MS = 10 * 60 * 1000;
export const LOCATION_RETENTION_MS = 24 * 60 * 60 * 1000;
const PICKUP_REFERENCE_MS = 30 * 60 * 1000;
const CROWD_TTL_MS = 5 * 60 * 1000;

export function getDiningConfig({ db }) {
  const setting = readSetting(db, 'dining_config');
  if (!setting) {
    throw unavailable('食堂配置尚未初始化。');
  }
  return {
    status: 200,
    body: { data: { ...setting.value, version: setting.version } },
  };
}

function purgeOldLocations(db, now) {
  db.prepare('DELETE FROM locations WHERE observed_at < ?').run(now - LOCATION_RETENTION_MS);
}

export function reportLocation({ db, clock, user, body }) {
  const input = asRecord(body);
  requireOnlyFields(input, ['requestId', 'presence']);
  const requestId = requireString(input.requestId, 'requestId', { max: 120 });
  const presence = requireEnum(input.presence, 'presence', ['INSIDE', 'OUTSIDE', 'UNKNOWN']);
  const now = clock();
  const hash = requestHash(input);

  return transaction(db, () =>
    runIdempotent(db, { actorId: user.id, operation: 'report-location', requestId, hash, now }, () => {
      purgeOldLocations(db, now);
      db.prepare(
        `INSERT INTO locations (user_id, presence, observed_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET presence = excluded.presence, observed_at = excluded.observed_at`,
      ).run(user.id, presence, now);
      return {
        status: 200,
        body: {
          data: {
            presence,
            observedAt: toShanghaiIso(now),
            expiresAt: toShanghaiIso(now + LOCATION_TTL_MS),
          },
        },
      };
    }),
  );
}

export function deleteLocation({ db, clock, user }) {
  purgeOldLocations(db, clock());
  db.prepare('DELETE FROM locations WHERE user_id = ?').run(user.id);
  return { status: 204 };
}

export function getCrowd({ db, clock, query }) {
  const slotId = requireString(query.get('slotId'), 'slotId', { max: 120 });
  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
  if (!slot) {
    throw notFound('SLOT_NOT_FOUND', '时段不存在。');
  }
  const now = clock();
  purgeOldLocations(db, now);

  const config = readSetting(db, 'dining_config');
  const thresholds = readSetting(db, 'crowd_thresholds');
  const canteenId = config?.value?.canteenId ?? 'demo-canteen-01';
  const crowdedAt = Number.isInteger(thresholds?.value?.crowdedAt) ? thresholds.value.crowdedAt : 10;

  const slotOrders = db
    .prepare(
      `SELECT student_id, status, dining_mode, picked_up_at
       FROM orders
       WHERE slot_id = ? AND dining_mode = 'DINE_IN' AND status != 'CANCELLED'`,
    )
    .all(slot.id);
  const reservedUsers = new Set(slotOrders.map((order) => order.student_id));
  const basis = [];
  if (reservedUsers.size > 0) {
    basis.push('RESERVATION');
  }

  const isCurrentSlot = slot.start_at <= now && now < slot.end_at;
  let currentReferenceUsers = null;

  if (isCurrentSlot) {
    const recentLocations = db
      .prepare('SELECT user_id, presence, observed_at FROM locations WHERE observed_at >= ?')
      .all(now - LOCATION_TTL_MS);
    const latestByUser = new Map();
    for (const location of recentLocations) {
      latestByUser.set(location.user_id, location);
    }

    const insideUsers = new Set(
      [...latestByUser.values()].filter((location) => location.presence === 'INSIDE').map((location) => location.user_id),
    );
    const outsideUsers = new Set(
      [...latestByUser.values()]
        .filter((location) => location.presence === 'OUTSIDE')
        .map((location) => location.user_id),
    );
    const pickupUsers = new Set(
      slotOrders
        .filter((order) => order.picked_up_at !== null && order.picked_up_at >= now - PICKUP_REFERENCE_MS)
        .map((order) => order.student_id),
    );

    const candidates = new Set(
      [...insideUsers].filter((userId) => reservedUsers.has(userId)),
    );
    for (const userId of pickupUsers) {
      candidates.add(userId);
    }
    for (const userId of outsideUsers) {
      candidates.delete(userId);
    }

    if ([...insideUsers].some((userId) => reservedUsers.has(userId))) {
      basis.push('LOCATION');
    }
    if (pickupUsers.size > 0) {
      basis.push('PICKUP');
    }

    currentReferenceUsers = basis.some((item) => item === 'LOCATION' || item === 'PICKUP')
      ? candidates.size
      : null;
  }

  let level;
  if (currentReferenceUsers !== null) {
    level = currentReferenceUsers >= crowdedAt ? 'CROWDED' : 'NO_ALERT';
  } else if (reservedUsers.size >= crowdedAt) {
    level = 'CROWDED';
  } else if (reservedUsers.size === 0) {
    level = 'UNKNOWN';
  } else {
    level = 'NO_ALERT';
  }

  const message =
    level === 'CROWDED'
      ? '演示数据：当前堂食可能较拥挤。仍可选择堂食，不保证座位；仅为本平台参考。'
      : level === 'NO_ALERT'
        ? '演示数据：暂无拥挤提醒，但不代表有空位；仅为本平台参考。'
        : '暂无足够信息判断堂食人数，请以现场为准。';

  return {
    status: 200,
    body: {
      data: {
        canteenId,
        slotId: slot.id,
        referenceScope: 'PLATFORM_ONLY',
        reservedDineInUsers: reservedUsers.size,
        currentReferenceUsers,
        level,
        basis,
        updatedAt: nowIso(clock),
        expiresAt: toShanghaiIso(now + CROWD_TTL_MS),
        demo: config?.value?.demo === true,
        message,
      },
    },
  };
}

export function getHealth({ db, clock }) {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  return {
    status: 200,
    body: {
      data: {
        service: 'xiu-jixiang-order-api',
        version: '0.1.0-draft',
        time: nowIso(clock),
        demoUsers: userCount,
      },
    },
  };
}