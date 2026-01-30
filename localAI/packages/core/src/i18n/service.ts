/**
 * 国际化核心服务
 * 提供翻译管理、语言切换和事件通知功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  TranslationData,
  TranslateOptions,
  LanguageChangeEvent,
  TranslationLoader,
  TranslationCache,
  MissingTranslationLogger,
  I18nEventListener,
  I18nServiceConfig,
  TranslationKeyPath,
} from './types.js';
import { DEFAULT_I18N_CONFIG } from './config.js';

/**
 * 默认翻译加载器（基于文件系统）
 */
class FileSystemTranslationLoader implements TranslationLoader {
  constructor(private localesPath: string) {}

  async load(language: string): Promise<TranslationData> {
    const filePath = path.join(this.localesPath, `${language}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as TranslationData;
    } catch (error) {
      throw new Error(`Failed to load translation for ${language}: ${error}`);
    }
  }

  async exists(language: string): Promise<boolean> {
    const filePath = path.join(this.localesPath, `${language}.json`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getAvailableLanguages(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.localesPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch {
      return [];
    }
  }
}

/**
 * 内存翻译缓存
 */
class MemoryTranslationCache implements TranslationCache {
  private cache = new Map<string, { data: TranslationData; timestamp: number }>();

  constructor(private ttl: number) {}

  get(language: string): TranslationData | undefined {
    const cached = this.cache.get(language);
    if (!cached) return undefined;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(language);
      return undefined;
    }

    return cached.data;
  }

  set(language: string, data: TranslationData): void {
    this.cache.set(language, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(language?: string): void {
    if (language) {
      this.cache.delete(language);
    } else {
      this.cache.clear();
    }
  }

  isValid(language: string): boolean {
    const cached = this.cache.get(language);
    if (!cached) return false;
    return Date.now() - cached.timestamp <= this.ttl;
  }
}

/**
 * 文件缺失翻译记录器
 */
class FileMissingTranslationLogger implements MissingTranslationLogger {
  private missingTranslations: Array<{
    language: string;
    key: string;
    context?: string;
    timestamp: number;
  }> = [];

  constructor(private logPath: string) {}

  log(language: string, key: string, context?: string): void {
    this.missingTranslations.push({
      language,
      key,
      context,
      timestamp: Date.now(),
    });
  }

  getMissingTranslations() {
    return [...this.missingTranslations];
  }

  clear(): void {
    this.missingTranslations = [];
  }

  async exportToFile(filePath: string): Promise<void> {
    const content = JSON.stringify(this.missingTranslations, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

/**
 * 国际化核心服务
 */
export class I18nService {
  private currentLanguage: string;
  private translations: Map<string, TranslationData> = new Map();
  private listeners: Set<I18nEventListener> = new Set();
  private config: I18nServiceConfig;
  private loader: TranslationLoader;
  private cache: TranslationCache;
  private missingLogger: MissingTranslationLogger;

  constructor(config?: Partial<I18nServiceConfig>) {
    this.config = {
      defaultLanguage: DEFAULT_I18N_CONFIG.defaultLanguage,
      supportedLanguages: DEFAULT_I18N_CONFIG.supportedLanguages.map(lang => lang.code),
      localesPath: DEFAULT_I18N_CONFIG.localesPath,
      cacheEnabled: DEFAULT_I18N_CONFIG.cacheEnabled,
      cacheTTL: DEFAULT_I18N_CONFIG.cacheTTL,
      dynamicLoading: DEFAULT_I18N_CONFIG.dynamicLoading,
      logMissing: DEFAULT_I18N_CONFIG.logMissing,
      missingLogPath: DEFAULT_I18N_CONFIG.missingLogPath,
      ...config,
    };

    this.currentLanguage = this.config.defaultLanguage;
    this.loader = this.config.loader || new FileSystemTranslationLoader(this.config.localesPath);
    this.cache = this.config.cache || new MemoryTranslationCache(this.config.cacheTTL);
    this.missingLogger = this.config.missingLogger || new FileMissingTranslationLogger(this.config.missingLogPath);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    // 加载默认语言的翻译
    await this.loadLanguage(this.currentLanguage);
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return [...this.config.supportedLanguages];
  }

  /**
   * 切换语言
   */
  async setLanguage(language: string): Promise<void> {
    if (!this.config.supportedLanguages.includes(language)) {
      throw new Error(`Language ${language} is not supported`);
    }

    const oldLanguage = this.currentLanguage;
    this.currentLanguage = language;

    // 加载新语言的翻译（如果尚未加载）
    if (!this.translations.has(language)) {
      await this.loadLanguage(language);
    }

    // 触发语言切换事件
    const event: LanguageChangeEvent = {
      oldLanguage,
      newLanguage: language,
      timestamp: Date.now(),
    };

    this.notifyListeners('onLanguageChange', event);
  }

  /**
   * 翻译文本
   */
  translate(key: string, options: TranslateOptions = {}): string {
    const {
      defaultValue,
      params = {},
      returnKey = true,
      logMissing = this.config.logMissing,
    } = options;

    // 解析键路径
    const keyPath = this.parseKeyPath(key);
    
    // 获取翻译文本
    let translation = this.getTranslation(keyPath);
    
    // 如果翻译不存在，使用默认值或返回键
    if (!translation) {
      if (logMissing) {
        this.missingLogger.log(this.currentLanguage, key);
        this.notifyListeners('onMissingTranslation', this.currentLanguage, key);
      }
      
      if (defaultValue !== undefined) {
        translation = defaultValue;
      } else if (returnKey) {
        translation = key;
      } else {
        translation = '';
      }
    }

    // 应用参数插值
    return this.interpolate(translation, params);
  }

  /**
   * 检查翻译是否存在
   */
  hasTranslation(key: string): boolean {
    const keyPath = this.parseKeyPath(key);
    return !!this.getTranslation(keyPath);
  }

  /**
   * 获取所有翻译键
   */
  getAllKeys(): string[] {
    const keys: string[] = [];
    const traverse = (data: TranslationData, prefix: string = '') => {
      for (const [key, value] of Object.entries(data)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          keys.push(fullKey);
        } else {
          traverse(value, fullKey);
        }
      }
    };

    const translations = this.translations.get(this.currentLanguage);
    if (translations) {
      traverse(translations);
    }

    return keys;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: I18nEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: I18nEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 获取缺失翻译记录
   */
  getMissingTranslations() {
    return this.missingLogger.getMissingTranslations();
  }

  /**
   * 导出缺失翻译记录
   */
  async exportMissingTranslations(filePath?: string): Promise<void> {
    const path = filePath || this.config.missingLogPath;
    await this.missingLogger.exportToFile(path);
  }

  /**
   * 清除缓存
   */
  clearCache(language?: string): void {
    this.cache.clear(language);
    if (language) {
      this.translations.delete(language);
    } else {
      this.translations.clear();
    }
  }

  /**
   * 预加载语言
   */
  async preloadLanguages(languages: string[]): Promise<void> {
    const promises = languages.map(lang => this.loadLanguage(lang, true));
    await Promise.all(promises);
  }

  /**
   * 获取服务配置
   */
  getConfig(): I18nServiceConfig {
    return { ...this.config };
  }

  /**
   * 更新服务配置
   */
  updateConfig(config: Partial<I18nServiceConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * 私有方法：加载语言
   */
  private async loadLanguage(language: string, silent: boolean = false): Promise<void> {
    try {
      // 检查缓存
      let translationData = this.cache.get(language);
      
      if (!translationData) {
        // 从加载器加载
        translationData = await this.loader.load(language);
        
        // 缓存结果
        if (this.config.cacheEnabled) {
          this.cache.set(language, translationData);
        }
      }

      // 存储到内存
      this.translations.set(language, translationData);

      if (!silent) {
        this.notifyListeners('onTranslationLoaded', language);
      }
    } catch (error) {
      if (!silent) {
        this.notifyListeners('onTranslationLoadError', language, error as Error);
      }
      throw error;
    }
  }

  /**
   * 私有方法：解析键路径
   */
  private parseKeyPath(key: string): TranslationKeyPath {
    const parts = key.split('.');
    const namespace = parts[0];
    const path = parts.slice(1);
    
    return {
      namespace,
      path,
      fullKey: key,
    };
  }

  /**
   * 私有方法：获取翻译
   */
  private getTranslation(keyPath: TranslationKeyPath): string | undefined {
    const translations = this.translations.get(this.currentLanguage);
    if (!translations) return undefined;

    let current: any = translations;
    
    // 首先查找命名空间
    if (!current[keyPath.namespace]) {
      // 如果没有命名空间，尝试直接查找
      current = translations;
    } else {
      current = current[keyPath.namespace];
    }

    // 遍历路径
    for (const part of keyPath.path) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * 私有方法：参数插值
   */
  private interpolate(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * 私有方法：通知监听器
   */
  private notifyListeners<K extends keyof I18nEventListener>(
    event: K,
    ...args: Parameters<NonNullable<I18nEventListener[K]>>
  ): void {
    for (const listener of this.listeners) {
      const handler = listener[event];
      if (typeof handler === 'function') {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(`Error in i18n event listener for ${event}:`, error);
        }
      }
    }
  }
}

// 全局国际化服务实例
export const i18nService = new I18nService();