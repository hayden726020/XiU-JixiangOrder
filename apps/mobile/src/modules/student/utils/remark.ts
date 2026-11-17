export const ORDER_REMARK_MAX_LENGTH = 50;

export function sanitizeOrderRemark(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, ORDER_REMARK_MAX_LENGTH);
}