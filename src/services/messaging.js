import { addDoc, collection, serverTimestamp, doc, onSnapshot } from "firebase/firestore";

import { db } from "../utils/firebaseInit";

export async function enqueueSms({ to, body, context = {} }) {
  const ref = await addDoc(collection(db, "outboundMessages"), {
    to, body, channel: "sms", status: "queued", context, createdAt: serverTimestamp(),
  });
  return ref;
}

export function watchMessage(ref, cb) {
  return onSnapshot(doc(db, "outboundMessages", ref.id), (s) => s.exists() && cb(s.data()));
}
