/* Proprietary and confidential. See LICENSE. */
import { useEffect, useState } from 'react';

export default function useDarkMode() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState(() =>
    JSON.parse(localStorage.getItem('lrp_darkMode')) ?? prefersDark
  );

  useEffect(() => {
    localStorage.setItem('lrp_darkMode', JSON.stringify(darkMode));
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return [darkMode, setDarkMode];
}
