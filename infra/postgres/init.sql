create table if not exists app_profiles (
  id text primary key,
  name text not null,
  age int not null,
  height_cm int not null,
  current_weight_kg numeric(6,2) not null,
  goal text not null check (goal in ('lose_weight', 'gain_muscle', 'maintain')),
  daily_calorie_target int not null,
  protein_target_grams int not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_workout_logs (
  id text primary key,
  workout_date date not null,
  workout_type text not null check (workout_type in ('strength', 'cardio', 'mobility')),
  duration_minutes int not null,
  notes text,
  created_at timestamptz not null,
  synced_at timestamptz
);

create table if not exists app_nutrition_logs (
  nutrition_date date primary key,
  calories numeric(8,2) not null,
  protein numeric(8,2) not null,
  carbs numeric(8,2) not null,
  fat numeric(8,2) not null,
  water_liters numeric(5,2) not null,
  updated_at timestamptz not null default now()
);

create table if not exists app_progress_entries (
  id text primary key,
  progress_date date not null,
  weight_kg numeric(6,2) not null,
  body_fat_pct numeric(5,2),
  waist_cm numeric(6,2),
  updated_at timestamptz not null default now()
);
