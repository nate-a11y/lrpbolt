import { useState, useCallback } from 'react';
import { BASE_URL } from './api';
import { fetchWithCache } from '../utils/cache';

export default function useDrivers() {
  const [drivers, setDrivers] = useState([]);

  const fetchDrivers = useCallback(async (userEmail = '') => {
    try {
      const data = await fetchWithCache('lrp_driverList', `${BASE_URL}?type=driverEmails`);
      const names = data.map(d => d.name);
      setDrivers(names);
      const match = data.find(d => d.email?.toLowerCase() === userEmail.toLowerCase());
      return match?.name || userEmail || '';
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      return userEmail || '';
    }
  }, []);

  return { drivers, fetchDrivers };
}
