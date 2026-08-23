#!/bin/bash
# Extract scroll-scrub webp frame sequences: every 2nd frame, 1920 & 960 tiers.
set -e
SRC=assets-src
OUT=public/assets
TMP=$(mktemp -d)
seq() { # name file
  local name=$1 file=$2
  local P="$TMP/$name"
  mkdir -p "$P"
  ffmpeg -y -v error -i "$SRC/$file" -vf "select=not(mod(n\,2))" -vsync vfr "$P/f_%04d.png"
  for W in 1920 960; do
    local Q=$( [ $W = 1920 ] && echo 70 || echo 72 )
    local D="$OUT/${name}-${W}"
    mkdir -p "$D"
    local i=0
    for f in "$P"/f_*.png; do
      cwebp -quiet -q $Q -resize $W 0 "$f" -o "$D/f_$(printf %03d $i).webp"
      i=$((i+1))
    done
    echo "$D: $i frames"
  done
  rm -rf "$P"
}
seq intro intro.mp4
seq clip2 asset2.mp4
seq clip3 asset3.mp4
seq clip4 asset4.mp4
seq clip5 asset5.mp4
seq clip6 asset6_outro.mp4
rm -rf "$TMP"
echo DONE
