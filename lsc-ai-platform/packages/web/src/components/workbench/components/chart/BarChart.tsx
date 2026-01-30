/**
 * Workbench BarChart 柱状图组件
 */

import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { BarChartSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const BarChart: React.FC<WorkbenchComponentProps<BarChartSchema>> = ({
  schema,
}) => {
  const {
    title,
    xAxis,
    series,
    horizontal = false,
    stack = false,
    legend = true,
    tooltip = true,
    height = 300,
    style,
    className,
  } = schema;

  const option = useMemo<EChartsOption>(() => {
    const categoryAxis = {
      type: 'category' as const,
      data: xAxis,
      axisLabel: {
        interval: 0,
        rotate: xAxis.length > 8 ? 30 : 0,
      },
    };

    const valueAxis = {
      type: 'value' as const,
    };

    return {
      title: title ? {
        text: title,
        left: 'center',
        top: 8,
      } : undefined,
      tooltip: tooltip ? {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
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
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: series.map((s, idx) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        stack: stack ? 'total' : undefined,
        itemStyle: s.color ? { color: s.color } : undefined,
        barMaxWidth: 40,
        emphasis: {
          focus: 'series',
        },
        animationDelay: idx * 100,
      })),
      animationEasing: 'elasticOut',
      animationDelayUpdate: (idx: number) => idx * 5,
    };
  }, [title, xAxis, series, horizontal, stack, legend, tooltip]);

  return (
    <BaseChart
      option={option}
      height={height}
      className={className}
      style={style}
    />
  );
};

BarChart.displayName = 'WorkbenchBarChart';
