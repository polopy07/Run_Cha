# Run Cha

<p align="center">
  <img src="docs/icon.png" width="120" alt="Run Cha"/>
</p>

> 러닝 + 가챠 — 실제 러닝으로 지도 위 영토를 점령하는 위치 기반 모바일 게임

GPS로 달린 경로가 폐곡선을 이루면 해당 면적이 내 영토가 됩니다. 캐릭터를 배치해 영토를 지키고, 다른 유저의 영토를 침략하세요.

---

## 주요 기능

- **러닝 & 영토 생성** — GPS 경로가 폐곡선을 완성하면 면적이 영토로 등록
- **실시간 지도** — Socket.io 기반 근처 유저 위치 및 영토 변경 실시간 반영
- **영토 침략** — 공격형 캐릭터로 타 유저 영토 침략, 폴리곤 면적 실제 이전
- **캐릭터 가챠 & 강화** — 포인트로 뽑기, 공격/방어/버프 3종 캐릭터 육성
- **영토 자연 감소** — 비활동 시 점령률 단계적 감소, 수비형 캐릭터 배치로 완화
- **랭킹** — 보유 면적 / 누적 러닝 거리 랭킹

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 모바일 | React Native CLI, TypeScript |
| 상태 관리 | Zustand |
| 지도 | react-native-maps (Google Maps / Apple Maps) |
| 백그라운드 GPS | react-native-background-actions |
| 실시간 | Socket.io |
| 서버 | NestJS, TypeScript, TypeORM |
| DB | MySQL |
| 인증 | Firebase Auth + Server JWT |
| 지리 연산 | turf.js |
| 배포 | Tailscale |

---

## 로컬 실행

### 사전 준비

- Node.js 18+
- Android Studio / Xcode
- MySQL
- Firebase 프로젝트

### 서버

```bash
cd apps/server
cp ../../.env.example .env
npm install
npm run start:dev
```

### 모바일

```bash
cd apps/mobile
cp .env.example .env
npm install

# Android
npm run android

# iOS
bundle exec pod install --project-directory=ios
npm run ios
```

---

## 환경변수

`.env.example` / `apps/mobile/.env.example` 파일을 참고하세요.

### Google Maps API 키 추가 설정 (Android)

`apps/mobile/android/local.properties`
```properties
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

---

## 아키텍처

```
React Native App
  ├── Firebase Auth   →  로그인 / ID Token 발급
  ├── NestJS REST API →  비즈니스 로직 / JWT 인증
  │     └── MySQL     →  데이터 영구 저장
  └── Socket.io       →  실시간 위치 / 랭킹 / 영토 이벤트
```

자세한 내용은 [`docs/system-architecture.md`](docs/system-architecture.md)를 참고하세요.
