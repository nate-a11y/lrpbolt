import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { canAccessRoute } from "../utils/roleGuards";

export default function PrivateRoute() {
  const { user, role, authLoading, roleLoading } = useAuth();
  const location = useLocation();

  if (authLoading || roleLoading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (
    !canAccessRoute(location.pathname, role) &&
    location.pathname !== "/shootout"
  ) {
    const to = `/shootout${location.search || ""}`;
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}
