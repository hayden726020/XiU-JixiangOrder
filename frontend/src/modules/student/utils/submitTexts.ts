export const SLOT_OPEN_TEXT = '可预约';
export const SLOT_CLOSED_TEXT = '该时段已关闭';
export const SLOT_UNAVAILABLE_MESSAGE = '该时段暂不可用，请选择其他时段。';
export const SLOT_CLOSED_MESSAGE = '该时段已关闭，请选择其他时段。';
export const BACK_TO_SLOT_LABEL = '返回时段页';
export const BACK_TO_MENU_LABEL = '返回菜单';
export const EMPTY_SLOTS_TEXT = '暂无可用时段，请稍后重试';

export const DISH_SHORTAGE_TEXT = '菜品不足';
export const DISH_SHORTAGE_NOTICE = '该菜品不足，请选择其他菜品';
export const DISH_OFF_SALE_TEXT = '今日已停售';
export const DISH_LIMIT_TEXT = '已达可售数量';
export const DISH_SHORTAGE_SUBMIT = '菜品不足，无法下单。';

export function dishShortageWithNames(names: string[]): string {
  const kept = names.filter((name) => typeof name === 'string' && name.trim() !== '');
  if (kept.length === 0) {
    return DISH_SHORTAGE_SUBMIT;
  }
  return `以下菜品不足：${kept.join('、')}。请返回菜单选择其他菜品。`;
}