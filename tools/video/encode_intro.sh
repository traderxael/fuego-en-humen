#!/usr/bin/env bash
# Encodes the Blender frame sequence into the intro video the game plays.
#
#   tools/video/encode_intro.sh <frames_dir> [out.mp4] [fps]
#
# Render the frames first with:
#   blender --background --factory-startup \
#     --python tools/blender/intro_scene.py -- <frames_dir> 1 240 640 360 10

set -e

FRAMES="${1:-C:/Users/USUARIO/AppData/Local/Temp/fu-eh-frames}"
OUT="${2:-assets/cinematic/intro.mp4}"
FPS="${3:-24}"

mkdir -p "$(dirname "$OUT")"

ffmpeg -y -v warning -framerate "$FPS" -i "$FRAMES/frame_%04d.png" \
  -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart \
  "$OUT"

echo "ENCODED $OUT"
