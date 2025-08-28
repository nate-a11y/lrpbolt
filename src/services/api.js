/* Centralized Axios with Firebase ID token */
import axios from "axios";
import { getAuth } from "firebase/auth";

import AppError from "../utils/AppError.js";
import logError from "../utils/logError.js";
import retry from "../utils/retry.js";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // keep
  timeout: 20000,
});

// Attach ID token for privileged calls
api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function request(config, options) {
  try {
    return await retry(() => api(config), {
      ...options,
      onError: (err, attempt) =>
        logError(err, { where: "api", action: config?.url, attempt }),
    });
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError(err.message || "API request failed", "API_REQUEST", {
            url: config?.url,
          });
    logError(appErr, { where: "api", action: config?.url });
    throw appErr;
  }
}
