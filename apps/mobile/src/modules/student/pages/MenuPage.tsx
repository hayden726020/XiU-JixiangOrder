import { useEffect, useState } from 'react';
import type { OrderDraft } from '../state/orderDraft';
import type { DishDto, ItemCustomizationSelection, MenuResponse, ShopSummary, StudentSource } from '../types';
import { filterDishesByShop } from '../utils/dishShopFilter';
import { formatYuan } from '../utils/money';
import { toSourceErrorView } from '../utils/sourceErrorView';
import { SHOP_SWITCH_NOTICE } from '../utils/shopTexts';
import { preloadImages } from '../../../shared/imagePreload';
import { getCachedMenu, setCachedMenu } from '../state/studentDataCache';
import OrderDishCard from '../components/OrderDishCard';
import OrderMenuIcon from '../components/OrderMenuIcons';
import StudentTabBar from '../components/StudentTabBar';
import '../order-menu.css';

type LoadStatus = 'loading' | 'ready' | 'error';
type Category = '全部' | '主食' | '套餐' | '小吃' | '饮品';
const CATEGORIES: Category[] = ['全部', '主食', '套餐', '小吃', '饮品'];

function categoryOf(dish: DishDto): Category {
  if (/套餐|定食|组合/.test(dish.name)) return '套餐';
  if (/饭|面|粉|粥|饺|包|馒头/.test(dish.name)) return '主食';
  if (/饮|茶|咖啡|可乐|牛奶|酸奶|果汁|水$/.test(dish.name)) return '饮品';
  return '小吃';
}

function monthDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${Number(month)}-${day}`;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function datePrefix(date: string, index: number): string {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  return WEEKDAY_LABELS[new Date(`${date}T12:00:00+08:00`).getUTCDay()];
}

export interface MenuPageProps {
  source: StudentSource;
  draft: OrderDraft;
  shop: ShopSummary;
  onBackToShops: (trigger?: HTMLElement | null) => void;
  onProceed: (trigger?: HTMLElement | null) => void;
  onViewSampleOrder: (trigger?: HTMLElement | null) => void;
  onViewCancelOrder?: (trigger?: HTMLElement | null) => void;
  onOpenOrders: (trigger?: HTMLElement | null, viaTab?: boolean) => void;
  onGoHome?: (trigger?: HTMLElement | null) => void;
  onGoProfile?: (trigger?: HTMLElement | null) => void;
  focusDishId?: string | null;
  onFocusHandled?: () => void;
}

export default function OrderMenuPage({ source, draft, shop, onBackToShops, onProceed, onViewSampleOrder, onViewCancelOrder, onOpenOrders, onGoHome, onGoProfile, focusDishId = null, onFocusHandled }: MenuPageProps) {
  const [snapshot, setSnapshot] = useState(() => draft.getState());
  const date = snapshot.date;
  const initialMenu = getCachedMenu(source, date);
  const [menu, setMenu] = useState<MenuResponse | null>(() => initialMenu);
  const [status, setStatus] = useState<LoadStatus>(() => (initialMenu ? 'ready' : 'loading'));
  const [errorText, setErrorText] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [category, setCategory] = useState<Category>('全部');
  const [dateAnimDir, setDateAnimDir] = useState<'none' | 'forward' | 'backward'>('none');

  useEffect(() => {
    let cancelled = false;
    const token = draft.beginMenuRead();
    const cached = getCachedMenu(source, date);
    if (cached && reloadToken === 0) {
      setMenu(cached);
      setStatus('ready');
      draft.applyDishCatalog(filterDishesByShop(cached.dishes, shop.merchantId));
      setSnapshot(draft.getState());
    } else {
      setStatus('loading');
    }
    setErrorText('');
    source.getMenu(date).then(
      (data) => {
        if (cancelled || !draft.isMenuReadCurrent(token)) return;
        setCachedMenu(source, date, data);
        const filtered = filterDishesByShop(data.dishes, shop.merchantId);
        preloadImages(filtered.map((dish) => dish.imageUrl));
        setMenu(data);
        setStatus('ready');
        draft.applyDishCatalog(filtered);
        setSnapshot(draft.getState());
      },
      (error: unknown) => {
        if (cancelled || !draft.isMenuReadCurrent(token)) return;
        if (getCachedMenu(source, date) === null || reloadToken > 0) {
          setMenu(null);
          setStatus('error');
          setErrorText(toSourceErrorView(error));
        }
      },
    );
    return () => { cancelled = true; };
  }, [source, draft, shop.merchantId, date, reloadToken]);

  function changeDate(next: string, nextIndex: number): void {
    const currentIndex = snapshot.allowedDates.indexOf(date);
    if (next === date || !draft.setDate(next)) return;
    if (currentIndex >= 0 && nextIndex !== currentIndex) {
      setDateAnimDir(nextIndex > currentIndex ? 'forward' : 'backward');
    }
    const cachedNext = getCachedMenu(source, next);
    setMenu(cachedNext);
    setStatus(cachedNext ? 'ready' : 'loading');
    setSnapshot(draft.getState());
  }

  function updateQuantity(dish: DishDto, next: number): void {
    draft.setQuantity(dish, next);
    setSnapshot(draft.getState());
  }

  function updateCustomization(dish: DishDto, selection: ItemCustomizationSelection) {
    const result = draft.setCustomization(dish, selection);
    setSnapshot(draft.getState());
    return result;
  }

  const shopDishes = menu ? filterDishesByShop(menu.dishes, shop.merchantId) : [];
  const needsFlavor = snapshot.items.some((item) => {
    const dish = shopDishes.find((candidate) => candidate.dishId === item.dishId);
    if (!dish) return false;
    const chosen = new Set((item.selectedFlavors ?? []).map((entry) => entry.groupId));
    return dish.flavorGroups.some((group) => group.required && !chosen.has(group.id));
  });
  const shownDishes = category === '全部' ? shopDishes : shopDishes.filter((dish) => categoryOf(dish) === category);
  const canSwitchShop = draft.canSetShop();

  const isTwoDateSwitch = snapshot.allowedDates.length === 2;
  const activeDateIndex = Math.max(0, snapshot.allowedDates.indexOf(date));

  return <section className="meal-menu" aria-labelledby="meal-menu-title">
    <div className="meal-menu__main">
      <header className="meal-menu__header">
        <div className="meal-menu__heading"><h1 id="meal-menu-title">学生点餐</h1><span className="meal-menu__rays" aria-hidden="true">✳</span></div>
        <button className="meal-menu__orders ticket-edge" type="button" onClick={(event) => onOpenOrders(event.currentTarget, false)}><OrderMenuIcon name="receipt" size={21} /> 我的订单 <OrderMenuIcon name="chevron" size={17} /></button>
      </header>

      <div className="meal-menu__shop ticket-edge">
        <OrderMenuIcon name="shop" size={27} />
        <span className="meal-menu__shop-label">当前店铺</span>
        <strong>{shop.name}</strong>
        <button type="button" disabled={!canSwitchShop} onClick={(event) => onBackToShops(event.currentTarget)}>切换店铺 <OrderMenuIcon name="chevron" size={16} /></button>
      </div>
      {!canSwitchShop ? <p className="meal-menu__notice" role="status">订单结果待确认，暂时不能切换店铺。</p> : null}
      {source.mode === 'sample' ? <p className="meal-menu__demo">示例菜单 · 图片仅供参考</p> : <p className="meal-menu__demo">图片仅供参考</p>}

      <div
        className={`meal-menu__dates${isTwoDateSwitch ? ' meal-menu__dates--elastic' : ''}`}
        role="group"
        aria-label="选择菜单日期"
        data-active-index={isTwoDateSwitch ? activeDateIndex : undefined}
        data-anim-dir={isTwoDateSwitch ? dateAnimDir : undefined}
      >
        {isTwoDateSwitch ? <span className="meal-menu__dates-thumb" aria-hidden="true" /> : null}
        {snapshot.allowedDates.map((item, index) => <button key={item} type="button" className={date === item ? 'is-active' : ''} aria-pressed={date === item} onClick={() => changeDate(item, index)}><OrderMenuIcon name="calendar" size={21} /> {datePrefix(item, index)} {monthDay(item)}</button>)}
      </div>

      <div className="meal-menu__categories" role="tablist" aria-label="菜品分类，按名称整理">
        {CATEGORIES.map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>

      {snapshot.notice && snapshot.notice !== SHOP_SWITCH_NOTICE ? <p className="meal-menu__notice" role="status">{snapshot.notice}</p> : null}
      {status === 'loading' ? <p className="meal-menu__state">正在读取菜单…</p> : null}
      {status === 'error' ? <div className="meal-menu__state is-error" role="alert"><p>{errorText}</p><button type="button" onClick={() => setReloadToken((value) => value + 1)}>重新读取</button></div> : null}
      {status === 'ready' && shopDishes.length === 0 ? <p className="meal-menu__state">当前店铺暂无菜单信息</p> : null}
      {status === 'ready' && shopDishes.length > 0 && shownDishes.length === 0 ? <p className="meal-menu__state">此分类暂无菜品</p> : null}
      {status === 'ready' && shownDishes.length > 0 ? <ul className="meal-menu__dishes" aria-label="菜品列表">{shownDishes.map((dish, index) => <OrderDishCard key={dish.dishId} dish={dish} quantity={snapshot.items.find((item) => item.dishId === dish.dishId)?.quantity ?? 0} index={index} customization={draft.getCustomization(dish.dishId)} onQuantityChange={(next) => updateQuantity(dish, next)} onCustomizationChange={(selection) => updateCustomization(dish, selection)} autoOpen={focusDishId === dish.dishId} onAutoOpenHandled={onFocusHandled} />)}</ul> : null}

      {needsFlavor ? <p className="meal-menu__notice" role="status">有菜品还未选择必选口味，请点菜品上的“选配菜/口味”。</p> : null}

      {source.mode === 'sample' ? <div className="meal-menu__sample-actions"><button type="button" onClick={(event) => onViewSampleOrder(event.currentTarget)}>查看示例订单</button>{onViewCancelOrder ? <button type="button" onClick={(event) => onViewCancelOrder(event.currentTarget)}>查看取消状态</button> : null}</div> : null}
    </div>

    <div className="meal-menu__bottom">
      <div className="meal-menu__basket ticket-edge">
        <div className="meal-menu__basket-total"><OrderMenuIcon name="basket" size={24} /><span>共 {snapshot.totalQuantity} 份</span><i aria-hidden="true" /><strong>合计 {formatYuan(snapshot.previewFen)}</strong></div>
        <button type="button" disabled={!snapshot.canProceedToSlot} onClick={(event) => onProceed(event.currentTarget)}>选择取餐时间 <OrderMenuIcon name="chevron" size={18} /></button>
      </div>
      <p className="meal-menu__estimate">此处为预估金额，下单金额以服务端返回为准</p>
      <StudentTabBar
        active="order"
        placement="inline"
        onSelect={(tab, button) => {
          if (tab === 'home') {
            (onGoHome ?? onBackToShops)(button);
          } else if (tab === 'orders') {
            onOpenOrders(button, true);
          } else if (tab === 'profile') {
            if (onGoProfile) {
              onGoProfile(button);
            } else {
              onOpenOrders(button, true);
            }
          }
        }}
      />
    </div>
  </section>;
}
