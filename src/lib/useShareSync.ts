import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '../store/useAppStore';
import { fetchState, isUnchanged, newBatchId, postOps } from './share';
import { useShareStatus } from './shareStatus';

/** 每隔几秒拉一次最新状态（没有推送，只能这样做到「准实时」） */
const INTERVAL_MS = 4000;

function describe(error: unknown): { status: 'offline' | 'invalid'; message: string } {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'unauthorized') {
    return { status: 'invalid', message: '配对已失效，请重新配对' };
  }
  return { status: 'offline', message: '暂时连不上服务器，改动会先存在手机上' };
}

/**
 * 共享清单的同步循环，在 App 根部挂一次就行。
 *
 * 每一轮：先把本地攒下的改动提交上去（服务器合并后把最新状态还回来），
 * 没有待提交的就去拉一次最新的。断网时什么都不丢——改动留在队列里，
 * 联网后照顺序补交。
 */
export function useShareSync(): void {
  const token = useAppStore((state) => state.shareToken);

  useEffect(() => {
    if (!token) {
      useShareStatus.getState().setStatus('off');
      return;
    }

    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const syncOnce = async () => {
      if (stopped || busy) return;
      busy = true;
      const status = useShareStatus.getState();
      try {
        const store = useAppStore.getState();
        const outbox = store.shareOutbox;

        if (outbox.length > 0) {
          status.setStatus('syncing');
          const merged = await postOps(token, outbox, newBatchId());
          if (stopped) return;
          useAppStore.getState().confirmShareOpsSent(outbox.length);
          useAppStore.getState().applySharedState(merged);
        } else {
          const result = await fetchState(token, store.shareRev);
          if (stopped) return;
          if (isUnchanged(result)) useAppStore.getState().markShareSynced();
          else useAppStore.getState().applySharedState(result);
        }
        if (!stopped) useShareStatus.getState().setStatus('online');
      } catch (error) {
        if (stopped) return;
        const code = (error as { code?: string } | null)?.code;
        if (code === 'not_modified') {
          // 服务器回「和上次一样」，说明连得上，只是没新东西
          useAppStore.getState().markShareSynced();
          useShareStatus.getState().setStatus('online');
        } else {
          const { status: next, message } = describe(error);
          useShareStatus.getState().setStatus(next, message);
        }
      } finally {
        busy = false;
      }
    };

    const startTimer = () => {
      if (timer) return;
      timer = setInterval(() => void syncOnce(), INTERVAL_MS);
    };
    const stopTimer = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    void syncOnce();
    startTimer();

    // 退到后台就停，回到前台立刻同步一次（省电，也省流量）
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncOnce();
        startTimer();
      } else {
        stopTimer();
      }
    });

    return () => {
      stopped = true;
      stopTimer();
      subscription.remove();
    };
  }, [token]);
}
