/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useMemo, useState } from "react";
import { Box, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Snackbar, Alert } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import dayjs from "dayjs";
import { subscribeTimeLogs } from "../../hooks/firestore";
import ToolsCell from "./cells/ToolsCell.jsx";
import StatusCell from "./cells/StatusCell.jsx";
import { db } from "../../utils/firebaseInit";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";

// helper guards
const tsToDate = (v) => {
  try {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    if (v.seconds != null) return new Date(v.seconds * 1000);
    if (typeof v === "number" || typeof v === "string" || v instanceof Date) return new Date(v);
  } catch (_) {}
  return null;
};

const fmt = (v) => {
  const d = tsToDate(v);
  return d ? dayjs(d).format("MM/DD/YYYY h:mm A") : "—";
};

const diffMins = (start, end) => {
  const s = tsToDate(start);
  const e = tsToDate(end);
  if (!s || !e) return "";
  const mins = Math.max(0, Math.round((e - s) / 60000));
  return `${mins}m`;
};

export default function EntriesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [form, setForm] = useState({ rideId: "", note: "", mode: "" });
  const [saving, setSaving] = useState(false);

  // toast
  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });

  useEffect(() => {
    const unsub = subscribeTimeLogs((data) => {
      const mapped = (data || []).map((snap, i) => {
        // DocumentSnapshot[] or plain objects[]
        const d = typeof snap?.data === "function" ? snap.data() : snap || {};
        const docId = snap?.id || d.id; // keep Firestore id
        const id = docId || `${d.userEmail || d.driver || "row"}-${d.startTime?.seconds ?? i}`;

        const startTime = d.startTime ?? null;
        const endTime = d.endTime ?? null;

        const driver = d.driverEmail || d.driver || "";
        const status = endTime ? "Closed" : "Open";

        return {
          id,
          docId, // <— needed for edit/delete
          driver,
          rideId: d.rideId || "",
          mode: d.mode || "RIDE",
          startTime,
          endTime,
          note: d.note || "",
          status,
          createdAt: d.createdAt || null,
          updatedAt: d.updatedAt || null,
        };
      });

      setRows(mapped);
      setLoading(false);
    });

    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  const handleEdit = (row) => {
    setEditRow(row);
    setForm({ rideId: row.rideId || "", note: row.note || "", mode: row.mode || "RIDE" });
    setEditOpen(true);
  };

  const handleDelete = async (row) => {
    if (!row?.docId) {
      setToast({ open: true, msg: "Missing document id.", severity: "error" });
      return;
    }
    if (!window.confirm("Delete this time log? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "timeLogs", row.docId));
      setToast({ open: true, msg: "Deleted.", severity: "success" });
    } catch (e) {
      setToast({ open: true, msg: e?.message || "Delete failed.", severity: "error" });
    }
  };

  const saveEdit = async () => {
    if (!editRow?.docId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "timeLogs", editRow.docId), {
        rideId: (form.rideId || "").trim().toUpperCase(),
        note: form.note || "",
        mode: form.mode || "RIDE",
      });
      setToast({ open: true, msg: "Saved.", severity: "success" });
      setEditOpen(false);
      setEditRow(null);
    } catch (e) {
      setToast({ open: true, msg: e?.message || "Save failed.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      { field: "driver", headerName: "Driver", flex: 1, minWidth: 160 },
      { field: "rideId", headerName: "Ride ID", width: 120 },
      { field: "mode", headerName: "Mode", width: 110 },
      { field: "startTime", headerName: "Start", minWidth: 180,
        valueGetter: (p) => p?.row?.startTime ?? null, renderCell: (p) => fmt(p.value) },
      { field: "endTime", headerName: "End", minWidth: 180,
        valueGetter: (p) => p?.row?.endTime ?? null, renderCell: (p) => fmt(p.value) },
      { field: "duration", headerName: "Duration", minWidth: 120,
        valueGetter: (p) => diffMins(p?.row?.startTime, p?.row?.endTime) },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        renderCell: (params) => <StatusCell value={params.value} />,
        sortable: true,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <ToolsCell
            row={params.row}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ),
      },
    ],
    [] // columns are static
  );

  return (
    <Stack spacing={2}>
      <Box sx={{ width: "100%" }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Time Log Entries</Typography>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{
            toolbar: { showQuickFilter: true, quickFilterProps: { debounceMs: 300 } },
          }}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            columns: { columnVisibilityModel: { note: false, createdAt: false, updatedAt: false } },
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      </Box>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Time Log</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Ride ID"
              value={form.rideId}
              onChange={(e) => setForm((f) => ({ ...f, rideId: e.target.value }))}
            />
            <TextField
              label="Mode"
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              helperText='e.g. "RIDE", "N/A", "MULTI"'
            />
            <TextField
              label="Note"
              multiline
              minRows={3}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={saveEdit} disabled={saving} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
