#!/bin/bash
# Vertical (1080x1920) 60fps mobile sequences — same recipe as extract-60fps:
# every 2nd frame, tiers 1080 (phones) and 540 (frugal networks).
set -e
SRC="assets-src/mobile60"
OUT=public/assets
TMP=$(mktemp -d)
enc() {
  local name=$1
  for W in 1080 540; do
    local Q=$([ $W = 1080 ] && echo 70 || echo 72)
    local D="$OUT/${name}-${W}"
    rm -rf "$D" && mkdir -p "$D"
    local i=0
    for f in "$TMP/seq"/*.png; do
      cwebp -quiet -q $Q -resize $W 0 "$f" -o "$D/f_$(printf %03d $i).webp"
      i=$((i+1))
    done
    echo "$D: $i frames"
  done
  rm -rf "$TMP/seq"
}
one() {
  mkdir -p "$TMP/seq"
  ffmpeg -y -v error -i "$SRC/$2" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/seq/f_%04d.png"
  enc "$1"
}
mkdir -p "$TMP/seq" "$TMP/a" "$TMP/b"
ffmpeg -y -v error -i "$SRC/2026_VITURE_PHANTOM_BLADE_MOB_60FPS_1_reduced.mp4" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/a/f_%04d.png"
ffmpeg -y -v error -i "$SRC/2026_VITURE_PHANTOM_BLADE_MOB_60FPS_2_reduced.mp4" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/b/f_%04d.png"
n=0
for f in "$TMP/a"/*.png "$TMP/b"/*.png; do mv "$f" "$TMP/seq/g_$(printf %05d $n).png"; n=$((n+1)); done
enc intro60m
one clip260m "2026_VITURE_PHANTOM_BLADE_MOB_60FPS_3_reduced.mp4"
one clip360m "2026_VITURE_PHANTOM_BLADE_MOB_60FPS_4_reduced.mp4"
one clip460m "2026_VITURE_PHANTOM_BLADE_MOB_60FPS_5_reduced.mp4"
one clip560m "2026_VITURE_PHANTOM_BLADE_MOB_60FPS_6_reduced.mp4"
one clip660m "2026_VITURE_PHANTOM_BLADE_MOB_60FPS_7_reduced.mp4"
rm -rf "$TMP"
echo DONE
