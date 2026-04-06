  };

  // 处理分配设计师
  const handleAssignDesigner = (order: OrderInfo) => {
    Modal.confirm({
      title: '分配设计师',
      content: '确定要为此订单分配设计师吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 这里调用分配设计师的API
          message.success('设计师分配成功');
          loadOrders();
        } catch (error) {
          console.error('分配设计师失败:', error);
          message.error('分配设计师失败');
        }
      },
    });
  };

  // 处理分配建模师
  const handleAssignModeler = (order: OrderInfo) => {
    Modal.confirm({
      title: '分配建模师',
      content: '确定要为此订单分配建模师吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 这里调用分配建模师的API
          message.success('建模师分配成功');
          loadOrders();
        } catch (error) {
          console.error('分配建模师失败:', error);
          message.error('分配建模师失败');
        }
      },
    });
  };

  // 处理报价
  const handleQuotation = (order: OrderInfo) => {
    navigate(`/orders/${order.baseInfo.id}/quotation`);
  };

  // 处理设计管理
  const handleDesign = (order: OrderInfo) => {
    navigate(`/orders/${order.baseInfo.id}/design`);
  };

  // 处理建模管理
  const handleModel = (order: OrderInfo) => {
    navigate(`/orders/${order.baseInfo.id}/model`);
  };

  // 处理工艺评审
  const handleReview = (order: OrderInfo) => {
    navigate(`/orders/${order.baseInfo.id}/review`);
  };

  // 处理搜索
  const handleSearch = (values: any) => {
    console.log('搜索参数:', values);
    // 这里实现搜索逻辑
    loadOrders();
  };

  // 处理重置搜索
  const handleResetSearch = () => {
    searchForm.resetFields();
    loadOrders();
  };

  // 处理分页变化
  const handlePageChange = (page: number, pageSize: number) => {
    setCurrentPage(page);
    setPageSize(pageSize);
  };

  // 处理标签页变化
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setCurrentPage(1);
  };

  // 处理表单提交
  const handleFormSubmit = async (values: any) => {
    try {
      if (modalType === 'create') {
        await orderService.createOrder(values);
        message.success('订单创建成功');
      } else if (modalType === 'edit' && selectedOrder) {
        await orderService.updateOrder(selectedOrder.baseInfo.id, values);
        message.success('订单更新成功');
      }
      setModalVisible(false);
      loadOrders();
    } catch (error) {
      console.error('保存订单失败:', error);
      message.error('保存订单失败');
    }
  };

  // 渲染订单详情
  const renderOrderDetail = () => {
    if (!selectedOrder) return null;

    return (
      <Descriptions column={2} bordered>
        <Descriptions.Item label="订单编号">
          <Text strong>{selectedOrder.baseInfo.orderNumber}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="订单状态">
          <Tag color={getStatusColor(selectedOrder.currentStatus)}>
            {getStatusText(selectedOrder.currentStatus)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="客户姓名">
          {selectedOrder.baseInfo.customerName || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="联系方式">
          {selectedOrder.baseInfo.customerContact || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="订单来源">
          {getSourceText(selectedOrder.baseInfo.source)}
        </Descriptions.Item>
        <Descriptions.Item label="定金金额">
          <Text strong style={{ color: '#52c41a' }}>
            ¥{selectedOrder.baseInfo.depositAmount?.toLocaleString() || '0'}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(selectedOrder.baseInfo.orderTime).format('YYYY-MM-DD HH:mm:ss')}
        </Descriptions.Item>
        <Descriptions.Item label="基础需求">
          {selectedOrder.baseInfo.basicRequirements || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="款式信息">
          {selectedOrder.baseInfo.styleInfo || '未填写'}
        </Descriptions.Item>
        <Descriptions.Item label="材质信息">
          {selectedOrder.baseInfo.materialInfo || '未填写'}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  // 渲染订单表单
  const renderOrderForm = () => {
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFormSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="customerName"
              label="客户姓名"
              rules={[{ required: true, message: '请输入客户姓名' }]}
            >
              <Input placeholder="请输入客户姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="customerContact"
              label="联系方式"
              rules={[{ required: true, message: '请输入联系方式' }]}
            >
              <Input placeholder="请输入联系方式" />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="source"
              label="订单来源"
              rules={[{ required: true, message: '请选择订单来源' }]}
            >
              <Select placeholder="请选择订单来源">
                <Option value={OrderSource.DOUYIN}>抖音</Option>
                <Option value={OrderSource.BILIBILI}>B站</Option>
                <Option value={OrderSource.XIAOHONGSHU}>小红书</Option>
                <Option value={OrderSource.TAOBAO}>淘宝</Option>
                <Option value={OrderSource.XIANYU}>闲鱼</Option>
                <Option value={OrderSource.RECOMMEND}>达人推荐</Option>
                <Option value={OrderSource.OTHER}>其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="depositAmount"
              label="定金金额"
              rules={[{ required: true, message: '请输入定金金额' }]}
            >
              <Input type="number" placeholder="请输入定金金额" addonAfter="元" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="basicRequirements"
          label="基础需求"
          rules={[{ required: true, message: '请输入基础需求' }]}
        >
          <Input.TextArea rows={3} placeholder="请输入基础需求" />
        </Form.Item>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="styleInfo"
              label="款式信息"
            >
              <Input placeholder="请输入款式信息" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="materialInfo"
              label="材质信息"
            >
              <Input placeholder="请输入材质信息" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="orderTime"
          label="下单时间"
          rules={[{ required: true, message: '请选择下单时间' }]}
        >
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    );
  };

  return (
    <div className="order-management-page">
      {/* 页面标题和操作按钮 */}
      <Card bordered={false}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              订单管理
            </Title>
            <Text type="secondary">
              共 {total} 个订单
            </Text>
          </Col>
          <Col>
            <Space>
              {[UserRole.PRE_SALES, UserRole.ADMIN].includes(user?.role as UserRole) && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateOrder}
                >
                  新建订单
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={loadOrders}
              >
                刷新
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => message.info('导出功能开发中')}
              >
                导出
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 搜索区域 */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
        >
          <Row gutter={16} style={{ width: '100%' }}>
            <Col span={6}>
              <Form.Item name="orderNumber" label="订单编号">
                <Input placeholder="请输入订单编号" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="customerName" label="客户姓名">
                <Input placeholder="请输入客户姓名" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="source" label="订单来源">
                <Select placeholder="请选择订单来源" allowClear>
                  <Option value={OrderSource.DOUYIN}>抖音</Option>
                  <Option value={OrderSource.BILIBILI}>B站</Option>
                  <Option value={OrderSource.XIAOHONGSHU}>小红书</Option>
                  <Option value={OrderSource.TAOBAO}>淘宝</Option>
                  <Option value={OrderSource.XIANYU}>闲鱼</Option>
                  <Option value={OrderSource.RECOMMEND}>达人推荐</Option>
                  <Option value={OrderSource.OTHER}>其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="订单状态">
                <Select placeholder="请选择订单状态" allowClear>
                  {Object.values(OrderStatus).map(status => (
                    <Option key={status} value={status}>
                      {getStatusText(status)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16} style={{ width: '100%', marginTop: 16 }}>
            <Col span={12}>
              <Form.Item name="dateRange" label="创建时间">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Space style={{ float: 'right' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SearchOutlined />}
                >
                  搜索
                </Button>
                <Button
                  onClick={handleResetSearch}
                  icon={<ReloadOutlined />}
                >
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* 标签页和订单列表 */}
      <Card bordered={false} style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={getTabs().map(tab => ({
            key: tab.key,
            label: (
              <Space>
                {tab.label}
                <Badge
                  count={tab.count}
                  style={{ backgroundColor: '#1890ff' }}
                />
              </Space>
            ),
            children: (
              <Table
                columns={columns}
                dataSource={orders}
                rowKey={(record) => record.baseInfo.id}
                loading={loading}
                pagination={{
                  current: currentPage,
                  pageSize: pageSize,
                  total: total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                  onChange: handlePageChange,
                  onShowSizeChange: handlePageChange,
                }}
                scroll={{ x: 1200 }}
              />
            ),
          }))}
        />
      </Card>

      {/* 订单详情/编辑模态框 */}
      <Modal
        title={modalType === 'view' ? '订单详情' : modalType === 'edit' ? '编辑订单' : '新建订单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={
          modalType === 'view' ? (
            <Button onClick={() => setModalVisible(false)}>关闭</Button>
          ) : (
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={() => form.submit()}>
                {modalType === 'create' ? '创建' : '保存'}
              </Button>
            </Space>
          )
        }
      >
        {modalType === 'view' ? renderOrderDetail() : renderOrderForm()}
      </Modal>
    </div>
  );
};

export default OrderManagementPage;