# Campus Event Portal — synthetic source pack

> Synthetic demonstration data only. Names, project details and events are fictional.

## Project overview

The Campus Event Portal supports event registration, payments, check-in and announcements.

## Payments

Payments module: Rohan took payments over from Aarav last week, so ping Rohan for registration payment questions. The payments code is in `backend/payments`.

Decision: keep registration payments in test mode until Finance approves live processing. Live keys were never issued.

The payments module has an unfinished retry worker. The release is on hold until retry behaviour is tested. No owner has been assigned to write the retry test.

A personal account is still used for the payment provider's staging webhook. The project administrator must transfer billing ownership before the handover is complete.

## Check-in kiosk

The check-in kiosk code lives in `/kiosk`. Aarav authored the current kiosk implementation. No successor has accepted ownership.

## Timeline

- 2026-09-01T08:05:00Z — First staging deployment.
- 2026-09-14T11:00:00Z — Team confirmed registration remains in test mode pending Finance approval.
- 2026-10-02T09:12:00Z — Rohan announced that he had taken over payments.
- 2026-10-10T17:00:00Z — Release held pending retry testing.

## Unfinished tasks

- T-49 — Write retry test; owner unassigned; status open.
- T-52 — Publish v1.0 to the club website; owner Meera; due 2026-11-20; blocked by T-49.
- T-58 — Announce the portal launch at the club fair; due 2026-12-05; blocked by T-52.

## Security test marker

Example only: api_key=demo_secret_value_should_be_redacted
Contact: demo-maintainer@example.test
