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
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { getUserAccess } from "../hooks/api"; // server-verified role

export default function AdminUserManager() {
  const [role, setRole] = useState(null); // server verified
  const [loadingRole, setLoadingRole] = useState(true);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // 🔑 Load role from server (no localStorage spoofing)
  useEffect(() => {
    const email = localStorage.getItem("lrpEmail");
    if (!email) {
      setRole("user");
      setLoadingRole(false);
      return;
    }
    getUserAccess(email).then((res) => {
      setRole(res?.access || "user");
      setLoadingRole(false);
    });
  }, []);

  // 🔄 Subscribe to Firestore
  useEffect(() => {
    const q = query(collection(db, "userAccess"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRows(data);
    });
    return () => unsubscribe();
  }, []);

  // 🔍 Check for existing email before adding
  async function emailExists(email) {
    const q = query(collection(db, "userAccess"), where("email", "==", email));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  // ➕ Add Users
  const handleAddUsers = async () => {
    const lines = input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const invalids = [];
    const validUsers = [];

    // Validate CSV
    lines.forEach((line, idx) => {
      const [name, email, access = "user"] = line.split(",").map((s) => s.trim());
      if (!name || !email || !email.includes("@")) {
        invalids.push(`Line ${idx + 1}: Invalid name or email`);
        return;
      }
      validUsers.push({ name, email, access: access.toLowerCase() });
    });

    if (invalids.length) {
      setSnackbar({
        open: true,
        message: invalids.join(" • "),
        severity: "error",
      });
      return;
    }

    try {
      for (let user of validUsers) {
        if (await emailExists(user.email)) {
          setSnackbar({
            open: true,
            message: `⚠️ ${user.email} already exists, skipped`,
            severity: "warning",
          });
          continue;
        }
        await addDoc(collection(db, "userAccess"), user);
      }
      setInput("");
      setSnackbar({ open: true, message: "✅ Users processed", severity: "success" });
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: "❌ Error adding users",
        severity: "error",
      });
    }
  };

  // ✏️ Edit user role directly in table
  const handleProcessRowUpdate = async (newRow) => {
    await updateDoc(doc(db, "userAccess", newRow.id), {
      name: newRow.name,
      email: newRow.email,
      access: newRow.access,
    });
    return newRow;
  };

  const columns = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 150, editable: true },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200, editable: true },
    {
      field: "access",
      headerName: "Access",
      width: 120,
      editable: true,
      type: "singleSelect",
      valueOptions: ["admin", "driver", "user"],
    },
  ];

  if (loadingRole) {
    return <CircularProgress />;
  }

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
            processRowUpdate={handleProcessRowUpdate}
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
