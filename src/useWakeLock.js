// useWakeLock.js
import { useEffect, useRef } from 'react';

export default function useWakeLock() {
  const wakeLockRef = useRef(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          console.log('Wake Lock liberado');
        });
        console.log('Wake Lock activo');
      }
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  useEffect(() => {
    // Solicitar el Wake Lock cuando el componente se monta
    requestWakeLock();

    // Re-solicitar el Wake Lock cuando la pestaña vuelve a estar visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    });

    // Limpiar los eventos y liberar el Wake Lock al desmontar
    return () => {
      document.removeEventListener('visibilitychange', requestWakeLock);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);
}
