# Atlas product roadmap

## Now (MVP, ships before the Eid rush)
- Rider app: assigned parcels, offline status queue, proof-of-delivery photo.
- Dispatcher dashboard: manual parcel assignment, live rider map on Appwrite Realtime.
- Customer SMS tracking link with parcel status.
- Cash-on-delivery reconciliation at shift end against the cod_ledger table.

## Next (v1.1, about 4 weeks after launch)
- Offline photo upload queue so riders can finish deliveries without signal.
- Urdu interface for the rider app.
- Daily COD summary report emailed to the courier owner.

## Later (v2)
- Route optimiser that suggests parcel order per rider.
- Card and wallet payments (JazzCash, Easypaisa).
- Customer self-service rescheduling from the tracking link.

## Success metrics
- 95% of parcels marked delivered with a photo.
- COD mismatch under 0.5% of daily cash.
- Dispatcher assigns a parcel in under 20 seconds.

## Risks
- SMS gateway delivery rates for Pakistani numbers are not yet measured.
- Riders on low-end Android phones may struggle with large photos.
