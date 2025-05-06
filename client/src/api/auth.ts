import api from './index';

export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    diet?: string;
    intolerances?: string[];
    favoriteIngredients?: string[];
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
}

const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', credentials);
    const { token, user } = response.data;
    
    // Store token and user in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', userData);
    const { token, user } = response.data;
    
    // Store token and user in localStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: (): User | null => {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  },

  isAuthenticated: (): boolean => {
    return localStorage.getItem('token') !== null;
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await api.put('/auth/profile', userData);
    
    // Update stored user data
    const updatedUser = response.data.user;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    return updatedUser;
  }
};

export default authApi;