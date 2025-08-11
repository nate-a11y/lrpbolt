import { createContext, useContext } from "react";

export const AuthContext = createContext({ user: null, loading: true });

export function useAuth() {
  const { user, loading } = useContext(AuthContext);
  return {
    user: user ? { ...user, email: user.email || "" } : null,
    authLoading: loading,
  };
}
