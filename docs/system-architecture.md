# RUN TERRITORY 시스템 아키텍처 설계

## 1. 전체 시스템 구조

React Native 앱이 NestJS 서버에 REST API 요청을 보내고,
서버는 MySQL DB와 연동하여 데이터를 저장/조회한다.

Firebase Auth는 사용자 인증을 담당하며,
Socket.io는 실시간 이벤트 전송에 사용된다.

turf.js는 GPS 좌표 기반 면적 계산에 사용된다.

---

## 2. 시스템 구성 요소

### 2.1 React Native App
역할:
- 로그인/회원가입 화면
- 메인 지도 화면
- 러닝 화면
- 캐릭터 화면
- 랭킹 화면
- GPS 위치 추적
- API 요청 처리

기술:
- React Native
- Expo
- react-native-maps

담당:
- 팀원 B 주담당
- 팀원 A 일부 연동 보조

---

### 2.2 NestJS Server
역할:
- REST API 제공
- Firebase 인증 검증
- 러닝 기록 저장
- 영토 계산 처리
- 가챠 및 강화 로직 처리
- 랭킹 데이터 제공

기술:
- NestJS
- TypeScript
- TypeORM

담당:
- 팀원 A
- 팀원 C

---

### 2.3 MySQL Database
역할:
- 사용자 정보 저장
- 영토 데이터 저장
- 캐릭터 데이터 저장
- 러닝 로그 저장
- 랭킹 데이터 관리

주요 테이블:
- users
- territories
- characters
- user_characters
- running_log
- gacha_log

담당:
- 팀원 C 주담당

---

### 2.4 Firebase Auth
역할:
- 회원가입
- 로그인
- 사용자 인증
- Firebase ID Token 발급

담당:
- 팀원 A 주담당

---

### 2.5 turf.js
역할:
- GPS 좌표 기반 폐곡선 면적 계산
- 영토 면적 계산

담당:
- 팀원 C 주담당

---

### 2.6 Socket.io
역할:
- 실시간 지도 업데이트
- 근처 유저 침략 알림

담당:
- 팀원 C 주담당

---

## 3. 데이터 흐름

사용자 로그인
↓
Firebase Auth 인증
↓
Firebase ID Token 발급
↓
앱 → 서버 API 요청
↓
서버에서 Firebase 토큰 검증
↓
MySQL 조회/저장
↓
API 응답 반환

---

## 4. 러닝 처리 흐름

사용자 러닝 시작
↓
GPS 좌표 수집
↓
러닝 종료
↓
서버에 경로 전송
↓
turf.js 면적 계산
↓
포인트 계산
↓
territories 및 running_log 저장
↓
결과 반환