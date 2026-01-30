/**
 * Workbench Gantt 甘特图组件
 *
 * 项目管理场景核心组件
 * 展示任务时间线和依赖关系
 */

import React, { useMemo, useCallback } from 'react';
import { Tooltip } from 'antd';
import clsx from 'clsx';
import type { GanttSchema, GanttTask } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';
import { useWorkbenchStore } from '../../context';

// ============================================================================
// 工具函数
// ============================================================================

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}

function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// 默认颜色
const defaultColors = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
];

// ============================================================================
// 组件
// ============================================================================

export const Gantt: React.FC<WorkbenchComponentProps<GanttSchema>> = ({
  schema,
}) => {
  const {
    tasks,
    title,
    height = 400,
    showProgress = true,
    // showDependencies reserved for future implementation
    onTaskClick,
    style,
    className,
  } = schema;

  const { handleAction } = useWorkbenchStore();

  // 计算时间范围
  const { minDate, totalDays, dateLabels } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return {
        minDate: today,
        maxDate: today,
        totalDays: 1,
        dateLabels: [formatDate(today)],
      };
    }

    let min = parseDate(tasks[0].start);
    let max = parseDate(tasks[0].end);

    tasks.forEach((task) => {
      const start = parseDate(task.start);
      const end = parseDate(task.end);
      if (start < min) min = start;
      if (end > max) max = end;
    });

    // 添加一些边距
    min = new Date(min.getTime() - 1000 * 60 * 60 * 24);
    max = new Date(max.getTime() + 1000 * 60 * 60 * 24);

    const days = getDaysBetween(min, max);

    // 生成日期标签（每隔几天显示一个）
    const labels: string[] = [];
    const step = Math.max(1, Math.floor(days / 10));
    for (let i = 0; i <= days; i += step) {
      const date = new Date(min.getTime() + i * 24 * 60 * 60 * 1000);
      labels.push(formatDate(date));
    }

    return {
      minDate: min,
      maxDate: max,
      totalDays: days,
      dateLabels: labels,
    };
  }, [tasks]);

  // 按分组整理任务
  const groupedTasks = useMemo(() => {
    const groups = new Map<string, GanttTask[]>();
    const noGroup: GanttTask[] = [];

    tasks.forEach((task) => {
      if (task.group) {
        if (!groups.has(task.group)) {
          groups.set(task.group, []);
        }
        groups.get(task.group)!.push(task);
      } else {
        noGroup.push(task);
      }
    });

    // 返回排序后的结果
    const result: Array<{ group: string | null; tasks: GanttTask[] }> = [];
    groups.forEach((groupTasks, groupName) => {
      result.push({ group: groupName, tasks: groupTasks });
    });
    if (noGroup.length > 0) {
      result.push({ group: null, tasks: noGroup });
    }

    return result;
  }, [tasks]);

  // 计算任务位置
  const getTaskPosition = useCallback(
    (task: GanttTask) => {
      const start = parseDate(task.start);
      const end = parseDate(task.end);
      const startOffset = getDaysBetween(minDate, start);
      const duration = getDaysBetween(start, end);

      return {
        left: `${(startOffset / totalDays) * 100}%`,
        width: `${(duration / totalDays) * 100}%`,
      };
    },
    [minDate, totalDays]
  );

  // 点击任务
  const handleTaskClick = useCallback(
    (task: GanttTask) => {
      if (onTaskClick) {
        handleAction(onTaskClick, { task });
      }
    },
    [onTaskClick, handleAction]
  );

  // 获取任务颜色
  const getTaskColor = (task: GanttTask, index: number): string => {
    return task.color || defaultColors[index % defaultColors.length];
  };

  return (
    <div
      className={clsx(
        'workbench-gantt',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-light)]',
        className
      )}
      style={{ ...style, height: typeof height === 'number' ? `${height}px` : height }}
    >
      {/* 标题 */}
      {title && (
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--glass-bg-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-primary)] m-0">{title}</h4>
        </div>
      )}

      {/* 甘特图主体 */}
      <div className="flex h-full" style={{ height: title ? 'calc(100% - 48px)' : '100%' }}>
        {/* 左侧任务列表 */}
        <div className="w-48 flex-shrink-0 border-r border-[var(--border-light)] overflow-y-auto">
          {/* 表头 */}
          <div className="h-10 px-3 flex items-center border-b border-[var(--border-light)] bg-[var(--glass-bg-subtle)]">
            <span className="text-xs font-medium text-[var(--text-secondary)]">任务名称</span>
          </div>

          {/* 任务行 */}
          {groupedTasks.map((group, groupIdx) => (
            <div key={groupIdx}>
              {group.group && (
                <div className="h-8 px-3 flex items-center bg-[var(--glass-bg-hover)]">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {group.group}
                  </span>
                </div>
              )}
              {group.tasks.map((task) => (
                <div
                  key={task.id}
                  className={clsx(
                    'h-10 px-3 flex items-center border-b border-[var(--border-light)]',
                    'hover:bg-[var(--glass-bg-hover)] cursor-pointer transition-colors'
                  )}
                  onClick={() => handleTaskClick(task)}
                >
                  <span className="text-sm text-[var(--text-primary)] truncate">
                    {task.name}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 右侧时间线 */}
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          {/* 时间刻度 */}
          <div className="h-10 flex items-end border-b border-[var(--border-light)] bg-[var(--glass-bg-subtle)] sticky top-0 z-10">
            <div className="relative w-full h-full min-w-[600px]">
              {dateLabels.map((label, idx) => (
                <span
                  key={idx}
                  className="absolute bottom-2 text-xs text-[var(--text-tertiary)] transform -translate-x-1/2"
                  style={{ left: `${(idx / (dateLabels.length - 1)) * 100}%` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* 任务条 */}
          <div className="min-w-[600px]">
            {groupedTasks.map((group, groupIdx) => (
              <div key={groupIdx}>
                {group.group && <div className="h-8" />}
                {group.tasks.map((task, taskIdx) => {
                  const position = getTaskPosition(task);
                  const color = getTaskColor(task, groupIdx * 10 + taskIdx);

                  return (
                    <div
                      key={task.id}
                      className="h-10 relative border-b border-[var(--border-light)]"
                    >
                      {/* 背景网格线 */}
                      <div className="absolute inset-0 flex">
                        {dateLabels.map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 border-r border-[var(--border-light)] opacity-30"
                          />
                        ))}
                      </div>

                      {/* 任务条 */}
                      <Tooltip
                        title={
                          <div>
                            <div className="font-medium">{task.name}</div>
                            <div className="text-xs mt-1">
                              {task.start} ~ {task.end}
                            </div>
                            {showProgress && task.progress !== undefined && (
                              <div className="text-xs mt-1">进度: {task.progress}%</div>
                            )}
                          </div>
                        }
                      >
                        <div
                          className={clsx(
                            'absolute top-2 h-6 rounded cursor-pointer',
                            'transition-all hover:brightness-110'
                          )}
                          style={{
                            left: position.left,
                            width: position.width,
                            minWidth: '4px',
                            backgroundColor: color,
                          }}
                          onClick={() => handleTaskClick(task)}
                        >
                          {/* 进度条 */}
                          {showProgress && task.progress !== undefined && (
                            <div
                              className="absolute inset-0 rounded opacity-30 bg-black"
                              style={{
                                width: `${100 - task.progress}%`,
                                right: 0,
                                left: 'auto',
                              }}
                            />
                          )}

                          {/* 任务名称（如果空间足够） */}
                          <span className="absolute inset-0 flex items-center px-2 text-xs text-white truncate">
                            {task.name}
                          </span>
                        </div>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Gantt.displayName = 'WorkbenchGantt';
