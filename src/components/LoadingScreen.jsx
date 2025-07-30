import React from 'react';

export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{
        height: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #4cbb17 0%, #11998e 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#fff',
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif',
        animation: 'pulseBg 6s infinite ease-in-out',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <img
        src="https://lakeridepros.xyz/Color%20logo%20-%20no%20background.png"
        alt="Lake Ride Pros Logo"
        style={{
          height: 100,
          marginBottom: 20,
          animation: 'bounce 2s infinite',
        }}
      />
      <main>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          🚀 LRP Elite Portal Loading…
        </h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>
          Buckle up — activating your driver dashboard.
        </p>
      </main>
    </div>
  );
}
