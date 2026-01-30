/**
 * 国际化配置接口
 */

/**
 * 语言配置项
 */
export interface LanguageConfig {
  /** 语言代码，如 'zh-CN', 'en-US' */
  code: string;
  /** 语言显示名称 */
  name: string;
  /** 本地化名称 */
  nativeName: string;
  /** 语言方向 */
  direction: 'ltr' | 'rtl';
  /** 是否启用 */
  enabled: boolean;
  /** 翻译完成度（0-100） */
  completeness: number;
}

/**
 * 国际化配置
 */
export interface I18nConfig {
  /** 是否启用国际化 */
  enabled: boolean;
  /** 默认语言 */
  defaultLanguage: string;
  /** 支持的语言列表 */
  supportedLanguages: LanguageConfig[];
  /** 是否自动检测语言 */
  autoDetect: boolean;
  /** 是否启用回退语言 */
  fallbackEnabled: boolean;
  /** 回退语言链 */
  fallbackChain: string[];
  /** 翻译文件路径 */
  localesPath: string;
  /** 是否缓存翻译 */
  cacheEnabled: boolean;
  /** 缓存过期时间（毫秒） */
  cacheTTL: number;
  /** 是否启用动态加载 */
  dynamicLoading: boolean;
  /** 是否记录缺失翻译 */
  logMissing: boolean;
  /** 缺失翻译日志路径 */
  missingLogPath: string;
}

/**
 * 默认国际化配置
 */
export const DEFAULT_I18N_CONFIG: I18nConfig = {
  enabled: true,
  defaultLanguage: 'zh-CN',
  supportedLanguages: [
    {
      code: 'zh-CN',
      name: 'Chinese (Simplified)',
      nativeName: '简体中文',
      direction: 'ltr',
      enabled: true,
      completeness: 100,
    },
    {
      code: 'en-US',
      name: 'English (US)',
      nativeName: 'English',
      direction: 'ltr',
      enabled: true,
      completeness: 100,
    },
    {
      code: 'ja-JP',
      name: 'Japanese',
      nativeName: '日本語',
      direction: 'ltr',
      enabled: false,
      completeness: 30,
    },
    {
      code: 'ko-KR',
      name: 'Korean',
      nativeName: '한국어',
      direction: 'ltr',
      enabled: false,
      completeness: 20,
    },
    {
      code: 'es-ES',
      name: 'Spanish',
      nativeName: 'Español',
      direction: 'ltr',
      enabled: false,
      completeness: 15,
    },
    {
      code: 'fr-FR',
      name: 'French',
      nativeName: 'Français',
      direction: 'ltr',
      enabled: false,
      completeness: 10,
    },
  ],
  autoDetect: true,
  fallbackEnabled: true,
  fallbackChain: ['zh-CN', 'en-US'],
  localesPath: './locales',
  cacheEnabled: true,
  cacheTTL: 3600000, // 1小时
  dynamicLoading: true,
  logMissing: true,
  missingLogPath: './missing-translations.log',
};

/**
 * 获取语言配置
 */
export function getLanguageConfig(languageCode: string): LanguageConfig | undefined {
  return DEFAULT_I18N_CONFIG.supportedLanguages.find(lang => lang.code === languageCode);
}

/**
 * 检查语言是否支持
 */
export function isLanguageSupported(languageCode: string): boolean {
  const lang = getLanguageConfig(languageCode);
  return !!lang && lang.enabled;
}

/**
 * 获取启用的语言列表
 */
export function getEnabledLanguages(): LanguageConfig[] {
  return DEFAULT_I18N_CONFIG.supportedLanguages.filter(lang => lang.enabled);
}

/**
 * 获取最佳匹配语言
 */
export function getBestMatchLanguage(preferredLanguages: string[]): string {
  for (const preferred of preferredLanguages) {
    // 精确匹配
    if (isLanguageSupported(preferred)) {
      return preferred;
    }

    // 基础语言匹配（如 zh-CN 匹配 zh）
    const baseLang = preferred.split('-')[0];
    const match = DEFAULT_I18N_CONFIG.supportedLanguages.find(
      lang => lang.enabled && lang.code.startsWith(`${baseLang}-`)
    );
    if (match) {
      return match.code;
    }
  }

  // 返回默认语言
  return DEFAULT_I18N_CONFIG.defaultLanguage;
}