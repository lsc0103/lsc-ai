/**
 * Workbench Select 选择器组件
 *
 * 用于下拉选择
 * - 单选/多选
 * - 搜索过滤
 * - 自定义选项
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  DownOutlined,
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { WorkbenchComponentProps } from '../../registry';
import type { BaseComponentSchema, WorkbenchAction } from '../../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SelectSchema extends BaseComponentSchema {
  type: 'Select';
  /** 选项列表 */
  options: SelectOption[];
  /** 占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: string | number | (string | number)[];
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  searchable?: boolean;
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

export const Select: React.FC<WorkbenchComponentProps<SelectSchema>> = ({
  schema,
}) => {
  const {
    options,
    placeholder = '请选择',
    defaultValue,
    label,
    disabled = false,
    required = false,
    multiple = false,
    searchable = false,
    allowClear = false,
    status,
    helpText,
    style,
    className,
  } = schema;

  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedValues, setSelectedValues] = useState<(string | number)[]>(() => {
    if (defaultValue === undefined) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 状态样式
  const statusStyles = {
    success: 'border-[#3fb950]',
    warning: 'border-[#d29922]',
    error: 'border-[#f85149]',
  };

  const helpTextColors = {
    success: 'text-[#3fb950]',
    warning: 'text-[#d29922]',
    error: 'text-[#f85149]',
  };

  // 过滤选项
  const filteredOptions = searchable && searchText
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchText.toLowerCase())
      )
    : options;

  // 获取选中的标签
  const selectedLabels = selectedValues
    .map(v => options.find(opt => opt.value === v)?.label)
    .filter(Boolean);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const handleSelect = useCallback((value: string | number) => {
    if (multiple) {
      setSelectedValues(prev => {
        if (prev.includes(value)) {
          return prev.filter(v => v !== value);
        }
        return [...prev, value];
      });
    } else {
      setSelectedValues([value]);
      setIsOpen(false);
      setSearchText('');
    }
  }, [multiple]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValues([]);
  }, []);

  const handleRemoveTag = useCallback((value: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedValues(prev => prev.filter(v => v !== value));
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx('workbench-select relative', className)}
      style={style}
    >
      {label && (
        <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
          {label}
          {required && <span className="text-[#f85149] ml-1">*</span>}
        </label>
      )}

      {/* 选择框 */}
      <div
        onClick={handleToggle}
        className={clsx(
          'flex items-center min-h-[36px] px-3 rounded-lg cursor-pointer',
          'border bg-[var(--glass-bg-subtle)]',
          'transition-colors duration-150',
          isOpen && 'border-[var(--accent-default)]',
          !isOpen && (status ? statusStyles[status] : 'border-[var(--border-default)]'),
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* 多选标签 */}
        {multiple && selectedValues.length > 0 ? (
          <div className="flex-1 flex flex-wrap gap-1 py-1">
            {selectedValues.map(value => {
              const opt = options.find(o => o.value === value);
              return (
                <span
                  key={value}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded',
                    'text-xs bg-[var(--accent-default)] text-white'
                  )}
                >
                  {opt?.label}
                  <CloseOutlined
                    style={{ fontSize: 10 }}
                    onClick={(e) => handleRemoveTag(value, e)}
                    className="cursor-pointer hover:opacity-80"
                  />
                </span>
              );
            })}
          </div>
        ) : (
          <span className={clsx(
            'flex-1 text-sm truncate',
            selectedLabels.length > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
          )}>
            {selectedLabels[0] || placeholder}
          </span>
        )}

        {/* 清空按钮 */}
        {allowClear && selectedValues.length > 0 && !disabled && (
          <CloseOutlined
            onClick={handleClear}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mr-1"
            style={{ fontSize: 12 }}
          />
        )}

        {/* 下拉箭头 */}
        <DownOutlined
          className={clsx(
            'text-[var(--text-tertiary)] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          style={{ fontSize: 12 }}
        />
      </div>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 w-full mt-1 py-1 rounded-lg',
            'border border-[var(--border-light)]',
            'bg-[var(--glass-bg-solid)] backdrop-blur-xl',
            'shadow-lg shadow-black/20',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
        >
          {/* 搜索框 */}
          {searchable && (
            <div className="px-2 pb-2 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-2 px-2 h-8 rounded bg-[var(--glass-bg-subtle)]">
                <SearchOutlined className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }} />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="搜索..."
                  className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* 选项列表 */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-sm text-[var(--text-tertiary)]">
                无匹配选项
              </div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    className={clsx(
                      'flex items-center justify-between px-3 py-2 text-sm',
                      'transition-colors duration-100',
                      option.disabled
                        ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                        : 'text-[var(--text-primary)] cursor-pointer hover:bg-[var(--glass-bg-hover)]',
                      isSelected && 'bg-[var(--accent-default)]/10'
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && (
                      <CheckOutlined className="text-[var(--accent-default)]" style={{ fontSize: 12 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

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

Select.displayName = 'WorkbenchSelect';
