// src/components/common/GuestRoute.tsx
import { useSelector } from 'react-redux';
import type { RootState } from '../store'; // Adjust the path if your store file is elsewhere

import { Navigate, Outlet } from 'react-router-dom';

export default function GuestRoute() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}

