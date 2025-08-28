import { getAuth, onAuthStateChanged } from "firebase/auth";

export function waitForAuth(requireUser = true) {
  const auth = getAuth();
  if (!requireUser) {
    return new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve(u);
      });
    });
  }
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        unsub();
        if (u) resolve(u);
        else reject(new Error("Not signed in"));
      },
      (e) => {
        unsub();
        reject(e);
      },
    );
  });
}
