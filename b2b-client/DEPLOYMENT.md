# MOJE 珠宝 - 官网 & B2B业务门户

高端珠宝定制企业官网与B2B业务门户系统，支持SSL加密、自动证书续订等功能。

## 功能特性

### 官网首页
- ✨ 高端大气的珠宝行业设计风格
- 📦 产品展示与企业介绍
- 🔗 显眼的B端业务入口（导航栏和首页中心）
- 📱 响应式设计，支持移动端

### B端业务门户
- 📝 快速创建定制订单
- 📎 支持多格式文件上传（图片、Word、Excel、PDF）
- 🔗 访问链接与二维码分享
- 📊 订单进度实时查看

### 技术特性
- 🔒 SSL证书自动申请与续订
- 📜 Let's Encrypt免费证书
- 📈 完整的Docker部署方案
- 🔄 定期证书自动更新

## 快速开始

### 前置条件

- Docker & Docker Compose
- 域名已解析到服务器（moje珠宝.com & www.moje珠宝.com）
- 服务器开放80和443端口
- 阿里云OSS账号（用于文件存储）

### 部署步骤

#### 1. 环境准备

```bash
# 克隆项目
cd moje-company/b2b-client

# 复制配置文件
cp .env.example .env
# 编辑.env文件，填入实际配置
nano .env
```

#### 2. 初始化SSL证书

```bash
# 进入脚本目录
cd ../scripts

# 赋予执行权限
chmod +x init-ssl.sh
chmod +x renew-ssl.sh

# 运行SSL初始化脚本
./init-ssl.sh
```

此脚本会：
- 自动申请Let's Encrypt免费SSL证书
- 配置域名 moje珠宝.com 和 www.moje珠宝.com
- 证书会保存到Docker Volume中

#### 3. 启动服务

```bash
cd ../b2b-client

# 构建并启动所有服务
docker-compose -f docker-compose.prod.yml up -d --build
```

服务说明：
- `moje-web` - 前端网站（Nginx）
- `moje-backend` - 后端API服务
- `moje-mysql` - MySQL数据库
- `moje-redis` - Redis缓存（可选）

#### 4. 设置SSL自动续订

**方案一：使用系统Cron任务（推荐）**

```bash
# 编辑crontab
crontab -e

# 添加每周一凌晨2点的续订任务
0 2 * * 1 cd /path/to/moje-company/scripts && ./renew-ssl.sh >> /var/log/moje-ssl.log 2>&1
```

**方案二：手动定期检查**

```bash
# 随时可以手动检查和续订
./scripts/renew-ssl.sh
```

## 网站结构

```
/                       - 官网首页（企业介绍、产品展示）
/portal                 - B端业务入口（订单创建）
/order/{token}          - 订单详情页
```

### 首页导航

- **Logo区域** - MOJE珠宝品牌标识
- **导航链接**
  - 关于我们
  - 产品展示
  - 联系方式
- **B端入口** - 右上角醒目按钮

### 首页内容区域

1. **Hero区域** - 品牌标语与主要CTA
2. **关于我们** - 企业介绍和核心优势
3. **产品展示** - 6个产品卡片
4. **CTA区域** - 深色背景的需求提交入口
5. **联系信息** - 地址、电话、邮箱、营业时间
6. **页脚** - 快速链接、服务支持、社交账号

## 系统架构

```
                     ┌─────────────────────────────────┐
                     │    浏览器访问                    │
                     │    https://moje珠宝.com        │
                     └────────────────┬────────────────┘
                                      │
                                      ▼ HTTPS
                              ┌─────────────────┐
                              │   Nginx (SSL)  │
                              │  (443端口)     │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌─────────────┐   ┌───────────────┐   ┌─────────────┐
            │   首页      │   │    B端门户   │   │  后端API  │
            │   Home     │   │   Portal      │   │  Backend   │
            └─────────────┘   └───────────────┘   └──────┬──────┘
                                                            │
                                                 ┌──────────┴──────────┐
                                                 ▼                     ▼
                                          ┌───────────┐       ┌──────────────┐
                                          │   MySQL   │       │  Aliyun OSS │
                                          └───────────┘       └──────────────┘
```

## 订单创建流程（B端）

```
1. 访问官网首页
   ↓
2. 点击“B端业务入口”或“立即定制”
   ↓
3. 填写订单信息
   - 公司名称
   - 联系方式
   - 订单需求
   - 定金金额
   - 附件上传（可选）
   ↓
4. 系统创建订单
   - 自动分配建模师
   - 生成访问令牌
   - 生成二维码
   ↓
5. 收到确认信息
   - 订单编号
   - 访问链接
   - 二维码
   ↓
6. 随时查看进度
```

## 订单状态

- `PENDING_DESIGN` - 待设计
- `DESIGNING` - 设计中
- `PENDING_MODEL` - 待建模
- `MODELING` - 建模中
- `PENDING_REVIEW` - 待审核
- `PENDING_PRODUCTION` - 待生产
- `PRODUCING` - 生产中
- `COMPLETED` - 已完成
- `CANCELLED` - 已取消

## 驳回流程优化

驳回流程支持以下状态：
1. `PENDING_FIX` - 待修复
2. `IN_FIX` - 修复中
3. `RESUBMITTED` - 重新提交
4. `RESOLVED` - 已解决

## 建模师工作模式

- `AUTO` - 自动模式（接收C端和B端）
- `B2B_ONLY` - 仅接收B端
- `C2C_ONLY` - 仅接收C端

建模师可以在任务未全部完成时切换模式，系统会智能分配。

## 超时提醒

- **警告提醒** - 任务96小时未完成
- **强制暂停** - 任务168小时未完成
- 可手动恢复自动派单

## 管理员数据统筹

管理员可以查看所有C端和B端订单数据的统一统计。

访问地址：`/admin`

包含统计内容：
- 整体订单统计
- C端业务统计
- B端业务统计
- 每日新订单数
- 完成订单数
- 收入统计

## 文件支持类型

- 🖼️ 图片：JPG, PNG, GIF, BMP, PDF
- 📄 文档：Word (.doc, .docx), Excel (.xls, .xlsx)
- 📦 建模文件：STL, OBJ, JAD

## 监控与维护

### 查看服务状态
```bash
docker-compose -f docker-compose.prod.yml ps
```

### 查看日志
```bash
# 前端
docker logs moje-web

# 后端
docker logs moje-backend

# 数据库
docker logs moje-mysql
```

### 备份数据库
```bash
docker exec moje-mysql mysqldump -uroot -p moje_db > backup.sql
```

### 更新系统
```bash
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

## 常见问题

### SSL证书申请失败
- 检查域名是否正确解析
- 检查80端口是否开放
- 查看详细错误信息

### 页面无法访问
- 检查docker服务是否运行
- 检查防火墙设置
- 检查nginx配置

### 文件上传失败
- 检查OSS配置
- 检查文件大小限制
- 查看后端日志

## 安全建议

1. 定期更新系统和依赖
2. 使用强密码和JWT密钥
3. 定期备份数据库
4. 监控服务运行状态
5. 设置日志轮转

## 联系方式

- 官网：https://moje珠宝.com
- B端门户：https://moje珠宝.com/portal
- 邮箱：admin@moje珠宝.com
- 电话：400-888-8888
- 地址：上海市静安区南京西路1266号恒隆广场33楼

---

© 2024 MOJE 珠宝. All rights reserved.
