/* Proprietary and confidential. See LICENSE. */
import { Timestamp } from "firebase/firestore";

import dayjs, { isValidDayjs } from "./dates";

void dayjs;

export const toISOorNull = (d) =>
  isValidDayjs(d) ? d.toDate().toISOString() : null;

export const toTimestampOrNull = (d) =>
  isValidDayjs(d) ? Timestamp.fromDate(d.toDate()) : null;
