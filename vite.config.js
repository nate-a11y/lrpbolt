VitePWA({
  cacheId: 'lrp-v2-2025-05-13',
  registerType: 'autoUpdate',
  includeAssets: [
    'favicon.ico',
    'robots.txt',
    'offline.html',
    'icons/favicon-16x16.png',
    'icons/favicon-32x32.png',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/maskable-icon.png'
  ],
  manifest: {
    name: 'Lake Ride Pros',
    short_name: 'LRP',
    start_url: '.',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#4cbb17',
    description: 'Ride Claim & Time Clock Portal',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icons/favicon-16x16.png',
        sizes: '16x16',
        type: 'image/png'
      },
      {
        src: '/icons/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      }
    ]
  }
})
