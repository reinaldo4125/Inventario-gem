import React, { createContext, useState, useEffect } from 'react';
import api from './api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ id: payload.id, nombre: payload.nombre, rol: payload.rol });
      } catch { setUser(null); }
    }
  }, []);

  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken || '');
    setUser({ id: data.id, nombre: data.nombre, rol: data.rol });
  };
  const logout = async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) await fetch('/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) });
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location = '/';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
