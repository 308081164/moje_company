import api from './api';
import {
  UserInfo,
  UserCreateRequest,
  UserUpdateRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  UserQueryParams,
  PaginatedResponse,
  LoginHistory,
  OperationLog,
  Role,
  Permission,
} from '@/types/auth';

// 用户服务
export const userService = {
  // 获取用户列表
  async getUsers(params?: UserQueryParams): Promise<PaginatedResponse<UserInfo>> {
    try {
      const response = await api.get<PaginatedResponse<UserInfo>>('/users', { params });
      return response;
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  },
  
  // 获取用户详情
  async getUserById(userId: number): Promise<UserInfo> {
    try {
      const response = await api.get<UserInfo>(`/users/${userId}`);
      return response;
    } catch (error) {
      console.error('获取用户详情失败:', error);
      throw error;
    }
  },
  
  // 创建用户
  async createUser(userData: UserCreateRequest): Promise<UserInfo> {
    try {
      const response = await api.post<UserInfo>('/users', userData);
      return response;
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  },
  
  // 更新用户
  async updateUser(userId: number, userData: UserUpdateRequest): Promise<UserInfo> {
    try {
      const response = await api.put<UserInfo>(`/users/${userId}`, userData);
      return response;
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  },
  
  // 删除用户
  async deleteUser(userId: number): Promise<void> {
    try {
      await api.delete(`/users/${userId}`);
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  },
  
  // 批量删除用户
  async deleteUsers(userIds: number[]): Promise<void> {
    try {
      await api.delete('/users/batch', { data: { userIds } });
    } catch (error) {
      console.error('批量删除用户失败:', error);
      throw error;
    }
  },
  
  // 修改密码
  async changePassword(passwordData: ChangePasswordRequest): Promise<void> {
    try {
      await api.put('/users/change-password', passwordData);
    } catch (error) {
      console.error('修改密码失败:', error);
      throw error;
    }
  },
  
  // 重置密码（管理员）
  async resetPassword(passwordData: ResetPasswordRequest): Promise<void> {
    try {
      await api.put('/users/reset-password', passwordData);
    } catch (error) {
      console.error('重置密码失败:', error);
      throw error;
    }
  },
  
  // 启用用户
  async enableUser(userId: number): Promise<void> {
    try {
      await api.put(`/users/${userId}/enable`);
    } catch (error) {
      console.error('启用用户失败:', error);
      throw error;
    }
  },
  
  // 禁用用户
  async disableUser(userId: number): Promise<void> {
    try {
      await api.put(`/users/${userId}/disable`);
    } catch (error) {
      console.error('禁用用户失败:', error);
      throw error;
    }
  },
  
  // 解锁用户
  async unlockUser(userId: number): Promise<void> {
    try {
      await api.put(`/users/${userId}/unlock`);
    } catch (error) {
      console.error('解锁用户失败:', error);
      throw error;
    }
  },
  
  // 获取用户登录历史
  async getLoginHistory(params?: {
    userId?: number;
    username?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<LoginHistory>> {
    try {
      const response = await api.get<PaginatedResponse<LoginHistory>>('/users/login-history', { params });
      return response;
    } catch (error) {
      console.error('获取登录历史失败:', error);
      throw error;
    }
  },
  
  // 获取用户操作日志
  async getOperationLogs(params?: {
    userId?: number;
    username?: string;
    operation?: string;
    module?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<OperationLog>> {
    try {
      const response = await api.get<PaginatedResponse<OperationLog>>('/users/operation-logs', { params });
      return response;
    } catch (error) {
      console.error('获取操作日志失败:', error);
      throw error;
    }
  },
  
  // 获取所有角色
  async getRoles(): Promise<Role[]> {
    try {
      const response = await api.get<Role[]>('/users/roles');
      return response;
    } catch (error) {
      console.error('获取角色列表失败:', error);
      throw error;
    }
  },
  
  // 获取角色详情
  async getRoleById(roleId: number): Promise<Role> {
    try {
      const response = await api.get<Role>(`/users/roles/${roleId}`);
      return response;
    } catch (error) {
      console.error('获取角色详情失败:', error);
      throw error;
    }
  },
  
  // 创建角色
  async createRole(roleData: Partial<Role>): Promise<Role> {
    try {
      const response = await api.post<Role>('/users/roles', roleData);
      return response;
    } catch (error) {
      console.error('创建角色失败:', error);
      throw error;
    }
  },
  
  // 更新角色
  async updateRole(roleId: number, roleData: Partial<Role>): Promise<Role> {
    try {
      const response = await api.put<Role>(`/users/roles/${roleId}`, roleData);
      return response;
    } catch (error) {
      console.error('更新角色失败:', error);
      throw error;
    }
  },
  
  // 删除角色
  async deleteRole(roleId: number): Promise<void> {
    try {
      await api.delete(`/users/roles/${roleId}`);
    } catch (error) {
      console.error('删除角色失败:', error);
      throw error;
    }
  },
  
  // 获取所有权限
  async getPermissions(): Promise<Permission[]> {
    try {
      const response = await api.get<Permission[]>('/users/permissions');
      return response;
    } catch (error) {
      console.error('获取权限列表失败:', error);
      throw error;
    }
  },
  
  // 分配角色给用户
  async assignRoleToUser(userId: number, roleId: number): Promise<void> {
    try {
      await api.post(`/users/${userId}/assign-role`, { roleId });
    } catch (error) {
      console.error('分配角色失败:', error);
      throw error;
    }
  },
  
  // 从用户移除角色
  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    try {
      await api.delete(`/users/${userId}/remove-role/${roleId}`);
    } catch (error) {
      console.error('移除角色失败:', error);
      throw error;
    }
  },
  
  // 分配权限给角色
  async assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void> {
    try {
      await api.post(`/users/roles/${roleId}/assign-permissions`, { permissionIds });
    } catch (error) {
      console.error('分配权限失败:', error);
      throw error;
    }
  },
  
  // 从角色移除权限
  async removePermissionsFromRole(roleId: number, permissionIds: number[]): Promise<void> {
    try {
      await api.delete(`/users/roles/${roleId}/remove-permissions`, { data: { permissionIds } });
    } catch (error) {
      console.error('移除权限失败:', error);
      throw error;
    }
  },
  
  // 导出用户数据
  async exportUsers(params?: UserQueryParams): Promise<Blob> {
    try {
      const response = await api.get('/users/export', {
        params,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('导出用户数据失败:', error);
      throw error;
    }
  },
  
  // 导入用户数据
  async importUsers(file: File): Promise<{ success: number; failed: number; errors: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/users/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response;
    } catch (error) {
      console.error('导入用户数据失败:', error);
      throw error;
    }
  },
  
  // 获取用户统计信息
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    lockedUsers: number;
    todayLogins: number;
    weekLogins: number;
    monthLogins: number;
    roleDistribution: Array<{ role: string; count: number }>;
    departmentDistribution: Array<{ department: string; count: number }>;
  }> {
    try {
      const response = await api.get('/users/statistics');
      return response;
    } catch (error) {
      console.error('获取用户统计信息失败:', error);
      throw error;
    }
  },
  
  // 搜索用户
  async searchUsers(keyword: string, limit: number = 10): Promise<UserInfo[]> {
    try {
      const response = await api.get<UserInfo[]>('/users/search', {
        params: { keyword, limit },
      });
      return response;
    } catch (error) {
      console.error('搜索用户失败:', error);
      throw error;
    }
  },
  
  // 验证用户名是否可用
  async checkUsernameAvailable(username: string): Promise<boolean> {
    try {
      const response = await api.get<boolean>('/users/check-username', {
        params: { username },
      });
      return response;
    } catch (error) {
      console.error('检查用户名失败:', error);
      throw error;
    }
  },
  
  // 验证邮箱是否可用
  async checkEmailAvailable(email: string): Promise<boolean> {
    try {
      const response = await api.get<boolean>('/users/check-email', {
        params: { email },
      });
      return response;
    } catch (error) {
      console.error('检查邮箱失败:', error);
      throw error;
    }
  },
  
  // 更新用户头像
  async updateAvatar(userId: number, avatarFile: File): Promise<{ avatarUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      
      const response = await api.post<{ avatarUrl: string }>(
        `/users/${userId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response;
    } catch (error) {
      console.error('更新头像失败:', error);
      throw error;
    }
  },
  
  // 获取用户会话列表
  async getUserSessions(userId: number): Promise<any[]> {
    try {
      const response = await api.get(`/users/${userId}/sessions`);
      return response;
    } catch (error) {
      console.error('获取用户会话失败:', error);
      throw error;
    }
  },
  
  // 强制用户下线
  async forceLogout(userId: number, sessionId?: string): Promise<void> {
    try {
      await api.post(`/users/${userId}/force-logout`, { sessionId });
    } catch (error) {
      console.error('强制用户下线失败:', error);
      throw error;
    }
  },
};