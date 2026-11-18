import { preloadImages } from '../../../shared/imagePreload';
import campusHero from '../assets/campus-hero.webp';
import noodleCounter from '../assets/noodle-counter.webp';
import stallCounterJiachang from '../assets/stall-counter-jiachang.webp';
import stallCounterXiaochao from '../assets/stall-counter-xiaochao.webp';
import stallCounterMianshi from '../assets/stall-counter-mianshi.jpg';
import warmNoodleBanner from '../assets/warm-noodle-banner.webp';
import dishChickenLeg from '../assets/dish-chicken-leg.webp';
import dishBeefNoodle from '../assets/dish-beef-noodle.webp';
import dishChickenRice from '../assets/dish-chicken-rice.png';
import dishTomatoEgg from '../assets/dish-tomato-egg.jpg';
import friedRice from '../assets/fried-rice.webp';
import studentAvatar from '../assets/student-avatar.png';
import loginFoodRice from '../assets/login-food-rice.jpg';
import loginFoodNoodle from '../assets/login-food-noodle.jpg';
import loginTrays from '../assets/login-trays.jpg';

const CORE_STUDENT_ASSETS = [
  campusHero,
  noodleCounter,
  stallCounterJiachang,
  stallCounterXiaochao,
  stallCounterMianshi,
  warmNoodleBanner,
  dishChickenLeg,
  dishBeefNoodle,
  dishChickenRice,
  dishTomatoEgg,
  friedRice,
  studentAvatar,
  loginFoodRice,
  loginFoodNoodle,
  loginTrays,
] as const;

let scheduled = false;

/**
 * Warms browser/WebView cache and decoded bitmap cache for core student imagery
 * shortly after first paint so subsequent tab and page transitions render instantly.
 */
export function scheduleCoreStudentImagePreload(): void {
  if (typeof window === 'undefined' || scheduled) return;
  scheduled = true;

  const run = () => preloadImages(CORE_STUDENT_ASSETS);
  if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 600 });
  } else {
    window.setTimeout(run, 120);
  }
}
