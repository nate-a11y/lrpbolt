/* Proprietary and confidential. See LICENSE. */
import { setLicenseKey } from "@mui/x-license"; // eslint-disable-line import/named

const key = import.meta.env?.VITE_MUIX_LICENSE_KEY;
if (key) {
  try {
    LicenseInfo.setLicenseKey(key);
  } catch (e) {
    console.warn("MUIX license warn:", e?.message || e);
  }
}
