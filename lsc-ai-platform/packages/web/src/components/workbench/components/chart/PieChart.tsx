/**
 * Workbench PieChart 饼图组件
 */

import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { PieChartSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const PieChart: React.FC<WorkbenchComponentProps<PieChartSchema>> = ({
  schema,
}) => {
  const {
    title,
    data,
    donut = false,
    innerRadius = 50,
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
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      } : undefined,
      legend: legend ? {
        orient: 'horizontal',
        bottom: 0,
        data: data.map(d => d.name),
      } : undefined,
      series: [
        {
          type: 'pie',
          radius: donut ? [`${innerRadius}%`, '70%'] : '70%',
          center: ['50%', title ? '55%' : '50%'],
          data: data.map(d => ({
            name: d.name,
            value: d.value,
            itemStyle: d.color ? { color: d.color } : undefined,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
          label: {
            show: true,
            formatter: '{b}: {d}%',
            color: 'var(--text-secondary)',
          },
          labelLine: {
            lineStyle: {
              color: 'var(--border-default)',
            },
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          animationDelay: (idx: number) => idx * 50,
        },
      ],
    };
  }, [title, data, donut, innerRadius, legend, tooltip]);

  return (
    <BaseChart
      option={option}
      height={height}
      className={className}
      style={style}
    />
  );
};

PieChart.displayName = 'WorkbenchPieChart';
