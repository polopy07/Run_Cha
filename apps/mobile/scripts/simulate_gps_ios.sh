#!/bin/bash
INTERVAL=7
COORDS=(
  "37.56650,126.97800"
  "37.56650,126.97830"
  "37.56650,126.97860"
  "37.56670,126.97860"
  "37.56690,126.97860"
  "37.56690,126.97830"
  "37.56690,126.97800"
  "37.56670,126.97800"
  "37.56650,126.97800"
)

echo "GPS 시뮬레이션 시작 (${#COORDS[@]}개 좌표, ${INTERVAL}초 간격)"
for i in $(seq 0 $((${#COORDS[@]}-1))); do
  echo "[$((i+1))/${#COORDS[@]}] ${COORDS[$i]}"
  xcrun simctl location booted set ${COORDS[$i]}
  sleep $INTERVAL
done
echo "폐곡선 완성! 러닝 종료 버튼을 누르세요."
