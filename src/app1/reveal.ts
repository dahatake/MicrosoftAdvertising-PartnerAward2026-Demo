// App1 のカードの出現のアニメーション（NFR-UX-004 AC-092、NFR-A11Y-002）。
// 通常は、画面に入ったときに下から浮かび上がる（Framer Motion の whileInView）。
// 「動きを減らす」のときは最初から最終の状態で描き（initial: false）、動きの時間と遅れを 0（PARAM-007）にする。
// どちらの場合も内容（文字）と操作は DOM にあり、出現の動きは見た目だけを変える。
import type { MotionProps, Transition } from 'framer-motion';

/** 「動きを減らす」のときの動きの最大時間（ミリ秒）。PARAM-007 */
export const REDUCED_MOTION_MS = 0;

/** 通常の出現の動き（秒）。並んだカードは少しずつ遅らせて順に出す */
const DURATION_S = 0.5;
const STAGGER_S = 0.08;
const OFFSET_Y = 24;

/** 出現の動きの props（motion の要素に広げて使う）。reduce は OS の「動きを減らす」設定 */
export function revealMotion(
  reduce: boolean,
  index = 0,
): Pick<MotionProps, 'initial' | 'animate' | 'whileInView' | 'viewport' | 'transition'> {
  if (reduce) {
    // 静止: 最初から最終の状態（不透明・移動なし）で描き、画面に入っても動かさない
    const still: Transition = { duration: REDUCED_MOTION_MS / 1000, delay: 0 };
    return { initial: false, transition: still };
  }
  const transition: Transition = { duration: DURATION_S, delay: index * STAGGER_S, ease: [0.16, 1, 0.3, 1] };
  const shown = { opacity: 1, y: 0 };
  // IntersectionObserver がない環境では、画面に入るのを待たずに表示時に出す（内容が隠れたままにならない）
  if (typeof IntersectionObserver === 'undefined') {
    return { initial: { opacity: 0, y: OFFSET_Y }, animate: shown, transition };
  }
  return {
    initial: { opacity: 0, y: OFFSET_Y },
    whileInView: shown,
    viewport: { once: true, amount: 0.15 },
    transition,
  };
}
