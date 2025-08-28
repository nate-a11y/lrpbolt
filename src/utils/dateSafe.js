/* Proprietary and confidential. See LICENSE. */
import { Timestamp } from "firebase/firestore";

import dayjs, { isValidDayjs } from "./dates";
import { toIso } from "./time.js";

void dayjs;

export const toISOorNull = (d) => (isValidDayjs(d) ? toIso(d) : null);

export const toTimestampOrNull = (d) =>
  isValidDayjs(d) ? Timestamp.fromDate(d.toDate()) : null;
