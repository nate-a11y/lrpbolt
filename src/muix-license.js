/* Proprietary and confidential. See LICENSE. */
import { LicenseInfo } from "@mui/x-license";

import { env } from "@/utils/env";
import logError from "@/utils/logError.js";

const key = env.MUIX_LICENSE_KEY;
const applyKey =
  typeof LicenseInfo?.setLicenseKey === "function"
    ? LicenseInfo.setLicenseKey.bind(LicenseInfo)
    : null;

if (key && applyKey) {
  try {
    applyKey(key);
  } catch (error) {
    logError(error, { where: "muix-license:setLicenseKey" });
  }
} else if (key && !applyKey && import.meta.env.DEV) {
  console.warn("[LRP] MUI license API unavailable");
}

export {};
