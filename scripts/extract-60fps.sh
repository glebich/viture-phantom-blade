#!/bin/bash
# 60fps re-master: every 2nd source frame → 30 eff-fps scrub sequences,
# double the old density. NEW dir names (<clip>60-<tier>) — /assets/ ships
# immutable for a year, so a re-cut must never reuse a filename.
set -e
SRC="assets-src/60fps"
OUT=public/assets
TMP=$(mktemp -d)
enc() { # dir  (pngs already in $TMP/seq, 0-based)
  local name=$1
  for W in 1920 960; do
    local Q=$([ $W = 1920 ] && echo 70 || echo 72)
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
one() { # name file
  mkdir -p "$TMP/seq"
  ffmpeg -y -v error -i "$SRC/$2" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/seq/f_%04d.png"
  enc "$1"
}
# intro = part 1 + part 2, one continuous sequence
mkdir -p "$TMP/seq" "$TMP/a" "$TMP/b"
ffmpeg -y -v error -i "$SRC/2026_VITURE_PHANTOM_BLADE_HD_60FPS_1_reduced.mp4" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/a/f_%04d.png"
ffmpeg -y -v error -i "$SRC/2026_VITURE_PHANTOM_BLADE_HD_60FPS_2_reduced.mp4" -vf "select=not(mod(n\,2))" -vsync vfr "$TMP/b/f_%04d.png"
n=0
for f in "$TMP/a"/*.png "$TMP/b"/*.png; do mv "$f" "$TMP/seq/g_$(printf %05d $n).png"; n=$((n+1)); done
enc intro60
one clip260 "2026_VITURE_PHANTOM_BLADE_HD_60FPS_3_reduced.mp4"
one clip360 "2026_VITURE_PHANTOM_BLADE_HD_60FPS_4_reduced.mp4"
one clip460 "2026_VITURE_PHANTOM_BLADE_HD_60FPS_5_reduced.mp4"
one clip560 "2026_VITURE_PHANTOM_BLADE_HD_60FPS_6_reduced.mp4"
one clip660 "2026_VITURE_PHANTOM_BLADE_HD_60FPS_7_reduced.mp4"
one room60  "2026_VITURE_PHANTOM_BLADE_ASSET_ROOM HD_60fps_reduced.mp4"
rm -rf "$TMP"
echo DONE
