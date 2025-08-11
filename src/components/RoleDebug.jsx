import { Button, Chip, Divider, Stack, Typography } from "@mui/material";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { useRole } from "@/hooks";

export default function RoleDebug() {
  const { user, role, loading, isAdmin, isDriver } = useRole();

  if (!user) return <Typography variant="body2">Not signed in.</Typography>;

  const emailKey = (user.email || "").toLowerCase();
  const uidPath = `userAccessByUid/${user.uid}`;
  const emailPath = emailKey ? `userAccess/${emailKey}` : null;

  async function check(path) {
    const [col, id] = path.split("/");
    const snap = await getDoc(doc(db, col, id));
    return snap.exists();
  }

  async function seedAdmin() {
    // DEV-ONLY: allow seeding admin if missing and env explicitly allows it
    const allow = import.meta.env.VITE_ALLOW_ROLE_SEED === "true";
    if (!allow) { alert("Seeding disabled. Set VITE_ALLOW_ROLE_SEED=true to enable in DEV."); return; }

    const updates = [];
    updates.push(setDoc(doc(db, "userAccessByUid", user.uid), { access: "admin", email: user.email || null }, { merge: true }));
    if (emailKey) {
      updates.push(setDoc(doc(db, "userAccess", emailKey), { access: "admin", uid: user.uid }, { merge: true }));
    }
    await Promise.all(updates);
    alert("Seeded admin role for your account.");
  }

  return (
    <Stack spacing={1} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
      <Typography fontWeight={700}>Role Debug</Typography>
      <Typography variant="body2">UID: <code>{user.uid}</code></Typography>
      <Typography variant="body2">Email: <code>{user.email}</code></Typography>
      <Typography variant="body2">Role: <code>{role ?? "(none)"}</code></Typography>
      <Stack direction="row" spacing={1}>
        <Chip label={isAdmin ? "isAdmin" : "not admin"} color={isAdmin ? "success" : "default"} />
        <Chip label={isDriver ? "isDriver" : "not driver"} color={isDriver ? "success" : "default"} />
        <Chip label={loading ? "loading" : "loaded"} color={loading ? "warning" : "primary"} />
      </Stack>
      <Divider />
      <Typography variant="body2">Checked paths:</Typography>
      <Typography variant="body2"><code>{uidPath}</code></Typography>
      {emailPath && <Typography variant="body2"><code>{emailPath}</code></Typography>}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button size="small" variant="outlined" onClick={async () => alert(`UID path exists: ${await check(uidPath)}`)}>Check UID doc</Button>
        {emailPath && (
          <Button size="small" variant="outlined" onClick={async () => alert(`Email path exists: ${await check(emailPath)}`)}>Check Email doc</Button>
        )}
        <Button size="small" color="warning" variant="contained" onClick={seedAdmin}>Seed my admin (DEV)</Button>
      </Stack>
    </Stack>
  );
}

