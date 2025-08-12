/* Proprietary and confidential. See LICENSE. */
/**
 * Legacy shim: if any old imports remain (../../firebase),
 * forward them to the HMR-safe singleton.
 */
export { app, db, auth } from "./utils/firebaseInit";
