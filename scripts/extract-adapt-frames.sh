#!/bin/bash
# Extract alpha frames from the client's ProRes 4444 ADAPT movs into
# lossless-ish WebP (with alpha) sequences for the canvas scrub engine.
# Desktop 1440px-wide + mobile 720px-wide variants (products sit centered;
# 1440 covers the 1920 stage after cover-scaling on retina at the sizes the
# design uses the asset).
set -euo pipefail
SRC="$HOME/Downloads/DOCKs/ADAPT/MOVs+A"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/assets"
for n in 1 2 3 4 6; do
  mov="$SRC/VITURE_BEAST_ASSET_DOCK_ADAPT_${n}.mov"
  for size in 1440 720; do
    dir="$OUT/adapt${n}-${size}"
    mkdir -p "$dir"
    if [ -e "$dir/f_029.webp" ]; then echo "SKIP adapt$n-$size"; continue; fi
    ffmpeg -v error -y -i "$mov" -vf "scale=${size}:-2:flags=lanczos" \
      -c:v libwebp -lossless 0 -q:v 82 -pix_fmt yuva420p -start_number 0 \
      "$dir/f_%03d.webp"
    # ffmpeg starts numbering at 0 with -start_number 0 → f_000..f_029
    echo "OK adapt$n-$size ($(ls "$dir" | wc -l | tr -d ' ') frames, $(du -sh "$dir" | cut -f1))"
  done
done
echo DONE
