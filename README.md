# Fitness App Monorepo

Initial project scaffold for a fitness app with:

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

3. Run mobile app:

```bash
npm run dev:mobile
```

4. (Optional) Start local Postgres:

```bash
docker compose -f infra/docker-compose.yml up -d
```

## API Endpoints

- `GET /health`
- `GET /api/v1/plans/sample`
- `GET /api/v1/workouts/logs`
- `POST /api/v1/workouts/logs`
