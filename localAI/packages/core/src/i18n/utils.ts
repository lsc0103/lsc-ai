/**
 * 国际化工具函数
 * 提供便捷的翻译和语言处理功能
 */

import { i18nService } from './service.js';
import type { TranslateOptions } from './types.js';

/**
 * 翻译函数（简化版）
 */
export function t(key: string, options?: TranslateOptions): string {
  return i18nService.translate(key, options);
}

/**
 * 检查翻译是否存在
 */
export function has(key: string): boolean {
  return i18nService.hasTranslation(key);
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): string {
  return i18nService.getCurrentLanguage();
}

/**
 * 切换语言
 */
export async function setLanguage(language: string): Promise<void> {
  await i18nService.setLanguage(language);
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages(): string[] {
  return i18nService.getSupportedLanguages();
}

/**
 * 格式化带参数的翻译
 */
export function format(key: string, params: Record<string, string | number>): string {
  return t(key, { params });
}

/**
 * 复数化翻译
 */
export function plural(
  key: string,
  count: number,
  options?: {
    zero?: string;
    one?: string;
    other?: string;
    params?: Record<string, string | number>;
  }
): string {
  const { zero, one, other, params = {} } = options || {};
  
  // 根据数量选择键
  let pluralKey = key;
  if (count === 0 && zero) {
    pluralKey = zero;
  } else if (count === 1 && one) {
    pluralKey = one;
  } else if (other) {
    pluralKey = other;
  }

  // 添加数量参数
  const allParams = { ...params, count };
  
  return t(pluralKey, { params: allParams });
}

/**
 * 日期时间本地化
 */
export function formatDate(date: Date | string | number, format: string = 'datetime'): string {
  const d = new Date(date);
  const lang = getCurrentLanguage();
  
  const formats: Record<string, Record<string, string>> = {
    'zh-CN': {
      date: 'YYYY年MM月DD日',
      time: 'HH:mm:ss',
      datetime: 'YYYY年MM月DD日 HH:mm:ss',
      shortDate: 'MM/DD',
      shortTime: 'HH:mm',
    },
    'en-US': {
      date: 'YYYY-MM-DD',
      time: 'HH:mm:ss',
      datetime: 'YYYY-MM-DD HH:mm:ss',
      shortDate: 'MM/DD',
      shortTime: 'HH:mm',
    },
    'ja-JP': {
      date: 'YYYY年MM月DD日',
      time: 'HH:mm:ss',
      datetime: 'YYYY年MM月DD日 HH:mm:ss',
      shortDate: 'MM/DD',
      shortTime: 'HH:mm',
    },
    'ko-KR': {
      date: 'YYYY년 MM월 DD일',
      time: 'HH:mm:ss',
      datetime: 'YYYY년 MM월 DD일 HH:mm:ss',
      shortDate: 'MM/DD',
      shortTime: 'HH:mm',
    },
  };

  const langFormats = formats[lang] || formats['en-US'];
  const formatString = langFormats[format] || langFormats.datetime;

  // 简单实现，实际项目中应该使用更完整的日期格式化库
  return formatString
    .replace('YYYY', d.getFullYear().toString())
    .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
    .replace('DD', d.getDate().toString().padStart(2, '0'))
    .replace('HH', d.getHours().toString().padStart(2, '0'))
    .replace('mm', d.getMinutes().toString().padStart(2, '0'))
    .replace('ss', d.getSeconds().toString().padStart(2, '0'));
}

/**
 * 数字本地化
 */
export function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
  const lang = getCurrentLanguage();
  
  try {
    return new Intl.NumberFormat(lang, options).format(num);
  } catch {
    return num.toString();
  }
}

/**
 * 货币本地化
 */
export function formatCurrency(amount: number, currency: string = 'CNY'): string {
  const lang = getCurrentLanguage();
  
  try {
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * 百分比本地化
 */
export function formatPercent(value: number, decimals: number = 2): string {
  const lang = getCurrentLanguage();
  
  try {
    return new Intl.NumberFormat(lang, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value / 100);
  } catch {
    return `${value.toFixed(decimals)}%`;
  }
}

/**
 * 文件大小本地化
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formattedSize = formatNumber(size, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return t('utils.file_size', {
    defaultValue: '{{size}} {{unit}}',
    params: { size: formattedSize, unit: units[unitIndex] },
  });
}

/**
 * 时长本地化
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(plural('utils.hours', hours, {
      one: 'utils.hour',
      other: 'utils.hours',
      params: { count: hours },
    }));
  }
  
  if (minutes > 0) {
    parts.push(plural('utils.minutes', minutes, {
      one: 'utils.minute',
      other: 'utils.minutes',
      params: { count: minutes },
    }));
  }
  
  if (secs > 0 || parts.length === 0) {
    parts.push(plural('utils.seconds', secs, {
      one: 'utils.second',
      other: 'utils.seconds',
      params: { count: secs },
    }));
  }

  return parts.join(' ');
}

/**
 * 创建翻译上下文
 */
export function createTranslationContext(namespace: string) {
  return {
    t: (key: string, options?: TranslateOptions) => t(`${namespace}.${key}`, options),
    has: (key: string) => has(`${namespace}.${key}`),
    format: (key: string, params: Record<string, string | number>) =>
      format(`${namespace}.${key}`, params),
  };
}

/**
 * 延迟加载翻译
 */
export async function lazyLoadTranslations(language: string): Promise<void> {
  if (!i18nService.hasTranslation) {
    await i18nService.preloadLanguages([language]);
  }
}

/**
 * 批量翻译
 */
export function batchTranslate(keys: string[], options?: TranslateOptions): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const key of keys) {
    result[key] = t(key, options);
  }
  
  return result;
}