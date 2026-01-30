/**
 * Workbench Input 输入框组件
 *
 * 用于表单输入
 * - 支持多种类型
 * - 前缀后缀
 * - 验证状态
 */

import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  EyeOutlined,
  EyeInvisibleOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import type { WorkbenchComponentProps } from '../../registry';
import type { BaseComponentSchema, WorkbenchAction } from '../../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface InputSchema extends BaseComponentSchema {
  type: 'Input';
  /** 输入类型 */
  inputType?: 'text' | 'password' | 'number' | 'email' | 'tel' | 'url' | 'textarea';
  /** 占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 前缀 */
  prefix?: string;
  /** 后缀 */
  suffix?: string;
  /** 最大长度 */
  maxLength?: number;
  /** 行数（textarea） */
  rows?: number;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 验证状态 */
  status?: 'success' | 'warning' | 'error';
  /** 帮助文本 */
  helpText?: string;
  /** 变更动作 */
  onChangeAction?: WorkbenchAction;
}

// ============================================================================
// 主组件
// ============================================================================

export const Input: React.FC<WorkbenchComponentProps<InputSchema>> = ({
  schema,
}) => {
  const {
    inputType = 'text',
    placeholder,
    defaultValue = '',
    label,
    disabled = false,
    readOnly = false,
    required = false,
    prefix,
    suffix,
    maxLength,
    rows = 3,
    allowClear = false,
    status,
    helpText,
    style,
    className,
  } = schema;

  const [value, setValue] = useState(defaultValue);
  const [showPassword, setShowPassword] = useState(false);

  // 状态样式
  const statusStyles = {
    success: 'border-[#3fb950] focus-within:border-[#3fb950]',
    warning: 'border-[#d29922] focus-within:border-[#d29922]',
    error: 'border-[#f85149] focus-within:border-[#f85149]',
  };

  // 帮助文本颜色
  const helpTextColors = {
    success: 'text-[#3fb950]',
    warning: 'text-[#d29922]',
    error: 'text-[#f85149]',
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    setValue('');
  }, []);

  const togglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // 渲染 textarea
  if (inputType === 'textarea') {
    return (
      <div className={clsx('workbench-input', className)} style={style}>
        {label && (
          <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
            {label}
            {required && <span className="text-[#f85149] ml-1">*</span>}
          </label>
        )}
        <div
          className={clsx(
            'relative rounded-lg overflow-hidden',
            'border bg-[var(--glass-bg-subtle)]',
            'transition-colors duration-150',
            status ? statusStyles[status] : 'border-[var(--border-default)] focus-within:border-[var(--accent-default)]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <textarea
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            maxLength={maxLength}
            rows={rows}
            className={clsx(
              'w-full px-3 py-2',
              'bg-transparent outline-none resize-none',
              'text-sm text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]'
            )}
          />
          {maxLength && (
            <div className="absolute bottom-2 right-3 text-xs text-[var(--text-tertiary)]">
              {value.length}/{maxLength}
            </div>
          )}
        </div>
        {helpText && (
          <div className={clsx(
            'text-xs mt-1.5',
            status ? helpTextColors[status] : 'text-[var(--text-tertiary)]'
          )}>
            {helpText}
          </div>
        )}
      </div>
    );
  }

  // 渲染 input
  const actualType = inputType === 'password' && showPassword ? 'text' : inputType;

  return (
    <div className={clsx('workbench-input', className)} style={style}>
      {label && (
        <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
          {label}
          {required && <span className="text-[#f85149] ml-1">*</span>}
        </label>
      )}
      <div
        className={clsx(
          'flex items-center rounded-lg',
          'border bg-[var(--glass-bg-subtle)]',
          'transition-colors duration-150',
          status ? statusStyles[status] : 'border-[var(--border-default)] focus-within:border-[var(--accent-default)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {prefix && (
          <span className="px-3 text-sm text-[var(--text-tertiary)] border-r border-[var(--border-light)]">
            {prefix}
          </span>
        )}
        <input
          type={actualType}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          className={clsx(
            'flex-1 min-w-0 h-9 px-3',
            'bg-transparent outline-none',
            'text-sm text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)]'
          )}
        />
        {/* 清空按钮 */}
        {allowClear && value && !disabled && !readOnly && (
          <button
            onClick={handleClear}
            className="px-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <CloseCircleFilled style={{ fontSize: 14 }} />
          </button>
        )}
        {/* 密码切换 */}
        {inputType === 'password' && (
          <button
            onClick={togglePassword}
            className="px-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            {showPassword ? (
              <EyeInvisibleOutlined style={{ fontSize: 14 }} />
            ) : (
              <EyeOutlined style={{ fontSize: 14 }} />
            )}
          </button>
        )}
        {suffix && (
          <span className="px-3 text-sm text-[var(--text-tertiary)] border-l border-[var(--border-light)]">
            {suffix}
          </span>
        )}
      </div>
      {helpText && (
        <div className={clsx(
          'text-xs mt-1.5',
          status ? helpTextColors[status] : 'text-[var(--text-tertiary)]'
        )}>
          {helpText}
        </div>
      )}
    </div>
  );
};

Input.displayName = 'WorkbenchInput';
