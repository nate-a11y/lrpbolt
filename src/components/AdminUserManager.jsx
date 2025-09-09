/* Proprietary and confidential. See LICENSE. */
// src/components/AdminUserManager.jsx
import { useEffect, useState, useMemo } from "react";
import {
  Card,
  Paper,
  TextField,
  Button,
  Snackbar,
  Alert,
  Typography,
  Stack,
  useMediaQuery,
  MenuItem,
} from "@mui/material";
import { doc, setDoc } from "firebase/firestore";

import { ROLES, ROLE_LABELS } from "../constants/roles";
import { subscribeUserAccess } from "../hooks/api";
import { useDriver } from "../context/DriverContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { db } from "../utils/firebaseInit";
import { createUser, updateUser } from "../utils/firestoreService.js";
import logError from "../utils/logError.js";
import { warnMissingFields } from "../utils/gridFormatters";
import { useGridDoctor } from "../utils/useGridDoctor";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";

// --- helpers: robust parsing for lines and "email,role" ---
function parseUserLines(input) {
  const raw = typeof input === "string" ? input : "";
  return raw
    .split(/\r?\n|\r/g) // CRLF/CR/LF safe
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCsvLine(line) {
  // Accept comma OR tab: "Name,email,phone,access" OR "Name\temail\tphone\taccess"
  const [nameRaw, emailRaw, phoneRaw, accessRaw] = line
    .split(/[,\t]/)
    .map((s) => (s || "").trim());
  const name = nameRaw || "";
  const email = (emailRaw || "").toLowerCase();
  const phone = phoneRaw || "";
  const access = (accessRaw || "").toLowerCase();
  return { name, email, phone, access };
}

export default function AdminUserManager() {
  const { driver } = useDriver();
  const { user, role: currentRole, authLoading, roleLoading } = useAuth();
  const role = driver?.access || currentRole || "user";
  const isAdmin = role === "admin";
  const isSmall = useMediaQuery((t) => t.breakpoints.down("sm"));
  const [input, setInput] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    access: "driver",
  });

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        minWidth: 150,
        editable: isAdmin,
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1,
        minWidth: 200,
        editable: false,
      },
      {
        field: "phone",
        headerName: "Phone",
        flex: 1,
        minWidth: 150,
        editable: isAdmin,
      },
      {
        field: "access",
        headerName: "Access",
        width: 120,
        editable: isAdmin,
        type: "singleSelect",
        valueOptions: ROLES,
      },
    ],
    [isAdmin],
  );

  const { dedupeRows } = useGridDoctor({
    name: "AdminUserManager",
    rows,
    columns,
  });

  // 🔄 Subscribe to Firestore
  useEffect(() => {
    if (authLoading || !user?.email) return undefined;

    const unsubscribe = subscribeUserAccess(
      (list = []) => {
        const mapped = list.map((r) => ({
          id: r.id || r.email,
          email: (r.email || r.id || "").toLowerCase(),
          name: r.name || "",
          phone: r.phone || "",
          access: (r.access || "").toLowerCase(),
        }));
        if (import.meta.env.MODE !== "production")
          warnMissingFields(columns, mapped);
        setRows((prev) => dedupeRows(prev, mapped));
        setLoading(false);
      },
      { roles: ROLES },
      () => {
        setSnackbar({
          open: true,
          message: "Permissions issue loading users",
          severity: "error",
        });
        setLoading(false);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [authLoading, user?.email, columns, dedupeRows]);

  if (authLoading || roleLoading || currentRole === "shootout") return null;

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

    const lines = parseUserLines(input);

    const invalids = [];
    const validUsers = [];

    lines.forEach((line, idx) => {
      const { name, email, phone, access } = parseCsvLine(line);
      if (!name || !email || !email.includes("@")) {
        invalids.push(`Line ${idx + 1}: Invalid name or email`);
        return;
      }
      if (!phone) {
        invalids.push(`Line ${idx + 1}: Missing phone`);
        return;
      }
      if (!ROLES.includes(access)) {
        invalids.push(
          `Line ${idx + 1}: Access must be one of ${ROLES.join(", ")}`,
        );
        return;
      }
      validUsers.push({
        name: name.trim(),
        email,
        phone: phone.trim(),
        access,
      });
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
    for (const u of validUsers) {
      try {
        await createUser(u);
        await setDoc(
          doc(db, "users", u.email),
          { name: u.name, email: u.email, phone: u.phone, role: u.access },
          { merge: true },
        );
      } catch (err) {
        logError(err, "AdminUserManager:createUser");
        errors.push(`${u.email}: ${err?.message || JSON.stringify(err)}`);
      }
    }
    setInput("");
    setSnackbar({
      open: true,
      message: errors.length ? errors.join(" • ") : "✅ Users processed",
      severity: errors.length ? "warning" : "success",
    });
  };

  // ➕ Add a single user manually
  const handleManualAdd = async () => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }

    const name = newUser.name.trim();
    const email = newUser.email.trim().toLowerCase();
    const phone = newUser.phone.trim();
    const access = newUser.access.trim().toLowerCase();

    if (!name || !email || !email.includes("@") || !phone) {
      setSnackbar({
        open: true,
        message: "Invalid name, email, or phone",
        severity: "error",
      });
      return;
    }
    if (!ROLES.includes(access)) {
      setSnackbar({
        open: true,
        message: "Access must be admin, driver, or shootout",
        severity: "error",
      });
      return;
    }

    try {
      await createUser({ name, email, phone, access });
      await setDoc(
        doc(db, "users", email),
        { name, email, phone, role: access },
        { merge: true },
      );
      setNewUser({ name: "", email: "", phone: "", access: "driver" });
      setSnackbar({
        open: true,
        message: "User added",
        severity: "success",
      });
    } catch (err) {
      logError(err, "AdminUserManager:handleManualAdd");
      setSnackbar({
        open: true,
        message: err?.message || "Add failed",
        severity: "error",
      });
    }
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
        phone: newRow.phone,
      });
      await setDoc(
        doc(db, "users", newRow.email),
        {
          name: newRow.name,
          email: newRow.email,
          phone: newRow.phone,
          role: newRow.access,
        },
        { merge: true },
      );
      return newRow;
    } catch (err) {
      logError(err, "AdminUserManager:updateUser");
      setSnackbar({
        open: true,
        message: err?.message || "Update failed",
        severity: "error",
      });
      return oldRow;
    }
  };

  const handleMobileFieldChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const handleMobileUpdate = async (id) => {
    if (!isAdmin) {
      setSnackbar({
        open: true,
        message: "Admin access required",
        severity: "error",
      });
      return;
    }
    const row = rows.find((r) => r.id === id);
    try {
      await updateUser({
        email: id,
        name: row.name,
        access: row.access,
        phone: row.phone,
      });
      await setDoc(
        doc(db, "users", row.email),
        {
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.access,
        },
        { merge: true },
      );
    } catch (err) {
      logError(err, "AdminUserManager:handleMobileUpdate");
      setSnackbar({
        open: true,
        message: err?.message || "Update failed",
        severity: "error",
      });
    }
  };

  return (
    <Card sx={{ p: 2, m: "auto", maxWidth: 900 }}>
      <Stack spacing={2}>
        {!isAdmin && (
          <Typography color="error">
            Admin access required to modify users
          </Typography>
        )}

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Name"
            value={newUser.name}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, name: e.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Email"
            value={newUser.email}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, email: e.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Phone"
            value={newUser.phone}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, phone: e.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Access"
            select
            value={newUser.access}
            onChange={(e) =>
              setNewUser((u) => ({ ...u, access: e.target.value }))
            }
            sx={{ minWidth: 160 }}
            helperText="Shootout = only Shootout Ride & Time Tracker"
          >
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={handleManualAdd}
            disabled={!isAdmin}
          >
            Add User
          </Button>
        </Stack>

        <TextField
          label="Users CSV"
          placeholder="Name,email,phone,access"
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

        {isSmall ? (
          <Stack spacing={1}>
            {rows.map((r) => (
              <Stack
                key={r.id}
                spacing={1}
                sx={{
                  p: 1,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <TextField
                  label="Name"
                  value={r.name}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    handleMobileFieldChange(r.id, "name", e.target.value)
                  }
                  onBlur={() => handleMobileUpdate(r.id)}
                />
                <TextField label="Email" value={r.email} disabled />
                <TextField
                  label="Phone"
                  value={r.phone}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    handleMobileFieldChange(r.id, "phone", e.target.value)
                  }
                  onBlur={() => handleMobileUpdate(r.id)}
                />
                <TextField
                  label="Access"
                  select
                  value={r.access}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    handleMobileFieldChange(r.id, "access", e.target.value);
                    handleMobileUpdate(r.id);
                  }}
                >
                  {ROLES.map((r0) => (
                    <MenuItem key={r0} value={r0}>
                      {ROLE_LABELS[r0]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ width: "100%" }}>
            <SmartAutoGrid
              rows={rows || []}
              columnsCompat={columns}
              autoHeight
              loading={loading}
              checkboxSelection
              disableRowSelectionOnClick
              processRowUpdate={handleProcessRowUpdate}
              isCellEditable={(params) => isAdmin && params.field !== "email"}
              pageSizeOptions={[5, 10, 25]}
              getRowId={(r) =>
                r?.id ?? r?.uid ?? r?._id ?? r?.docId ?? JSON.stringify(r)
              }
              experimentalFeatures={{ newEditingApi: true }}
              columnVisibilityModel={
                isSmall ? { access: false, phone: false } : undefined
              }
              showToolbar
            />
          </Paper>
        )}
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
