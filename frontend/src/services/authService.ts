import api from './api';
import { LoginRequest, LoginResponse, UserInfo } from '@/types/auth';

// 认证服务
export const authService = {
  // 用户登录
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      
      // 保存token到本地存储
      if (response.accessToken) {
        localStorage.setItem('access_token', response.accessToken);
      }
      if (response.refreshToken) {
        localStorage.setItem('refresh_token', response.refreshToken);
      }
      
      // 保存用户信息
      if (response.userId && response.username) {
        const userInfo: UserInfo = {
          id: response.userId,
          username: response.username,
          realName: response.realName,
          role: response.role,
          roleDescription: response.roleDescription,
          permissions: response.permissions || [],
        };
        localStorage.setItem('user_info', JSON.stringify(userInfo));
      }
      
      return response;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  },
  
  // 用户登出
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('登出请求失败:', error);
    } finally {
      // 清除本地存储
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
    }
  },
  
  // 刷新token
  async refreshToken(): Promise<LoginResponse> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('刷新令牌不存在');
      }
      
      const response = await api.post<LoginResponse>('/auth/refresh-token', {
        refreshToken,
      });
      
      // 更新本地存储
      if (response.accessToken) {
        localStorage.setItem('access_token', response.accessToken);
      }
      if (response.refreshToken) {
        localStorage.setItem('refresh_token', response.refreshToken);
      }
      
      return response;
    } catch (error) {
      console.error('刷新令牌失败:', error);
      // 清除本地存储，强制重新登录
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
      throw error;
    }
  },
  
  // 获取当前用户信息
  async getCurrentUser(): Promise<UserInfo> {
    try {
      const response = await api.get<UserInfo>('/auth/current-user');
      
      // 更新本地存储的用户信息
      localStorage.setItem('user_info', JSON.stringify(response));
      
      return response;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  },
  
  // 检查认证状态
  checkAuth(): boolean {
    const token = localStorage.getItem('access_token');
    const userInfo = localStorage.getItem('user_info');
    
    if (!token || !userInfo) {
      return false;
    }
    
    try {
      // 检查token是否过期（简单检查）
      const user = JSON.parse(userInfo);
      return !!user.id && !!user.username;
    } catch {
      return false;
    }
  },
  
  // 获取当前用户信息（从本地存储）
  getCurrentUserFromStorage(): UserInfo | null {
    try {
      const userInfoStr = localStorage.getItem('user_info');
      if (!userInfoStr) {
        return null;
      }
      
      return JSON.parse(userInfoStr);
    } catch (error) {
      console.error('解析用户信息失败:', error);
      return null;
    }
  },
  
  // 获取访问令牌
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  },
  
  // 更新用户信息
  updateUserInfo(userInfo: Partial<UserInfo>): void {
    try {
      const currentUserInfo = this.getCurrentUserFromStorage();
      if (currentUserInfo) {
        const updatedUserInfo = { ...currentUserInfo, ...userInfo };
        localStorage.setItem('user_info', JSON.stringify(updatedUserInfo));
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
    }
  },
  
  // 检查权限
  hasPermission(permission: string): boolean {
    try {
      const userInfo = this.getCurrentUserFromStorage();
      if (!userInfo || !userInfo.permissions) {
        return false;
      }
      
      return userInfo.permissions.includes(permission);
    } catch {
      return false;
    }
  },
  
  // 检查角色
  hasRole(role: string): boolean {
    try {
      const userInfo = this.getCurrentUserFromStorage();
      if (!userInfo) {
        return false;
      }
      
      return userInfo.role === role;
    } catch {
      return false;
    }
  },
  
  // 获取用户角色
  getUserRole(): string | null {
    try {
      const userInfo = this.getCurrentUserFromStorage();
      return userInfo?.role || null;
    } catch {
      return null;
    }
  },
  
  // 获取用户权限列表
  getUserPermissions(): string[] {
    try {
      const userInfo = this.getCurrentUserFromStorage();
      return userInfo?.permissions || [];
    } catch {
      return [];
    }
  },
  
  // 清除认证信息
  clearAuth(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
  },
  
  // 验证密码强度
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    let score = 0;
    
    // 长度检查
    if (password.length >= 8) {
      score += 1;
    } else {
      suggestions.push('密码长度至少8位');
    }
    
    // 包含大写字母
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('包含至少一个大写字母');
    }
    
    // 包含小写字母
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('包含至少一个小写字母');
    }
    
    // 包含数字
    if (/\d/.test(password)) {
      score += 1;
    } else {
      suggestions.push('包含至少一个数字');
    }
    
    // 包含特殊字符
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('包含至少一个特殊字符');
    }
    
    return {
      isValid: score >= 4,
      score,
      suggestions,
    };
  },
  
  // 生成随机密码
  generateRandomPassword(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // 确保包含各种字符类型
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    password += 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
    password += '0123456789'.charAt(Math.floor(Math.random() * 10));
    password += '!@#$%^&*()_+-=[]{}|;:,.<>?'.charAt(Math.floor(Math.random() * 24));
    
    // 填充剩余长度
    for (let i = 4; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // 打乱密码
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },
};