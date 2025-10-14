/* Proprietary and confidential. See LICENSE. */
import { LicenseInfo } from "@mui/x-license";

import { env } from "@/utils/env";

import logError from "./utils/logError.js";

const key = env.MUIX_LICENSE_KEY;
if (key) {
  try {
    LicenseInfo.setLicenseKey(key);
  } catch (e) {
    logError(e, { where: "muix-license" });
  }
}
