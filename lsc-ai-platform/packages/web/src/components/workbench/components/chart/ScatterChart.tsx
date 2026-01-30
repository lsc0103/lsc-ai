/**
 * Workbench ScatterChart 散点图组件
 *
 * 用于数据分析场景，展示数据分布和相关性
 */

import React, { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { BaseChart } from './BaseChart';
import type { ScatterChartSchema } from '../../schema/types';
import type { WorkbenchComponentProps } from '../../registry';

export const ScatterChart: React.FC<WorkbenchComponentProps<ScatterChartSchema>> = ({
  schema,
}) => {
  const {
    title,
    data,
    xAxisName,
    yAxisName,
    regression = false,
    legend = true,
    tooltip = true,
    height = 300,
    style,
    className,
  } = schema;

  const option = useMemo<EChartsOption>(() => {
    // 按名称分组数据点
    const groupedData = new Map<string, Array<[number, number]>>();
    const defaultGroup = '数据点';

    data.forEach((point) => {
      const groupName = point.name || defaultGroup;
      if (!groupedData.has(groupName)) {
        groupedData.set(groupName, []);
      }
      groupedData.get(groupName)!.push(point.value);
    });

    // 构建系列
    const series: EChartsOption['series'] = [];
    let colorIndex = 0;
    const defaultColors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666',
      '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
    ];

    groupedData.forEach((points, name) => {
      series.push({
        name,
        type: 'scatter',
        data: points,
        symbolSize: (dataItem: number[]) => {
          // 可以根据数据值调整点的大小
          const point = data.find(
            (p) => p.value[0] === dataItem[0] && p.value[1] === dataItem[1]
          );
          return point?.size || 10;
        },
        itemStyle: {
          color: data.find((p) => p.name === name)?.color || defaultColors[colorIndex % defaultColors.length],
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
      });
      colorIndex++;
    });

    // 如果需要回归线
    if (regression && data.length > 1) {
      // 简单线性回归
      const allPoints = data.map((p) => p.value);
      const n = allPoints.length;
      const sumX = allPoints.reduce((sum, p) => sum + p[0], 0);
      const sumY = allPoints.reduce((sum, p) => sum + p[1], 0);
      const sumXY = allPoints.reduce((sum, p) => sum + p[0] * p[1], 0);
      const sumX2 = allPoints.reduce((sum, p) => sum + p[0] * p[0], 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const minX = Math.min(...allPoints.map((p) => p[0]));
      const maxX = Math.max(...allPoints.map((p) => p[0]));

      series.push({
        name: '回归线',
        type: 'line',
        data: [
          [minX, slope * minX + intercept],
          [maxX, slope * maxX + intercept],
        ],
        lineStyle: {
          type: 'dashed',
          color: '#ff7875',
          width: 2,
        },
        symbol: 'none',
      });
    }

    return {
      title: title
        ? {
            text: title,
            left: 'center',
            top: 8,
          }
        : undefined,
      tooltip: tooltip
        ? {
            trigger: 'item',
            formatter: (params: any) => {
              const { seriesName, value } = params;
              return `${seriesName}<br/>X: ${value[0]}<br/>Y: ${value[1]}`;
            },
          }
        : undefined,
      legend:
        legend && groupedData.size > 1
          ? {
              data: Array.from(groupedData.keys()),
              bottom: 0,
            }
          : undefined,
      grid: {
        left: 12,
        right: 12,
        top: title ? 48 : 24,
        bottom: legend && groupedData.size > 1 ? 40 : 24,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: xAxisName,
        nameLocation: 'middle',
        nameGap: 25,
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
        nameLocation: 'middle',
        nameGap: 40,
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      series,
      animationDuration: 1000,
    };
  }, [title, data, xAxisName, yAxisName, regression, legend, tooltip]);

  return (
    <BaseChart
      option={option}
      height={height}
      className={className}
      style={style}
    />
  );
};

ScatterChart.displayName = 'WorkbenchScatterChart';
