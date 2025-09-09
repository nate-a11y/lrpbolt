/* Proprietary and confidential. See LICENSE. */
import { LicenseInfo } from "@mui/x-license";

import logError from "./utils/logError.js";

const key = import.meta.env?.VITE_MUIX_LICENSE_KEY;
if (key) {
  try {
    LicenseInfo.setLicenseKey(key);
  } catch (e) {
    logError(e, { where: "muix-license" });
  }
}
