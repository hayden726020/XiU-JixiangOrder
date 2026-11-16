export function assertFen(fen: number): void {
  if (!Number.isInteger(fen) || fen < 0) {
    throw new TypeError('金额必须是非负整数分');
  }
}

export function fenToYuan(fen: number): number {
  assertFen(fen);
  return fen / 100;
}

export function formatYuan(fen: number): string {
  return `¥${fenToYuan(fen).toFixed(2)}`;
}

export interface PricedQuantity {
  unitPriceFen: number;
  quantity: number;
}

export function sumFen(items: PricedQuantity[]): number {
  let total = 0;
  for (const item of items) {
    assertFen(item.unitPriceFen);
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new TypeError('份数必须是非负整数');
    }
    total += item.unitPriceFen * item.quantity;
  }
  return total;
}