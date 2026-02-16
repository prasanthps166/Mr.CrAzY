create table if not exists users (
  id uuid primary key,
  name text not null,
  age int not null check (age > 0),
  height_cm int not null check (height_cm > 0),
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  goal text not null check (goal in ('lose_weight', 'gain_muscle', 'maintain')),
  created_at timestamptz not null default now()
);

create table if not exists workout_logs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  workout_type text not null check (workout_type in ('strength', 'cardio', 'mobility')),
  duration_minutes int not null check (duration_minutes > 0),
  workout_date date not null,
  notes text,
  created_at timestamptz not null default now()
);
