import { useEffect, useRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

/**
 * 横向滚动容器（分类胶囊、卡片横排都用它）。
 *
 * 为什么要单独包一层：手机上横滑靠原生手势，没问题；但网页版里
 * react-native-web 的横向 ScrollView 只认「滚轮 / 触摸板」横向滚动，
 * 鼠标按住拖动是不会滚的，而滚动条又被我们隐藏了 —— 在电脑上看起来
 * 就像「滑不动」。所以这里在网页端补一段鼠标拖拽滚动。
 * 手机端保持原样，不干涉原生手势。
 */
export function HScroll({ children, ...rest }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // react-native-web 的 ScrollView 实例上挂着 getScrollableNode()，拿到的就是那个可滚动 div
    const instance = ref.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null;
    const node = instance?.getScrollableNode?.();
    if (!node) return;

    // 手指/触控笔交给浏览器原生横滑，这里只管鼠标
    const DRAG_THRESHOLD = 4;
    let pointerId: number | null = null;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let swallowedClick = false;

    const onPointerDown = (event: PointerEvent) => {
      // 每次新的按下都清掉上一次的标记，避免误吞后面的点击
      swallowedClick = false;
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (node.scrollWidth <= node.clientWidth) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startLeft = node.scrollLeft;
      dragging = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        dragging = true;
        node.style.cursor = 'grabbing';
        node.style.userSelect = 'none';
        // 抓住指针，拖出容器范围也不会断
        node.setPointerCapture?.(event.pointerId);
      }
      node.scrollLeft = startLeft - dx;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (dragging) {
        // 拖动结束后浏览器还会补一个 click，不拦掉会误触到胶囊
        swallowedClick = true;
        try {
          node.releasePointerCapture?.(event.pointerId);
        } catch {
          // 指针早就没了，忽略
        }
      }
      pointerId = null;
      dragging = false;
      node.style.cursor = 'grab';
      node.style.removeProperty('user-select');
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!swallowedClick) return;
      swallowedClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    node.style.cursor = 'grab';
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerUp);
    node.addEventListener('click', onClickCapture, true);

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('click', onClickCapture, true);
      node.style.removeProperty('cursor');
    };
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} {...rest}>
      {children}
    </ScrollView>
  );
}
