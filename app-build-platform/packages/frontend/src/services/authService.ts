import api from './api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  expires_in: number;
  user: {
    username: string;
  };
}

export const authService = {
  // 登录
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response.data;
  },

  // 登出（客户端清除 token）
  logout: () => {
    localStorage.removeItem('token');
  },

  // 检查是否已登录
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  // 获取 token
  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
};
