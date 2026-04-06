// 用户角色枚举
export enum UserRole {
  ADMIN = 'ADMIN',           // 管理员
  PRE_SALES = 'PRE_SALES',   // 售前客服
  SALES = 'SALES',           // 售中客服
  DESIGNER = 'DESIGNER',     // 设计师
  MODELER = 'MODELER',       // 建模师
  TRACKER = 'TRACKER',       // 跟单员
}

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 'ACTIVE',         // 活跃
  INACTIVE = 'INACTIVE',     // 未激活
  LOCKED = 'LOCKED',         // 锁定
  DELETED = 'DELETED',       // 删除
}

// 登录请求
export interface LoginRequest {
  username: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: number;
  username: string;
  realName: string;
  role: UserRole;
  roleDescription: string;
  loginTime: string;
  permissions: string[];
}

// 用户信息
export interface UserInfo {
  id: number;
  username: string;
  realName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  roleDescription: string;
  status: UserStatus;
  department?: string;
  position?: string;
  joinDate?: string;
  lastLoginTime?: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

// 用户创建/更新请求
export interface UserCreateRequest {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  department?: string;
  position?: string;
  status?: UserStatus;
}

export interface UserUpdateRequest {
  realName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  department?: string;
  position?: string;
  status?: UserStatus;
}

// 密码修改请求
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// 重置密码请求
export interface ResetPasswordRequest {
  userId: number;
  newPassword: string;
  confirmPassword: string;
}

// 权限信息
export interface Permission {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  enabled: boolean;
}

// 角色信息
export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  permissions: Permission[];
  enabled: boolean;
}

// 认证状态
export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// 会话信息
export interface SessionInfo {
  id: string;
  userId: number;
  username: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  lastActivityTime: string;
  expiresAt: string;
  isValid: boolean;
}

// API响应格式
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

// 分页请求参数
export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  first: boolean;
  size: number;
  number: number;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  empty: boolean;
}

// 用户查询参数
export interface UserQueryParams extends PaginationParams {
  username?: string;
  realName?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  startDate?: string;
  endDate?: string;
}

// 登录历史记录
export interface LoginHistory {
  id: number;
  userId: number;
  username: string;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  logoutTime?: string;
  success: boolean;
  failureReason?: string;
}

// 操作日志
export interface OperationLog {
  id: number;
  userId: number;
  username: string;
  operation: string;
  module: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  parameters?: string;
  result?: string;
  success: boolean;
  errorMessage?: string;
  executionTime: number;
  createdAt: string;
}

// 系统配置
export interface SystemConfig {
  id: number;
  configKey: string;
  configValue: string;
  configName: string;
  description?: string;
  configType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'ARRAY';
  category: string;
  editable: boolean;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

// 验证码请求
export interface CaptchaRequest {
  type: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PASSWORD';
  target: string; // 邮箱或手机号
}

// 验证码验证
export interface CaptchaVerify {
  type: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD' | 'CHANGE_PASSWORD';
  target: string;
  code: string;
}

// 忘记密码请求
export interface ForgotPasswordRequest {
  username: string;
  email: string;
  captcha: string;
}

// 重置密码验证
export interface ResetPasswordVerify {
  token: string;
  newPassword: string;
  confirmPassword: string;
}