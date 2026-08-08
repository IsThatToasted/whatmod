/* WeTrack Shop feature flag / product catalog.
   Set enabled:false to remove the Shop UI and return to the existing license-only flow.
   Product IDs must match App Store Connect before StoreKit purchases can complete. */
window.WeTrackShopConfig = Object.freeze({
  enabled: true,
  storeKitEnabled: true,
  allowLicenseFallback: true,
  baseMemoryLimit: 20,
  memoryPackSize: 20,
  premium: {
    productId: 'com.wetrack.premium.monthly',
    fallbackPrice: '$7.95',
    periodLabel: '/ month',
    title: 'WeTrack Premium'
  },
  memoryTiers: [
    { extra: 20,  productId: 'com.wetrack.memories.plus20.monthly',  fallbackPrice: '$0.99' },
    { extra: 40,  productId: 'com.wetrack.memories.plus40.monthly',  fallbackPrice: '$1.98' },
    { extra: 60,  productId: 'com.wetrack.memories.plus60.monthly',  fallbackPrice: '$2.97' },
    { extra: 80,  productId: 'com.wetrack.memories.plus80.monthly',  fallbackPrice: '$3.96' },
    { extra: 100, productId: 'com.wetrack.memories.plus100.monthly', fallbackPrice: '$4.95' }
  ]
});
