import React from 'react';
import { Empty, Tabs } from 'antd';
import ModelSettlementDesk from './ModelSettlementDesk';
import './SettlementPage.css';

const SettlementPage: React.FC = () => {
  return (
    <div className="settle-page">
      <Tabs
        defaultActiveKey="model"
        items={[
          {
            key: 'design',
            label: '设计核算',
            children: (
              <Empty
                className="settle-empty"
                description="设计核算还没有评定规则。订单里的设计师、设计图和确认时间以后可以自动带出，计分项等规则确定后再做。"
              />
            ),
          },
          {
            key: 'model',
            label: '建模核算',
            children: <ModelSettlementDesk />,
          },
        ]}
      />
    </div>
  );
};

export default SettlementPage;
