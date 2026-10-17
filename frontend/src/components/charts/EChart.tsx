import React from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, RadarChart, FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import type { EChartsOption } from 'echarts';

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  RadarComponent,
  CanvasRenderer,
]);

/** 仪表盘统一主题色（沿用现有紫蓝渐变风格） */
export const CHART_COLORS = [
  '#667eea',
  '#764ba2',
  '#4facfe',
  '#43e97b',
  '#fa709a',
  '#f6d365',
  '#30cfd0',
  '#a18cd1',
];

export const CHART_PALETTE = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#f5222d',
  info: '#4facfe',
  text: '#595959',
  textSecondary: '#8c8c8c',
  splitLine: '#f0f0f0',
};

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  style?: React.CSSProperties;
  loading?: boolean;
  onEvents?: Record<string, (params: any) => void>;
}

const EChart: React.FC<EChartProps> = ({
  option,
  height = 320,
  style,
  loading,
  onEvents,
}) => {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      showLoading={loading}
      style={{ height, width: '100%', ...style }}
      onEvents={onEvents}
    />
  );
};

export default EChart;
export { echarts };
