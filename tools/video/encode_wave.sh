#!/usr/bin/env bash
# Encodes one wave clip from its Blender frame sequence.
#
#   tools/video/encode_wave.sh <frames_dir> <out.mp4> [fps]
#
# Render the frames first with:
#   blender --background --factory-startup \
#     --python tools/blender/wave_scene.py -- <frames_dir> 1 84 640 360 10 <wave>

set -e

FRAMES="${1:?usage: encode_wave.sh <frames_dir> <out.mp4> [fps]}"
OUT="${2:?usage: encode_wave.sh <frames_dir> <out.mp4> [fps]}"
FPS="${3:-24}"

mkdir -p "$(dirname "$OUT")"

ffmpeg -y -v warning -framerate "$FPS" -i "$FRAMES/frame_%04d.png" \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart \
  "$OUT"

echo "ENCODED $OUT"
