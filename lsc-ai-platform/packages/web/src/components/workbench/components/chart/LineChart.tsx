/**
 * Workbench LineChart 折线图组件
 */

import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { LineChartSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const LineChart: React.FC<WorkbenchComponentProps<LineChartSchema>> = ({
  schema,
}) => {
  const {
    title,
    xAxis,
    series,
    area = false,
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
      } : undefined,
      tooltip: tooltip ? {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: 'var(--glass-bg-solid)',
          },
        },
      } : undefined,
      legend: legend && series.length > 1 ? {
        data: series.map(s => s.name),
        bottom: 0,
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
        data: xAxis,
        boundaryGap: false,
        axisLabel: {
          interval: 0,
          rotate: xAxis.length > 8 ? 30 : 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: series.map((s, idx) => ({
        name: s.name,
        type: 'line',
        data: s.data,
        smooth: s.smooth ?? true,
        itemStyle: s.color ? { color: s.color } : undefined,
        lineStyle: s.color ? { color: s.color } : undefined,
        areaStyle: area ? {
          opacity: 0.3,
        } : undefined,
        emphasis: {
          focus: 'series',
        },
        symbol: 'circle',
        symbolSize: 6,
        animationDelay: idx * 100,
      })),
      animationEasing: 'cubicOut',
    };
  }, [title, xAxis, series, area, legend, tooltip]);

  return (
    <BaseChart
      option={option}
      height={height}
      className={className}
      style={style}
    />
  );
};

LineChart.displayName = 'WorkbenchLineChart';
