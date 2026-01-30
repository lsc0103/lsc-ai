/**
 * 国际化类型定义
 */

/**
 * 翻译数据接口
 */
export interface TranslationData {
  [key: string]: string | TranslationData;
}

/**
 * 翻译函数参数
 */
export interface TranslateOptions {
  /** 默认值，当翻译不存在时返回 */
  defaultValue?: string;
  /** 插值参数 */
  params?: Record<string, string | number>;
  /** 是否返回原始键（当翻译不存在时） */
  returnKey?: boolean;
  /** 是否记录缺失翻译 */
  logMissing?: boolean;
}

/**
 * 语言切换事件
 */
export interface LanguageChangeEvent {
  /** 旧语言代码 */
  oldLanguage: string;
  /** 新语言代码 */
  newLanguage: string;
  /** 切换时间 */
  timestamp: number;
}

/**
 * 翻译加载器接口
 */
export interface TranslationLoader {
  /** 加载指定语言的翻译数据 */
  load(language: string): Promise<TranslationData>;
  /** 检查翻译数据是否存在 */
  exists(language: string): Promise<boolean>;
  /** 获取所有可用语言 */
  getAvailableLanguages(): Promise<string[]>;
}

/**
 * 翻译缓存接口
 */
export interface TranslationCache {
  /** 获取缓存的翻译数据 */
  get(language: string): TranslationData | undefined;
  /** 设置翻译数据到缓存 */
  set(language: string, data: TranslationData): void;
  /** 清除指定语言的缓存 */
  clear(language?: string): void;
  /** 检查缓存是否有效 */
  isValid(language: string): boolean;
}

/**
 * 缺失翻译记录器接口
 */
export interface MissingTranslationLogger {
  /** 记录缺失的翻译 */
  log(language: string, key: string, context?: string): void;
  /** 获取所有缺失的翻译记录 */
  getMissingTranslations(): Array<{
    language: string;
    key: string;
    context?: string;
    timestamp: number;
  }>;
  /** 清除记录 */
  clear(): void;
  /** 导出记录到文件 */
  exportToFile(path: string): Promise<void>;
}

/**
 * 国际化事件监听器
 */
export interface I18nEventListener {
  /** 语言切换时触发 */
  onLanguageChange?(event: LanguageChangeEvent): void;
  /** 翻译加载完成时触发 */
  onTranslationLoaded?(language: string): void;
  /** 翻译加载失败时触发 */
  onTranslationLoadError?(language: string, error: Error): void;
  /** 缺失翻译记录时触发 */
  onMissingTranslation?(language: string, key: string): void;
}

/**
 * 国际化服务配置
 */
export interface I18nServiceConfig {
  /** 默认语言 */
  defaultLanguage: string;
  /** 支持的语言列表 */
  supportedLanguages: string[];
  /** 翻译文件路径 */
  localesPath: string;
  /** 是否启用缓存 */
  cacheEnabled: boolean;
  /** 缓存过期时间（毫秒） */
  cacheTTL: number;
  /** 是否启用动态加载 */
  dynamicLoading: boolean;
  /** 是否记录缺失翻译 */
  logMissing: boolean;
  /** 缺失翻译日志路径 */
  missingLogPath: string;
  /** 翻译加载器 */
  loader?: TranslationLoader;
  /** 翻译缓存 */
  cache?: TranslationCache;
  /** 缺失翻译记录器 */
  missingLogger?: MissingTranslationLogger;
}

/**
 * 翻译键路径解析结果
 */
export interface TranslationKeyPath {
  /** 命名空间 */
  namespace: string;
  /** 键路径数组 */
  path: string[];
  /** 完整键 */
  fullKey: string;
}