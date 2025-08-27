/* Proprietary and confidential. See LICENSE. */
import React, { useEffect, useState, useCallback } from "react";
import { Box, Button } from "@mui/material";
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { buildNativeActionsColumn } from "../columns/nativeActions.jsx";
import { mapSnapshotToRows, enrichDriverNames } from "../services/normalizers";
import { db } from "../utils/firebaseInit";
import { useAuth } from "../context/AuthContext.jsx";

import SmartAutoGrid from "./datagrid/SmartAutoGrid.jsx";

export default function ShootoutTab() {
  const { user } = useAuth();
  const [sessionRows, setSessionRows] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!user?.email) return;
    const q = query(
      collection(db, "shootoutStats"),
      where("driverEmail", "==", user.email.toLowerCase()),
      orderBy("startTime", "desc"),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const base = mapSnapshotToRows("shootoutStats", snap);
      const withNames = await enrichDriverNames(base);
      setSessionRows(withNames);
    });
    return () => unsub();
  }, [user?.email]);

  const handleStart = useCallback(async () => {
    if (!user?.email) return;
    const docRef = await addDoc(collection(db, "shootoutStats"), {
      driverEmail: user.email.toLowerCase(),
      startTime: serverTimestamp(),
      endTime: null,
      vehicle: null,
      trips: null,
      passengers: null,
      createdAt: serverTimestamp(),
    });
    setActiveId(docRef.id);
  }, [user?.email]);

  const handleEnd = useCallback(async () => {
    if (!activeId) return;
    await updateDoc(doc(db, "shootoutStats", activeId), {
      endTime: serverTimestamp(),
    });
    setActiveId(null);
  }, [activeId]);

  const deleteShootoutStatById = async (id) => {
    await deleteDoc(doc(db, "shootoutStats", id));
  };

  const running = Boolean(activeId);

  return (
    <>
      <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
        {running ? (
          <Button variant="contained" color="error" onClick={handleEnd}>
            End Session
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={handleStart}>
            Start Session
          </Button>
        )}
      </Box>
      <SmartAutoGrid
        rows={sessionRows}
        headerMap={{
          driverEmail: "Driver Email",
          driver: "Driver",
          vehicle: "Vehicle",
          startTime: "Start",
          endTime: "End",
          duration: "Duration",
          trips: "Trips",
          passengers: "PAX",
          createdAt: "Created",
          id: "id",
        }}
        order={[
          "driver",
          "driverEmail",
          "vehicle",
          "startTime",
          "endTime",
          "duration",
          "trips",
          "passengers",
          "createdAt",
          "id",
        ]}
        hide={["driverEmail", "createdAt"]}
        forceHide={["id"]}
        actionsColumn={buildNativeActionsColumn({
          onEdit: (_id, _row) => null,
          onDelete: async (id) => await deleteShootoutStatById(id),
        })}
      />
    </>
  );
}
