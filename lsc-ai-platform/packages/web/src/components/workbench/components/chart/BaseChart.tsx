/**
 * Workbench BaseChart 基础图表组件
 *
 * 基于 ECharts 实现的图表基础封装
 * - 自适应容器大小
 * - 暗色主题适配
 * - 统一的交互体验
 */

import React, { useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import clsx from 'clsx';

// ============================================================================
// 玻璃拟态主题配置
// ============================================================================

export const glassTheme = {
  // 背景透明
  backgroundColor: 'transparent',

  // 文字颜色
  textStyle: {
    color: 'var(--text-secondary)',
  },

  // 标题
  title: {
    textStyle: {
      color: 'var(--text-primary)',
      fontSize: 14,
      fontWeight: 500,
    },
    subtextStyle: {
      color: 'var(--text-tertiary)',
      fontSize: 12,
    },
  },

  // 图例
  legend: {
    textStyle: {
      color: 'var(--text-secondary)',
    },
    pageTextStyle: {
      color: 'var(--text-tertiary)',
    },
  },

  // 提示框
  tooltip: {
    backgroundColor: 'var(--glass-bg-solid)',
    borderColor: 'var(--border-light)',
    borderWidth: 1,
    textStyle: {
      color: 'var(--text-primary)',
    },
    extraCssText: 'backdrop-filter: blur(12px); box-shadow: 0 4px 16px rgba(0,0,0,0.2);',
  },

  // 坐标轴
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: 'var(--border-default)',
      },
    },
    axisTick: {
      lineStyle: {
        color: 'var(--border-default)',
      },
    },
    axisLabel: {
      color: 'var(--text-tertiary)',
    },
    splitLine: {
      lineStyle: {
        color: 'var(--border-light)',
        type: 'dashed' as const,
      },
    },
  },

  valueAxis: {
    axisLine: {
      lineStyle: {
        color: 'var(--border-default)',
      },
    },
    axisTick: {
      lineStyle: {
        color: 'var(--border-default)',
      },
    },
    axisLabel: {
      color: 'var(--text-tertiary)',
    },
    splitLine: {
      lineStyle: {
        color: 'var(--border-light)',
        type: 'dashed' as const,
      },
    },
  },

  // 颜色调色板（玻璃拟态风格）
  color: [
    '#60A5FA', // 蓝色
    '#34D399', // 绿色
    '#FBBF24', // 黄色
    '#F472B6', // 粉色
    '#A78BFA', // 紫色
    '#FB923C', // 橙色
    '#2DD4BF', // 青色
    '#E879F9', // 洋红
  ],
};

// ============================================================================
// 类型定义
// ============================================================================

export interface BaseChartProps {
  /** ECharts 配置项 */
  option: EChartsOption;
  /** 高度 */
  height?: number | string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 点击事件 */
  onEvents?: Record<string, (params: unknown) => void>;
}

// ============================================================================
// 组件实现
// ============================================================================

export const BaseChart: React.FC<BaseChartProps> = ({
  option,
  height = 300,
  className,
  style,
  loading = false,
  onEvents,
}) => {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 合并主题配置
  const mergedOption: EChartsOption = {
    ...option,
    backgroundColor: 'transparent',
    textStyle: {
      ...glassTheme.textStyle,
      ...(option.textStyle as object),
    },
    tooltip: {
      ...glassTheme.tooltip,
      ...(option.tooltip as object),
    },
    legend: option.legend ? {
      ...glassTheme.legend,
      ...(option.legend as object),
    } : undefined,
    xAxis: option.xAxis ? (
      Array.isArray(option.xAxis)
        ? option.xAxis.map(axis => ({
            ...glassTheme.categoryAxis,
            ...axis,
          }))
        : {
            ...glassTheme.categoryAxis,
            ...option.xAxis,
          }
    ) : undefined,
    yAxis: option.yAxis ? (
      Array.isArray(option.yAxis)
        ? option.yAxis.map(axis => ({
            ...glassTheme.valueAxis,
            ...axis,
          }))
        : {
            ...glassTheme.valueAxis,
            ...option.yAxis,
          }
    ) : undefined,
    color: option.color || glassTheme.color,
  };

  // 响应式调整 - 使用 ResizeObserver 监听容器变化
  useEffect(() => {
    const handleResize = () => {
      // 延迟执行确保容器尺寸已更新
      requestAnimationFrame(() => {
        chartRef.current?.getEchartsInstance()?.resize();
      });
    };

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize);

    // 使用 ResizeObserver 监听容器大小变化（解决 Tab 切换问题）
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);
    }

    // 初始化时也触发一次 resize（解决首次渲染问题）
    const initTimer = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      clearTimeout(initTimer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'workbench-chart',
        'rounded-lg overflow-hidden',
        'border border-[var(--border-light)]',
        'bg-[var(--glass-bg-light)]',
        className
      )}
      style={style}
    >
      <ReactECharts
        ref={chartRef}
        option={mergedOption}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'svg' }}
        showLoading={loading}
        loadingOption={{
          text: '加载中...',
          color: 'var(--accent-primary)',
          textColor: 'var(--text-secondary)',
          maskColor: 'rgba(0, 0, 0, 0.1)',
        }}
        onEvents={onEvents}
        notMerge={true}
      />
    </div>
  );
};

export default BaseChart;
