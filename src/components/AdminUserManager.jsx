/* Proprietary and confidential. See LICENSE. */
// src/components/AdminUserManager.jsx
import React, { useEffect, useState } from "react";
import { Card, TextField, Button, Snackbar, Alert, Typography, Stack } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { subscribeUserAccess } from "../hooks/api";
import { useDriver } from "../context/DriverContext.jsx";
import { createUser, updateUser } from "../utils/firestoreService.js";
import { logError } from "../utils/logError";

export default function AdminUserManager() {
  const { driver } = useDriver();
  const role = driver?.access || "user";
  const isAdmin = role === "admin";
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // 🔄 Subscribe to Firestore
  useEffect(() => {
    const unsubscribe = subscribeUserAccess(setRows, {
      activeOnly: true,
      roles: ["admin", "driver"],
      max: 100,
    });
    return () => unsubscribe();
  }, []);

  // ➕ Add Users
  const handleAddUsers = async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }

    const lines = input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const invalids = [];
    const validUsers = [];

    lines.forEach((line, idx) => {
      const [name, email, access] = line.split(",").map((s) => s.trim());
      const lcEmail = email?.toLowerCase();
      const lcAccess = access?.toLowerCase();
      if (!name || !email || !access || !email.includes("@")) {
        invalids.push(`Line ${idx + 1}: Invalid name, email, or access`);
        return;
      }
      if (!["admin", "driver"].includes(lcAccess)) {
        invalids.push(`Line ${idx + 1}: Access must be admin or driver`);
        return;
      }
      validUsers.push({ name: name.trim(), email: lcEmail, access: lcAccess });
    });

    if (invalids.length) {
      setSnackbar({
        open: true,
        message: invalids.join(" • "),
        severity: "error",
      });
      return;
    }

    const errors = [];
    for (const user of validUsers) {
      try {
        await createUser(user);
      } catch (err) {
        logError(err, "AdminUserManager:createUser");
        errors.push(`${user.email}: ${err?.message || JSON.stringify(err)}`);
      }
    }
    setInput("");
    setSnackbar({
      open: true,
      message:
        errors.length > 0
          ? errors.join(" • ")
          : "✅ Users processed",
      severity: errors.length > 0 ? "warning" : "success",
    });
  };

  // ✏️ Edit user role directly in table
  const handleProcessRowUpdate = async (newRow, oldRow) => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return oldRow;
    }
    try {
      await updateUser({
        email: oldRow.id, // doc id is lowercase email
        access: newRow.access,
        name: newRow.name,
      });
      return newRow;
    } catch (err) {
      logError(err, "AdminUserManager:updateUser");
      setSnackbar({
        open: true,
        message: err?.message || "Update failed",
        severity: "error",
      });
      return oldRow; // revert
    }
  };

  const columns = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 150, editable: isAdmin },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200, editable: false },
    {
      field: "access",
      headerName: "Access",
      width: 120,
      editable: isAdmin,
      type: "singleSelect",
      valueOptions: ["admin", "driver"],
    },
  ];

  return (
    <Card sx={{ p: 2, m: "auto", maxWidth: 900 }}>
      <Stack spacing={2}>
        {!isAdmin && (
          <Typography color="error">
            Admin access required to modify users
          </Typography>
        )}
        <TextField
          label="Users CSV"
          placeholder="Name,email,access"
          multiline
          minRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          variant="contained"
          onClick={handleAddUsers}
          disabled={!isAdmin}
        >
          Add Users
        </Button>
        <div style={{ width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
            processRowUpdate={handleProcessRowUpdate}
            isCellEditable={(params) => isAdmin && params.field !== "email"}
            pageSizeOptions={[5, 10, 25]}
          />
        </div>
      </Stack>
      <Snackbar
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
}
