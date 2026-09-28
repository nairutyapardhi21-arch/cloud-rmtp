# End-to-end test plan

Current result: local API, PostgreSQL, dashboard, synthetic RTMP ingest, local restream, failure isolation, and reconnect tests passed. OBS GUI, real external destinations, and AWS remain untested. The exact evidence is in [validation-report.md](validation-report.md).

Run these only after Docker, Node/FFmpeg, OBS, destination credentials, and (for the final test) AWS are available.

| Test | Procedure | Expected result |
| --- | --- | --- |
| 1: OBS ingest | Create and arm a stream; send OBS to its RTMP endpoint | Dashboard changes from `CONNECTING` to `LIVE` |
| 2: One destination | Enable YouTube and configure its secret reference | YouTube receives the stream; destination is `CONNECTED` |
| 3: Multiple destinations | Enable YouTube, Twitch, and LinkedIn | Each destination has an independent FFmpeg process/status |
| 4: Failure isolation | Use an invalid LinkedIn secret/reference while YouTube is valid | YouTube remains live; LinkedIn moves through `RECONNECTING` then `FAILED` after 2/5/10 s retries |
| 5: End stream | Stop OBS | Dashboard changes to `STOPPED`; output processes terminate |
| 6: Reconnect | Arm again and restart OBS | A new session is created and the dashboard returns to `LIVE` |
| 7: EC2 | Repeat 1–6 against the EC2 RTMP DNS name | Live media and CloudWatch network activity are visible |
