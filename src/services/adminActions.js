// src/services/adminActions.js
import axios from "axios";
import { getAuth } from "firebase/auth";

export async function callDropDaily() {
  const url = import.meta.env.VITE_DROP_DAILY_URL;
  const auth = getAuth();
  const user = auth.currentUser;
  const headers = {};

  if (user) {
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  // No VITE_LRP_ADMIN_TOKEN; rely on ID token (CI uses MANUAL_DROP_TOKEN)
  return axios.post(url, {}, { headers });
}
