import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { CAN_UPDATE } from './updates';

/** 两次「重新查一遍」之间至少隔这么久（启动时 expo-updates 自己已经查过一次） */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** 切走超过这么久才算「真离开了」；回来时会强行接着把没下完的更新下完 */
const BACKGROUND_GRACE_MS = 10 * 1000;

/**
 * 后台静默更新。
 *
 * 打开 App 时、以及每次从后台切回前台时，安安静静把新版本查出来、下下来，
 * 用户感觉不到（不弹窗、不打断）。下好的版本由 expo-updates 在**下次打开 App 时自动用上**。
 *
 * 关于「切到后台下载会停」：
 * 安卓在 App 切到后台一段时间后会冻结甚至杀掉进程，下载自然就断了（想不停就得开前台服务挂通知栏，
 * 为了一个菜谱 App 不值得）。所以这里的做法是**被打断就接着下**：
 * 从后台回来时如果发现刚才正在下载，就再发一次 `fetchUpdateAsync()`——
 * expo-updates 每个资源都是下完按内容 md5 存盘、下次发现文件已在就直接跳过
 * （`FileDownloader.kt` 里 `if (path.exists())` 那段），所以这一下是从没下完的地方接着下，
 * 已经下好的图片不会重来。
 *
 * 故意**不**在这里调 `reloadAsync()`：expo-updates 在后台重启时会先调 `onHostResume`，
 * 那是前台才该有的状态，安卓上会不会出岔子没法在电脑上验。想立刻换新版走面板上的「马上重启」。
 */
export function useAutoUpdate(): void {
  const updatesState = Updates.useUpdates();
  const { lastCheckForUpdateTimeSinceRestart } = updatesState;

  const lastCheckRef = useRef(0);
  const busyRef = useRef(false);
  /** 上次没下完（被系统冻住 / 网断了）：下次回前台不用再等一小时，直接接着下 */
  const retryRef = useRef(false);
  /** 切后台的时候正在下载 */
  const interruptedRef = useRef(false);
  const backgroundedAtRef = useRef(0);
  // 异步流程里要读「此刻」的状态，闭包里的会过期
  const stateRef = useRef(updatesState);
  stateRef.current = updatesState;

  if (lastCheckForUpdateTimeSinceRestart) {
    lastCheckRef.current = lastCheckForUpdateTimeSinceRestart.getTime();
  }

  useEffect(() => {
    if (!CAN_UPDATE) return;

    /** 查一次 + 把能下的下完。force = 刚从后台回来，别管节流，接着下 */
    const sync = async (force = false) => {
      if (busyRef.current) return;

      const live = stateRef.current;
      // 已经下好了：等下次启动自动生效
      if (live.isUpdatePending) {
        retryRef.current = false;
        return;
      }
      // 正在检查 / 正在下（比如启动那次，或者下载还在正常跑）：别插队，
      // expo-updates 的检查下载是排队跑的，插进去只会白等
      if (!force && (live.isChecking || live.isDownloading)) return;

      busyRef.current = true;
      try {
        // 1) 先确认有没有新版：已经知道有（availableUpdate 还在）就不用再问
        let hasUpdate = Boolean(live.availableUpdate);
        if (!hasUpdate) {
          const shouldCheck = force || retryRef.current || Date.now() - lastCheckRef.current >= CHECK_INTERVAL_MS;
          if (!shouldCheck) return;
          lastCheckRef.current = Date.now();
          const result = await Updates.checkForUpdateAsync();
          hasUpdate = result.isAvailable;
        }
        if (!hasUpdate) {
          retryRef.current = false;
          return;
        }

        // 2) 下 / 接着下
        retryRef.current = false;
        await Updates.fetchUpdateAsync();
        if (!stateRef.current.isUpdatePending) retryRef.current = true;
      } catch {
        // 没网 / 请求被系统冻住了 / 服务器没响应：下次回到前台接着试
        retryRef.current = true;
      } finally {
        busyRef.current = false;
      }
    };

    // 挂载时补一次：启动那次的检查可能因为当时没网失败了
    void sync();

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'background') {
        backgroundedAtRef.current = Date.now();
        interruptedRef.current = stateRef.current.isDownloading;
        return;
      }
      if (status !== 'active') return;

      const awayFor = Date.now() - backgroundedAtRef.current;
      const resumed = interruptedRef.current && awayFor >= BACKGROUND_GRACE_MS;
      interruptedRef.current = false;
      void sync(resumed);
    });

    return () => subscription.remove();
  }, []);
}
