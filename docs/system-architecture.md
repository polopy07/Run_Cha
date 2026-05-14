# RUN TERRITORY 시스템 아키텍처 설계

## 1. 전체 시스템 구조

RUN TERRITORY는 모바일 앱, NestJS 서버, MySQL 데이터베이스, Firebase Auth로 구성된다.

```text
React Native App
  -> Firebase Auth
  -> NestJS REST API
  -> MySQL
```

주요 역할:

- 모바일 앱: 로그인, 러닝 기록, 지도 화면, 캐릭터/가챠/랭킹 UI 제공
- Firebase Auth: 회원가입, 로그인, Firebase ID Token 발급
- NestJS 서버: 토큰 검증, 사용자/러닝/영토/캐릭터/랭킹 API 제공
- MySQL: 사용자, 러닝 로그, 영토, 캐릭터, 가챠 로그 저장
- turf.js: GPS 좌표 기반 면적 및 거리 계산
- Socket.io: 실시간 지도 업데이트 및 이벤트 전송. 추후 구현 예정

---

## 2. 구성 요소

### 2.1 Mobile App

역할:

- Firebase 로그인/회원가입 요청
- Firebase ID Token 획득
- 서버 API 호출
- GPS 위치 수집
- 지도, 러닝, 보관함, 가챠, 랭킹 화면 제공

기술:

- React Native
- 현재 프로젝트는 Expo 기반
- 추후 백그라운드 GPS 요구사항에 따라 React Native CLI 전환 가능성 있음

주요 폴더:

```text
apps/mobile/src/api
apps/mobile/src/screens
apps/mobile/src/components
apps/mobile/src/hooks
apps/mobile/src/store
apps/mobile/src/utils
```

### 2.2 NestJS Server

역할:

- REST API 제공
- Firebase ID Token 검증
- 사용자 생성/조회
- 러닝 기록 저장
- 폐곡선 판단 및 면적 계산
- 포인트 계산
- 영토 생성/조회/침략 처리
- 캐릭터 및 가챠 처리
- 랭킹 데이터 제공

기술:

- NestJS
- TypeScript
- TypeORM
- Firebase Admin SDK
- turf.js

주요 폴더:

```text
apps/server/src/auth
apps/server/src/users
apps/server/src/running
apps/server/src/territories
apps/server/src/characters
apps/server/src/gacha
apps/server/src/ranking
apps/server/src/common
```

### 2.3 MySQL Database

역할:

- 사용자 정보 저장
- 러닝 로그 저장
- 영토 데이터 저장
- 캐릭터 데이터 저장
- 사용자 보유 캐릭터 저장
- 가챠 로그 저장

주요 테이블:

| 테이블 | 설명 |
|---|---|
| users | 사용자 정보 |
| territories | 영토 정보 |
| characters | 캐릭터 원본 데이터 |
| user_characters | 사용자 보유 캐릭터 |
| running_log | 러닝 기록 |
| gacha_log | 가챠 기록 |

### 2.4 Firebase Auth

역할:

- 이메일/비밀번호 기반 회원가입
- 로그인
- Firebase ID Token 발급
- 서버에서 ID Token 검증

인증 흐름:

```text
Mobile App
  -> Firebase Auth 로그인
  -> Firebase ID Token 발급
  -> POST /auth/login
  -> Server Firebase Admin 검증
  -> users 테이블 조회/생성
  -> Server JWT 발급
  -> 이후 보호 API는 Server JWT 사용
```

Firebase ID Token은 로그인 검증 단계에서만 사용하고, 이후 보호 API는 서버가 발급한 JWT를 사용한다.

### 2.5 turf.js

역할:

- GPS 좌표 기반 polygon 생성
- 면적 계산
- 시작점과 종료점 거리 계산

폐곡선 기준:

- 좌표 3개 이상
- 시작점과 종료점 거리 50m 이내

### 2.6 Socket.io

역할:

- 실시간 지도 업데이트
- 근처 영토 침략 알림
- 랭킹 또는 영토 변경 이벤트 전파

현재 상태:

- 아키텍처상 포함
- 서버 구현은 추후 진행 예정

---

## 3. 주요 데이터 흐름

### 3.1 로그인 흐름

```text
1. 사용자가 앱에서 이메일/비밀번호 입력
2. 앱이 Firebase Auth 로그인 요청
3. Firebase가 ID Token 발급
4. 앱이 POST /auth/login으로 ID Token 전달
5. 서버가 Firebase Admin SDK로 토큰 검증
6. 서버가 users 테이블에서 사용자 조회
7. 없으면 사용자 생성
8. 서버가 accessToken과 사용자 정보를 응답
```

### 3.2 러닝 종료 흐름

```text
1. 앱이 GPS 좌표를 수집
2. 사용자가 러닝 종료
3. 앱이 POST /running/finish 호출
4. 서버가 path, distance_km, avg_pace 검증
5. 서버가 turf.js로 면적 계산
6. 서버가 시작점-종료점 50m 이내 여부 확인
7. 서버가 포인트 계산
8. 서버가 running_log 저장
9. 폐곡선이면 territories 저장
10. 서버가 러닝 결과 응답
```

### 3.3 포인트 계산 흐름

```text
areaSqm -> avg_pace -> paceMultiplier -> earnedPoints
```

공식:

```ts
Math.floor(areaSqm / 100 * paceMultiplier)
```

### 3.4 가챠 흐름

```text
1. 앱이 POST /gacha/draw 호출
2. 서버가 사용자 포인트 확인
3. 서버가 뽑기 횟수와 천장 조건 확인
4. 서버가 캐릭터 결과 생성
5. 서버가 user_characters 및 gacha_log 저장
6. 서버가 results와 remainingPoints 응답
```

---

## 4. 앱 연동 전 주의사항

- 모바일과 서버는 GPS 좌표 타입을 `{ lat, lng }`로 통일한다.
- 평균 페이스 단위는 `분/km`로 통일한다.
- 영토 폐곡선 기준은 시작점-종료점 50m 이내로 통일한다.
- `.env`, Firebase Admin 서비스 키, API Key는 저장소에 포함하지 않는다.
- Firebase ID Token은 `/auth/login`에서만 사용하고, 이후 보호 API는 서버 JWT를 사용한다.
