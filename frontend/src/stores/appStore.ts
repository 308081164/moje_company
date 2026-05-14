import { create } from 'zustand';
import { OrderInfo, OrderStatus, OrderSource } from '@/types/order';
import { UserInfo } from '@/types/auth';

interface AppState {
  // 应用状态
  appReady: boolean;
  loading: boolean;
  error: string | null;
  
  // 全局数据
  orders: OrderInfo[];
  users: UserInfo[];
  statistics: any;
  
  // UI状态
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  notifications: Notification[];
  unreadNotifications: number;
  
  // 操作
  initializeApp: () => Promise<void>;
  setAppReady: (ready: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 订单管理
  setOrders: (orders: OrderInfo[]) => void;
  addOrder: (order: OrderInfo) => void;
  updateOrder: (orderId: number, updates: Partial<OrderInfo>) => void;
  deleteOrder: (orderId: number) => void;
  
  // 用户管理
  setUsers: (users: UserInfo[]) => void;
  addUser: (user: UserInfo) => void;
  updateUser: (userId: number, updates: Partial<UserInfo>) => void;
  deleteUser: (userId: number) => void;
  
  // UI控制
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
  
  // 通知管理
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  
  // 统计信息
  setStatistics: (stats: any) => void;
  refreshStatistics: () => Promise<void>;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  appReady: false,
  loading: false,
  error: null,
  
  orders: [],
  users: [],
  statistics: null,
  
  sidebarCollapsed: false,
  theme: 'light',
  language: 'zh-CN',
  notifications: [],
  unreadNotifications: 0,
  
  // 初始化应用
  initializeApp: async () => {
    set({ loading: true });
    try {
      // 这里可以加载应用初始化需要的数据
      // 例如：用户信息、配置、权限等

      // 模拟初始化过程
      await new Promise((resolve) => setTimeout(resolve, 500));

      set({
        appReady: true,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || '应用初始化失败',
        loading: false,
        appReady: true,
      });
      throw error;
    }
  },
  
  // 设置应用就绪状态
  setAppReady: (ready) => {
    set({ appReady: ready });
  },
  
  // 设置加载状态
  setLoading: (loading) => {
    set({ loading });
  },
  
  // 设置错误
  setError: (error) => {
    set({ error });
  },
  
  // 清除错误
  clearError: () => {
    set({ error: null });
  },
  
  // 订单管理
  setOrders: (orders) => {
    set({ orders });
  },
  
  addOrder: (order) => {
    set((state) => ({
      orders: [order, ...state.orders],
    }));
  },
  
  updateOrder: (orderId, updates) => {
    set((state) => ({
      orders: state.orders.map((order) =>
        order.baseInfo.id === orderId
          ? { ...order, ...updates }
          : order
      ),
    }));
  },
  
  deleteOrder: (orderId) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.baseInfo.id !== orderId),
    }));
  },
  
  // 用户管理
  setUsers: (users) => {
    set({ users });
  },
  
  addUser: (user) => {
    set((state) => ({
      users: [user, ...state.users],
    }));
  },
  
  updateUser: (userId, updates) => {
    set((state) => ({
      users: state.users.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      ),
    }));
  },
  
  deleteUser: (userId) => {
    set((state) => ({
      users: state.users.filter((user) => user.id !== userId),
    }));
  },
  
  // UI控制
  toggleSidebar: () => {
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    }));
  },
  
  setSidebarCollapsed: (collapsed) => {
    set({ sidebarCollapsed: collapsed });
  },
  
  toggleTheme: () => {
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    }));
  },
  
  setTheme: (theme) => {
    set({ theme });
  },
  
  setLanguage: (language) => {
    set({ language });
  },
  
  // 通知管理
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: notification.id || Date.now().toString(),
      timestamp: notification.timestamp || new Date(),
      read: false,
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadNotifications: state.unreadNotifications + 1,
    }));
  },
  
  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;
      
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadNotifications: wasUnread
          ? state.unreadNotifications - 1
          : state.unreadNotifications,
      };
    });
  },
  
  markNotificationAsRead: (id) => {
    set((state) => {
      const updatedNotifications = state.notifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      );
      
      const unreadCount = updatedNotifications.filter((n) => !n.read).length;
      
      return {
        notifications: updatedNotifications,
        unreadNotifications: unreadCount,
      };
    });
  },
  
  markAllNotificationsAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
      unreadNotifications: 0,
    }));
  },
  
  clearNotifications: () => {
    set({
      notifications: [],
      unreadNotifications: 0,
    });
  },
  
  // 统计信息
  setStatistics: (stats) => {
    set({ statistics: stats });
  },
  
  refreshStatistics: async () => {
    // 这里可以调用API获取最新的统计信息
    // 暂时返回模拟数据
    const mockStats = {
      totalOrders: 156,
      pendingOrders: 23,
      completedOrders: 89,
      cancelledOrders: 12,
      totalRevenue: 1256000,
      todayNewOrders: 8,
      weekNewOrders: 42,
      monthNewOrders: 156,
      averageOrderValue: 8051,
      customerSatisfaction: 94.5,
    };
    
    set({ statistics: mockStats });
  },
}));

// 导出一些常用的选择器
export const useAppReady = () => useAppStore((state) => state.appReady);
export const useAppLoading = () => useAppStore((state) => state.loading);
export const useAppError = () => useAppStore((state) => state.error);

export const useOrders = () => useAppStore((state) => state.orders);
export const useUsers = () => useAppStore((state) => state.users);
export const useStatistics = () => useAppStore((state) => state.statistics);

export const useSidebarCollapsed = () => useAppStore((state) => state.sidebarCollapsed);
export const useTheme = () => useAppStore((state) => state.theme);
export const useLanguage = () => useAppStore((state) => state.language);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useUnreadNotifications = () => useAppStore((state) => state.unreadNotifications);

// 导出一些常用的操作
export const useAppActions = () => {
  const store = useAppStore();
  
  return {
    toggleSidebar: store.toggleSidebar,
    toggleTheme: store.toggleTheme,
    addNotification: store.addNotification,
    markAllNotificationsAsRead: store.markAllNotificationsAsRead,
    clearNotifications: store.clearNotifications,
    refreshStatistics: store.refreshStatistics,
  };
};

// 工具函数：创建通知
export const createNotification = (
  type: Notification['type'],
  title: string,
  message: string,
  action?: Notification['action']
): Notification => {
  return {
    id: Date.now().toString(),
    type,
    title,
    message,
    timestamp: new Date(),
    read: false,
    action,
  };
};

// 工具函数：添加成功通知
export const addSuccessNotification = (title: string, message: string) => {
  const notification = createNotification('success', title, message);
  useAppStore.getState().addNotification(notification);
};

// 工具函数：添加错误通知
export const addErrorNotification = (title: string, message: string) => {
  const notification = createNotification('error', title, message);
  useAppStore.getState().addNotification(notification);
};

// 工具函数：添加警告通知
export const addWarningNotification = (title: string, message: string) => {
  const notification = createNotification('warning', title, message);
  useAppStore.getState().addNotification(notification);
};

// 工具函数：添加信息通知
export const addInfoNotification = (title: string, message: string) => {
  const notification = createNotification('info', title, message);
  useAppStore.getState().addNotification(notification);
};