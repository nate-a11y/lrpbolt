// src/services/adminActions.js
import { callDropDailyRidesNow } from "../utils/functions";

export async function callDropDaily() {
  return callDropDailyRidesNow();
}
