import { useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../api/client';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem('access_token')));

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    authApi.getProfile()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    localStorage.setItem('access_token', response.data.access);
    localStorage.setItem('refresh_token', response.data.refresh);
    const profileRes = await authApi.getProfile();
    setUser(profileRes.data);
  };

  const register = async (data: {
    email: string;
    username: string;
    first_name: string;
    password: string;
    password_confirm: string;
  }) => {
    await authApi.register(data);
    await login(data.email, data.password);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
