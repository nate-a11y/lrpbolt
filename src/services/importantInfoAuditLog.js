/**
 * Audit Log Service for ImportantInfo
 * Tracks all changes to ImportantInfo items in a Firestore subcollection
 */

import {
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/services/firebase.js";
import { withExponentialBackoff } from "@/services/retry.js";
import { AppError } from "@/services/errors";
import logError from "@/utils/logError.js";

const COLLECTION = "importantInfo";
const AUDIT_SUBCOLLECTION = "auditLog";

/**
 * Log an audit entry for an ImportantInfo change
 * @param {string} itemId - The ImportantInfo item ID
 * @param {Object} entry - The audit entry
 * @param {string} entry.action - Action type: 'create', 'update', 'delete', 'restore'
 * @param {Object} entry.user - User info: { uid, email, displayName, role }
 * @param {Object} [entry.changes] - Field changes: { field: { from, to } }
 * @param {Object} [entry.metadata] - Additional metadata
 */
export async function logAuditEntry(itemId, entry) {
  if (!itemId) {
    throw new AppError("Missing item ID for audit log", {
      code: "audit_missing_id",
    });
  }

  const auditEntry = {
    action: entry.action || "unknown",
    timestamp: serverTimestamp(),
    user: {
      uid: entry.user?.uid || "unknown",
      email: entry.user?.email || "unknown",
      displayName: entry.user?.displayName || "Unknown User",
      role: entry.user?.role || "unknown",
    },
    changes: entry.changes || null,
    metadata: entry.metadata || null,
  };

  try {
    await withExponentialBackoff(async () => {
      const auditRef = collection(db, COLLECTION, itemId, AUDIT_SUBCOLLECTION);
      await addDoc(auditRef, auditEntry);
    });
  } catch (error) {
    // Don't throw - audit logging shouldn't block the main operation
    logError(error, {
      where: "importantInfoAuditLog.logAuditEntry",
      itemId,
      action: entry.action,
    });
  }
}

/**
 * Get audit log entries for an ImportantInfo item
 * @param {string} itemId - The ImportantInfo item ID
 * @param {number} maxEntries - Maximum number of entries to retrieve
 * @returns {Promise<Array>} Array of audit entries
 */
export async function getAuditLog(itemId, maxEntries = 50) {
  if (!itemId) {
    throw new AppError("Missing item ID for audit log", {
      code: "audit_missing_id",
    });
  }

  try {
    const auditRef = collection(db, COLLECTION, itemId, AUDIT_SUBCOLLECTION);
    const q = query(auditRef, orderBy("timestamp", "desc"), limit(maxEntries));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    const appErr =
      error instanceof AppError
        ? error
        : new AppError("Failed to retrieve audit log", {
            code: "audit_get_log",
            cause: error,
          });
    logError(error, {
      where: "importantInfoAuditLog.getAuditLog",
      itemId,
    });
    throw appErr;
  }
}

/**
 * Compute field changes between old and new states
 * @param {Object} oldState - Previous state
 * @param {Object} newState - New state
 * @returns {Object} Changes object with { field: { from, to } }
 */
export function computeChanges(oldState, newState) {
  const changes = {};
  const allFields = new Set([
    ...Object.keys(oldState || {}),
    ...Object.keys(newState || {}),
  ]);

  for (const field of allFields) {
    // Skip internal fields and timestamps
    if (
      field === "id" ||
      field === "createdAt" ||
      field === "updatedAt" ||
      field === "_cat"
    ) {
      continue;
    }

    const oldValue = oldState?.[field];
    const newValue = newState?.[field];

    // Deep comparison for objects and arrays
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[field] = {
        from: oldValue,
        to: newValue,
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Format an audit entry for display
 * @param {Object} entry - Audit entry
 * @returns {string} Formatted description
 */
export function formatAuditEntry(entry) {
  if (!entry) return "Unknown action";

  const action = entry.action || "unknown";
  const user = entry.user?.displayName || entry.user?.email || "Unknown User";
  const timestamp = entry.timestamp
    ? new Date(entry.timestamp.toMillis()).toLocaleString()
    : "Unknown time";

  let description = `${action.charAt(0).toUpperCase() + action.slice(1)} by ${user} at ${timestamp}`;

  if (entry.changes && Object.keys(entry.changes).length > 0) {
    const changedFields = Object.keys(entry.changes).join(", ");
    description += ` (Changed: ${changedFields})`;
  }

  return description;
}
