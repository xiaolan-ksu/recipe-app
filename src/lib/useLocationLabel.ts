import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppStore } from '../store/useAppStore';
import { describeCoords } from './geocode';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'failed';

/** 上次定位的时间（模块级，几个页面共用），避免切个 Tab 就又去查一次地名 */
let lastLocateAt = 0;
const FRESH_MS = 5 * 60 * 1000;

/**
 * 拿手机真实定位，反查成「城市 · 区」显示在首页左上角。
 * 首次打开会自动问一次权限，之后每次启动只在已经授权的情况下悄悄刷新。
 */
export function useLocationLabel() {
  const location = useAppStore((state) => state.location);
  const source = useAppStore((state) => state.locationSource);
  const coords = useAppStore((state) => state.locationCoords);
  const asked = useAppStore((state) => state.locationAsked);
  const setLocation = useAppStore((state) => state.setLocation);
  const setLocationCoords = useAppStore((state) => state.setLocationCoords);
  const markLocationAsked = useAppStore((state) => state.markLocationAsked);

  const [status, setStatus] = useState<LocationStatus>(source === 'none' ? 'idle' : 'ready');
  const running = useRef(false);

  const locate = useCallback(
    async (options?: { silent?: boolean }): Promise<LocationStatus> => {
      if (running.current) return 'locating';
      running.current = true;
      setStatus('locating');

      try {
        lastLocateAt = Date.now();
        let permission = await Location.getForegroundPermissionsAsync().catch(() => null);

        if (!permission?.granted && !options?.silent) {
          permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
          markLocationAsked();
        }

        if (!permission?.granted) {
          const next: LocationStatus = asked ? 'failed' : 'denied';
          setStatus(next);
          return next;
        }

        const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
        if (!servicesOn) {
          setStatus('failed');
          return 'failed';
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocationCoords(next);

        const label = await describeCoords(next);
        if (label) {
          setLocation(label, 'gps');
          setStatus('ready');
          return 'ready';
        }

        setStatus('failed');
        return 'failed';
      } catch {
        setStatus('failed');
        return 'failed';
      } finally {
        running.current = false;
      }
    },
    [asked, markLocationAsked, setLocation, setLocationCoords],
  );

  // 只在进 App 时跑一次：没问过就弹权限，问过就悄悄刷新
  useEffect(() => {
    // 自己手填的地址优先，后台不去覆盖它
    if (source === 'manual') {
      setStatus('ready');
      return;
    }
    // 刚定位过就别重复查了
    if (location.length > 0 && Date.now() - lastLocateAt < FRESH_MS) {
      setStatus('ready');
      return;
    }
    void locate({ silent: asked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = source !== 'none' ? location : '';

  return { label, coords, status, locate };
}
