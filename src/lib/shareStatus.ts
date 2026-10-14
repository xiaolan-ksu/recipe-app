import { create } from 'zustand';

/**
 * 共享同步的连线状态。单独放一个不进本地存储的小 store，
 * 免得「在线」这种临时状态被写到手机上、下次打开还显示旧的。
 */
export type ShareStatus = 'off' | 'syncing' | 'online' | 'offline' | 'invalid';

interface ShareStatusState {
  status: ShareStatus;
  message: string;
  setStatus: (status: ShareStatus, message?: string) => void;
}

export const useShareStatus = create<ShareStatusState>((set) => ({
  status: 'off',
  message: '',
  setStatus: (status, message = '') => set({ status, message }),
}));

export const SHARE_STATUS_LABEL: Record<ShareStatus, string> = {
  off: '还没配对',
  syncing: '正在同步…',
  online: '已连接',
  offline: '暂时连不上，改动先存在手机上',
  invalid: '配对已失效，需要重新配对',
};
