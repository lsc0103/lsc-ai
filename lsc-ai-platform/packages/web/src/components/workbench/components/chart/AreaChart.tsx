/**
 * Workbench AreaChart 面积图组件
 *
 * 用于展示趋势和变化
 * - 支持堆叠面积图
 * - 支持多系列数据
 * - 平滑曲线填充
 */

import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { AreaChartSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

// 默认颜色序列
const defaultColors = [
  '#58a6ff',
  '#3fb950',
  '#f0883e',
  '#a371f7',
  '#f85149',
  '#39c5cf',
  '#d29922',
  '#bc8cff',
];

export const AreaChart: React.FC<WorkbenchComponentProps<AreaChartSchema>> = ({
  schema,
}) => {
  const {
    title,
    xAxis,
    series,
    stack = false,
    legend = true,
    tooltip = true,
    height = 300,
    style,
    className,
  } = schema;

  const option = useMemo<EChartsOption>(() => {
    return {
      title: title ? {
        text: title,
        left: 'center',
        top: 8,
        textStyle: {
          color: 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 500,
        },
      } : undefined,
      tooltip: tooltip ? {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#1e3a5f',
          },
        },
        backgroundColor: 'rgba(13, 27, 42, 0.95)',
        borderColor: 'var(--border-light)',
        textStyle: {
          color: '#e6edf3',
        },
      } : undefined,
      legend: legend && series.length > 1 ? {
        data: series.map(s => s.name),
        bottom: 0,
        textStyle: {
          color: 'var(--text-secondary)',
        },
      } : undefined,
      grid: {
        left: 12,
        right: 12,
        top: title ? 48 : 24,
        bottom: legend && series.length > 1 ? 40 : 24,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xAxis,
        axisLine: {
          lineStyle: {
            color: 'var(--border-default)',
          },
        },
        axisLabel: {
          color: 'var(--text-tertiary)',
          interval: 0,
          rotate: xAxis.length > 8 ? 30 : 0,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: {
          show: false,
        },
        axisLabel: {
          color: 'var(--text-tertiary)',
        },
        splitLine: {
          lineStyle: {
            color: 'var(--border-light)',
            type: 'dashed',
          },
        },
      },
      series: series.map((s, idx) => {
        const color = s.color || defaultColors[idx % defaultColors.length];
        return {
          name: s.name,
          type: 'line',
          data: s.data,
          smooth: true,
          stack: stack ? 'Total' : undefined,
          itemStyle: {
            color,
          },
          lineStyle: {
            color,
            width: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}60` },
                { offset: 1, color: `${color}10` },
              ],
            },
          },
          emphasis: {
            focus: 'series',
          },
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          animationDelay: idx * 100,
        };
      }),
      animationEasing: 'cubicOut',
    };
  }, [title, xAxis, series, stack, legend, tooltip]);

  return (
    <BaseChart
      option={option}
      height={height}
      className={className}
      style={style}
    />
  );
};

AreaChart.displayName = 'WorkbenchAreaChart';
