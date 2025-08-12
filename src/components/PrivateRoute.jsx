import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { CircularProgress, Box } from "@mui/material";

export default function PrivateRoute({ children }) {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

