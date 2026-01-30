/**
 * 配置文件管理模块
 * 支持 ~/.lsc-ai/config.json 配置文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// 导出会话管理
export * from './session.js';

// 导出权限管理
export * from './permissions.js';

/**
 * 配置项定义
 */
export interface LscConfig {
  /** 默认模型来源 */
  modelSource?: 'local' | 'remote';
  /** 默认本地模型 */
  localModel?: string;
  /** 默认远程模型 */
  remoteModel?: string;
  /** Ollama 主机地址 */
  ollamaHost?: string;
  /** 是否默认启用高级模型模式 */
  advancedMode?: boolean;
  /** 始终允许的工具（跳过确认） */
  alwaysAllowTools?: string[];
  /** 始终允许的 bash 命令前缀 */
  alwaysAllowBashCommands?: string[];
  /** 历史记录保存路径 */
  historyPath?: string;
  /** 最大历史会话数 */
  maxHistorySessions?: number;
  /** 主题色 */
  theme?: 'default' | 'dark' | 'light';
  /** 自定义远程模型配置 */
  customModels?: Array<{
    name: string;
    baseURL: string;
    apiKey: string;
    model: string;
  }>;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: LscConfig = {
  modelSource: 'local',
  localModel: 'qwen2.5:7b-instruct',
  ollamaHost: 'http://localhost:11434',
  advancedMode: false,
  alwaysAllowTools: [],
  alwaysAllowBashCommands: [],
  maxHistorySessions: 50,
  theme: 'default',
};

/**
 * 获取配置目录路径
 */
export function getConfigDir(): string {
  return path.join(os.homedir(), '.lsc-ai');
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * 获取历史记录目录路径
 */
export function getHistoryDir(): string {
  return path.join(getConfigDir(), 'history');
}

/**
 * 确保配置目录存在
 */
export async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir();
  try {
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(getHistoryDir(), { recursive: true });
  } catch {
    // 目录可能已存在
  }
}

/**
 * 加载配置文件
 */
export async function loadConfig(): Promise<LscConfig> {
  try {
    const configPath = getConfigPath();
    const content = await fs.readFile(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<LscConfig>;
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch {
    // 配置文件不存在或解析失败，返回默认配置
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存配置文件
 */
export async function saveConfig(config: Partial<LscConfig>): Promise<void> {
  await ensureConfigDir();
  const configPath = getConfigPath();

  // 合并现有配置
  const existingConfig = await loadConfig();
  const newConfig = { ...existingConfig, ...config };

  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
}

/**
 * 获取单个配置项
 */
export async function getConfigValue<K extends keyof LscConfig>(key: K): Promise<LscConfig[K]> {
  const config = await loadConfig();
  return config[key];
}

/**
 * 设置单个配置项
 */
export async function setConfigValue<K extends keyof LscConfig>(
  key: K,
  value: LscConfig[K]
): Promise<void> {
  await saveConfig({ [key]: value });
}

/**
 * 重置配置为默认值
 */
export async function resetConfig(): Promise<void> {
  await ensureConfigDir();
  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
}

/**
 * 初始化配置（如果不存在则创建默认配置）
 */
export async function initConfig(): Promise<LscConfig> {
  await ensureConfigDir();
  const configPath = getConfigPath();

  try {
    await fs.access(configPath);
    return await loadConfig();
  } catch {
    // 配置文件不存在，创建默认配置
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return { ...DEFAULT_CONFIG };
  }
}
