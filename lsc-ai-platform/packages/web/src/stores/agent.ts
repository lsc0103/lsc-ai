/**
 * Client Agent 状态管理
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  hostname?: string;
  platform?: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: string;
}

interface AgentState {
  // 已配对的设备列表
  devices: AgentDevice[];
  // 当前选中的设备
  currentDeviceId: string | null;
  // 当前工作路径
  workDir: string | null;
  // 连接状态
  isConnected: boolean;
  // 是否正在检测
  isChecking: boolean;
  // 配对码（用于配对流程）
  pairingCode: string | null;

  // 操作
  setDevices: (devices: AgentDevice[]) => void;
  addDevice: (device: AgentDevice) => void;
  updateDeviceStatus: (deviceId: string, status: AgentDevice['status']) => void;
  setCurrentDevice: (deviceId: string | null) => void;
  setWorkDir: (workDir: string | null) => void;
  setConnected: (connected: boolean) => void;
  setChecking: (checking: boolean) => void;
  setPairingCode: (code: string | null) => void;
  clearWorkspace: () => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      devices: [],
      currentDeviceId: null,
      workDir: null,
      isConnected: false,
      isChecking: false,
      pairingCode: null,

      setDevices: (devices) => set({ devices }),

      addDevice: (device) =>
        set((state) => ({
          devices: [...state.devices.filter((d) => d.deviceId !== device.deviceId), device],
        })),

      updateDeviceStatus: (deviceId, status) =>
        set((state) => ({
          devices: state.devices.map((d) => (d.deviceId === deviceId ? { ...d, status } : d)),
          isConnected: state.currentDeviceId === deviceId ? status === 'online' : state.isConnected,
        })),

      setCurrentDevice: (deviceId) =>
        set((state) => {
          const device = state.devices.find((d) => d.deviceId === deviceId);
          return {
            currentDeviceId: deviceId,
            isConnected: device?.status === 'online',
          };
        }),

      setWorkDir: (workDir) => set({ workDir }),

      setConnected: (connected) => set({ isConnected: connected }),

      setChecking: (checking) => set({ isChecking: checking }),

      setPairingCode: (code) => set({ pairingCode: code }),

      clearWorkspace: () =>
        set({
          currentDeviceId: null,
          workDir: null,
          isConnected: false,
        }),
    }),
    {
      name: 'lsc-ai-agent',
      partialize: (state) => ({
        devices: state.devices,
        currentDeviceId: state.currentDeviceId,
        workDir: state.workDir,
      }),
    }
  )
);
