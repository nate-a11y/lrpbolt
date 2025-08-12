// src/hooks/useAuthGuard.js
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { logError } from "../utils/logError";

import { getUserAccess } from "./api";
import useAuth from "./useAuth.js";

/**
 * Redirects unauthenticated users to "/login" and unauthorized users to "/rides".
 * @param {string} [requiredRole]
 */
export default function useAuthGuard(requiredRole) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

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
        if (location.pathname !== "/rides")
          navigate("/rides", { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, requiredRole, navigate, location.pathname]);
}
