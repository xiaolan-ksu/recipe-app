import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * 底部弹层需要往上抬多少（约等于键盘高度）。
 *
 * 正常情况下系统会自己压缩窗口、把弹层顶上去，但这个 App 开了全面屏
 * （edge-to-edge）而且 targetSdk 到了 36 —— Android 15 以后系统不再替
 * 开了全面屏的 App 压缩窗口了，弹层还贴在屏幕最底部，输入框就被键盘
 * 盖住。所以这里自己监听键盘高度，让弹层整体上移同样的距离。
 */
export function useKeyboardGap(visible: boolean): number {
  const [gap, setGap] = useState(0);

  useEffect(() => {
    if (!visible) {
      setGap(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setGap(Math.max(0, Math.round(event.endCoordinates?.height ?? 0)));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setGap(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  return visible ? gap : 0;
}
