# Validation report — 2026-09-28

## Environment

| Item | Result | Evidence |
| --- | --- | --- |
| Git | PASS | 2.55.0.windows.5 at `C:\Installed Apps\Git\cmd\git.exe` |
| Node | PASS | v22.23.3 at `C:\Installed Apps\nodejs\node.exe` |
| npm | PASS | 10.9.9; workspace dependencies installed |
| Docker CLI / engine | PASS | Docker 29.8.0, Compose 5.5.1, server 29.8.0, context `desktop-linux` |
| FFmpeg / FFprobe | PASS | 9.0.2 at `C:\Installed Apps\ffmpeg\bin` |
| AWS CLI | BLOCKED | No executable after the official installer attempt |
| OBS | PASS | OBS Studio 32.0.1 |

## Local tests

| Test | Result | Notes |
| --- | --- | --- |
| Secure stream-key helper | PASS | Generated and verified a random key; a mismatched key was rejected. |
| API TypeScript build | PASS | `npm run build --workspace @cloud-restreamer/api` passed after the status-handler fix. |
| Web production build | PASS | Vite produced the dashboard bundle. |
| API unit test | PASS | `npm run test --workspace @cloud-restreamer/api` passed (1 test, 0 failures). |
| Compose config | PASS | `docker compose config --quiet` succeeded. |
| PostgreSQL / Prisma | PASS | `prisma db push` synchronized the running PostgreSQL schema. |
| API health | PASS | `GET http://127.0.0.1:3001/health` returned `ok`. |
| Dashboard | PASS | `http://localhost:8080` loaded in the browser and listed persisted streams. |
| Dashboard stream creation / arm | PASS | Created a fresh stream through the dashboard and armed it for OBS. The bodyless arm request initially exposed a web-client `400 Bad Request` bug; the request helper was fixed, the web image rebuilt, and the arm request then returned `200`. |
| Frontend request helper | PASS | Shared `api()` helper now adds `Content-Type: application/json` only when a request has a body. The bodyless `start` and `stop` actions therefore send no empty JSON body and preserve the existing API contract. |
| Web tests | NOT AVAILABLE | `npm run test --workspace @cloud-restreamer/web` reports `Missing script: "test"`; no web test script is defined. |
| Web production build | PASS | `npm run build --workspace @cloud-restreamer/web` passed. |
| Web container refresh | PASS | `docker compose build web` and `docker compose up -d --force-recreate web` completed; the recreated container started. |
| Dashboard Arm button | PASS | On stream `cmulf8ody000gla0tagu06usc`, the dashboard button changed `IDLE → CONNECTING`; API log recorded `POST /api/streams/.../start` with HTTP `200`. |
| Dashboard Stop button | PASS | On the same stream, the dashboard button changed `CONNECTING → STOPPED`; API log recorded `POST /api/streams/.../stop` with HTTP `200`. |
| OBS → NGINX (actual GUI) | PASS | Actual OBS published to `rtmp://localhost/live`; NGINX accepted the stream and API ingest callbacks completed with HTTP 200. |
| NGINX → FFmpeg | PASS (local sink) | API showed an active FFmpeg pull from NGINX and the isolated sink’s network traffic increased while live. |
| FFmpeg → external destination | NOT TESTED | No real YouTube/Twitch/LinkedIn credentials were supplied. |
| Multi-destination | PASS (local/failure simulation) | YouTube local sink `CONNECTED`; unconfigured Twitch and LinkedIn `FAILED`; stream remained `LIVE`. |
| Failure isolation | PASS | Invalid/unconfigured routes failed independently without stopping the valid route or incoming stream. |
| Stop / reconnect | PASS (synthetic publisher) | Verified `LIVE → STOPPED → LIVE → STOPPED` across two sessions with the same key. |

## Actual OBS GUI validation

| Check | Observed result |
| --- | --- |
| Stream configuration | PASS; OBS used `rtmp://localhost/live` with a fresh dashboard-generated key. |
| Start OBS streaming | PASS; NGINX accepted the actual OBS publisher and `/internal/ingest/publish` returned HTTP 200. |
| `CONNECTING → LIVE` | PASS; API/dashboard observed the stream as `LIVE`. |
| Sustained live run | PASS; the actual OBS stream remained `LIVE` for approximately two minutes. |
| Stop OBS and `LIVE → STOPPED` | PASS; stopping OBS triggered `/internal/ingest/done` HTTP 200 and the backend transitioned to `STOPPED`. |
| API status verification | PASS; validated stream `cmulfsdw2000wla0t0ll0ptm2` returned `STOPPED`. |

## AWS

| Item | Result |
| --- | --- |
| EC2 / security group / Secrets Manager / CloudWatch | NOT TESTED — AWS CLI authentication and cloud resources were not configured. |
| Remote OBS → EC2 / EC2 → destinations | NOT TESTED — no EC2 deployment or platform credentials. |

## API error-handling cleanup

| Check | Result | Evidence |
| --- | --- | --- |
| Invalid stream status request | PASS | `GET /api/streams/nonexistent-validation-id-20260928/status` returned HTTP 404 with `{"error":"Stream not found"}`. |
| Duplicate-reply warning | PASS | API logs for the invalid request showed one completed 404 response and no `FST_ERR_REP_ALREADY_SENT` / `Reply was already sent` entry. |
| Existing stream status regression | PASS | `GET /api/streams/cmulfsdw2000wla0t0ll0ptm2/status` returned `STOPPED`. |

## Remaining real blockers

1. Complete AWS CLI v2 installation and authenticate interactively before any AWS operation.
2. Supply destination secret references/credentials required for real platform tests; none were invented or stored.
