/* Proprietary and confidential. See LICENSE. */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://lakeridepros.xyz/claim-proxy.php';
export const SECURE_KEY = import.meta.env.VITE_API_SECRET_KEY;
export const TIME_LOG_CSV =
  import.meta.env.VITE_TIME_LOG_CSV ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlmQyi2ohRZAyez3qMsO3E7aWWIYSDP3El4c3tyY1G-ztdjxnUHI6tNqJgbe9yGcjFht3qmwMnTIvq/pub?gid=888251608&single=true&output=csv';

export const fetchRideQueue = async () => {
  const res = await fetch(`${BASE_URL}?type=ridequeue`);
  return await res.json();
};

export const fetchLiveRides = async () => {
  const res = await fetch(`${BASE_URL}?type=rides`);
  return await res.json();
};

export const updateRide = async (TripID, updates, sheet = 'RideQueue') => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'updateRide',
      TripID,
      fields: updates,
      sheet
    })
  });
  return await res.json();
};

export const restoreRide = async (rideData) => {
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: SECURE_KEY,
        type: 'addRide',
        sheet: 'Sheet1',
        data: rideData,
      }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: err.message };
  }
};


export const deleteRide = async (TripID, sheet = 'RideQueue') => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'deleteRide',
      TripID,
      sheet
    })
  });
  return await res.json();
};
export const getAccessLevel = async (email) => {
  const res = await fetch(`${BASE_URL}?type=access&email=${encodeURIComponent(email)}`);
  const json = await res.json();
  return json?.access || 'User'; // Fallback if not Admin
};

// ----- Claim Operations -----
export const claimRide = async (tripId, claimedBy) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'claim',
      tripId,
      claimedBy,
      claimedAt: new Date().toISOString()
    })
  });
  return await res.json();
};

// ----- Ticket Operations -----
export const fetchTickets = async () => {
  const res = await fetch(`${BASE_URL}?type=tickets`);
  return await res.json();
};

export const fetchTicket = async (ticketId) => {
  const res = await fetch(`${BASE_URL}?type=ticket&ticketId=${ticketId}`);
  return await res.json();
};

export const addTicket = async (ticketData) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SECURE_KEY, type: 'addticket', ...ticketData })
  });
  return await res.json();
};

export const deleteTicket = async (ticketId) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SECURE_KEY, type: 'deleteticket', ticketId })
  });
  return await res.json();
};

export const emailTicket = async (ticketId, email, attachment) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'emailticket',
      ticketId,
      email,
      attachment
    })
  });
  return await res.json();
};

export const updateTicketScan = async (
  ticketId,
  scanType,
  scannedAt = new Date().toISOString(),
  scannedBy = 'Unknown'
) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'updateticket',
      ticketId,
      scanType,
      scannedAt,
      scannedBy
    })
  });
  return await res.json();
};

// ----- Time Logging -----
export const logTime = async (payload) => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SECURE_KEY, type: 'logtime', ...payload })
  });
  return await res.json();
};

export const fetchTimeLogs = async (driver) => {
  const res = await fetch(TIME_LOG_CSV);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  const idx = {
    driver: headers.indexOf('Driver'),
    start: headers.indexOf('StartTime'),
    end: headers.indexOf('EndTime'),
    duration: headers.indexOf('Duration'),
    rideId: headers.indexOf('RideID')
  };
  return lines.slice(1)
    .map((row) => {
      const parts = row.split(',');
      return {
        driver: parts[idx.driver],
        start: parts[idx.start],
        end: parts[idx.end],
        duration: parts[idx.duration],
        rideId: parts[idx.rideId] || 'N/A'
      };
    })
    .filter((log) => (driver ? log.driver === driver : true));
};

