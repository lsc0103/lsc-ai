import Conf from 'conf';
import os from 'os';
import path from 'path';

/**
 * Client Agent 配置项
 */
export interface ClientAgentConfig {
  // Platform 服务器地址
  platformUrl: string;
  // 用户 ID（配对后获得）
  userId?: string;
  // 设备 ID（首次运行时生成）
  deviceId: string;
  // 设备名称
  deviceName: string;
  // 认证 Token（配对后获得）
  authToken?: string;
  // 默认工作目录
  workDir: string;
  // API 提供商配置（由 Platform 下发）
  apiProvider: 'anthropic' | 'deepseek';
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
}

/**
 * 生成设备 ID
 */
function generateDeviceId(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${platform}-${hostname}-${timestamp}-${random}`;
}

/**
 * 获取默认设备名称
 */
function getDefaultDeviceName(): string {
  const hostname = os.hostname();
  const username = os.userInfo().username;
  return `${username}@${hostname}`;
}

/**
 * 配置存储实例
 */
const config = new Conf<ClientAgentConfig>({
  projectName: 'lsc-ai-client-agent',
  defaults: {
    platformUrl: 'http://localhost:3000',
    deviceId: generateDeviceId(),
    deviceName: getDefaultDeviceName(),
    workDir: process.cwd(),
    apiProvider: 'deepseek',
  },
});

/**
 * 配置管理器
 */
export const configManager = {
  /**
   * 获取所有配置
   */
  getAll(): ClientAgentConfig {
    return config.store;
  },

  /**
   * 获取单个配置项
   */
  get<K extends keyof ClientAgentConfig>(key: K): ClientAgentConfig[K] {
    return config.get(key);
  },

  /**
   * 设置单个配置项
   */
  set<K extends keyof ClientAgentConfig>(key: K, value: ClientAgentConfig[K]): void {
    config.set(key, value);
  },

  /**
   * 批量设置配置
   */
  setMany(values: Partial<ClientAgentConfig>): void {
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        config.set(key as keyof ClientAgentConfig, value);
      }
    }
  },

  /**
   * 检查是否已配对
   */
  isPaired(): boolean {
    return !!config.get('authToken') && !!config.get('userId');
  },

  /**
   * 清除配对信息
   */
  clearPairing(): void {
    config.delete('authToken');
    config.delete('userId');
  },

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return config.path;
  },

  /**
   * 重置所有配置
   */
  reset(): void {
    config.clear();
    config.set('deviceId', generateDeviceId());
    config.set('deviceName', getDefaultDeviceName());
  },
};

export default configManager;
