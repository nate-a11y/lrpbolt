import { db } from "../firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const COLL = "userAccess";

/**
 * Creates/merges a userAccess doc. Doc ID is the LOWERCASED email.
 * Fields required by rules: name, email, access ("admin" | "driver")
 * Extra fields (active, createdAt/updatedAt) are allowed.
 */
export async function createUser({ name, email, access, active = true }) {
  const lcEmail = (email || "").toLowerCase();
  const lcAccess = (access || "").toLowerCase();
  const ref = doc(db, COLL, lcEmail);
  await setDoc(
    ref,
    {
      name: String(name || "").trim(),
      email: lcEmail,
      access: lcAccess,
      active: Boolean(active),
      createdAt: new Date(),
    },
    { merge: true },
  );
}

export async function updateUser({ email, access, name, active }) {
  const lcEmail = (email || "").toLowerCase();
  const patch = {};
  if (typeof name === "string") patch.name = name.trim();
  if (typeof access === "string") patch.access = access.toLowerCase();
  if (typeof active === "boolean") patch.active = active;
  patch.updatedAt = new Date();
  await updateDoc(doc(db, COLL, lcEmail), patch);
}
