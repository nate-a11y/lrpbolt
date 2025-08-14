import { useAuth } from "../context/AuthContext.jsx";

export function useRole() {
  const { role, roleLoading } = useAuth();
  return { role, roleLoading };
}
