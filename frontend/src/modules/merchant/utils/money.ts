export function assertFen(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`金额必须是非负整数分，收到：${String(value)}`);
  }
}

export function fenToYuan(fen: number): string {
  assertFen(fen);
  return (fen / 100).toFixed(2);
}

export function formatYuan(fen: number): string {
  return `¥${fenToYuan(fen)}`;
}

export function totalQuantity(items: ReadonlyArray<{ quantity: number }>): number {
  return items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new TypeError(`菜品份数必须是正整数，收到：${String(item.quantity)}`);
    }
    return sum + item.quantity;
  }, 0);
}

export function itemsSummary(items: ReadonlyArray<{ name: string; quantity: number }>): string {
  return items.map((item) => `${item.name} ×${item.quantity}`).join('、');
}