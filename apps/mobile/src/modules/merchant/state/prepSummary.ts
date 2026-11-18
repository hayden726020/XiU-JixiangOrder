import type { MerchantOrder } from '../data/types';

export interface PrepDishRow {
  dishId: string;
  name: string;
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
  total: number;
}

export interface PrepSlotGroup {
  slotId: string;
  startLabel: string;
  endLabel: string;
  orderCount: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  completedOrders: number;
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
  prepTotal: number;
  total: number;
  dishes: PrepDishRow[];
}

export interface PrepSummaryData {
  groups: PrepSlotGroup[];
  orderCount: number;
  cancelledCount: number;
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
  prepTotal: number;
  total: number;
}

function clock(iso: string): string {
  return iso.slice(11, 16);
}

function orderDate(order: MerchantOrder): string {
  return order.slotStart.slice(0, 10) || order.createdAt.slice(0, 10);
}

type PrepPhase = 'pending' | 'preparing' | 'ready' | 'completed';

function phaseOf(order: MerchantOrder): PrepPhase | null {
  switch (order.status) {
    case 'NEW':
      return 'pending';
    case 'ACCEPTED':
    case 'PREPARING':
      return 'preparing';
    case 'READY':
      return 'ready';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
    default:
      return null;
  }
}

export function buildPrepSummary(orders: MerchantOrder[], date: string): PrepSummaryData {
  const groups = new Map<string, PrepSlotGroup & { dishMap: Map<string, PrepDishRow> }>();
  let cancelledCount = 0;

  for (const order of orders) {
    if (orderDate(order) !== date) continue;
    const phase = phaseOf(order);
    if (phase === null) {
      if (order.status === 'CANCELLED') cancelledCount += 1;
      continue;
    }
    let group = groups.get(order.slotId);
    if (!group) {
      group = {
        slotId: order.slotId,
        startLabel: clock(order.slotStart),
        endLabel: clock(order.slotEnd),
        orderCount: 0,
        pendingOrders: 0,
        preparingOrders: 0,
        readyOrders: 0,
        completedOrders: 0,
        pending: 0,
        preparing: 0,
        ready: 0,
        completed: 0,
        prepTotal: 0,
        total: 0,
        dishes: [],
        dishMap: new Map<string, PrepDishRow>(),
      };
      groups.set(order.slotId, group);
    }
    group.orderCount += 1;
    if (phase === 'pending') group.pendingOrders += 1;
    else if (phase === 'preparing') group.preparingOrders += 1;
    else if (phase === 'ready') group.readyOrders += 1;
    else group.completedOrders += 1;

    for (const item of order.items) {
      let row = group.dishMap.get(item.dishId);
      if (!row) {
        row = {
          dishId: item.dishId,
          name: item.name,
          pending: 0,
          preparing: 0,
          ready: 0,
          completed: 0,
          total: 0,
        };
        group.dishMap.set(item.dishId, row);
        group.dishes.push(row);
      }
      row[phase] += item.quantity;
      row.total += item.quantity;
      group[phase] += item.quantity;
      group.total += item.quantity;
      if (phase !== 'completed') group.prepTotal += item.quantity;
    }
  }

  const list = [...groups.values()]
    .sort((left, right) => left.startLabel.localeCompare(right.startLabel))
    .map((group): PrepSlotGroup => ({
      slotId: group.slotId,
      startLabel: group.startLabel,
      endLabel: group.endLabel,
      orderCount: group.orderCount,
      pendingOrders: group.pendingOrders,
      preparingOrders: group.preparingOrders,
      readyOrders: group.readyOrders,
      completedOrders: group.completedOrders,
      pending: group.pending,
      preparing: group.preparing,
      ready: group.ready,
      completed: group.completed,
      prepTotal: group.prepTotal,
      total: group.total,
      dishes: [...group.dishes].sort((left, right) => (
        right.total === left.total
          ? left.name.localeCompare(right.name, 'zh-Hans-CN')
          : right.total - left.total
      )),
    }));

  return {
    groups: list,
    orderCount: list.reduce((sum, group) => sum + group.orderCount, 0),
    cancelledCount,
    pending: list.reduce((sum, group) => sum + group.pending, 0),
    preparing: list.reduce((sum, group) => sum + group.preparing, 0),
    ready: list.reduce((sum, group) => sum + group.ready, 0),
    completed: list.reduce((sum, group) => sum + group.completed, 0),
    prepTotal: list.reduce((sum, group) => sum + group.prepTotal, 0),
    total: list.reduce((sum, group) => sum + group.total, 0),
  };
}