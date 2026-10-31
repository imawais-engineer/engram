# Project Atlas — Architecture & Requirements

## Overview
Atlas is a delivery-tracking platform for small courier companies in Lahore and Karachi. Riders use a mobile app; dispatchers use a web dashboard. The MVP must ship before the Eid rush.

## Requirements
- Riders can see assigned parcels, navigate, and mark parcels delivered with a photo proof.
- Dispatchers assign parcels to riders and see live rider locations on a map.
- Customers receive an SMS tracking link that shows the parcel status.
- Cash-on-delivery amounts must be reconciled at the end of each rider shift.

## Architecture
- Frontend: Next.js dashboard, React Native rider app.
- Backend: Appwrite (Auth, TablesDB, Storage, Functions, Realtime).
- Live locations are pushed every 15 seconds through Appwrite Realtime; we do not poll.
- Proof-of-delivery photos are stored in Appwrite Storage, compressed to 1280px on device.
- Payments: cash-on-delivery only for the MVP; card payments are out of scope.

## Data model
Tables: riders, parcels, shifts, deliveries, cod_ledger. Each parcel has status: created, assigned, picked_up, out_for_delivery, delivered, failed.

## Risks
- Poor mobile network coverage: the rider app must queue status updates offline and sync later.
- SMS costs: batch notifications and only send on status changes customers care about.

## Open questions
- Which SMS gateway is cheapest for Pakistani numbers?
- Do dispatchers need a route optimiser in the MVP, or can it wait for v2?
