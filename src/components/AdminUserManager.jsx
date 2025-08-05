/* Proprietary and confidential. See LICENSE. */
// src/components/AdminUserManager.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  TextField,
  Button,
  Snackbar,
  Alert,
  Typography,
  Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

export default function AdminUserManager() {
  const role = (localStorage.getItem("lrpRole") || "").toLowerCase();
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    const q = query(collection(db, "userAccess"), orderBy("Name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRows(data);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUsers = async () => {
    const lines = input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;

    try {
      await Promise.all(
        lines.map((line) => {
          const [name, email, access] = line.split(",");
          return addDoc(collection(db, "userAccess"), {
            Name: (name || "").trim(),
            email: (email || "").trim(),
            access: (access || "user").trim().toLowerCase() || "user",
          });
        }),
      );
      setInput("");
      setSnackbar({ open: true, message: "Users added", severity: "success" });
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: "Error adding users",
        severity: "error",
      });
    }
  };

  const columns = [
    { field: "Name", headerName: "Name", flex: 1, minWidth: 150 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "access", headerName: "Access", width: 120 },
  ];

  if (role !== "admin") {
    return <Typography>🚫 Admin access required</Typography>;
  }

  return (
    <Card sx={{ p: 2, m: "auto", maxWidth: 900 }}>
      <Stack spacing={2}>
        <TextField
          label="Users CSV"
          placeholder="Name,email,access"
          multiline
          minRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button variant="contained" onClick={handleAddUsers}>
          Add Users
        </Button>
        <div style={{ width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            disableRowSelectionOnClick
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

