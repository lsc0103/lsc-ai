/**
 * Workbench DatePicker 日期选择器组件
 *
 * 用于选择日期
 * - 日期选择
 * - 日期范围
 * - 快捷选项
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  CloseCircleFilled,
} from '@ant-design/icons';
import type { WorkbenchComponentProps } from '../../registry';
import type { BaseComponentSchema, WorkbenchAction } from '../../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface DatePickerSchema extends BaseComponentSchema {
  type: 'DatePicker';
  /** 占位符 */
  placeholder?: string;
  /** 默认值（YYYY-MM-DD 格式） */
  defaultValue?: string;
  /** 标签 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否必填 */
  required?: boolean;
  /** 是否可清空 */
  allowClear?: boolean;
  /** 日期格式 */
  format?: string;
  /** 验证状态 */
  status?: 'success' | 'warning' | 'error';
  /** 帮助文本 */
  helpText?: string;
  /** 变更动作 */
  onChangeAction?: WorkbenchAction;
}

// ============================================================================
// 工具函数
// ============================================================================

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(date.getTime()) ? null : date;
}

// ============================================================================
// 主组件
// ============================================================================

export const DatePicker: React.FC<WorkbenchComponentProps<DatePickerSchema>> = ({
  schema,
}) => {
  const {
    placeholder = '选择日期',
    defaultValue,
    label,
    disabled = false,
    required = false,
    allowClear = true,
    format = 'YYYY-MM-DD',
    status,
    helpText,
    style,
    className,
  } = schema;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseDate(defaultValue || ''));
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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

  // 生成日历数据
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInPrevMonth = getDaysInMonth(year, month - 1);

    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

    // 上月的日期
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      days.push({
        day,
        isCurrentMonth: false,
        date: new Date(year, month - 1, day),
      });
    }

    // 当月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(year, month, i),
      });
    }

    // 下月的日期
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  }, [viewDate]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
    }
  }, [disabled]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsOpen(false);
  }, []);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDate(null);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handlePrevYear = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  }, []);

  const handleNextYear = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setViewDate(today);
    setIsOpen(false);
  }, []);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  return (
    <div
      ref={containerRef}
      className={clsx('workbench-datepicker relative', className)}
      style={style}
    >
      {label && (
        <label className="block text-sm text-[var(--text-secondary)] mb-1.5">
          {label}
          {required && <span className="text-[#f85149] ml-1">*</span>}
        </label>
      )}

      {/* 输入框 */}
      <div
        onClick={handleToggle}
        className={clsx(
          'flex items-center h-9 px-3 rounded-lg cursor-pointer',
          'border bg-[var(--glass-bg-subtle)]',
          'transition-colors duration-150',
          isOpen && 'border-[var(--accent-default)]',
          !isOpen && (status ? statusStyles[status] : 'border-[var(--border-default)]'),
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <CalendarOutlined className="text-[var(--text-tertiary)] mr-2" style={{ fontSize: 14 }} />
        <span className={clsx(
          'flex-1 text-sm',
          selectedDate ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
        )}>
          {selectedDate ? formatDate(selectedDate, format) : placeholder}
        </span>
        {allowClear && selectedDate && !disabled && (
          <CloseCircleFilled
            onClick={handleClear}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            style={{ fontSize: 14 }}
          />
        )}
      </div>

      {/* 日历面板 */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1 p-3 rounded-lg',
            'border border-[var(--border-light)]',
            'bg-[var(--glass-bg-solid)] backdrop-blur-xl',
            'shadow-lg shadow-black/20',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
        >
          {/* 头部导航 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevYear}
                className="p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
              >
                <DoubleLeftOutlined style={{ fontSize: 12 }} />
              </button>
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
              >
                <LeftOutlined style={{ fontSize: 12 }} />
              </button>
            </div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {viewDate.getFullYear()}年 {MONTHS[viewDate.getMonth()]}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
              >
                <RightOutlined style={{ fontSize: 12 }} />
              </button>
              <button
                onClick={handleNextYear}
                className="p-1 rounded hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
              >
                <DoubleRightOutlined style={{ fontSize: 12 }} />
              </button>
            </div>
          </div>

          {/* 星期头 */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-tertiary)]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期格子 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectDate(item.date)}
                className={clsx(
                  'w-8 h-8 rounded flex items-center justify-center text-xs',
                  'transition-colors duration-100',
                  item.isCurrentMonth
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-tertiary)]',
                  isSelected(item.date) && 'bg-[var(--accent-default)] text-white',
                  !isSelected(item.date) && isToday(item.date) && 'border border-[var(--accent-default)]',
                  !isSelected(item.date) && 'hover:bg-[var(--glass-bg-hover)]'
                )}
              >
                {item.day}
              </button>
            ))}
          </div>

          {/* 底部 */}
          <div className="mt-3 pt-2 border-t border-[var(--border-light)]">
            <button
              onClick={handleToday}
              className="text-xs text-[var(--accent-default)] hover:text-[var(--accent-hover)]"
            >
              今天
            </button>
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

DatePicker.displayName = 'WorkbenchDatePicker';
