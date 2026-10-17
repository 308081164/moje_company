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

function buildTrendOption(trend: OrderTrendPoint[]): EChartsOption {
  const dates = trend.map((t) => t.date.slice(5));
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['新增订单', '完成订单', '营收'], top: 0 },
    grid: { left: 48, right: 64, top: 44, bottom: 28 },
    xAxis: { type: 'category', data: dates, boundaryGap: true },
    yAxis: [
      { type: 'value', name: '订单数', minInterval: 1 },
      { type: 'value', name: '营收', axisLabel: { formatter: '¥{value}' } },
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

function buildSourceOption(stats: OrderStatistics): EChartsOption {
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['30%', '65%'],
        roseType: 'area',
        center: ['50%', '45%'],
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

function buildStatusOption(stats: OrderStatistics): EChartsOption {
  return {
    color: CHART_COLORS,
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
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
  }
): EChartsOption {
  const labels = ['设计', '建模', '工艺验证', '报价', '生产'];
  const values = [
    pending.pendingDesign,
    pending.pendingModel,
    pending.pendingReview,
    pending.pendingQuotation,
    pending.pendingProduction,
  ];
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 40, top: 16, bottom: 16 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: [...labels].reverse() },
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

function buildC2cB2bOption(ov: DashboardOverview): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单总数', '已完成', '待处理', '营收'], top: 0 },
    grid: { left: 48, right: 64, top: 44, bottom: 28 },
    xAxis: { type: 'category', data: ['C端客户', 'B端客户'] },
    yAxis: [
      { type: 'value', name: '订单数', minInterval: 1 },
      { type: 'value', name: '营收', axisLabel: { formatter: '¥{value}' } },
    ],
    series: [
      { name: '订单总数', type: 'bar', data: [ov.c2cTotalOrders, ov.b2bTotalOrders], itemStyle: { color: CHART_PALETTE.primary } },
      { name: '已完成', type: 'bar', data: [ov.c2cCompletedOrders, ov.b2bCompletedOrders], itemStyle: { color: CHART_PALETTE.success } },
      { name: '待处理', type: 'bar', data: [ov.c2cPendingOrders, ov.b2bPendingOrders], itemStyle: { color: CHART_PALETTE.warning } },
      { name: '营收', type: 'bar', yAxisIndex: 1, data: [ov.c2cRevenue, ov.b2bRevenue], itemStyle: { color: '#f6d365' } },
    ],
  };
}

function buildFunnelOption(stats: OrderStatistics): EChartsOption {
  const data = [
    { name: '设计', value: stats.pendingDesignOrders + stats.designingOrders },
    { name: '建模', value: stats.pendingModelOrders + stats.modelingOrders },
    { name: '工艺验证', value: stats.pendingReviewOrders },
    { name: '生产', value: stats.pendingProductionOrders + stats.producingOrders },
    { name: '完成', value: stats.completedOrders },
  ];
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'funnel',
        left: '10%',
        width: '80%',
        top: 12,
        bottom: 12,
        sort: 'none',
        gap: 2,
        label: { show: true, position: 'inside', formatter: '{b} {c}' },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
        data,
      },
    ],
  };
}

function buildEmployeeBarOption(employees: EmployeeWorkStatistics[]): EChartsOption {
  const names = employees.map((e) => e.employeeName);
  const completed = employees.map((e) => e.completedOrders);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 90, right: 40, top: 16, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: [...names].reverse(), axisLabel: { fontSize: 12 } },
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

function buildEmployeeRadarOption(employees: EmployeeWorkStatistics[]): EChartsOption {
  const maxCompleted = Math.max(1, ...employees.map((e) => e.completedOrders));
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll', data: employees.map((e) => e.employeeName) },
    radar: {
      indicator: [
        { name: '质量分', max: 100 },
        { name: '客户满意度', max: 100 },
        { name: '完成量', max: maxCompleted },
      ],
      radius: '65%',
      center: ['50%', '48%'],
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
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, gradient, sub, loading }) => (
  <Card className="kpi-card" bordered={false} loading={loading}>
    <div className="kpi-card-inner">
      <div className="kpi-icon" style={{ background: gradient }}>
        {icon}
      </div>
      <div className="kpi-content">
        <div className="kpi-title">{title}</div>
        <Statistic value={value} valueStyle={{ fontSize: 26, fontWeight: 700, color: '#1f1f1f' }} />
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  </Card>
);

// ============ 主组件 ============

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
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

  const trendOption = useMemo(() => (trend.length ? buildTrendOption(trend) : null), [trend]);
  const sourceOption = useMemo(
    () => (stats && stats.sourceDistribution.length ? buildSourceOption(stats) : null),
    [stats]
  );
  const statusOption = useMemo(
    () => (stats && stats.statusDistribution.length ? buildStatusOption(stats) : null),
    [stats]
  );
  const pendingOption = useMemo(() => (pending ? buildPendingOption(pending) : null), [pending]);
  const c2cB2bOption = useMemo(() => (overview ? buildC2cB2bOption(overview) : null), [overview]);
  const funnelOption = useMemo(() => (stats ? buildFunnelOption(stats) : null), [stats]);
  const employeeBarOption = useMemo(
    () => (employees.length ? buildEmployeeBarOption(employees) : null),
    [employees]
  );
  const employeeRadarOption = useMemo(
    () => (employees.length ? buildEmployeeRadarOption(employees) : null),
    [employees]
  );

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(
    today.getDate()
  ).padStart(2, '0')}日`;

  return (
    <div className="dashboard-page">
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
      <Row gutter={[16, 16]} className="kpi-row">
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="订单总数"
            value={stats?.totalOrders ?? 0}
            icon={<ShoppingCartOutlined />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            sub={`本月新增 ${stats?.monthNewOrders ?? 0}`}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="待处理订单"
            value={pending?.totalPending ?? 0}
            icon={<ClockCircleOutlined />}
            gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
            sub={`设计 ${pending?.pendingDesign ?? 0} · 建模 ${pending?.pendingModel ?? 0}`}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="本周完成"
            value={week?.completedOrders ?? 0}
            icon={<RiseOutlined />}
            gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
            sub={`本周处理 ${week?.processedOrders ?? 0} 单`}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="累计营收（定金）"
            value={fmtMoney(stats?.totalRevenue ?? 0)}
            icon={<DollarOutlined />}
            gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            sub={`已完成 ${fmtMoney(stats?.completedRevenue ?? 0)}`}
            loading={loading}
          />
        </Col>
      </Row>

      {/* 趋势 + 来源/状态 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={24}>
          <Card
            className="chart-card"
            title="订单趋势（近 30 天）"
            bordered={false}
            loading={loading}
          >
            {trendOption ? <EChart option={trendOption} height={320} /> : <Empty description="暂无趋势数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="订单来源分布" bordered={false} loading={loading}>
            {sourceOption ? <EChart option={sourceOption} height={300} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="订单状态分布" bordered={false} loading={loading}>
            {statusOption ? <EChart option={statusOption} height={300} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="待处理环节拆分" bordered={false} loading={loading}>
            {pendingOption ? <EChart option={pendingOption} height={260} /> : <Empty description="暂无数据" />}
          </Card>
        </Col>
        {/* 管理员：C端/B端 对比 */}
        {isAdmin && (
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="C端 / B端 对比" bordered={false} loading={loading}>
              {c2cB2bOption ? <EChart option={c2cB2bOption} height={260} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
        )}
      </Row>

      {/* 管理员：员工统计 + 漏斗 */}
      {isAdmin && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="订单流程漏斗" bordered={false} loading={loading}>
              {funnelOption ? <EChart option={funnelOption} height={300} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="员工完成量" bordered={false} loading={loading}>
              {employeeBarOption ? <EChart option={employeeBarOption} height={300} /> : <Empty description="暂无数据" />}
            </Card>
          </Col>
        </Row>
      )}

      {isAdmin && employeeRadarOption && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={24}>
            <Card className="chart-card" title="员工质量与满意度" bordered={false} loading={loading}>
              <EChart option={employeeRadarOption} height={340} />
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
