import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Statistic, Typography, message, Empty } from 'antd';
import {
  ShoppingCartOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import type {
  EmployeeWorkStatistics,
  OrderStatistics,
  OrderTrendPoint,
  DashboardOverview,
} from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusLabel } from '@/utils/orderLabels';
import ModelerStatusPanel from '@/components/ModelerStatusPanel';
import EChart, { CHART_COLORS, CHART_PALETTE } from '@/components/charts/EChart';
import type { EChartsOption } from 'echarts';
import './DashboardPage.css';

const { Text } = Typography;

const fmtMoney = (v: number) =>
  `¥${Number(v || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

// ============ ECharts option 构建（纯函数） ============

type ViewportTier = 'phone' | 'tablet' | 'desktop';

function useViewportTier(): ViewportTier {
  const read = () => {
    const width = window.innerWidth;
    if (width < 768) return 'phone' as const;
    if (width < 1200) return 'tablet' as const;
    return 'desktop' as const;
  };
  const [tier, setTier] = useState<ViewportTier>(() =>
    typeof window === 'undefined' ? 'desktop' : read()
  );
  useEffect(() => {
    const onResize = () => setTier(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return tier;
}

function buildTrendOption(trend: OrderTrendPoint[], tier: ViewportTier): EChartsOption {
  const dates = trend.map((t) => t.date.slice(5));
  const phone = tier === 'phone';
  return {
    tooltip: { trigger: 'axis', confine: true },
    legend: {
      data: ['新增订单', '完成订单', '营收'],
      top: 0,
      itemWidth: phone ? 12 : 18,
      itemHeight: phone ? 8 : 10,
      textStyle: { fontSize: phone ? 11 : 12 },
    },
    grid: phone
      ? { left: 28, right: 36, top: 36, bottom: 22 }
      : { left: 48, right: 64, top: 44, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: true,
      axisLabel: { fontSize: phone ? 10 : 12, hideOverlap: true },
    },
    yAxis: [
      { type: 'value', name: phone ? '' : '订单数', minInterval: 1, axisLabel: { fontSize: phone ? 10 : 12 } },
      { type: 'value', name: phone ? '' : '营收', axisLabel: { formatter: phone ? '{value}' : '¥{value}', fontSize: phone ? 10 : 12 } },
    ],
    series: [
      {
        name: '新增订单',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        data: trend.map((t) => t.newOrders),
        itemStyle: { color: CHART_PALETTE.primary },
        areaStyle: { opacity: 0.08 },
      },
      {
        name: '完成订单',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        data: trend.map((t) => t.completed),
        itemStyle: { color: CHART_PALETTE.success },
      },
      {
        name: '营收',
        type: 'bar',
        yAxisIndex: 1,
        barMaxWidth: 18,
        data: trend.map((t) => t.revenue),
        itemStyle: { color: '#f6d365', opacity: 0.85 },
      },
    ],
  };
}

function compactLegend(tier: ViewportTier) {
  const phone = tier === 'phone';
  return {
    type: 'scroll' as const,
    bottom: 0,
    left: 8,
    right: 8,
    itemWidth: phone ? 8 : 14,
    itemHeight: phone ? 8 : 10,
    itemGap: phone ? 6 : 10,
    textStyle: { fontSize: phone ? 10 : 12 },
    pageIconSize: phone ? 10 : 12,
    pageTextStyle: { fontSize: 10 },
  };
}

function buildSourceOption(stats: OrderStatistics, tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)', confine: true },
    legend: compactLegend(tier),
    series: [
      {
        type: 'pie',
        radius: phone ? ['26%', '48%'] : ['30%', '62%'],
        roseType: 'area',
        center: ['50%', phone ? '40%' : '44%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: stats.sourceDistribution.map((s) => ({
          name: orderSourceLabel(s.source),
          value: s.count,
        })),
      },
    ],
  };
}

function buildStatusOption(stats: OrderStatistics, tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)', confine: true },
    legend: compactLegend(tier),
    series: [
      {
        type: 'pie',
        radius: phone ? ['34%', '52%'] : ['45%', '68%'],
        center: ['50%', phone ? '40%' : '44%'],
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: stats.statusDistribution.map((s) => ({
          name: orderStatusLabel(s.status),
          value: s.count,
        })),
      },
    ],
  };
}

function buildPendingOption(
  pending: {
    pendingDesign: number;
    pendingModel: number;
    pendingReview: number;
    pendingQuotation: number;
    pendingProduction: number;
  },
  tier: ViewportTier
): EChartsOption {
  const phone = tier === 'phone';
  const labels = ['设计', '建模', '工艺验证', '报价', '生产'];
  const values = [
    pending.pendingDesign,
    pending.pendingModel,
    pending.pendingReview,
    pending.pendingQuotation,
    pending.pendingProduction,
  ];
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
    grid: { left: phone ? 64 : 80, right: phone ? 28 : 40, top: 12, bottom: 12 },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: phone ? 10 : 12 } },
    yAxis: { type: 'category', data: [...labels].reverse(), axisLabel: { fontSize: phone ? 11 : 12 } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        data: [...values].reverse(),
        label: { show: true, position: 'right', color: CHART_PALETTE.text },
        itemStyle: { color: CHART_PALETTE.warning, borderRadius: 4 },
      },
    ],
  };
}

function buildC2cB2bOption(ov: DashboardOverview, tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  return {
    tooltip: { trigger: 'axis', confine: true },
    legend: {
      type: 'scroll',
      data: ['订单总数', '已完成', '待处理', '营收'],
      top: 0,
      itemWidth: phone ? 10 : 18,
      itemHeight: phone ? 8 : 10,
      textStyle: { fontSize: phone ? 10 : 12 },
    },
    grid: phone
      ? { left: 28, right: 32, top: 36, bottom: 22 }
      : { left: 48, right: 64, top: 44, bottom: 28 },
    xAxis: {
      type: 'category',
      data: phone ? ['C端', 'B端'] : ['C端客户', 'B端客户'],
      axisLabel: { fontSize: phone ? 11 : 12 },
    },
    yAxis: [
      { type: 'value', name: phone ? '' : '订单数', minInterval: 1, axisLabel: { fontSize: phone ? 10 : 12 } },
      { type: 'value', name: phone ? '' : '营收', axisLabel: { formatter: phone ? '{value}' : '¥{value}', fontSize: phone ? 10 : 12 } },
    ],
    series: [
      { name: '订单总数', type: 'bar', data: [ov.c2cTotalOrders, ov.b2bTotalOrders], itemStyle: { color: CHART_PALETTE.primary } },
      { name: '已完成', type: 'bar', data: [ov.c2cCompletedOrders, ov.b2bCompletedOrders], itemStyle: { color: CHART_PALETTE.success } },
      { name: '待处理', type: 'bar', data: [ov.c2cPendingOrders, ov.b2bPendingOrders], itemStyle: { color: CHART_PALETTE.warning } },
      { name: '营收', type: 'bar', yAxisIndex: 1, data: [ov.c2cRevenue, ov.b2bRevenue], itemStyle: { color: '#f6d365' } },
    ],
  };
}

function buildFunnelOption(stats: OrderStatistics, tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  const data = [
    { name: '设计', value: stats.pendingDesignOrders + stats.designingOrders },
    { name: '建模', value: stats.pendingModelOrders + stats.modelingOrders },
    { name: '工艺验证', value: stats.pendingReviewOrders },
    { name: '生产', value: stats.pendingProductionOrders + stats.producingOrders },
    { name: '完成', value: stats.completedOrders },
  ];
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}', confine: true },
    series: [
      {
        type: 'funnel',
        left: phone ? '4%' : '10%',
        width: phone ? '92%' : '80%',
        top: 8,
        bottom: 8,
        min: 0,
        minSize: '22%',
        maxSize: '100%',
        sort: 'none',
        gap: phone ? 6 : 2,
        label: {
          show: true,
          position: 'inside',
          fontSize: phone ? 12 : 13,
          color: '#fff',
          formatter: '{b} {c}',
        },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
        data,
      },
    ],
  };
}

function buildEmployeeBarOption(employees: EmployeeWorkStatistics[], tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  const names = employees.map((e) => e.employeeName);
  const completed = employees.map((e) => e.completedOrders);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
    grid: { left: phone ? 76 : 90, right: phone ? 28 : 40, top: 8, bottom: 20 },
    xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: phone ? 10 : 12 } },
    yAxis: {
      type: 'category',
      data: [...names].reverse(),
      axisLabel: { fontSize: phone ? 11 : 12, width: phone ? 68 : 84, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        data: [...completed].reverse(),
        label: { show: true, position: 'right', color: CHART_PALETTE.text },
        itemStyle: { color: CHART_PALETTE.primary, borderRadius: 4 },
      },
    ],
  };
}

function buildEmployeeRadarOption(employees: EmployeeWorkStatistics[], tier: ViewportTier): EChartsOption {
  const phone = tier === 'phone';
  const tablet = tier === 'tablet';
  const maxCompleted = Math.max(1, ...employees.map((e) => e.completedOrders));
  return {
    tooltip: { trigger: 'item', confine: true },
    legend: {
      ...compactLegend(tier),
      data: employees.map((e) => e.employeeName),
    },
    radar: {
      indicator: [
        { name: '质量分', max: 100 },
        { name: '客户满意度', max: 100 },
        { name: '完成量', max: maxCompleted },
      ],
      radius: phone ? '46%' : tablet ? '56%' : '62%',
      center: ['50%', phone ? '38%' : '46%'],
      axisName: { fontSize: phone ? 11 : 12, color: '#595959' },
    },
    series: [
      {
        type: 'radar',
        data: employees.map((e, i) => ({
          name: e.employeeName,
          value: [e.qualityScore, e.customerSatisfaction, e.completedOrders],
          areaStyle: { opacity: 0.08 },
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  };
}

// ============ KPI 卡片 ============

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  sub?: React.ReactNode;
  loading?: boolean;
  valueSize?: number;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, gradient, sub, loading, valueSize = 26 }) => (
  <Card className="kpi-card" bordered={false} loading={loading}>
    <div className="kpi-card-inner">
      <div className="kpi-icon" style={{ background: gradient }}>
        {icon}
      </div>
      <div className="kpi-content">
        <div className="kpi-title">{title}</div>
        <Statistic value={value} valueStyle={{ fontSize: valueSize, fontWeight: 700, color: '#1f1f1f', lineHeight: 1.2 }} />
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  </Card>
);

// ============ 主组件 ============

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const tier = useViewportTier();
  const chartHeight = tier === 'phone' ? 220 : tier === 'tablet' ? 280 : 320;
  const secondaryHeight = tier === 'phone' ? 260 : tier === 'tablet' ? 280 : 300;
  const kpiSize = tier === 'phone' ? 20 : 26;
  const [stats, setStats] = useState<OrderStatistics | null>(null);
  const [pending, setPending] = useState<{
    pendingDesign: number;
    pendingModel: number;
    pendingReview: number;
    pendingQuotation: number;
    pendingProduction: number;
    totalPending: number;
  } | null>(null);
  const [week, setWeek] = useState<{
    processedOrders: number;
    completedOrders: number;
    averageProcessingTime: number;
  } | null>(null);
  const [trend, setTrend] = useState<OrderTrendPoint[]>([]);
  const [employees, setEmployees] = useState<EmployeeWorkStatistics[]>([]);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === UserRole.ADMIN;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, p, w] = await Promise.all([
          orderService.getOrderStatistics(),
          orderService.getPendingOrderCounts(),
          orderService.getThisWeekProcessedOrders(),
        ]);
        if (cancelled) return;
        setStats(s);
        setPending(p);
        setWeek(w);

        // 趋势接口失败不阻塞主看板
        try {
          const t = await orderService.getOrderTrend(30);
          if (!cancelled) setTrend(t);
        } catch {
          if (!cancelled) setTrend([]);
        }

        if (user?.role === UserRole.ADMIN) {
          orderService
            .getEmployeeWorkStatistics()
            .then((em) => !cancelled && setEmployees(em))
            .catch(() => !cancelled && setEmployees([]));
          orderService
            .getDashboardOverview()
            .then((ov) => !cancelled && setOverview(ov))
            .catch(() => !cancelled && setOverview(null));
        }
      } catch (e) {
        if (!cancelled) message.error('加载仪表盘数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  const trendOption = useMemo(() => (trend.length ? buildTrendOption(trend, tier) : null), [trend, tier]);
  const sourceOption = useMemo(
    () => (stats && stats.sourceDistribution.length ? buildSourceOption(stats, tier) : null),
    [stats, tier]
  );
  const statusOption = useMemo(
    () => (stats && stats.statusDistribution.length ? buildStatusOption(stats, tier) : null),
    [stats, tier]
  );
  const pendingOption = useMemo(() => (pending ? buildPendingOption(pending, tier) : null), [pending, tier]);
  const c2cB2bOption = useMemo(() => (overview ? buildC2cB2bOption(overview, tier) : null), [overview, tier]);
  const funnelOption = useMemo(() => (stats ? buildFunnelOption(stats, tier) : null), [stats, tier]);
  const employeeBarOption = useMemo(
    () => (employees.length ? buildEmployeeBarOption(employees, tier) : null),
    [employees, tier]
  );
  const employeeRadarOption = useMemo(
    () => (employees.length ? buildEmployeeRadarOption(employees, tier) : null),
    [employees, tier]
  );
  const employeeBarHeight = tier === 'phone' ? Math.max(240, employees.length * 30 + 36) : secondaryHeight;
  const radarHeight = tier === 'phone' ? 320 : tier === 'tablet' ? 360 : 340;
  const funnelHeight = tier === 'phone' ? 300 : secondaryHeight;

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(
    today.getDate()
  ).padStart(2, '0')}日`;

  return (
    <div className={`dashboard-page dashboard-page--${tier}`}>
      {/* 欢迎横幅 */}
      <div className="welcome-banner">
        <div>
          <div className="welcome-title">欢迎回来，{user?.realName || user?.username}</div>
          <div className="welcome-sub">
            {dateStr} · 待处理订单 {pending?.totalPending ?? 0} 单
          </div>
        </div>
      </div>

      {/* 建模师工作状态面板 */}
      {user?.role === UserRole.MODELER && <ModelerStatusPanel />}

      {/* KPI 卡片行 */}
      <div className="kpi-grid">
        <KpiCard
          title="订单总数"
          value={stats?.totalOrders ?? 0}
          icon={<ShoppingCartOutlined />}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          sub={`本月新增 ${stats?.monthNewOrders ?? 0}`}
          loading={loading}
          valueSize={kpiSize}
        />
        <KpiCard
          title="待处理订单"
          value={pending?.totalPending ?? 0}
          icon={<ClockCircleOutlined />}
          gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
          sub={`设计 ${pending?.pendingDesign ?? 0} · 建模 ${pending?.pendingModel ?? 0}`}
          loading={loading}
          valueSize={kpiSize}
        />
        <KpiCard
          title="本周完成"
          value={week?.completedOrders ?? 0}
          icon={<RiseOutlined />}
          gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
          sub={`本周处理 ${week?.processedOrders ?? 0} 单`}
          loading={loading}
          valueSize={kpiSize}
        />
        <KpiCard
          title={tier === 'phone' ? '累计定金' : '累计营收（定金）'}
          value={fmtMoney(stats?.totalRevenue ?? 0)}
          icon={<DollarOutlined />}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          sub={`已完成 ${fmtMoney(stats?.completedRevenue ?? 0)}`}
          loading={loading}
          valueSize={kpiSize}
        />
      </div>

      {/* 趋势 + 来源/状态 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={24}>
          <Card
            className="chart-card"
            title="订单趋势（近 30 天）"
            bordered={false}
            loading={loading}
          >
            {trendOption ? <EChart key={tier} option={trendOption} height={chartHeight} /> : <Empty description="暂无趋势数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="chart-card" title="订单来源分布" bordered={false} loading={loading}>
            {sourceOption ? <EChart option={sourceOption} height={secondaryHeight} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card className="chart-card" title="订单状态分布" bordered={false} loading={loading}>
            {statusOption ? <EChart option={statusOption} height={secondaryHeight} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card className="chart-card" title="待处理环节拆分" bordered={false} loading={loading}>
            {pendingOption ? <EChart option={pendingOption} height={secondaryHeight} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
        {/* 管理员：C端/B端 对比 */}
        {isAdmin && (
          <Col xs={24} md={12}>
            <Card className="chart-card" title="C端 / B端 对比" bordered={false} loading={loading}>
              {c2cB2bOption ? <EChart option={c2cB2bOption} height={secondaryHeight} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
        )}
      </Row>

      {/* 管理员：员工统计 + 漏斗 */}
      {isAdmin && (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card className="chart-card" title="订单流程漏斗" bordered={false} loading={loading}>
              {funnelOption ? <EChart option={funnelOption} height={funnelHeight} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card className="chart-card" title="员工完成量" bordered={false} loading={loading}>
              {employeeBarOption ? <EChart option={employeeBarOption} height={employeeBarHeight} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
        </Row>
      )}

      {isAdmin && employeeRadarOption && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={24}>
            <Card className="chart-card" title="员工质量与满意度" bordered={false} loading={loading}>
              <EChart option={employeeRadarOption} height={radarHeight} />
            </Card>
          </Col>
        </Row>
      )}

      {!loading && !stats && (
        <Card bordered={false}>
          <Empty description="暂无统计数据" />
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
