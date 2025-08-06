import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

export default function PrivateRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    console.log("[PrivateRoute] Waiting for auth...");
    return <LoadingScreen />;
  }
  if (!user) {
    console.log("[PrivateRoute] No user found. Redirecting to /login");
    return <Navigate to="/login" replace />;
  }
  console.log("[PrivateRoute] Authenticated user:", user.email);
  return <Outlet />;
}
