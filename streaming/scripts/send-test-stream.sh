#!/usr/bin/env sh
# Requires FFmpeg. Replace STREAM_KEY with a generated value from the dashboard.
set -eu
: "${STREAM_KEY:?Set STREAM_KEY to the one-time key from the dashboard}"
: "${RTMP_SERVER:=rtmp://localhost/live}"
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000 \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -f flv "$RTMP_SERVER/$STREAM_KEY"

