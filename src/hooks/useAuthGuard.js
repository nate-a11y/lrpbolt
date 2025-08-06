// src/hooks/useAuthGuard.js
// Simple authentication guard to ensure user is logged in and optionally has a role
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserAccess } from "./api";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Redirects to "/" if user is not authenticated or lacks the required role.
 * @param {string} [requiredRole]
 */
export default function useAuthGuard(requiredRole) {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (requiredRole) {
      getUserAccess(user.email)
        .then((access) => {
          if (!access || access.access !== requiredRole) {
            navigate("/", { replace: true });
          }
        })
        .catch(() => navigate("/", { replace: true }));
    }
  }, [user, requiredRole, navigate]);
}
