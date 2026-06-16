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

엔드포인트 목록의 인증 표기는 다음 기준을 사용한다.

- `O`: 인증 필요
- `X`: 인증 불필요
- `△`: 인증 선택. `OptionalJwtAuthGuard` 기준으로 비로그인 요청도 가능하지만, 로그인 요청이면 사용자 기준 추가 필드를 계산한다.

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
| statPoints | number | 보유 스탯 포인트 |
| totalDistance | number | 누적 러닝 거리 |
| representativeCharacter | RepresentativeCharacter \| null | 대표 캐릭터 정보 |

#### RepresentativeCharacter

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 원본 ID |
| name | string | 캐릭터 이름 |
| type | string | 캐릭터 타입. `attack`, `defense`, `buff` |
| grade | string | 캐릭터 등급 |
| imageUrl | string \| null | 캐릭터 이미지 URL |
| level | number | 캐릭터 전체 레벨 |
| experience | number | 현재 경험치 |
| nextLevelExperience | number \| null | 다음 레벨 필요 경험치. 최대 레벨이면 `null` |

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
| statPoints | number | 보유 스탯 포인트 |
| totalDistance | number | 누적 러닝 거리 |
| representativeCharacter | RepresentativeCharacter \| null | 대표 캐릭터 정보 |

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
| statPoints | number | 보유 스탯 포인트 |
| totalDistance | number | 누적 러닝 거리 |

---

## 4. 러닝 / 영토 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/running/start` | O | 러닝 시작 기록. 필요 여부 결정 필요 |
| POST | `/running/finish` | O | 러닝 종료, 경로 저장, 면적/포인트 계산, 영토 생성 처리 |
| GET | `/running/logs` | O | 현재 로그인 사용자의 러닝 기록 목록 조회 |
| GET | `/territories` | X | 현재 지도 범위 내 영토 목록 조회 |
| GET | `/territories/:id` | △ | 영토 상세 조회. 로그인 시 `isMine` 판별 |
| GET | `/territories/me` | O | 현재 로그인 사용자의 보유 영토 목록 조회 |
| PATCH | `/territories/:id/name` | O | 내 영토 이름 변경 |
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
| representativeCharacterExp | RepresentativeCharacterExp \| null | 대표 캐릭터 경험치 보상 결과 |

#### RepresentativeCharacterExp

| 필드 | 타입 | 설명 |
|---|---|---|
| userCharacterId | number | 경험치를 받은 유저 캐릭터 ID |
| gainedExp | number | 이번 러닝으로 획득한 경험치 |
| level | number | 보상 반영 후 캐릭터 전체 레벨 |
| experience | number | 보상 반영 후 현재 경험치 |
| nextLevelExperience | number \| null | 다음 레벨 필요 경험치. 최대 레벨이면 `null` |
| levelUps | number | 이번 러닝으로 상승한 레벨 수 |
| increasedStat | string \| null | 레벨업으로 증가한 주 스탯. `attack`, `defense`, `point`, 또는 `null` |

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

### GET `/running/logs`

현재 로그인 사용자의 러닝 기록 목록을 조회한다.

침략 실행 화면에서 사용자가 침략에 사용할 러닝 기록을 선택할 때 사용한다.

현재 구현은 별도 페이지네이션 없이 최신 20개 기록을 반환한다. 러닝 기록 전체 조회나 이전 기록 더보기 기능이 필요해지면 `cursor` 또는 `lastId` 기반 페이지네이션을 추가한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 러닝 로그 ID |
| distanceKm | number | 러닝 거리(km) |
| earnedPoints | number | 획득 포인트 |
| avgPace | number | 평균 페이스 |
| areaSqm | number | 생성 또는 계산된 면적 |
| startedAt | string (ISO 8601) | 러닝 시작 시각 |
| endedAt | string (ISO 8601) \| null | 러닝 종료 시각 |

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
| name | string \| null | 영토 이름. 사용자가 지정하지 않은 경우 `null` |
| userId | number | 소유 사용자 ID. 현재 로그인 사용자 ID와 비교해 내 영토/다른 사용자 영토를 구분할 때 사용 |
| ownerNickname | string \| null | 보유자 닉네임. 지도 위 간단한 라벨 표시에 사용 |
| coordinates | `{ lat: number, lng: number }[]` | 영토 좌표 데이터 |
| areaSqm | number | 영토 면적 |
| occupationRate | number | 점령률 |

목록 응답은 지도 렌더링에 필요한 경량 필드만 포함한다. `userId`는 JOIN 없이 영토 테이블에서 바로 내려줄 수 있는 값이며, 지도에서 내 영토와 다른 사용자 영토의 색상을 구분하거나 클릭 후 분기할 때 사용한다. `ownerNickname`은 지도 위 보유자 이름 표시에 사용한다. 배치 캐릭터 상세 정보는 N+1 쿼리를 피하기 위해 상세 API에서 조회한다.

### GET `/territories/:id`

점령된 영토를 선택했을 때 영토 상세 정보를 조회한다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 영토 ID |
| name | string \| null | 영토 이름. 사용자가 지정하지 않은 경우 `null` |
| coordinates | `{ lat: number, lng: number }[]` | 영토 좌표 데이터 |
| areaSqm | number | 영토 면적 |
| occupationRate | number | 점령률 |
| owner | `{ id: number, nickname: string }` | 보유자 정보 |
| isMine | boolean | 현재 로그인 사용자의 영토인지 여부 |
| deployedCharacters | TerritoryDeployedCharacterDetail[] | 배치 캐릭터 상세 |

#### TerritoryDeployedCharacterDetail

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 원본 ID |
| name | string | 캐릭터 이름 |
| type | string | 캐릭터 타입. `defense`, `buff` |
| grade | string | 캐릭터 등급 |
| basePointRate | number | 기본 포인트 수익 배율. 버프형 캐릭터에서만 수익 계산에 사용하며, 공격형/수비형에서는 계산에 사용하지 않음 |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| pointLv | number | 포인트 효율 레벨 |

비로그인 사용자도 접근 가능하며, 로그인 사용자인 경우에만 `isMine`을 현재 사용자 기준으로 계산한다. 상세 응답에서는 소유자 ID를 별도 `userId` 필드가 아닌 `owner.id`로 참조한다.

내 영토 상세 화면은 이 응답의 `areaSqm`, `occupationRate`, `deployedCharacters[0].basePointRate`, `deployedCharacters[0].pointLv`를 사용해 시간당 예상 수익과 버프 배율을 표시할 수 있다.

### GET `/territories/me`

현재 로그인 사용자의 보유 영토 목록을 조회한다.

캐릭터 배치 화면에서 사용자가 배치할 영토를 선택할 때 사용한다.

현재 응답은 내 영토 관리 화면에서 목록과 지도 위치를 표시할 수 있도록 `coordinates`를 포함한다. 보유자 닉네임, 배치 캐릭터 등 상세 정보가 필요한 경우 `GET /territories/:id`를 추가 호출한다.

내 영토 관리 화면은 영토 개수, 총 면적, 각 영토의 면적, 점령률, 최근 활동 시간을 표시한다. 영토 이름은 `PATCH /territories/:id/name`으로 수정하거나 `name: null` 요청으로 삭제할 수 있다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 영토 ID |
| name | string \| null | 영토 이름. 사용자가 지정하지 않은 경우 `null` |
| userId | number | 소유 사용자 ID |
| ownerNickname | string \| null | 보유자 닉네임 |
| coordinates | `{ lat: number, lng: number }[]` | 영토 좌표 데이터 |
| areaSqm | number | 영토 면적 |
| occupationRate | number | 점령률 |
| lastActiveAt | string (ISO 8601) | 마지막 활동 시각 |

내 영토 관리 화면에서 사용자가 보유한 영토 목록을 확인하고, 지도 표시와 캐릭터 배치/회수 화면 진입에 사용한다.

### PATCH `/territories/:id/name`

현재 로그인 사용자가 보유한 영토의 이름을 변경한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| name | string \| null | O | 변경할 영토 이름 (1자 이상 100자 이하, 앞뒤 공백 trim 처리). `null`로 요청 시 이름 삭제 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 영토 ID |
| name | string \| null | 변경된 영토 이름 |

### POST `/territories/:id/attack`

특정 영토에 대한 침략 요청을 처리한다.

> 아래 내용은 침략 API 구현 기준으로 사용한다.

#### 침략 가능 조건

- 대상은 다른 사용자가 점령 중인 영토여야 한다.
- `runningLogId`는 현재 사용자의 러닝 로그여야 한다.
- 공격자는 대상 영토 면적의 최소 30% 이상을 직접 러닝으로 지나가야 한다.
- 서버는 `POST /territories/:id/attack` 처리 중 러닝 로그의 GPS 경로와 대상 영토의 겹친 면적을 계산해 침략 가능 여부를 판단한다.
- 침략에는 현재 사용자가 보유한 공격형 캐릭터만 사용할 수 있다.
- 하루 침략 가능 횟수는 5회이며, `attack_logs`의 공격자/날짜 기준 카운트로 제한한다.
- 침략 가능 조건을 만족하면 공격력과 방어력을 계산해 침략 성공 여부와 점령률 감소량을 판단한다.
- 침략 성공 시 러닝 경로와 대상 영토가 겹친 영역을 방어자 영토에서 제거하고 공격자 영토로 이전한다.
- 서버는 `turf.difference(방어자 영토, 겹침 폴리곤)`로 방어자 영토를 갱신하고, `turf.union(공격자 기존 영토, 겹침 폴리곤)`으로 공격자 영토에 병합한다.
- 침략 성공 시 획득 폴리곤은 공격자 기존 영토와 인접한 것으로 간주하며, 별도 새 영토 생성 분기는 두지 않는다.
- 방어자/공격자 영토의 `coordinates`, `area_sqm`, `center_lat`, `center_lng`는 각각 차집합/합집합 결과 기준으로 재계산한다.
- 방어자 영토 차집합 결과 면적이 0이면 해당 영토는 삭제한다.
- 차집합 결과가 `MultiPolygon`이면 임시 정책으로 가장 큰 조각만 보존하고 나머지는 삭제해 단일 폴리곤 구조를 유지한다.
- 침략 실패 시 겹침 후보 영역은 소유권 이전 없이 유지된다.
- 대상 영토에 포함되지 않은 새 폐곡선 면적은 일반 러닝 보상/영토 생성 규칙에 따라 처리한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| runningLogId | number | O | 침략 판정에 사용할 러닝 로그 ID |
| attackerCharacterId | number | O | 침략에 사용할 보유 공격형 사용자 캐릭터 ID |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| success | boolean | 점령률이 실제로 감소하고 겹침 폴리곤이 존재해 소유권 이전이 발생했는지 여부 |
| overlapRate | number | 대상 영토 기준 직접 러닝으로 겹친 비율 |
| contestedAreaSqm | number | 대상 영토와 직접 러닝 경로가 겹친 면적 |
| damage | number | 공격/방어 계산으로 산출한 점령률 감소 참고값 |
| occupationRateBefore | number | 침략 전 대상 영토 점령률 |
| occupationRateAfter | number | 침략 후 대상 영토 점령률. 방어력 보정/자연 감소 관리를 위한 상태값 |
| acquiredAreaSqm | number | 침략 성공 시 공격자 소유로 이전된 실제 겹침 폴리곤 면적 |
| neutralAreaSqm | number | 기존 점령 영토에 포함되지 않아 일반 규칙으로 처리된 면적 |
| nextAttackAvailableAt | string | 다음 침략 가능 시각. 침략 로그 저장 시각 기준 5분 뒤 시각을 반환 |
| remainingDailyAttacks | number | 당일 남은 침략 횟수 |
| message | string | 처리 결과 메시지 |

#### Error Cases

| Status | 조건 | 메시지 |
|---|---|---|
| 400 | 자기 영토를 침략한 경우 | `자신의 영토는 침략할 수 없습니다.` |
| 400 | 공격 캐릭터가 공격형이 아닌 경우 | `공격형 캐릭터만 침략에 사용할 수 있습니다.` |
| 400 | 당일 침략 횟수 5회를 모두 사용한 경우 | `오늘의 침략 가능 횟수를 모두 사용했습니다.` |
| 400 | 러닝 경로와 대상 영토 겹침 비율이 30% 미만인 경우 | `대상 영토의 30% 이상을 직접 러닝해야 합니다.` |
| 400 | 침략 판정에 사용할 폐곡선 좌표가 3개 미만인 경우 | `폐곡선 좌표가 부족합니다.` |
| 401 | 인증 토큰이 없거나 유효하지 않은 경우 | 공통 인증 오류 메시지 |
| 404 | 대상 영토가 없는 경우 | `영토를 찾을 수 없습니다.` |
| 404 | 현재 사용자의 러닝 로그가 아닌 경우 또는 러닝 로그가 없는 경우 | `러닝 기록을 찾을 수 없습니다.` |
| 404 | 현재 사용자의 보유 캐릭터가 아닌 경우 또는 캐릭터가 없는 경우 | `보유 캐릭터를 찾을 수 없습니다.` |

> `neutralAreaSqm`은 대상 점령 영토 밖의 새 면적 처리 정책이 별도 구현되기 전까지 `0`으로 반환한다.

#### 침략 계산 기준

```ts
const attackPower =
  attackerCharacter.character.base_attack + (attackerCharacter.attack_lv - 1) * 5;
const defensePower = deployedDefenders.reduce(
  (sum, defender) => sum + defender.character.base_defense + (defender.defense_lv - 1) * 5,
  0,
);
const defenseWithRate = defensePower * (territory.occupation_rate / 100);
const damage = Math.max(0, attackPower - defenseWithRate);
const contestedPolygon = intersect(runningPolygon, territoryPolygon);
const rateDamage = Math.floor(damage);
const occupationRateAfter = Math.max(0, territory.occupation_rate - rateDamage);
const success = contestedPolygon !== null && rateDamage > 0;
const acquiredAreaSqm = success ? area(contestedPolygon) : 0;
const defenderPolygonAfter = success
  ? difference(territoryPolygon, contestedPolygon)
  : territoryPolygon;
const attackerPolygonAfter = success
  ? union(attackerTerritoryPolygon, contestedPolygon)
  : attackerTerritoryPolygon;
```

- 방어 캐릭터는 대상 영토에 배치된 수비형 캐릭터를 사용한다.
- 배치 기준은 `user_characters.deployed_territory_id = territory.id`다.
- 공격/방어 기본 스탯은 `UserCharacter`의 `character` relation을 통해 `characters.base_attack`, `characters.base_defense`에서 조회한다.
- 최종 구현에서는 `turf.intersect`로 겹친 영역을 산출하고, 침략 성공 시 해당 겹침 폴리곤을 방어자 영토에서 제거한 뒤 공격자 영토에 병합한다.
- 방어자 영토는 `turf.difference`, 공격자 영토는 `turf.union` 결과 기준으로 `coordinates`, `area_sqm`, `center_lat`, `center_lng`를 갱신한다.
- 방어자 영토 면적이 0이 되면 해당 영토는 삭제한다.
- `difference()` 결과가 `MultiPolygon`이면 임시 정책으로 가장 큰 조각만 보존하고 나머지는 삭제한다.
- 점령률은 방어력 보정, 시간당 포인트 수입, 자연 감소, 랭킹 필터에 사용하며 폴리곤 이전 면적 계산에는 사용하지 않는다.
- 획득 면적은 `area(contestedPolygon)` 기준으로 계산한다.
- 점령률 감소만 저장하고 폴리곤을 갱신하지 않으면 지도에서 침략 결과가 보이지 않으므로 최종 구현 기준으로 보지 않는다.
- 속도 스탯은 사용하지 않는다.
- 포인트 효율 스탯은 침략 공식에 사용하지 않고, 버프형 캐릭터가 배치된 영토의 시간당 포인트 수익 증가에 사용한다.
- 침략 결과는 `attack_logs`에 저장한다.
- 침략 성공/실패와 관계없이 침략 로그가 저장되면 해당 사용자에게 5분 쿨타임이 적용된다.
- 새로 생성된 영토는 생성 시각 기준 5분 동안 `protected_until`이 설정되어 침략 대상에서 보호된다.

### 영토 자연 감소 구현 기준

영토 자연 감소 스케줄러는 매일 UTC 00:00(KST 09:00)에 실행되며, `last_active_at` 기준 비활동 기간에 따라 점령률을 단계적으로 낮춘다.

| 비활동 기간 | 적용 점령률 |
|---|---:|
| 4일 이상 8일 미만 | 75% |
| 8일 이상 15일 미만 | 50% |
| 15일 이상 22일 미만 | 25% |
| 22일 이상 | 0% |

- 자연 감소는 `area_sqm > 0`인 영토 중 현재 점령률이 목표 점령률보다 높은 영토에만 적용한다.
- 22일 이상 비활동 영토는 `occupationRate = 0`으로 중립화된다.
- 자연 감소 업데이트는 `last_active_at`을 변경하지 않는다.
- 직접 러닝으로 영토 활동 조건을 충족한 경우에는 `last_active_at` 갱신을 우선 완화 방식으로 사용한다.
- 영토 활동 조건은 러닝 경로와 해당 영토의 겹침 비율 등을 기준으로 후속 구현에서 확정한다.
- 수비형 캐릭터는 후속 구현에서 자연 감소 완화에 사용할 수 있으며, 방어 스탯을 기준으로 자연 감소 기준일 연장 또는 감소폭 완화를 적용한다.
- 버프형 캐릭터는 자연 감소 계산에 사용하지 않고, 시간당 포인트 수익 증가에만 사용한다.

#### 겹치는 영토 포인트 패널티 검토 항목

핵심 침략 로직 구현 이후, 서로 다른 영토가 크게 겹친 상태를 방치하지 않도록 포인트 수익 패널티를 추가할 수 있다.

- 두 영토 중 더 큰 영토 면적 대비 겹침 영역이 30% 이상이면 겹침 영역의 포인트 수익을 절반으로 줄인다.
- 작은 영토가 큰 영토 안에 일부 포함되는 정도는 큰 영토 기준 30%를 넘지 않으면 패널티를 적용하지 않는다.
- 영토 생성, 침략, 삭제 시 겹침 관계를 `territory_overlaps` 캐시 테이블에 저장하고, 시간당 수익 스케줄러는 캐시 테이블을 JOIN해 계산한다.
- 이 항목은 침략 폴리곤 이전 핵심 로직 완성 후 적용 여부를 결정한다.

---

## 5. 캐릭터 / 가챠 API

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/gacha/draw` | O | 포인트를 사용해 캐릭터 뽑기 수행 |
| GET | `/characters/me` | O | 현재 사용자의 보유 캐릭터 목록 조회 |
| PATCH | `/characters/:id/upgrade` | O | 캐릭터 스탯 강화 처리 |
| PATCH | `/characters/:id/deploy` | O | 수비형/버프형 캐릭터를 사용자 영토에 배치 또는 회수 |
| POST | `/characters/dismantle` | O | 보유 캐릭터 분해 및 스탯 포인트 획득 |

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

### GET `/characters/me`

현재 사용자가 보유한 캐릭터 목록을 조회한다.

캐릭터 스탯은 공격, 방어, 포인트 효율 3종을 사용한다. 속도 스탯은 사용하지 않는다.

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| characterId | number | 캐릭터 원본 ID |
| name | string | 캐릭터 이름 |
| grade | string | 캐릭터 등급 |
| type | string | 캐릭터 타입. `attack`, `defense`, `buff` |
| basePointRate | number | 기본 포인트 수익 배율. 버프형 캐릭터에서만 수익 계산에 사용하며, 공격형/수비형에서는 계산에 사용하지 않음 |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| pointLv | number | 포인트 효율 레벨 |
| isDeployed | boolean | 배치 여부 |
| deployedTerritoryId | number \| null | 배치된 영토 ID. `null`이면 미배치 |
| level | number | 캐릭터 전체 레벨 |
| experience | number | 현재 경험치 |
| nextLevelExperience | number \| null | 다음 레벨 필요 경험치. 최대 레벨이면 `null` |
| imageUrl | string \| null | 캐릭터 이미지 URL |

캐릭터 최대 보유 개수는 30개다. 보유 페이지의 등급별/능력 타입별 정렬은 클라이언트에서 이 응답을 기준으로 처리한다.

캐릭터 상세 화면에서는 공격/방어/포인트 효율 스탯 레벨, 캐릭터 전체 레벨, 경험치, 이미지를 표시한다.

#### 캐릭터 성장 공식

- 대표 캐릭터 경험치는 러닝 거리(`distanceKm`)가 0보다 클 때 `Math.max(1, Math.floor(distanceKm * 20))`만큼 지급한다.
- 다음 레벨 필요 경험치는 `100 + (현재 레벨 - 1) * 50`이다.
- 캐릭터 최대 레벨은 common 10, rare 15, epic 20, legendary 30을 사용한다. 현재 스탯 레벨 상한도 동일한 등급별 수치를 사용한다.
- 캐릭터 레벨업 시 타입별 주 스탯이 1 증가한다.
  - 공격형: `attackLv + 1`
  - 수비형: `defenseLv + 1`
  - 버프형: `pointLv + 1`
  - 주 스탯은 등급별 최대 레벨을 초과하지 않는다.

### PATCH `/characters/:id/upgrade`

보유 캐릭터의 특정 스탯을 강화한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| stat | string | O | 강화할 스탯. `attack`, `defense`, `point` |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 유저 캐릭터 ID |
| upgradedStat | string | 강화된 스탯 |
| newLevel | number | 강화 후 레벨 |
| remainingStatPoints | number | 강화 후 남은 스탯 포인트 |

### PATCH `/characters/:id/deploy`

보유 캐릭터를 사용자의 영토에 배치하거나 배치를 해제한다.

수비형/버프형 캐릭터만 배치할 수 있으며, 배치 여부는 `user_characters.deployed_territory_id` 값으로 판단한다.

앱의 배치 후보 목록은 캐릭터 이미지, 등급, 타입, 방어/포인트 효율 스탯을 표시한다. 최근/등급/타입 정렬을 제공하며, 타입 정렬 시 수비형/버프형 필터를 제공한다. 공격형 캐릭터는 배치 후보에서 제외한다.

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
| basePointRate | number | 기본 포인트 수익 배율. 버프형 캐릭터에서만 수익 계산에 사용하며, 공격형/수비형에서는 계산에 사용하지 않음 |
| attackLv | number | 공격 레벨 |
| defenseLv | number | 방어 레벨 |
| pointLv | number | 포인트 효율 레벨 |
| isDeployed | boolean | 배치 여부 |
| deployedTerritoryId | number \| null | 배치된 영토 ID |
| level | number | 캐릭터 전체 레벨 |
| experience | number | 현재 경험치 |
| nextLevelExperience | number \| null | 다음 레벨 필요 경험치. 최대 레벨이면 `null` |
| imageUrl | string \| null | 캐릭터 이미지 URL |

#### 예외

- 공격형 캐릭터 배치 요청 시 400
- 이미 다른 캐릭터가 배치된 영토에 중복 배치 요청 시 400
- 보유하지 않은 캐릭터 배치 요청 시 404
- 사용자가 소유하지 않은 영토 배치 요청 시 404
- 수비형 캐릭터는 영토 방어 계산에 사용한다.
- 버프형 캐릭터는 영토의 시간당 포인트 수익 증가에 사용한다.
- 버프형 캐릭터가 배치된 영토의 수익 배율은 `Math.min(base_point_rate + (pointLv - 1) * 0.05, 2.0)`이다.
- 수비형 캐릭터 또는 미배치 영토는 수익 배율 `1.0`을 사용한다.
- 시간당 사용자 포인트 수익은 `Math.floor(SUM((area_sqm * occupation_rate / 100 / 1000) * territoryMultiplier))`로 집계한다.
- 앱의 내 영토 관리와 내 영토 상세 화면은 영토별 `Math.floor((areaSqm * occupationRate / 100 / 1000) * territoryMultiplier)` 기준의 시간당 예상 수익을 표시한다.

#### 현재 구현 기준

- 가챠 비용: 1회 100 포인트, 10회 900 포인트
- 가챠 확률: common 60%, rare 30%, epic 9%, legendary 1%
- 천장 보장 시스템은 사용하지 않는다.
- 강화 비용: 스탯 포인트 1개
- 위 수치는 현재 구현 기준이며, 밸런스 검토 후 조정될 수 있다.

### POST `/characters/dismantle`

선택한 보유 캐릭터를 분해하고 등급에 따른 스탯 포인트를 획득한다.

캐릭터 보유 페이지의 분해 모드에서 사용자가 원하는 캐릭터들을 선택한 뒤 호출한다.

한 번에 분해할 수 있는 캐릭터 수는 최대 29개로 제한한다.

분해 후에도 사용자는 최소 1개 이상의 캐릭터를 보유해야 한다.

분해로 획득한 스탯 포인트는 `users.stat_points`에 누적 저장한다.

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| userCharacterIds | number[] | O | 분해할 유저 캐릭터 ID 목록 |

#### Response

| 필드 | 타입 | 설명 |
|---|---|---|
| dismantledCount | number | 분해된 캐릭터 수 |
| earnedStatPoints | number | 획득한 스탯 포인트 총합 |
| statPoints | number | 분해 후 사용자의 보유 스탯 포인트 |
| remainingCharacterCount | number | 분해 후 보유 캐릭터 수 |

#### 분해 보상 기준

| 등급 | 획득 스탯 포인트 |
|---|---:|
| common | 1 |
| rare | 2 |
| epic | 3 |
| legendary | 4 |

#### 예외

- 보유하지 않은 캐릭터 분해 요청 시 404
- 배치 중인 캐릭터 분해 요청 시 400
- 빈 목록으로 요청 시 400
- 한 번에 29개를 초과해 분해 요청 시 400
- 분해 후 보유 캐릭터가 0개가 되는 요청 시 400

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
| rankings | AreaRankEntry[] | 전체 면적 랭킹 목록 |
| myRank | AreaRankEntry \| null | 내 면적 순위. 비로그인 또는 기록이 없으면 `null` |

#### AreaRankEntry

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
| rankings | DistanceRankEntry[] | 전체 거리 랭킹 목록 |
| myRank | DistanceRankEntry \| null | 내 거리 순위. 비로그인 또는 기록이 없으면 `null` |

#### DistanceRankEntry

| 필드 | 타입 | 설명 |
|---|---|---|
| rank | number | 순위 |
| userId | number | 사용자 ID |
| nickname | string | 사용자 닉네임 |
| totalDistanceKm | number | 누적 러닝 거리 |

---

## 7. 앱 연동 전 결정 필요 항목

1. `/running/start` API 필요 여부
2. 수비형 캐릭터의 자연 감소 완화 세부 공식과 수치, 응답 필드 필요 여부
3. 직접 러닝으로 `last_active_at`을 갱신하기 위한 영토 활동 조건과 추가 점령률 회복/완화 필요 여부
4. 공통 에러 메시지 세부 코드 정의
5. `difference()` 결과가 `MultiPolygon`일 때의 장기 처리 방식
6. 겹치는 영토 포인트 수입 패널티 적용 여부와 `territory_overlaps` 캐시 테이블 도입 여부
7. `GET /territories/:id` 상세 응답의 보유자/배치 캐릭터 JOIN 최적화 방식
8. 캐릭터 분해로 획득한 스탯 포인트 사용처
