import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

export default function PrivateRoute({ children }) {
  const { user, authLoading } = useAuth();
  if (authLoading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

