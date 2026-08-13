'use client';
import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!mounted) return null;

  if (showRestored) {
    return (
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 shadow-lg animate-slide-up"
        style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)' }}
        role="status"
        aria-live="polite"
      >
        <Wifi size={15} />
        Connection restored
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-600"
      style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
      role="alert"
      aria-live="assertive"
    >
      <WifiOff size={15} />
      No internet connection — changes will not be saved
    </div>
  );
}
