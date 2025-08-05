// src/hooks/useAuthGuard.js
// Simple authentication guard to ensure user is logged in and optionally has a role
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserAccess } from "./api";
import { subscribeAuth } from "../utils/listenerRegistry";

/**
 * Redirects to "/" if user is not authenticated or lacks the required role.
 * @param {string} [requiredRole]
 */
export default function useAuthGuard(requiredRole) {
  const navigate = useNavigate();
  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      if (!user) {
        navigate("/", { replace: true });
        return;
      }
      if (requiredRole) {
        try {
          const access = await getUserAccess(user.email);
          if (!access || access.access !== requiredRole) {
            navigate("/", { replace: true });
          }
        } catch {
          navigate("/", { replace: true });
        }
      }
    });
    return () => unsub();
  }, [navigate, requiredRole]);
}
