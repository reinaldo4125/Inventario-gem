import React from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';

export default function PrivateRoute({ children, roles = [] }) {
  const { user } = React.useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user.rol)) return <Navigate to="/" replace />;
  return children;
}
