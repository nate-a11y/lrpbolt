const BASE_URL = 'https://lakeridepros.xyz/claim-proxy.php';
const SECURE_KEY = 'a9eF12kQvB67xZsT30pL';

export const fetchRideQueue = async () => {
  const res = await fetch(`${BASE_URL}?type=ridequeue`);
  return await res.json();
};

export const fetchLiveRides = async () => {
  const res = await fetch(`${BASE_URL}?type=rides`);
  return await res.json();
};

export const updateRide = async (TripID, field, value, sheet = 'RideQueue') => {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: SECURE_KEY,
      type: 'updateRide',
      TripID,
      field,
      value,
      sheet
    })
  });
  return await res.json();
};

export const restoreRide = async (rideData) => {
  try {
    const res = await fetch('https://lakeridepros.xyz/claim-proxy.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'a9eF12kQvB67xZsT30pL',
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
  const res = await fetch(`https://lakeridepros.xyz/claim-proxy.php?type=access&email=${encodeURIComponent(email)}`);
  const json = await res.json();
  return json?.access || 'User'; // Fallback if not Admin
};
