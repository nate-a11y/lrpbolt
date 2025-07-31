/* Proprietary and confidential. See LICENSE. */
import Papa from 'papaparse';
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://lakeridepros.xyz/claim-proxy.php';
export const SECURE_KEY = import.meta.env.VITE_API_SECRET_KEY;
export const TIME_LOG_CSV =
  import.meta.env.VITE_TIME_LOG_CSV ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlmQyi2ohRZAyez3qMsO3E7aWWIYSDP3El4c3tyY1G-ztdjxnUHI6tNqJgbe9yGcjFht3qmwMnTIvq/pub?gid=888251608&single=true&output=csv';

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

const post = async (payload) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SECURE_KEY, ...payload })
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
};

export const fetchRideQueue = () => get(`${BASE_URL}?type=ridequeue`);

export const fetchLiveRides = () => get(`${BASE_URL}?type=rides`);

export const updateRide = (TripID, updates, sheet = 'RideQueue') =>
  post({ type: 'updateRide', TripID, fields: updates, sheet });

export const restoreRide = async (rideData) => {
  try {
    return await post({ type: 'addRide', sheet: 'Sheet1', data: rideData });
  } catch (err) {
    return { success: false, message: err.message };
  }
};


export const deleteRide = (TripID, sheet = 'RideQueue') =>
  post({ type: 'deleteRide', TripID, sheet });
export const getAccessLevel = async (email) => {
  const json = await get(`${BASE_URL}?type=access&email=${encodeURIComponent(email)}`);
  return json?.access || 'User';
};

// ----- Claim Operations -----
export const claimRide = (tripId, claimedBy) =>
  post({ type: 'claim', tripId, claimedBy, claimedAt: new Date().toISOString() });

// ----- Ticket Operations -----
export const fetchTickets = () => get(`${BASE_URL}?type=tickets`);

export const fetchTicket = (ticketId) => get(`${BASE_URL}?type=ticket&ticketId=${ticketId}`);

export const addTicket = (ticketData) => post({ type: 'addticket', ...ticketData });

export const deleteTicket = (ticketId) => post({ type: 'deleteticket', ticketId });

export const emailTicket = (ticketId, email, attachment) =>
  post({ type: 'emailticket', ticketId, email, attachment });

export const updateTicketScan = (
  ticketId,
  scanType,
  scannedAt = new Date().toISOString(),
  scannedBy = 'Unknown'
) => post({ type: 'updateticket', ticketId, scanType, scannedAt, scannedBy });

// ----- Time Logging -----
export const logTime = (payload) => post({ type: 'logtime', ...payload });

export const fetchTimeLogs = async (driver) => {
  const res = await fetch(TIME_LOG_CSV);
  const csvText = await res.text();
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return data
    .map((row) => ({
      driver: row.Driver,
      start: row.StartTime,
      end: row.EndTime,
      duration: row.Duration,
      rideId: row.RideID || 'N/A'
    }))
    .filter((log) => (driver ? log.driver === driver : true));
};

