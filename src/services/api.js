import axios from "axios";

const API = axios.create({
  baseURL: "https://us-central1-lrp---claim-portal.cloudfunctions.net",
  timeout: 20000,
});

API.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response) {
      console.error("[API] Error:", err.response.status, err.response.data);
    } else {
      console.error("[API] Network/Error:", err?.message || err);
    }
    return Promise.reject(err);
  },
);

export async function dropDailyRidesNow(payload = {}) {
  const res = await API.post("/dropDailyRidesNow", payload, {
    headers: { "Content-Type": "application/json" },
    withCredentials: false,
  });
  return res.data;
}
