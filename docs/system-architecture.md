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
- Socket.io: 실시간 위치 공유, 랭킹/영토 변경 이벤트 전송

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
- 현재 프로젝트는 React Native CLI 기반이다.
- GPS 수집은 러닝 화면 포그라운드 실행과 백그라운드 전환 상황을 모두 고려한다.
- 백그라운드 GPS는 `react-native-background-actions` 기반으로 처리한다.
- `expo-location` 기반 백그라운드 GPS는 사용하지 않는다.

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
- 영토 시간당 포인트 수익 지급
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
- 사용자 보유 캐릭터의 영토별 배치 정보 저장
- 침략 기록 저장

주요 테이블:

| 테이블 | 설명 |
|---|---|
| users | 사용자 정보 |
| territories | 영토 정보 |
| characters | 캐릭터 원본 데이터 |
| user_characters | 사용자 보유 캐릭터 |
| running_log | 러닝 기록 |
| gacha_log | 가챠 기록 |
| attack_logs | 영토 침략 기록 |

캐릭터 배치는 별도 테이블을 만들지 않고 `user_characters.deployed_territory_id`로 저장한다. `deployed_territory_id`가 `NULL`이면 미배치, 값이 있으면 해당 영토에 배치된 상태로 판단한다.

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

- 서버는 `SocketModule`과 `EventsGateway`를 통해 위치 브로드캐스트, 랭킹 갱신, 영토 갱신 이벤트를 전송한다.
- 모바일은 로그인 후 소켓에 연결하고, 영토 변경 이벤트 수신 시 현재 지도 범위의 영토 목록을 재조회한다.

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
8. 신규 사용자라면 common 등급 공격형/수비형/버프형 캐릭터 중 1개를 랜덤 지급
9. 서버가 accessToken과 사용자 정보를 응답
```

### 3.2 러닝 종료 흐름

```text
1. 앱이 GPS 좌표를 수집
2. 사용자가 러닝 종료
3. 앱이 POST /running/finish 호출
4. 서버가 path, started_at을 기준으로 러닝 기록 검증
   - distance_km은 앱 참고값으로만 취급하며 서버 검증/저장 기준으로 사용하지 않음
5. 서버가 path 기반 이동 거리와 러닝 시간으로 평균 속도/페이스 계산
6. 서버가 turf.js로 면적 계산
7. 서버가 시작점-종료점 50m 이내 여부 확인
8. 서버가 포인트 계산
9. 서버가 running_log 저장
10. 폐곡선이면 territories 저장
11. 이후 시간당 포인트 수익 배치에서 영토 면적과 점령률을 기준으로 포인트 지급
12. 서버가 대표 캐릭터에 경험치 지급
13. 서버가 소량의 가챠 재화 또는 포인트 지급
14. 서버가 러닝 결과 응답
```

### 3.3 포인트 계산 흐름

```text
path + started_at -> distanceKm/serverAvgSpeed/serverAvgPace -> paceMultiplier/distanceMultiplier -> earnedPoints
```

공식:

```ts
const basePoints = Math.floor(distanceKm * 100 * paceMultiplier * distanceMultiplier);
const earnedPoints = isClosedLoop ? basePoints : Math.floor(basePoints * 1.3);
```

- `distanceKm`는 서버가 `path` 좌표로 계산한다.
- `distanceMultiplier`는 장거리 러닝 보정값이며 현재 구현 기준 `Math.min(1.1 ** distanceKm, 3.0)`을 사용한다.
- 폐곡선이 아닌 러닝은 영토를 생성하지 않고 즉시 보상에 1.3배를 적용한다.
- 폐곡선으로 생성된 영토는 매시간 포인트 수익을 만든다.
- 시간당 수익은 사용자별로 `Math.floor(SUM((area_sqm * occupation_rate / 100 / 1000) * territoryMultiplier))`를 지급한다.
- `territoryMultiplier`는 버프형 캐릭터가 배치된 영토만 `Math.min(base_point_rate + (point_lv - 1) * 0.05, 2.0)`을 사용한다.
- 수비형 캐릭터 또는 미배치 영토는 `territoryMultiplier = 1.0`을 사용한다.
- 앱은 내 영토 관리와 홈 지도 영토 상세에서 영토별 시간당 예상 수익, 기준 수익, 버프 배율을 표시한다.

### 3.4 가챠 흐름

```text
1. 앱이 POST /gacha/draw 호출
2. 서버가 사용자 포인트 확인
3. 서버가 뽑기 횟수와 포인트를 확인
4. 서버가 캐릭터 결과 생성
5. 서버가 user_characters 및 gacha_log 저장
6. 서버가 results와 remainingPoints 응답
```

현재 구현 기준:

- 가챠 비용은 1회 100 포인트, 10회 900 포인트다.
- 가챠 확률은 common 60%, rare 30%, epic 9%, legendary 1%다.
- 천장 보장 시스템은 사용하지 않는다.
- 캐릭터 강화 비용은 스탯 포인트 1개를 사용한다.

### 3.5 캐릭터 배치 흐름

```text
1. 앱이 GET /characters/me로 보유 캐릭터 목록 조회
2. 사용자가 수비형 또는 버프형 캐릭터를 선택
3. 사용자가 홈 지도에서 내 영토를 선택하거나 메뉴의 내 영토 관리 화면에서 배치할 영토를 선택
4. 필요 시 앱이 GET /territories/me로 사용자 보유 영토 목록 조회
5. 앱이 PATCH /characters/:id/deploy 호출
6. 서버가 캐릭터 소유자와 영토 소유자가 같은지 검증
7. 서버가 해당 영토에 이미 배치된 캐릭터가 없는지 검증
8. 서버가 `user_characters.deployed_territory_id`를 저장
9. 이후 침략 방어 또는 시간당 포인트 수익 계산에서 배치 효과를 참조
```

배치 기준:

- 배치 요청 본문은 `{ territory_id: number | null }`을 사용한다.
- `territory_id`가 `null`이면 배치 해제다.
- 배치 가능 캐릭터 타입은 수비형/버프형이다.
- 하나의 영토에는 하나의 수비형/버프형 캐릭터만 배치할 수 있다.
- 배치 여부는 `deployed_territory_id IS NOT NULL`로 파생한다.
- 수비형 캐릭터는 침략 방어력 계산에 사용한다.
- 버프형 캐릭터는 영토의 시간당 포인트 수익 증가 효과로 다룬다.
- 버프형 배율은 `Math.min(base_point_rate + (point_lv - 1) * 0.05, 2.0)`이며, 공격/방어 강화 스탯과는 분리한다.
- 자연 감소 완화는 수비형 캐릭터만 대상으로 한다. 버프형 캐릭터는 시간당 포인트 수익 전용으로 유지한다.

### 3.6 캐릭터 분해 흐름

```text
1. 앱이 GET /characters/me로 보유 캐릭터 목록 조회
2. 사용자가 캐릭터 보유 페이지에서 분해 모드 진입
3. 사용자가 분해할 캐릭터를 하나 이상 선택
4. 앱이 캐릭터 분해 API 호출
5. 서버가 보유 여부, 배치 여부, 분해 가능 여부를 검증
6. 서버가 선택한 캐릭터를 제거하고 등급 기준 스탯 포인트를 지급
7. 서버가 갱신된 보유 캐릭터 목록 또는 획득 스탯 포인트 결과를 응답
```

분해 보상 기준:

| 등급 | 획득 스탯 포인트 |
|---|---:|
| common | 1 |
| rare | 2 |
| epic | 3 |
| legendary | 4 |

캐릭터 최대 보유 개수는 30개이며, 보유 페이지에서는 등급별/능력 타입별 정렬과 캐릭터 상세 화면 진입을 제공한다.

분해는 한 번에 최대 29개까지 가능하며, 분해 후에도 최소 1개의 캐릭터는 보유해야 한다. 분해로 획득한 스탯 포인트는 `users.stat_points`에 누적 저장한다.

### 3.7 영토 침략 흐름

```text
1. 사용자가 다른 사용자의 점령 영토 근처 또는 내부를 러닝
2. 앱이 POST /running/finish로 러닝 로그 저장
3. 앱이 공격 대상 영토와 사용할 공격형 캐릭터를 선택
4. 앱이 POST /territories/:id/attack 호출
5. 서버가 runningLogId 소유자, 공격형 사용자 캐릭터, 하루 제한을 검증
6. 서버가 대상 영토와 러닝 로그 경로의 겹친 면적을 계산
7. 겹친 면적이 대상 영토의 30% 이상인지 검증
8. 서버가 공격 캐릭터 공격력과 대상 영토 배치 수비형 캐릭터 방어력을 계산
9. 서버가 `occupation_rate` 기준 보정 방어력을 적용해 침략 성공 여부와 점령률 감소 참고값을 계산
10. 침략 성공 시 서버가 러닝 경로와 대상 영토의 실제 겹침 폴리곤을 계산
11. 서버가 `difference(방어자 영토, 겹침 폴리곤)`로 방어자 영토를 갱신
12. 서버가 `union(공격자 기존 영토, 겹침 폴리곤)`으로 공격자 영토에 병합
13. 서버가 방어자/공격자 영토의 `coordinates`, `area_sqm`, `center_lat`, `center_lng`를 재계산
14. 방어자 영토 면적이 0이면 해당 영토를 삭제
15. 서버가 침략 결과를 `attack_logs`에 저장
16. 대상 영토 밖의 새 면적은 일반 러닝 영토 생성 규칙에 따라 처리
17. 서버가 침략 결과, 다음 가능 시각, 남은 횟수를 응답
```

침략 계산 기준:

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

최종 침략 구현은 점령률 수치만 변경하지 않고 공격자가 획득한 겹침 폴리곤을 영토 데이터로 반영해야 한다. 점령률만 감소하면 지도에서 영토 변화가 보이지 않아 회의에서 결정한 침략 체감 방식과 맞지 않는다.

침략 성공 시 방어자 영토는 `difference()` 결과로 실제 겹침 폴리곤을 제외한 형태가 되며, 공격자 영토는 획득한 겹침 폴리곤을 기존 공격자 영토와 `union()` 해 병합한다. 획득 폴리곤은 공격자 기존 영토와 인접한 것으로 간주하므로 별도 새 영토 생성 분기는 두지 않는다.

방어자 영토의 차집합 결과가 `MultiPolygon`이면 임시 정책으로 가장 큰 조각만 보존하고 나머지는 삭제해 단일 폴리곤 구조를 유지한다. 장기적으로 여러 조각 보존이 필요하면 DB/API/지도 렌더링 구조를 함께 확장한다.

점령률은 폴리곤 크기를 직접 의미하지 않는다. 점령률은 침략 시 방어력 보정, 시간당 포인트 수입, 자연 감소, 랭킹 필터에 사용하며, 침략으로 빼앗은 면적은 `area(contestedPolygon)` 기준으로 계산한다. 자연 감소는 점령률만 낮추고 폴리곤 형태를 바꾸지 않는다.

하루 침략 제한은 5회이며 `attack_logs`의 공격자/날짜 기준 카운트로 계산한다. 침략 로그가 저장되면 성공/실패와 관계없이 해당 사용자에게 5분 쿨타임이 적용된다. 응답의 `nextAttackAvailableAt`은 저장된 침략 로그의 `created_at` 기준 다음 침략 가능 시각을 반환한다. 새로 생성된 영토는 `protected_until`에 생성 시각 기준 5분 뒤 시각을 저장해 보호 시간 동안 침략을 거부한다.

자연 감소 스케줄러는 매일 UTC 00:00(KST 09:00)에 실행되며 `last_active_at` 기준 비활동 기간에 따라 점령률을 단계적으로 낮춘다. 4일 이상 비활동 영토는 75%, 8일 이상은 50%, 15일 이상은 25%, 22일 이상은 0%로 갱신한다. 0%가 된 영토는 DB 레코드를 보존하되 지도/목록/랭킹/침략 대상 조회에서는 `area_sqm > 0`과 `occupation_rate > 0` 조건으로 제외한다. 자연 감소 업데이트는 `last_active_at`을 변경하지 않는다.

직접 러닝으로 영토 활동 조건을 충족한 경우에는 해당 영토의 `last_active_at` 갱신을 우선 완화 방식으로 사용한다. 영토 활동 조건은 러닝 경로와 해당 영토의 겹침 비율 등을 기준으로 후속 구현에서 확정한다. 후속 자연 감소 완화는 영토에 배치된 수비형 캐릭터의 방어 스탯을 기준으로 적용하며, 버프형 캐릭터의 포인트 효율 스탯은 시간당 포인트 수익에만 사용해 역할을 분리한다.

핵심 침략 폴리곤 이전 로직이 완성된 뒤에는 겹치는 영토 수입 패널티를 검토할 수 있다. 두 영토 중 큰 쪽 면적 대비 겹침이 30% 이상이면 겹침 영역의 포인트 수입을 절반으로 줄이고, 영토 생성/침략/삭제 시 `territory_overlaps` 캐시 테이블을 갱신해 시간당 수익 스케줄러가 매시간 turf 연산을 반복하지 않도록 한다.

### 3.8 영토 조회 및 관리 흐름

```text
1. 앱이 지도 바운딩 박스 기준으로 GET /territories 호출
2. 지도는 경량 목록 응답으로 영토 polygon, 면적, 소유자 ID, 보유자 이름 등 기본 정보를 표시
3. 사용자가 점령된 영토를 선택
4. 앱이 영토 상세 화면을 열고 필요 시 GET /territories/:id 호출
5. 상세 화면은 보유자 이름, 배치 캐릭터 스탯 등 상세 정보를 표시
6. 현재 사용자의 영토라면 이름 수정과 캐릭터 배치/회수 진입을 제공
```

지도 화면은 영토 목록의 소유자 식별값으로 내 영토와 다른 사용자 영토의 색상 및 클릭 분기를 처리한다. 목록/상세 응답 필드 기준은 `api-spec.md`의 영토 API 명세를 따른다.

메뉴의 내 영토 관리 화면은 `GET /territories/me`를 사용해 현재 사용자의 보유 영토 목록을 조회하고, 지도 표시와 영토 이름 수정/삭제, 캐릭터 배치/회수 흐름으로 연결한다. 화면에는 영토 개수, 총 면적, 각 영토의 면적, 점령률, 최근 활동 시간을 표시한다.

캐릭터 배치 후보 목록은 수비형/버프형 캐릭터만 포함한다. 앱은 후보 캐릭터의 이미지, 등급, 타입, 방어/포인트 효율 스탯을 표시하고 최근/등급/타입 정렬과 수비형/버프형 필터를 제공한다.

---

## 4. 앱 연동 전 주의사항

- 모바일과 서버는 GPS 좌표 타입을 `{ lat, lng }`로 통일한다.
- 평균 페이스 단위는 `분/km`로 통일한다.
- 영토 폐곡선 기준은 시작점-종료점 50m 이내로 통일한다.
- 침략 가능 기준은 대상 영토 면적의 30% 이상을 직접 러닝으로 겹쳐야 한다.
- 침략 성공 시 방어자 영토는 겹침 폴리곤을 제외한 차집합 결과로 갱신하고, 공격자 영토는 겹침 폴리곤을 기존 영토와 병합한다.
- `difference()` 결과가 `MultiPolygon`이면 현재 문서 기준 가장 큰 조각만 보존하는 임시 정책을 사용한다.
- 모바일 침략 결과 지도 반영은 소켓 `territory:update` 이벤트와 완료 콜백의 현재 지도 범위 재조회로 처리한다.
- 자연 감소 캐릭터 연동은 수비형 캐릭터만 대상으로 하며, 버프형 캐릭터는 시간당 포인트 수익 전용으로 유지한다.
- 영토 점령률은 시간이 지나면 반드시 감소한다. 직접 러닝으로 영토 활동 조건을 충족하면 `last_active_at` 갱신을 기본 완화 방식으로 사용하고, 영토 활동 조건과 추가 점령률 회복/완화 공식은 별도 구현에서 결정한다.
- 캐릭터 강화 스탯은 공격, 방어, 포인트 효율 3종을 사용한다. 속도 스탯은 사용하지 않는다.
- 버프형 캐릭터의 시간당 포인트 수익 증가는 `Math.min(base_point_rate + (point_lv - 1) * 0.05, 2.0)`으로 계산한다.
- 장시간 연속 러닝은 보상 보정이 증가할 수 있으며, 짧게 끊어 달리는 보상 악용을 줄이는 방향으로 공식 확정이 필요하다.
- `.env`, Firebase Admin 서비스 키, API Key는 저장소에 포함하지 않는다.
- Firebase ID Token은 `/auth/login`에서만 사용하고, 이후 보호 API는 서버 JWT를 사용한다.
