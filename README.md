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

6. (Optional) switch API to Postgres storage:

```bash
$env:STORAGE_BACKEND="postgres"
$env:DATABASE_URL="postgres://fitness:fitness@localhost:5432/fitness_app"
npm run dev:api
```

## Mobile Features

- Onboarding with profile + goal setup
- Dashboard with streak, weekly volume, calories, and dynamic plan
- Workout logger with offline-first save + API sync status
- Nutrition tracker with calories/macros/water and target progress
- Progress tracker for weight/body-fat/waist history
- Account tab for editing profile/targets, pending sync visibility, manual sync, and reset
- Daily notification reminders with customizable time
- Delete actions for workouts/progress/nutrition with offline-safe sync queues

## Android API Note

Mobile sync uses `http://10.0.2.2:4000` on Android emulator (maps to your host machine).
Run the API before logging workouts if you want immediate sync.
For a physical Android device on the same Wi-Fi, set `EXPO_PUBLIC_API_BASE_URL` to your host IP, for example:

```bash
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.25:4000"
npm run dev:mobile
```

Android 13+ asks for notification permission the first time reminders are enabled.

## API Endpoints

- `GET /health`
- `GET /api/v1/sync/snapshot`
- `DELETE /api/v1/sync/data`
- `GET /api/v1/profile`
- `PUT /api/v1/profile`
- `GET /api/v1/plans/sample`
- `GET /api/v1/workouts/logs`
- `POST /api/v1/workouts/logs`
- `DELETE /api/v1/workouts/logs/:id`
- `GET /api/v1/nutrition/logs`
- `PUT /api/v1/nutrition/logs/:date`
- `DELETE /api/v1/nutrition/logs/:date`
- `GET /api/v1/progress/entries`
- `POST /api/v1/progress/entries`
- `DELETE /api/v1/progress/entries/:id`

## Data Persistence

`/health` now returns active storage backend info.

- `file` backend persists at `apps/api/data/app-data.json`
- `postgres` backend persists in `app_*` tables in your Postgres database

If Postgres is configured but unavailable, the API automatically falls back to file storage.
