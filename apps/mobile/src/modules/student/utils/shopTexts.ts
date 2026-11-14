export const SHOP_PICKER_TITLE = '选择店铺';
export const SHOP_PICKER_LEAD = '先选择店铺，菜单只显示这家店的菜品。';
export const SHOP_LIST_LOADING = '正在读取店铺列表…';
export const DEMO_SHOP_LABEL = '演示店铺';
export const DEMO_DATA_LABEL = '演示数据';
export const CURRENT_SHOP_PREFIX = '当前店铺';
export const SAMPLE_ONLY_LABEL = '仅样例';

export const CANTEEN_MISSING = '所属食堂未提供';
export const ORDERABLE_MISSING = '可下单状态未提供';
export const ORDERABLE_YES = '可下单';
export const ORDERABLE_NO = '暂不可下单';
export const SHOP_NAME_MISSING = '店铺名称未提供';

export const SHOP_SWITCH_NOTICE = '已切换店铺，请重新选择';
export const SHOP_SWITCH_BUSY = '正在提交，请等待结果';
export const SHOP_CLOSED_REASON = '该店铺暂不可下单';
export const SHOP_FOREIGN_ITEM_NOTICE = '已移除不属于当前店铺的菜品，请重新确认';

export const SHOP_LIST_UNAVAILABLE_TEXT = '服务端未提供店铺列表';
export const SHOP_LIST_UNAVAILABLE_HINT =
  '契约 DRAFT v0.3 未定义店铺列表接口；真实模式不会回退演示店铺。';

export const DERIVED_ENTRY_LABEL = '仅按菜品归属继续（不显示店铺名称）';
export const DERIVED_NAME_NOTE = '店铺名称未提供，仅按菜品归属展示';
export const DERIVED_ENTRY_NOTE =
  '未连共同数据：店铺名称来自菜品归属，不是服务端店铺数据；进入后仍只显示该 merchantId 的菜品。';

export const EMPTY_SHOP_LIST = '当前没有可下单的店铺';
export const EMPTY_SHOP_MENU = '本店今日暂无可下单菜品';
export const SHOP_MENU_MISSING_MERCHANT = '服务端未提供菜品所属店铺，无法按店铺展示';

export const ORDER_SHOP_LABEL = '所属店铺';
export const ORDER_SHOP_DEMO_NOTE = '演示店铺';
export const ORDER_SHOP_NAME_MISSING = '服务端未提供店铺名称';
export const ORDER_SHOP_SERVER_MISSING = '服务端未提供所属店铺';
export const ORDER_SHOP_FIELD_PENDING = '待服务端补充订单店铺字段';
export const ORDER_SHOP_SAMPLE_MISSING = '未记录所属店铺';

export const SHOP_CROSS_ITEM_MESSAGE =
  '该订单包含不同店铺的菜品，请返回菜单只保留当前店铺菜品。';
export const SHOP_LIST_UNAVAILABLE_ERROR =
  '无法读取店铺列表，请确认服务已启动、地址可达。';