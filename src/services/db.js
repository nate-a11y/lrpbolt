import { serverTimestamp, Timestamp } from "firebase/firestore";

export const ts = (d) =>
  d instanceof Timestamp ? d : Timestamp.fromDate(new Date(d));

export const ensureTicketShapeOnCreate = (t) => ({
  pickupTime: ts(t.pickupTime),
  passengercount: Number(t.passengercount ?? 0),
  ticketId: t.ticketId ?? null,
  passenger: t.passenger ?? null,
  pickup: t.pickup ?? null,
  dropoff: t.dropoff ?? null,
  notes: t.notes ?? null,
  scannedOutbound: Boolean(t.scannedOutbound ?? false),
  scannedReturn: Boolean(t.scannedReturn ?? false),
  createdAt: t.createdAt ? ts(t.createdAt) : serverTimestamp(),
  scannedOutboundAt: t.scannedOutboundAt ? ts(t.scannedOutboundAt) : null,
  scannedOutboundBy: t.scannedOutboundBy ?? null,
  scannedReturnAt: t.scannedReturnAt ? ts(t.scannedReturnAt) : null,
  scannedReturnBy: t.scannedReturnBy ?? null,
});
