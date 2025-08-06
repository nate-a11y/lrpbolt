import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

export default function PrivateRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
