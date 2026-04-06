# 珠宝定制管理系统 - Electron前端

## 项目概述

珠宝定制工作室企业信息化管理系统前端，基于Electron + React + TypeScript + Ant Design开发。

## 技术栈

- **Electron 25+**: 桌面应用框架
- **React 18**: UI框架
- **TypeScript 5**: 类型安全
- **Ant Design 5**: UI组件库
- **React Router 6**: 路由管理
- **Zustand**: 状态管理
- **Axios**: HTTP客户端
- **Day.js**: 日期处理
- **Webpack 5**: 构建工具

## 快速开始

### 环境要求

1. **Node.js 18+** 或更高版本
2. **npm 9+** 或 **yarn 1.22+**
3. **Git**: 版本控制

### 安装依赖

```bash
# 进入项目目录
cd frontend

# 安装依赖
npm install

# 或使用yarn
yarn install
```

### 开发环境启动

```bash
# 启动开发服务器（渲染进程）
npm run watch:renderer

# 在另一个终端启动主进程监听
npm run watch:main

# 在第三个终端启动Electron应用
npm run start:electron

# 或使用concurrent一键启动（推荐）
npm run dev
```

### 构建应用

```bash
# 构建应用
npm run build

# 打包为可执行文件
npm run package

# 打包Windows版本
npm run package:win

# 打包macOS版本
npm run package:mac

# 打包Linux版本
npm run package:linux
```

## 项目结构

```
frontend/
├── src/
│   ├── main/                    # Electron主进程
│   │   ├── main.ts             # 主进程入口
│   │   └── preload.js          # 预加载脚本
│   ├── renderer/               # 渲染进程
│   │   ├── index.html          # HTML模板
│   │   ├── index.tsx           # React入口
│   │   ├── App.tsx             # 主应用组件
│   │   ├── App.css             # 全局样式
│   │   └── index.css           # 基础样式
│   ├── components/             # 公共组件
│   │   ├── layout/             # 布局组件
│   │   │   ├── AppHeader.tsx   # 顶部导航
│   │   │   ├── AppSider.tsx    # 侧边栏
│   │   │   └── AppFooter.tsx   # 底部信息
│   │   └── common/             # 通用组件
│   ├── pages/                  # 页面组件
│   │   ├── LoginPage.tsx       # 登录页面
│   │   ├── DashboardPage.tsx   # 仪表盘
│   │   ├── OrderManagementPage.tsx # 订单管理
│   │   ├── UserManagementPage.tsx  # 用户管理
│   │   ├── SystemConfigPage.tsx    # 系统配置
│   │   └── NotFoundPage.tsx    # 404页面
│   ├── stores/                 # 状态管理
│   │   ├── authStore.ts        # 认证状态
│   │   ├── appStore.ts         # 应用状态
│   │   └── orderStore.ts       # 订单状态
│   ├── services/               # API服务
│   │   ├── api.ts              # API配置
│   │   ├── authService.ts      # 认证服务
│   │   ├── orderService.ts     # 订单服务
│   │   └── userService.ts      # 用户服务
│   ├── utils/                  # 工具函数
│   │   ├── request.ts          # HTTP请求封装
│   │   ├── storage.ts          # 本地存储
│   │   ├── format.ts           # 格式化工具
│   │   └── validator.ts        # 表单验证
│   └── types/                  # TypeScript类型定义
│       ├── api.ts              # API类型
│       ├── user.ts             # 用户类型
│       └── order.ts            # 订单类型
├── assets/                     # 静态资源
│   ├── icon.png               # 应用图标
│   ├── icon.ico               # Windows图标
│   └── icon.icns              # macOS图标
├── dist/                       # 构建输出目录
├── webpack.main.config.js      # 主进程Webpack配置
├── webpack.renderer.config.js  # 渲染进程Webpack配置
├── tsconfig.json               # TypeScript配置
├── package.json                # 项目配置
└── README.md                   # 项目文档
```

## 开发指南

### 添加新页面

1. 在 `src/pages/` 目录下创建页面组件
2. 在 `src/types/` 目录下添加类型定义
3. 在 `src/services/` 目录下添加API服务
4. 在 `src/stores/` 目录下添加状态管理
5. 在路由配置中添加页面路由

### 添加新组件

1. 在 `src/components/` 目录下创建组件
2. 使用TypeScript定义Props类型
3. 使用Ant Design组件库
4. 添加必要的样式

### API调用

使用 `src/utils/request.ts` 封装的axios实例：

```typescript
import request from '@/utils/request';

// GET请求
const response = await request.get('/api/orders');

// POST请求
const response = await request.post('/api/orders', data);

// 带参数的请求
const response = await request.get('/api/orders', { params });
```

### 状态管理

使用Zustand进行状态管理：

```typescript
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async (credentials) => {
    // 登录逻辑
  },
  logout: () => {
    // 登出逻辑
  },
}));
```

## 与后端API集成

### 后端服务地址

- **开发环境**: http://localhost:8851/api
- **生产环境**: 根据环境变量配置

### 认证流程

1. 用户输入用户名密码
2. 调用 `/api/auth/login` 接口
3. 获取JWT令牌
4. 将令牌存储在本地存储
5. 后续请求自动携带令牌

### API接口

| 模块 | 接口 | 方法 | 描述 |
|------|------|------|------|
| 认证 | `/api/auth/login` | POST | 用户登录 |
| 认证 | `/api/auth/logout` | POST | 用户登出 |
| 认证 | `/api/auth/refresh-token` | POST | 刷新令牌 |
| 用户 | `/api/users` | GET | 获取用户列表 |
| 用户 | `/api/users/:id` | GET | 获取用户详情 |
| 订单 | `/api/orders` | GET | 获取订单列表 |
| 订单 | `/api/orders/:id` | GET | 获取订单详情 |
| 订单 | `/api/orders` | POST | 创建订单 |
| 订单 | `/api/orders/:id` | PUT | 更新订单 |
| 系统 | `/api/system/config` | GET | 获取系统配置 |

## 功能模块

### 1. 用户认证
- 登录/登出
- 令牌刷新
- 权限验证
- 会话管理

### 2. 仪表盘
- 数据统计
- 订单概览
- 待办事项
- 系统状态

### 3. 订单管理
- 订单创建
- 订单查询
- 订单编辑
- 订单状态跟踪
- 文件上传（设计图、建模文件）

### 4. 用户管理
- 用户列表
- 用户详情
- 角色分配
- 权限管理

### 5. 系统配置
- 工艺配置
- 材质配置
- 价格配置
- 系统设置

## 开发命令

### 常用命令

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建应用
npm run build

# 运行构建后的应用
npm start

# 打包应用
npm run package

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 调试命令

```bash
# 打开开发者工具
Ctrl+Shift+I 或 Cmd+Option+I

# 重新加载应用
Ctrl+R 或 Cmd+R

# 强制重新加载
Ctrl+Shift+R 或 Cmd+Shift+R

# 切换开发者工具
Ctrl+Shift+I 或 Cmd+Option+I
```

## 打包部署

### 环境变量

创建 `.env` 文件：

```env
# 后端API地址
API_URL=http://localhost:8851/api

# 应用名称
APP_NAME=珠宝定制管理系统

# 应用版本
APP_VERSION=1.0.0

# 是否开发环境
NODE_ENV=development
```

### 打包配置

在 `package.json` 的 `build` 字段中配置：

```json
{
  "build": {
    "appId": "com.jewelry.system",
    "productName": "珠宝定制管理系统",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

### 打包命令

```bash
# 打包所有平台
npm run package

# 打包Windows版本
npm run package:win

# 打包macOS版本
npm run package:mac

# 打包Linux版本
npm run package:linux
```

## 故障排除

### 常见问题

1. **依赖安装失败**
   - 检查Node.js版本（需要18+）
   - 清理npm缓存：`npm cache clean --force`
   - 删除node_modules重新安装

2. **开发服务器无法启动**
   - 检查端口占用（3000, 5858, 9222）
   - 检查Webpack配置
   - 检查TypeScript配置

3. **Electron应用无法启动**
   - 检查主进程配置
   - 检查预加载脚本
   - 检查渲染进程构建

4. **API请求失败**
   - 检查后端服务是否运行
   - 检查网络连接
   - 检查CORS配置

5. **打包失败**
   - 检查electron-builder配置
   - 检查图标文件路径
   - 检查依赖版本兼容性

### 调试技巧

1. **主进程调试**
   - 使用 `--inspect` 参数启动Electron
   - 使用Chrome DevTools连接调试

2. **渲染进程调试**
   - 使用Electron内置开发者工具
   - 使用React DevTools扩展

3. **网络请求调试**
   - 使用Chrome DevTools Network面板
   - 查看请求/响应详情

4. **性能分析**
   - 使用Chrome DevTools Performance面板
   - 分析CPU和内存使用

## 开发规范

### 代码规范

1. **TypeScript**
   - 使用严格模式
   - 定义明确的类型
   - 避免使用any类型

2. **React**
   - 使用函数组件和Hooks
   - 合理使用useEffect
   - 避免不必要的重新渲染

3. **样式**
   - 使用CSS Modules或styled-components
   - 遵循Ant Design设计规范
   - 保持样式一致性

4. **状态管理**
   - 合理划分状态
   - 避免过度使用全局状态
   - 使用Zustand进行状态管理

### Git提交规范

```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具变动
```

## 联系方式

- **项目负责人**: 系统管理员
- **技术支持**: support@jewelry.com
- **问题反馈**: GitHub Issues

## 许可证

MIT License