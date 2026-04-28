import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, message } from 'antd';
import {
  ShoppingCartOutlined,
  TeamOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { orderService } from '@/services/orderService';
import type { EmployeeWorkStatistics, OrderStatistics } from '@/types/order';
import { UserRole } from '@/types/auth';
import { orderSourceLabel, orderStatusLabel } from '@/utils/orderLabels';
import ModelerStatusPanel from '@/components/ModelerStatusPanel';

const { Title, Text } = Typography;

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
  const [employees, setEmployees] = useState<EmployeeWorkStatistics[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) {
          setStats(s);
          setPending(p);
          setWeek(w);
        }
        if (user?.role === UserRole.ADMIN) {
          try {
            const em = await orderService.getEmployeeWorkStatistics();
            if (!cancelled) setEmployees(em);
          } catch {
            if (!cancelled) setEmployees([]);
          }
        }
      } catch (e) {
        message.error('加载仪表盘数据失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        仪表盘
      </Title>
      <Text type="secondary">
        欢迎回来，{user?.realName || user?.username}
      </Text>
      
      {/* 建模师工作状态面板 */}
      {user?.role === UserRole.MODELER && <ModelerStatusPanel />}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="订单总数"
              value={stats?.totalOrders ?? 0}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="待处理（汇总）"
              value={pending?.totalPending ?? 0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading} bordered={false}>
            <Statistic
              title="本周完成"
              value={week?.completedOrders ?? 0}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="待处理拆分" loading={loading} bordered={false}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="待设计相关" value={pending?.pendingDesign ?? 0} />
              </Col>
              <Col span={12}>
                <Statistic title="待建模相关" value={pending?.pendingModel ?? 0} />
              </Col>
              <Col span={12} style={{ marginTop: 16 }}>
                <Statistic title="待工艺验证" value={pending?.pendingReview ?? 0} />
              </Col>
              <Col span={12} style={{ marginTop: 16 }}>
                <Statistic title="待生产相关" value={pending?.pendingProduction ?? 0} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="今日 / 本周 / 本月新增" loading={loading} bordered={false}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="今日" value={stats?.todayNewOrders ?? 0} />
              </Col>
              <Col span={8}>
                <Statistic title="本周" value={stats?.weekNewOrders ?? 0} />
              </Col>
              <Col span={8}>
                <Statistic title="本月" value={stats?.monthNewOrders ?? 0} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {user?.role === UserRole.ADMIN && employees.length > 0 && (
        <Card
          title={
            <span>
              <TeamOutlined /> 员工工作统计（管理员）
            </span>
          }
          style={{ marginTop: 16 }}
          bordered={false}
        >
          <Table
            size="small"
            rowKey="employeeId"
            pagination={false}
            dataSource={employees}
            columns={[
              { title: '员工', dataIndex: 'employeeName' },
              { title: '角色', dataIndex: 'role', width: 120 },
              { title: '待处理', dataIndex: 'pendingOrders' },
              { title: '已完成(周)', dataIndex: 'completedOrders' },
              { title: '质量分', dataIndex: 'qualityScore', width: 90 },
            ]}
          />
        </Card>
      )}

      {stats?.sourceDistribution && stats.sourceDistribution.length > 0 && (
        <Card title="客户来源分布" style={{ marginTop: 16 }} bordered={false}>
          <Table
            size="small"
            pagination={false}
            dataSource={stats.sourceDistribution.map((row: any, i: number) => ({
              key: i,
              source: orderSourceLabel(row.source),
              count: row.count,
              revenue: row.revenue,
            }))}
            columns={[
              { title: '来源', dataIndex: 'source' },
              { title: '订单数', dataIndex: 'count' },
              { title: '定金合计', dataIndex: 'revenue', render: (v) => `¥${Number(v).toFixed(2)}` },
            ]}
          />
        </Card>
      )}

      {stats?.statusDistribution && stats.statusDistribution.length > 0 && (
        <Card title="状态分布" style={{ marginTop: 16 }} bordered={false}>
          <Table
            size="small"
            pagination={false}
            dataSource={stats.statusDistribution.map((row: any, i: number) => ({
              key: i,
              status: orderStatusLabel(row.status),
              count: row.count,
            }))}
            columns={[
              { title: '状态', dataIndex: 'status' },
              { title: '数量', dataIndex: 'count' },
            ]}
          />
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
