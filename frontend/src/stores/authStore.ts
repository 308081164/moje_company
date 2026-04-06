import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services/authService';
import { LoginRequest, LoginResponse, UserInfo, UserRole } from '@/types/auth';

interface AuthState {
  // 状态
  isAuthenticated: boolean;
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  
  // 操作
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  clearError: () => void;
  updateUserInfo: (userInfo: Partial<UserInfo>) => void;
  
  // 权限检查
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  getUserRole: () => UserRole | null;
  getUserPermissions: () => string[];
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
      
      // 登录
      login: async (credentials) => {
        set({ loading: true, error: null });
        try {
          const response = await authService.login(credentials);
          
          set({
            isAuthenticated: true,
            user: {
              id: response.userId,
              username: response.username,
              realName: response.realName,
              role: response.role,
              roleDescription: response.roleDescription,
              permissions: response.permissions || [],
              status: 'ACTIVE',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            token: response.accessToken,
            loading: false,
          });
          
          return response;
        } catch (error: any) {
          const errorMessage = error.message || '登录失败，请检查用户名和密码';
          set({ 
            error: errorMessage,
            loading: false,
          });
          throw error;
        }
      },
      
      // 登出
      logout: async () => {
        set({ loading: true });
        try {
          await authService.logout();
        } catch (error) {
          console.error('登出失败:', error);
        } finally {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: null,
          });
        }
      },
      
      // 检查认证状态
      checkAuth: async () => {
        const token = localStorage.getItem('access_token');
        const userInfoStr = localStorage.getItem('user_info');
        
        if (!token || !userInfoStr) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
          });
          return false;
        }
        
        try {
          const userInfo = JSON.parse(userInfoStr);
          
          // 简单检查用户信息是否完整
          if (!userInfo.id || !userInfo.username) {
            set({
              isAuthenticated: false,
              user: null,
              token: null,
            });
            return false;
          }
          
          set({
            isAuthenticated: true,
            user: userInfo,
            token: token,
          });
          
          // 尝试获取最新用户信息
          try {
            const currentUser = await authService.getCurrentUser();
            set({
              user: currentUser,
            });
          } catch (error) {
            console.error('获取最新用户信息失败:', error);
            // 不影响认证状态
          }
          
          return true;
        } catch (error) {
          console.error('检查认证状态失败:', error);
          set({
            isAuthenticated: false,
            user: null,
            token: null,
          });
          return false;
        }
      },
      
      // 清除错误
      clearError: () => {
        set({ error: null });
      },
      
      // 更新用户信息
      updateUserInfo: (userInfo) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userInfo };
          set({ user: updatedUser });
          authService.updateUserInfo(userInfo);
        }
      },
      
      // 检查权限
      hasPermission: (permission) => {
        const user = get().user;
        if (!user || !user.permissions) {
          return false;
        }
        return user.permissions.includes(permission);
      },
      
      // 检查角色
      hasRole: (role) => {
        const user = get().user;
        if (!user) {
          return false;
        }
        return user.role === role;
      },
      
      // 获取用户角色
      getUserRole: () => {
        const user = get().user;
        return user?.role || null;
      },
      
      // 获取用户权限列表
      getUserPermissions: () => {
        const user = get().user;
        return user?.permissions || [];
      },
    }),
    {
      name: 'auth-storage', // localStorage的key
      partialize: (state) => ({
        // 只持久化必要的状态
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
);

// 导出一些常用的选择器
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useUserRole = () => useAuthStore((state) => state.user?.role);
export const useUserPermissions = () => useAuthStore((state) => state.user?.permissions || []);
export const useAuthLoading = () => useAuthStore((state) => state.loading);
export const useAuthError = () => useAuthStore((state) => state.error);

// 权限检查Hook
export const useHasPermission = (permission: string) => {
  return useAuthStore((state) => state.hasPermission(permission));
};

export const useHasRole = (role: UserRole) => {
  return useAuthStore((state) => state.hasRole(role));
};

// 角色特定的Hook
export const useIsAdmin = () => useHasRole(UserRole.ADMIN);
export const useIsPreSales = () => useHasRole(UserRole.PRE_SALES);
export const useIsSales = () => useHasRole(UserRole.SALES);
export const useIsDesigner = () => useHasRole(UserRole.DESIGNER);
export const useIsModeler = () => useHasRole(UserRole.MODELER);
export const useIsTracker = () => useHasRole(UserRole.TRACKER);

// 权限检查工具函数
export const checkPermission = (permission: string): boolean => {
  const state = useAuthStore.getState();
  return state.hasPermission(permission);
};

export const checkRole = (role: UserRole): boolean => {
  const state = useAuthStore.getState();
  return state.hasRole(role);
};

// 获取当前用户信息
export const getCurrentUser = (): UserInfo | null => {
  return useAuthStore.getState().user;
};

// 获取访问令牌
export const getAccessToken = (): string | null => {
  return useAuthStore.getState().token;
};

// 检查认证状态
export const isAuthenticated = (): boolean => {
  return useAuthStore.getState().isAuthenticated;
};