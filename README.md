# Fitness App Monorepo

Fitness tracking app with Android-ready Expo mobile UI, local persistence, and API sync.

## Apps

- `apps/mobile`: Expo React Native app
- `apps/api`: Node.js + TypeScript API
- `packages/shared`: shared types for app and API
- `infra`: local Postgres and SQL bootstrap files

## Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (optional, for local Postgres)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run API:

```bash
npm run dev:api
```

3. Start mobile dev server:

```bash
npm run dev:mobile
```

4. Launch Android:

```bash
npm run android
```

5. (Optional) Start local Postgres:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## Mobile Features

- Onboarding with profile + goal setup
- Dashboard with streak, weekly volume, calories, and dynamic plan
- Workout logger with offline-first save + API sync status
- Nutrition tracker with calories/macros/water and target progress
- Progress tracker for weight/body-fat/waist history

## Android API Note

Mobile sync uses `http://10.0.2.2:4000` on Android emulator (maps to your host machine).
Run the API before logging workouts if you want immediate sync.

## API Endpoints

- `GET /health`
- `GET /api/v1/sync/snapshot`
- `GET /api/v1/profile`
- `PUT /api/v1/profile`
- `GET /api/v1/plans/sample`
- `GET /api/v1/workouts/logs`
- `POST /api/v1/workouts/logs`
- `GET /api/v1/nutrition/logs`
- `PUT /api/v1/nutrition/logs/:date`
- `GET /api/v1/progress/entries`
- `POST /api/v1/progress/entries`

## Data Persistence

API data is persisted locally at `apps/api/data/app-data.json`.
