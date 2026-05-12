# RUN TERRITORY API 명세서

## 1. 문서 목적

이 문서는 RUN TERRITORY 프로젝트의 앱과 서버 간 통신에 사용되는 주요 API를 정리한 문서입니다.

현재 단계에서는 핵심 기능 중심으로 API 구조와 역할을 정의하며, 세부 Request/Response 형식은 구현 과정에서 지속적으로 보완합니다. (진행따라 수정 예정)

---

## 2. 공통 규칙

### Base URL

```txt
http://localhost:3000
```

### 인증 방식

로그인이 필요한 API는 Firebase ID Token 기반 인증을 사용한다.

```txt
Authorization: Bearer {firebase_id_token}
```

---

## 3. 인증 / 사용자 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | X | Firebase ID Token 검증 및 사용자 정보 생성/조회 |
| GET | `/users/me` | O | 현재 로그인한 사용자의 기본 정보 조회 |

---

### POST `/auth/login`

Firebase 로그인 후 발급받은 ID Token을 서버에 전달한다.

서버는 토큰을 검증하고, 최초 로그인 사용자일 경우 사용자 정보를 생성한다.

#### Request Body

| 필드 | 타입 | 설명 |
|---|---|---|
| idToken | string | Firebase ID Token |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 사용자 ID |
| email | string | 사용자 이메일 |
| nickname | string | 사용자 닉네임 |
| points | number | 보유 포인트 |
| totalDistance | number | 누적 러닝 거리 |

---

### GET `/users/me`

현재 로그인한 사용자의 기본 정보를 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 사용자 ID |
| email | string | 사용자 이메일 |
| nickname | string | 사용자 닉네임 |
| points | number | 보유 포인트 |
| totalDistance | number | 누적 러닝 거리 |

---

## 4. 러닝 / 영토 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/running/finish` | O | 러닝 종료 후 기록 저장 및 영토 생성 처리 |
| GET | `/territories` | O | 현재 지도 범위 내 영토 목록 조회 |
| POST | `/territories/:id/attack` | O | 특정 영토에 대한 침략 처리 |

---

### POST `/running/finish`

러닝 종료 시 GPS 경로와 러닝 정보를 서버에 저장한다.

서버는 거리, 평균 페이스, 면적, 획득 포인트를 계산하고 영토를 생성한다.

#### Request Body

| 필드 | 타입 | 설명 |
|---|---|---|
| path | array | GPS 좌표 배열 |
| distanceKm | number | 총 이동 거리 |
| avgPace | number | 평균 페이스 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| runningLogId | number | 저장된 러닝 기록 ID |
| territoryId | number | 생성된 영토 ID |
| areaSqm | number | 계산된 영토 면적 |
| earnedPoints | number | 획득 포인트 |

---

### GET `/territories`

현재 지도 범위 안의 영토 목록을 조회한다.

#### Query Parameters

| 필드 | 타입 | 설명 |
|---|---|---|
| minLat | number | 최소 위도 |
| maxLat | number | 최대 위도 |
| minLng | number | 최소 경도 |
| maxLng | number | 최대 경도 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 영토 ID |
| userId | number | 소유 사용자 ID |
| coordinates | array | 영토 좌표 데이터 |
| areaSqm | number | 영토 면적 |
| occupationRate | number | 점령력 |

---

### POST `/territories/:id/attack`

특정 영토에 대한 침략 요청을 처리한다.

서버는 공격/방어 상태와 점령력을 기준으로 침략 결과를 계산한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| success | boolean | 침략 성공 여부 |
| acquiredAreaSqm | number | 획득 면적 |
| message | string | 처리 결과 메시지 |

---

## 5. 캐릭터 / 가챠 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/gacha/draw` | O | 포인트를 사용한 캐릭터 뽑기 수행 |
| GET | `/characters/me` | O | 현재 사용자의 보유 캐릭터 목록 조회 |
| PATCH | `/characters/:id/upgrade` | O | 캐릭터 스탯 강화 처리 |

---

### POST `/gacha/draw`

포인트를 사용하여 캐릭터 뽑기를 수행한다.

#### Request Body

| 필드 | 타입 | 설명 |
|---|---|---|
| count | number | 뽑기 횟수 (1 또는 10) |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| results | array | 뽑기 결과 목록 |
| remainingPoints | number | 남은 포인트 |

---

### GET `/characters/me`

현재 사용자가 보유한 캐릭터 목록을 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 ID |
| name | string | 캐릭터 이름 |
| grade | string | 캐릭터 등급 |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| speedLv | number | 속도 레벨 |
| pointLv | number | 포인트 배율 레벨 |
| isDeployed | boolean | 배치 여부 |

---

### PATCH `/characters/:id/upgrade`

캐릭터의 특정 스탯을 강화한다.

#### Request Body

| 필드 | 타입 | 설명 |
|---|---|---|
| stat | string | 강화할 스탯 (`attack`, `defense`, `speed`, `point`) |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| upgradedStat | string | 강화된 스탯 |
| newLevel | number | 강화 후 레벨 |
| remainingPoints | number | 강화 후 남은 포인트 |

---

## 6. 랭킹 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/ranking/area` | O | 전체 점령 면적 기준 랭킹 조회 |
| GET | `/ranking/distance` | O | 전체 누적 러닝 거리 기준 랭킹 조회 |

---

### GET `/ranking/area`

현재 점령 중인 총 면적 기준 랭킹을 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| rank | number | 순위 |
| userId | number | 사용자 ID |
| nickname | string | 사용자 닉네임 |
| totalAreaSqm | number | 총 점령 면적 |

---

### GET `/ranking/distance`

누적 러닝 거리 기준 랭킹을 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| rank | number | 순위 |
| userId | number | 사용자 ID |
| nickname | string | 사용자 닉네임 |
| totalDistanceKm | number | 누적 러닝 거리 |

---

## 7. 추후 보완 예정

- DTO 기준 Request/Response 구조 보완
- API 에러 코드 및 예외 처리 정리
- Swagger 기반 API 문서화
- API 테스트 및 예시 응답 추가