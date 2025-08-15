/* Proprietary and confidential. See LICENSE. */
import dayjs from "./dates";
import { Timestamp } from "firebase/firestore";
import { isValidDayjs } from "./dates";

void dayjs;

export const toISOorNull = (d) =>
  isValidDayjs(d) ? d.toDate().toISOString() : null;

export const toTimestampOrNull = (d) =>
  isValidDayjs(d) ? Timestamp.fromDate(d.toDate()) : null;
