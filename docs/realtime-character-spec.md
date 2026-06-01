# 실시간 캐릭터 지도 표시 — 구현 명세

## 1. 기능 개요

앱에 접속한 유저의 **대표 캐릭터**가 지도 위에 실시간으로 표시된다.
다른 유저에게도 보이며, GPS 이동에 따라 캐릭터 마커가 실시간으로 움직인다.

### 동작 흐름

```
유저 앱 접속 → 소켓 연결 (JWT 인증)
  → 서버가 유저 정보 + 대표 캐릭터 로드
  → GPS 위치를 주기적으로 서버에 전송 (location:update)
  → 서버가 내 위치 반경 2km 이내 접속 유저에게 브로드캐스트 (location:broadcast)
  → 상대 지도에 내 대표 캐릭터 마커 표시 + 실시간 이동
  → 앱 종료 / 백그라운드 전환 → 소켓 끊김 → 마커 제거
```

### 영토 vs 캐릭터 마커 표시 범위

| 대상 | 표시 범위 | 방식 |
|------|-----------|------|
| 영토 폴리곤 | 현재 지도 화면 (바운딩 박스) | `GET /territories` REST API (기존 구현) |
| 접속 유저 캐릭터 | 내 GPS 위치 반경 약 2km | Socket.io 실시간 브로드캐스트 |

- 영토는 지도를 어디로 이동하든 해당 위치의 영토가 모두 보인다 (기존 구현 유지)
- 접속 유저 캐릭터는 **내 실제 위치 기준 근처 유저만** 표시한다
  - 게임 특성상 (러닝 기반, 근처 유저와 상호작용) 실제 위치 기준이 자연스러움
  - 서버 부하도 최소화됨

### 영토 위 표시

- 배치된 캐릭터가 있는 영토에는 **영토 이름**이 표시된다
- 영토를 **누르면 상세 정보** 화면이 열린다 (보유자, 배치 캐릭터 스탯 등)
- 상세 화면 구현은 `GET /territories/:id` API 사용 (이미 구현됨)

---

## 2. 필요한 DB 변경 (@Bae 담당)

### 2.1 `users` 테이블 — `representative_character_id` 추가

```sql
ALTER TABLE users
ADD COLUMN representative_character_id INT NULL,
ADD CONSTRAINT fk_users_representative
  FOREIGN KEY (representative_character_id)
  REFERENCES user_characters(id)
  ON DELETE SET NULL;
```

- nullable — 대표 미설정 허용
- `ON DELETE SET NULL` — 대표 캐릭터가 분해되면 자동 해제
- `requirements.md` 135줄에 명시: "사용자는 대표 캐릭터를 설정할 수 있어야 한다"

### 2.2 `characters` 테이블 — `image_url` 추가

```sql
ALTER TABLE characters
ADD COLUMN image_url VARCHAR(500) NULL;

-- 시드 데이터 (타입_등급 키 형식)
UPDATE characters SET image_url = CONCAT(LOWER(type), '_', LOWER(grade));
```

- `api-spec.md` 470줄에 향후 필드로 이미 명시됨: `imageUrl: string | null`
- 현재 단계에서는 앱 번들 키를 저장 (예: `attack_common`, `defense_rare`)
- 앱에서 키 → 로컬 이미지 매핑 (네트워크 불필요, 오프라인 동작)

---

## 3. 필요한 API 변경

### 3.1 대표 캐릭터 설정 API (신규)

```
PUT /users/me/representative
Authorization: Bearer {token}
```

#### Request Body

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| userCharacterId | number \| null | O | 대표로 설정할 유저 캐릭터 ID. `null`이면 해제 |

#### 처리

1. `userCharacterId`가 현재 유저 소유인지 검증
2. `users.representative_character_id` 업데이트
3. `null` 전달 시 대표 해제

#### Response

`GET /users/me`와 동일 형식 + `representativeCharacter` 포함

#### 에러

| Status | 조건 |
|--------|------|
| 400 | `userCharacterId`가 누락된 경우 |
| 404 | 해당 캐릭터를 보유하지 않은 경우 |

### 3.2 `GET /users/me` 응답 확장

기존 필드에 추가:

| 필드 | 타입 | 설명 |
|------|------|------|
| representativeCharacter | object \| null | 대표 캐릭터 정보. 미설정 시 `null` |

#### representativeCharacter 객체

| 필드 | 타입 | 설명 |
|------|------|------|
| id | number | 유저 캐릭터 ID (`user_characters.id`) |
| characterId | number | 캐릭터 원본 ID (`characters.id`) |
| name | string | 캐릭터 이름 |
| type | string | `attack` / `defense` / `buff` |
| grade | string | `common` / `rare` / `epic` / `legendary` |
| imageUrl | string \| null | 이미지 키 (예: `attack_common`) |

### 3.3 `GET /characters/me` 응답에 `imageUrl` 추가

기존 개별 캐릭터 객체에 추가:

| 필드 | 타입 | 설명 |
|------|------|------|
| imageUrl | string \| null | 캐릭터 이미지 키 |

### 3.4 캐릭터 분해 시 대표 캐릭터 처리

`POST /characters/dismantle`에서 분해 대상에 현재 대표 캐릭터가 포함되면:
- `users.representative_character_id`를 `NULL`로 리셋
- DB FK `ON DELETE SET NULL`이 처리하지만, 트랜잭션 내에서 명시적으로도 처리 권장

---

## 4. Socket.io 서버 구현 (@Bae 담당)

### 4.1 패키지 설치

```bash
cd apps/server
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

### 4.2 모듈 구조

```
apps/server/src/socket/
├── socket.module.ts          # SocketModule — UsersModule, CharactersModule import
├── events.gateway.ts         # WebSocketGateway 구현 (현재 빈 파일)
```

`AppModule`에 `SocketModule` 등록 필요 (현재 미등록 상태)

### 4.3 Gateway 구현

```ts
@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // 접속 유저 관리 (인메모리)
  // Map<socketId, { userId, nickname, lat, lng, character }>
}
```

#### 연결 / 해제

| 이벤트 | 처리 |
|--------|------|
| `handleConnection(client)` | `client.handshake.auth.token`에서 JWT 추출 → 검증 → `UsersService`로 유저 + 대표 캐릭터 조회 → Map에 저장 → 근처 유저에게 `user:online` emit |
| `handleDisconnect(client)` | Map에서 제거 → 근처 유저에게 `user:offline` emit |

인증 실패 시 `client.disconnect()` 처리

#### 이벤트 명세

```
클라이언트 → 서버
──────────────────
location:update
  { lat: number, lng: number }
  - 클라이언트가 3~5초 간격으로 전송
  - 서버가 Map의 해당 유저 위치 업데이트
  - 근처 유저(반경 2km)에게 location:broadcast 전송


서버 → 클라이언트
──────────────────
location:broadcast
  {
    userId: number,
    nickname: string,
    lat: number,
    lng: number,
    character: {
      name: string,
      type: string,       // 'attack' | 'defense' | 'buff'
      grade: string,      // 'common' | 'rare' | 'epic' | 'legendary'
      imageUrl: string | null
    } | null              // 대표 캐릭터 미설정 시 null
  }

user:online
  - location:broadcast와 동일 형식
  - 새 유저가 소켓 연결 시 근처 유저에게 전송

user:offline
  { userId: number }
  - 유저 소켓 끊김 시 근처 유저에게 전송
```

#### 근처 유저 필터링

Haversine 공식으로 두 좌표 간 거리 계산, **반경 약 2km 이내** 유저에게만 브로드캐스트.

```ts
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

전체 Map을 순회하며 2km 이내인 소켓에만 emit. 유저 수가 적은 현재 단계에서는 충분. 추후 유저 수 증가 시 geo-hashing 최적화 가능.

#### 대표 캐릭터 미설정 유저

- `representative_character_id`가 `NULL`이면 `character: null`로 브로드캐스트
- 모바일에서 기본 아바타 또는 마커 미표시로 처리 (모바일 담당이 결정)

### 4.4 Railway 배포 시 확인 사항

- Railway는 WebSocket을 기본 지원하지만, HTTP polling fallback 설정 확인 필요
- CORS 설정에 모바일 앱 origin 포함 (또는 `*`)

---

## 5. 캐릭터 이미지 에셋 (@GYU 담당)

### 5.1 파일 형식 및 규격

| 항목 | 값 |
|------|-----|
| 형식 | PNG (투명 배경) |
| 크기 | 96×96px (@2x 기본), 144×144px (@3x 고해상도) |
| 배경 | 투명 |
| 총 장수 | 타입 3종 × 등급 4종 = **12장** |

PNG를 사용하는 이유:
- `react-native-maps`의 `<Marker>`에서 PNG를 네이티브로 렌더링 → 성능 최적
- SVG는 `react-native-maps`에서 직접 지원 안 함 (변환 필요)
- Lottie는 Marker에서 사용 불가

### 5.2 파일 구조

```
apps/mobile/src/assets/characters/
├── attack_common.png
├── attack_rare.png
├── attack_epic.png
├── attack_legendary.png
├── defense_common.png
├── defense_rare.png
├── defense_epic.png
├── defense_legendary.png
├── buff_common.png
├── buff_rare.png
├── buff_epic.png
├── buff_legendary.png
```

### 5.3 이미지 키 규칙

DB `characters.image_url`에 저장되는 값: `{type}_{grade}` (소문자)

예시:
- `attack_common`
- `defense_legendary`
- `buff_rare`

모바일에서 이 키를 받아 로컬 PNG에 매핑:
```ts
const CHARACTER_IMAGES = {
  attack_common: require('../assets/characters/attack_common.png'),
  attack_rare: require('../assets/characters/attack_rare.png'),
  // ...
};
```

### 5.4 디자인 가이드

- 지도 위에 작게 표시되므로 **실루엣이 명확**해야 함
- 등급별 구분이 시각적으로 되면 좋음 (색감, 이펙트 등)
- 타입별 구분도 가능하면 좋음 (공격형/수비형/버프형)
- 기존 앱 테마 색상 참고:
  - common: `#9E9E9E` (회색)
  - rare: `#42A5F5` (파랑)
  - epic: `#AB47BC` (보라)
  - legendary: `#FFA726` (주황/금)

---

## 6. 대표 캐릭터 설정 UI (@GYU 담당)

### 6.1 위치

캐릭터 보관함 화면 (`StorageScreen.tsx`)

### 6.2 동작

1. 캐릭터 카드에 **"대표 설정"** 버튼 추가 (또는 카드 길게 누르기)
2. `PUT /users/me/representative` API 호출
3. 현재 대표 캐릭터에는 뱃지 또는 테두리 강조 표시
4. 이미 대표인 캐릭터를 다시 누르면 해제 (`userCharacterId: null`)

### 6.3 상태 관리

`authStore`에 `representativeCharacter` 상태 추가:
- 로그인 시 `GET /users/me` 응답에서 로드
- 대표 설정/해제 시 업데이트
- 로그아웃 시 초기화

---

## 7. 모바일 소켓 + 지도 마커 (@Jae 담당)

### 7.1 소켓 클라이언트

```
apps/mobile/src/services/socket.ts
```

- `socket.io-client` 패키지 이미 설치됨 (`^4.8.3`)
- 로그인 성공 시 소켓 연결, 로그아웃 시 해제
- GPS 위치 변경 시 `location:update` 전송 (3초 throttle)

### 7.2 근처 유저 상태 관리

```
apps/mobile/src/hooks/useOnlineUsers.ts
```

- `Map<userId, OnlineUser>` 관리
- `location:broadcast` 수신 → 위치 업데이트
- `user:offline` 수신 → 제거
- 30초 이상 업데이트 없는 유저 자동 제거 (타임아웃)

### 7.3 지도 마커

```
apps/mobile/src/components/CharacterMarker.tsx
```

- `react-native-maps` `<Marker>` 사용
- 캐릭터 PNG 이미지 표시
- 하단에 닉네임 라벨
- 본인 마커는 강조 표시
- 대표 캐릭터 미설정 유저는 기본 아바타 또는 미표시

### 7.4 MapScreen 수정

- `showsUserLocation` → 커스텀 마커로 대체 (본인 대표 캐릭터)
- 다른 접속 유저 마커 표시
- 영토 폴리곤 `onPress` → `GET /territories/:id` → 상세 모달

### 7.5 영토 상세 화면

영토 클릭 시 하단 시트 또는 모달:

| 표시 항목 | 출처 |
|-----------|------|
| 영토 이름 | `territories.name` (마이그레이션 후) |
| 보유자 닉네임 | `GET /territories/:id` → `owner.nickname` |
| 면적 / 점령률 | `areaSqm`, `occupationRate` |
| 배치 캐릭터 목록 | `deployedCharacters[]` — 이름, 타입, 등급, 스탯 |
| 내 영토인 경우 | 이름 수정, 캐릭터 배치/회수 버튼 |

---

## 8. 작업 분담 및 일정

### @Bae — 서버 인프라 + 소켓

| # | 작업 | 상세 |
|---|------|------|
| 1 | 마이그레이션: `users.representative_character_id` | FK → `user_characters.id`, ON DELETE SET NULL |
| 2 | 마이그레이션: `characters.image_url` | VARCHAR(500), 시드 데이터 포함 |
| 3 | 소켓 패키지 설치 | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` |
| 4 | `SocketModule` + `EventsGateway` 구현 | JWT 인증, 위치 브로드캐스트, 근처 유저 필터링 |
| 5 | `AppModule`에 `SocketModule` 등록 | `UsersModule`, `CharactersModule` 의존성 |
| 6 | Railway WebSocket 배포 확인 | CORS, sticky session |

### @GYU — 캐릭터 API + 이미지 + UI

| # | 작업 | 상세 |
|---|------|------|
| 1 | `User` entity 수정 | `representative_character_id` + relation 추가 |
| 2 | `Character` entity 수정 | `image_url` 컬럼 추가 |
| 3 | `PUT /users/me/representative` API | controller + service + DTO |
| 4 | `GET /users/me` 응답 확장 | `representativeCharacter` 객체 포함 |
| 5 | `GET /characters/me` 응답 확장 | `imageUrl` 필드 추가 |
| 6 | `dismantle()` 대표 캐릭터 처리 | 분해 시 `representative_character_id = NULL` |
| 7 | 캐릭터 PNG 에셋 12장 | 96×96px, 투명 배경, 팀 디자인 기반 |
| 8 | 대표 캐릭터 설정 UI | `StorageScreen`에 대표 설정 버튼 + 뱃지 |

### @Jae — 모바일 소켓 + 지도

| # | 작업 | 상세 |
|---|------|------|
| 1 | docs 업데이트 | `api-spec.md`, `system-architecture.md` |
| 2 | `socket.ts` 소켓 서비스 | 연결/해제/이벤트 관리 |
| 3 | `useOnlineUsers` 훅 | 근처 유저 상태 관리 |
| 4 | `CharacterMarker` 컴포넌트 | 지도 위 캐릭터 마커 |
| 5 | `useGPS.ts` 수정 | 소켓 emit 추가 (3초 throttle) |
| 6 | `App.tsx` 소켓 연결 | 로그인/로그아웃 시 연결/해제 |
| 7 | `MapScreen` 통합 | 본인/타 유저 마커 + 영토 상세 |
| 8 | `authStore` 확장 | `representativeCharacter` 상태 |

### 진행 순서

```
1단계 — 병렬 시작
  @Bae: 마이그레이션 2건 + 소켓 Gateway
  @GYU: Entity 수정 + 대표 캐릭터 API + 이미지 에셋
  @Jae: docs 업데이트 + socket.ts + useOnlineUsers + CharacterMarker 뼈대

2단계 — API 연동
  @GYU: GET /users/me 확장 + GET /characters/me 확장 + 대표 설정 UI
  @Jae: authStore 확장 + useGPS 소켓 emit + App.tsx 소켓 연결

3단계 — 통합 테스트
  @Jae: MapScreen 전체 연동 (소켓 + 마커 + 영토 상세)
  전체: 에뮬레이터 / 실기기 테스트
```

---

## 9. 결정 필요 사항

| # | 항목 | 현재 제안 | 비고 |
|---|------|-----------|------|
| 1 | 소켓 위치 전송 주기 | 3초 | 너무 짧으면 서버 부하, 너무 길면 끊겨 보임 |
| 2 | 근처 유저 범위 | 반경 2km | 게임 특성상 러닝 범위 고려 |
| 3 | 대표 미설정 시 표시 | 기본 아바타 또는 마커 미표시 | 팀 논의 필요 |
| 4 | 이미지 저장 방식 | 앱 번들 키 (`attack_common`) | 추후 CDN URL로 전환 가능 |
| 5 | 유저 타임아웃 | 30초 무응답 시 자동 제거 | 네트워크 끊김 대비 |
