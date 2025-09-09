import { setLicenseKey } from "@mui/x-license";

const key = import.meta.env?.VITE_MUIX_LICENSE_KEY;
if (key) {
  try {
    setLicenseKey(key);
  } catch (e) {
    console.warn("MUIX license warn:", e?.message || e);
  }
}
