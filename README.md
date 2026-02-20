# Moneycat

커플 2인 전용 공유 가계부 PWA입니다.

- 아이폰 Safari에서 빠르게 입력
- PC 브라우저에서 월별 조회/예산/통계 확인
- 자체 서버(NAS/VPS) 운영 전제

## Tech Stack

- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- JWT (HTTP-only cookie) 인증
- Docker Compose + Caddy
- Vitest, ESLint, GitHub Actions CI

## 주요 기능 (현재 구현)

- 이메일/비밀번호 회원가입, 로그인, 로그아웃
- household 생성/초대코드 발급/초대 참여 (2인 제한)
- 거래 CRUD + 월별 집계
- 월별 카테고리 예산 설정
- 월간 통계(수입/지출/잔액, 카테고리 비중, 예산 사용률)
- PWA manifest + service worker 기반 조회 캐시
- 오프라인 입력 재시도 큐(거래 등록 실패 시 로컬 보관 후 온라인 복귀 시 재전송)

## 빠른 시작 (로컬 개발)

1. 환경변수

```bash
cp .env.example .env
```

2. PostgreSQL 실행 (예: Docker)

```bash
docker run --name moneycat-db \
  -e POSTGRES_DB=moneycat \
  -e POSTGRES_USER=moneycat \
  -e POSTGRES_PASSWORD=moneycat_local_password \
  -p 5432:5432 -d postgres:16-alpine
```

3. 의존성 설치 및 Prisma 준비

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
```

4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## Docker Compose 배포 (NAS/Home Server)

1. `.env` 작성 (`AUTH_SECRET`, `POSTGRES_PASSWORD`, `DOMAIN` 포함)
2. 서비스 실행:

```bash
docker compose up -d --build
```

기본 구성:
- `db` (PostgreSQL)
- `web` (Next.js standalone)
- `caddy` (리버스 프록시 + TLS)

## DB 마이그레이션

- 스키마: `prisma/schema.prisma`
- 초기 마이그레이션: `prisma/migrations/0001_init/migration.sql`

적용:

```bash
npx prisma migrate deploy
```

## 테스트 / 품질

```bash
npm run lint
npm run test:run
npm run build
```

CI는 `.github/workflows/ci.yml`에서 동일 순서로 검증합니다.

## API 개요

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET|POST /api/households`
- `POST /api/households/[id]/invite`
- `POST /api/households/join`
- `GET|POST /api/transactions`
- `PATCH|DELETE /api/transactions/[id]`
- `GET /api/categories`
- `GET /api/budgets`
- `PUT /api/budgets/[categoryId]?month=YYYY-MM`
- `GET /api/stats/monthly?month=YYYY-MM`
- `GET /api/stats/trend?from=YYYY-MM&to=YYYY-MM`
