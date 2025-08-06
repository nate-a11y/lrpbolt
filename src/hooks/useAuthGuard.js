// src/hooks/useAuthGuard.js
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getUserAccess } from "./api";
import { useAuth } from "../components/AuthProvider.jsx";
import { logError } from "../utils/logError";

/**
 * Redirects unauthenticated users to "/login" and unauthorized users to "/rides".
 * @param {string} [requiredRole]
 */
export default function useAuthGuard(requiredRole) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (location.pathname !== "/login") navigate("/login", { replace: true });
      return;
    }

    if (!requiredRole) return;

    let cancelled = false;

      getUserAccess(user.email)
        .then((access) => {
          if (cancelled) return;
          if (!access || access.access !== requiredRole) {
            if (location.pathname !== "/rides")
              navigate("/rides", { replace: true });
          }
        })
        .catch((err) => {
          if (cancelled) return;
          logError(err, "useAuthGuard");
          if (location.pathname !== "/rides") navigate("/rides", { replace: true });
        });

    return () => {
      cancelled = true;
    };
  }, [user, loading, requiredRole, navigate, location.pathname]);
}
