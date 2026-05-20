# RUN TERRITORY API 명세서 초안

## 1. 문서 목적

RUN TERRITORY 앱과 서버가 통신할 주요 REST API를 정의한다.

현재 문서는 앱 연동 전 합의용 초안이다. 실제 구현 과정에서 DTO, 응답 필드, 에러 코드가 변경될 수 있으며, 변경 시 이 문서를 함께 갱신한다.

---

## 2. 공통 규칙

### Base URL

```text
http://localhost:3000
```

### 인증 방식

인증이 필요한 API는 요청 헤더에 서버 발급 JWT를 전달한다.

```http
Authorization: Bearer {token}
```

Firebase ID Token은 `POST /auth/login`에서만 사용한다. 서버는 Firebase ID Token을 검증한 뒤 서버 JWT를 발급하며, 이후 보호 API는 서버 JWT를 사용한다.

### 공통 에러 응답

앱 연동 전 최소 에러 포맷은 아래 형태로 통일한다.

```json
{
  "statusCode": 400,
  "message": "포인트가 부족합니다."
}
```

대표 상태 코드:

| Status | 의미 | 예시 |
|---|---|---|
| 400 | 잘못된 요청 | 포인트 부족, 유효하지 않은 러닝 경로 |
| 401 | 인증 실패 | 토큰 누락, 유효하지 않은 토큰 |
| 404 | 리소스 없음 | 존재하지 않는 영토 또는 캐릭터 |
| 500 | 서버 오류 | 예상하지 못한 서버 오류 |

---

## 3. 인증 / 사용자 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/login` | X | Firebase ID Token 검증 및 사용자 생성/조회 |
| GET | `/users/me` | O | 현재 로그인한 사용자 정보 조회 |
| PATCH | `/users/me/nickname` | O | 현재 로그인한 사용자 닉네임 변경 |

### POST `/auth/login`

Firebase Auth 로그인/회원가입 후 발급받은 ID Token을 서버에 전달한다.

서버는 ID Token을 검증하고, 최초 로그인 사용자라면 `users` 테이블에 사용자 정보를 생성한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| idToken | string | O | Firebase ID Token |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| accessToken | string | 서버 발급 JWT. 이후 API 요청 시 Authorization 헤더에 사용 |
| id | number | 사용자 ID |
| email | string | 사용자 이메일 |
| nickname | string | 사용자 닉네임 |
| points | number | 보유 포인트 |
| totalDistance | number | 누적 러닝 거리 |
| pityCount | number | 가챠 천장 카운트 |

#### 닉네임 초기값 정책

`users.nickname`은 NOT NULL이므로 최초 사용자 생성 시 기본 닉네임이 필요하다.

현재 정책:

1. Firebase `displayName`이 있으면 사용
2. 없으면 이메일의 `@` 앞부분 사용

Firebase 이메일 정보가 없는 토큰은 서버에서 인증 실패로 처리한다.

닉네임 변경은 `PATCH /users/me/nickname` API를 사용한다.

### GET `/users/me`

현재 로그인한 사용자의 기본 정보를 조회한다.

`JwtAuthGuard`와 `CurrentUser`를 사용해 현재 사용자 식별 후 DB에서 사용자 정보를 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 사용자 ID |
| email | string | 사용자 이메일 |
| nickname | string | 사용자 닉네임 |
| points | number | 보유 포인트 |
| totalDistance | number | 누적 러닝 거리 |
| pityCount | number | 가챠 천장 카운트 |

### PATCH `/users/me/nickname`

현재 로그인한 사용자의 닉네임을 변경한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| nickname | string | O | 변경할 닉네임. 1자 이상 50자 이하 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 사용자 ID |
| email | string | 사용자 이메일 |
| nickname | string | 변경된 사용자 닉네임 |
| points | number | 보유 포인트 |
| totalDistance | number | 누적 러닝 거리 |
| pityCount | number | 가챠 천장 카운트 |

---

## 4. 러닝 / 영토 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/running/start` | O | 러닝 시작 기록. 필요 여부 결정 필요 |
| POST | `/running/finish` | O | 러닝 종료, 경로 저장, 면적/포인트 계산, 영토 생성 처리 |
| GET | `/territories` | O | 현재 지도 범위 내 영토 목록 조회 |
| POST | `/territories/:id/attack` | O | 특정 영토 침략 처리 |

### POST `/running/start`

러닝 시작 시 서버에 시작 기록을 남길지 결정이 필요하다.

현재 서버 구현에는 없음. 서버 시작 기록이 필요 없다면 요구사항 문구를 "러닝을 종료할 수 있어야 한다"로 조정한다.

### POST `/running/finish`

러닝 종료 후 GPS 경로와 러닝 정보를 서버에 저장한다.

서버는 경로 기반 거리와 러닝 시간을 이용해 평균 속도/페이스를 직접 계산하고, 면적과 획득 포인트를 계산한 뒤 조건을 만족하면 영토를 생성한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| path | `{ lat: number, lng: number }[]` | O | GPS 좌표 배열 |
| distance_km | number | X | 클라이언트가 측정한 총 이동 거리(km). 서버는 검증/저장/포인트 계산 시 `path` 기반 계산값을 사용하므로 참고값으로만 취급 |
| started_at | string | O | 러닝 시작 시각. ISO 8601 문자열 |

#### path 예시

```json
[
  { "lat": 37.5665, "lng": 126.9780 },
  { "lat": 37.5668, "lng": 126.9783 },
  { "lat": 37.5665, "lng": 126.9780 }
]
```

> 앱에서는 `[lat, lng]`, `{ latitude, longitude }` 형태가 아니라 반드시 `{ lat, lng }` 형태로 전송한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| log | object | 저장된 러닝 로그 |
| territory | object \| null | 생성된 영토. 폐곡선 조건 미충족 시 null |
| earned_points | number | 획득 포인트 |
| area_sqm | number | 계산된 면적(m²) |

#### 폐곡선 판단 기준

서버 기준:

- 좌표가 3개 이상이어야 한다.
- 시작점과 종료점의 거리가 50m 이내이면 폐곡선으로 판단한다.
- 폐곡선이 아니면 러닝 로그는 저장하지만 영토는 생성하지 않는다.

#### 속도 / 포인트 검증 기준

서버 기준:

- 클라이언트가 보낸 `avg_pace` 값은 신뢰하지 않는다.
- 클라이언트가 보낸 `distance_km` 값은 참고값으로만 취급하며, 서버 검증/저장 기준으로 사용하지 않는다.
- 서버가 `path` 기반 이동 거리와 `started_at`부터 종료 시각까지의 시간으로 평균 속도와 평균 페이스를 계산한다.
- 평균 속도가 4km/h 미만 또는 20km/h 초과이면 포인트는 0으로 처리한다.
- 유효 속도 범위 안에서는 서버 계산 평균 페이스에 따라 포인트 보정값을 적용한다.

> 현재 서버 DTO에 `distance_km`가 필수값으로 남아 있다면, 문서 기준에 맞춰 별도 서버 작업에서 optional 처리해야 한다.

### GET `/territories`

현재 지도 범위 내 영토 목록을 조회한다.

#### Query Parameters

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| minLat | number | O | 최소 위도 |
| maxLat | number | O | 최대 위도 |
| minLng | number | O | 최소 경도 |
| maxLng | number | O | 최대 경도 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 영토 ID |
| userId | number | 소유 사용자 ID |
| coordinates | `{ lat: number, lng: number }[]` | 영토 좌표 데이터 |
| areaSqm | number | 영토 면적 |
| occupationRate | number | 점령률 |

### POST `/territories/:id/attack`

특정 영토에 대한 침략 요청을 처리한다.

> 현재 서버 미구현 API다. 아래 내용은 앱/서버 연동 전 합의용 초안이며 구현 전 최종 확정이 필요하다.

#### 침략 가능 조건 초안

- 대상은 다른 사용자가 점령 중인 영토여야 한다.
- 공격자는 대상 영토 면적의 최소 30% 이상을 직접 러닝으로 지나가야 한다.
- 서버는 러닝 로그의 GPS 경로와 대상 영토의 겹친 면적을 기준으로 침략 가능 여부를 판단한다.
- 침략 가능 조건을 만족하면 공격 캐릭터와 방어 캐릭터의 전투를 진행한다.
- 공격 캐릭터가 승리하면 공격자가 직접 뛴 겹친 면적만큼 대상 영토를 점령한다.
- 공격 캐릭터가 패배하면 대상 점령 영토는 획득하지 못한다.
- 대상 영토에 포함되지 않은 새 폐곡선 면적은 일반 러닝 보상/영토 생성 규칙에 따라 처리한다.

#### Request Body 초안

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| runningLogId | number | O | 침략 판정에 사용할 러닝 로그 ID |
| characterId | number | O | 침략에 사용할 보유 공격 캐릭터 ID |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| success | boolean | 침략 성공 여부 |
| battleResult | string | 전투 결과. `win` 또는 `lose` |
| overlapRate | number | 대상 영토 기준 직접 러닝으로 겹친 비율 |
| contestedAreaSqm | number | 대상 영토와 직접 러닝 경로가 겹친 면적 |
| acquiredAreaSqm | number | 승리 시 획득한 점령 면적. 패배 시 0 |
| neutralAreaSqm | number | 기존 점령 영토에 포함되지 않아 일반 규칙으로 처리된 면적 |
| nextAttackAvailableAt | string \| null | 다음 침략 가능 시각. 쿨타임 확정 후 사용 |
| remainingDailyAttacks | number \| null | 당일 남은 침략 횟수. 하루 제한 확정 후 사용 |
| message | string | 처리 결과 메시지 |

#### 결정 필요

- 공격/방어 능력치 계산 공식
  - 공격 캐릭터 단일 스탯만 사용할지, 배치된 버프형 캐릭터 효과까지 합산할지 확정해야 한다.
  - 방어 측은 배치된 수비형 캐릭터를 사용할지, 대표 캐릭터를 사용할지 확정해야 한다.
- 침략 쿨타임과 하루 5회 제한 저장 방식
  - `users`, `territory_attacks`, 별도 쿨타임 테이블 중 어디에 저장할지 확정 후 마이그레이션이 필요하다.
- 응답에 `nextAttackAvailableAt`, `remainingDailyAttacks`를 포함할지 확정해야 한다.

---

## 5. 캐릭터 / 가챠 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/gacha/draw` | O | 포인트를 사용해 캐릭터 뽑기 수행 |
| GET | `/characters/me` | O | 현재 사용자의 보유 캐릭터 목록 조회 |
| PATCH | `/characters/:id/upgrade` | O | 캐릭터 스탯 강화 처리 |
| PATCH | `/characters/:id/deploy` | O | 수비형/버프형 캐릭터를 사용자 영토에 배치 또는 회수 |

### POST `/gacha/draw`

포인트를 사용해 캐릭터 뽑기를 수행한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| count | number | O | 뽑기 횟수. 1 또는 10 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| results | GachaResult[] | 뽑기 결과 목록 |
| remainingPoints | number | 남은 포인트 |

#### GachaResult

| 필드 | 타입 | 설명 |
|---|---|---|
| characterId | number | 뽑힌 캐릭터 ID |
| name | string | 캐릭터 이름 |
| grade | string | 등급. `common`, `rare`, `epic`, `legendary` |
| type | string | 종류. `attack`, `defense`, `buff` |
| isNew | boolean | 신규 캐릭터 여부 |
| isGuaranteed | boolean | 천장 보장 여부 |

### GET `/characters/me`

현재 사용자가 보유한 캐릭터 목록을 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 원본 ID |
| name | string | 캐릭터 이름 |
| grade | string | 캐릭터 등급 |
| type | string | 캐릭터 타입. `attack`, `defense`, `buff` |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| speedLv | number | 속도 레벨 |
| pointLv | number | 포인트 배율 레벨 |
| isDeployed | boolean | 배치 여부 |
| deployedTerritoryId | number \| null | 배치된 영토 ID. `null`이면 미배치 |

### PATCH `/characters/:id/upgrade`

보유 캐릭터의 특정 스탯을 강화한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| stat | string | O | 강화할 스탯. `attack`, `defense`, `speed`, `point` |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| upgradedStat | string | 강화된 스탯 |
| newLevel | number | 강화 후 레벨 |
| remainingPoints | number | 강화 후 남은 포인트 |

### PATCH `/characters/:id/deploy`

보유 캐릭터를 사용자의 영토에 배치하거나 배치를 해제한다.

수비형/버프형 캐릭터만 배치할 수 있으며, 배치 여부는 `user_characters.deployed_territory_id` 값으로 판단한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| territory_id | number \| null | O | 배치할 사용자 소유 영토 ID. `null`이면 회수 |

#### Response

`GET /characters/me`의 개별 보유 캐릭터 객체와 동일한 형식으로 응답한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 원본 ID |
| name | string | 캐릭터 이름 |
| grade | string | 캐릭터 등급 |
| type | string | 캐릭터 타입 |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| speedLv | number | 속도 레벨 |
| pointLv | number | 포인트 배율 레벨 |
| isDeployed | boolean | 배치 여부 |
| deployedTerritoryId | number \| null | 배치된 영토 ID |

#### 예외

- 공격형 캐릭터 배치 요청 시 400
- 보유하지 않은 캐릭터 배치 요청 시 404
- 사용자가 소유하지 않은 영토 배치 요청 시 404
- 수비형/버프형 캐릭터 효과가 침략/자연 감소 계산에 적용되는 방식은 후속 구현에서 확정한다.

#### 현재 구현 기준

- 가챠 비용: 1회 100 포인트, 10회 900 포인트
- 가챠 확률: common 60%, rare 30%, epic 9%, legendary 1%
- 천장: 100회차 legendary 보장
- 강화 비용: `Math.min(Math.floor(100 * 1.5 ** currentLevel), 5000)`
- 위 수치는 현재 구현 기준이며, 밸런스 검토 후 조정될 수 있다.

---

## 6. 랭킹 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/ranking/area` | O | 전체 점령 면적 기준 랭킹 조회 |
| GET | `/ranking/distance` | O | 전체 누적 러닝 거리 기준 랭킹 조회 |

### GET `/ranking/area`

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| rank | number | 순위 |
| userId | number | 사용자 ID |
| nickname | string | 사용자 닉네임 |
| totalAreaSqm | number | 총 점령 면적 |

### GET `/ranking/distance`

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| rank | number | 순위 |
| userId | number | 사용자 ID |
| nickname | string | 사용자 닉네임 |
| totalDistanceKm | number | 누적 러닝 거리 |

---

## 7. 앱 연동 전 결정 필요 항목

1. `/running/start` API 필요 여부
2. `/territories/:id/attack` 요청 필드 최종 확정
3. 대상 영토 30% 직접 러닝 판정 방식
4. 공격/방어 능력치 계산 공식
5. 침략 쿨타임 및 하루 5회 제한 저장 방식
6. 침략 응답에 다음 가능 시각과 남은 횟수 포함 여부
7. 버프형/수비형 캐릭터의 침략/자연 감소 계산 반영 방식
8. 공통 에러 메시지 세부 코드 정의
