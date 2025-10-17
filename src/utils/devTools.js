export async function nukeIndexedDBCaches() {
  if (typeof indexedDB === "undefined") return;
  const dbs = ["firebase-firestore-databases", "firebaseLocalStorageDb"];
  await Promise.allSettled(
    dbs.map(
      (name) =>
        new Promise((resolve) => {
          let request;
          try {
            request = indexedDB.deleteDatabase(name);
          } catch (error) {
            void error;
            resolve();
            return;
          }
          const settle = () => resolve();
          request.onsuccess = settle;
          request.onerror = settle;
          request.onblocked = settle;
        }),
    ),
  );
  if (
    typeof location !== "undefined" &&
    typeof location.reload === "function"
  ) {
    location.reload();
  }
}
