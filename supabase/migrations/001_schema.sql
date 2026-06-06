-- =====================================================
-- PGF Nutrição — Schema principal
-- Execute no SQL Editor do Supabase
-- =====================================================

-- EXTENSÕES
create extension if not exists "pgcrypto";

-- =====================================================
-- PROFILES (estende auth.users)
-- =====================================================
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('professional', 'student')),
  full_name    text not null,
  created_at   timestamptz default now()
);

-- Cria profile automaticamente ao criar usuário
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- =====================================================
-- PATIENTS
-- =====================================================
create table if not exists patients (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid references profiles(id) not null,
  auth_user_id     uuid references profiles(id),  -- preenchido quando o aluno tem login
  full_name        text not null,
  email            text,
  phone            text,
  date_of_birth    date,
  gender           text check (gender in ('M','F','outro')),
  weight_kg        numeric(5,2),
  height_cm        numeric(5,1),
  goal             text,
  activity_level   text default 'levemente_ativo',
  notes            text,
  active           boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- =====================================================
-- FOODS (TACO + personalizados)
-- =====================================================
create table if not exists foods (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  kcal                 numeric(7,2) not null,
  protein_g            numeric(6,2) default 0,
  carbs_g              numeric(6,2) default 0,
  fat_g                numeric(6,2) default 0,
  fiber_g              numeric(6,2) default 0,
  sodium_mg            numeric(7,2) default 0,
  portion_g            numeric(7,2) default 100,  -- base de cálculo (sempre 100g por padrão)
  portion_description  text,                       -- "1 col. de sopa (15g)"
  food_group           text,
  source               text default 'TACO' check (source in ('TACO','custom')),
  professional_id      uuid references profiles(id),  -- null para alimentos TACO
  active               boolean default true,
  created_at           timestamptz default now()
);

create index if not exists foods_name_idx on foods using gin(to_tsvector('portuguese', name));
create index if not exists foods_source_idx on foods(source);

-- =====================================================
-- DIET PLANS
-- =====================================================
create table if not exists diet_plans (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid references patients(id) on delete cascade not null,
  professional_id  uuid references profiles(id) not null,
  title            text default 'Plano Alimentar',
  kcal_goal        int,
  protein_goal_g   int,
  carbs_goal_g     int,
  fat_goal_g       int,
  notes            text,
  anamnesis        jsonb default '{}',  -- dados de anamnese
  active           boolean default true,
  valid_from       date default current_date,
  valid_until      date,
  published_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- =====================================================
-- MEALS (refeições dentro do plano)
-- =====================================================
create table if not exists meals (
  id            uuid primary key default gen_random_uuid(),
  diet_plan_id  uuid references diet_plans(id) on delete cascade not null,
  name          text not null,
  time_start    text,   -- "07:00"
  emoji         text default '🍽️',
  sort_order    int default 0,
  notes         text
);

-- =====================================================
-- MEAL FOODS (alimentos dentro de cada refeição)
-- =====================================================
create table if not exists meal_foods (
  id                   uuid primary key default gen_random_uuid(),
  meal_id              uuid references meals(id) on delete cascade not null,
  food_id              uuid references foods(id) not null,
  quantity_g           numeric(8,2) not null,   -- quantidade em gramas/ml
  quantity_description text,                    -- "2 col. sopa", "1 fatia"
  notes                text,
  sort_order           int default 0
);

-- =====================================================
-- ANTHROPOMETRIC RECORDS (evolução)
-- =====================================================
create table if not exists anthropometric_records (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid references patients(id) on delete cascade not null,
  professional_id  uuid references profiles(id) not null,
  measured_at      date default current_date,
  weight_kg        numeric(5,2),
  body_fat_pct     numeric(4,1),
  muscle_mass_kg   numeric(5,2),
  waist_cm         numeric(5,1),
  hip_cm           numeric(5,1),
  arm_cm           numeric(5,1),
  thigh_cm         numeric(5,1),
  calf_cm          numeric(5,1),
  adherence_pct    int,
  notes            text
);

-- =====================================================
-- EXERCISES (biblioteca de exercícios do profissional)
-- =====================================================
create table if not exists exercises (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid references profiles(id) not null,
  name             text not null,
  muscle_group     text,
  description      text,
  video_url        text,   -- URL do vídeo (Supabase Storage ou YouTube)
  thumbnail_url    text,
  active           boolean default true,
  created_at       timestamptz default now()
);

-- =====================================================
-- WORKOUT PLANS
-- =====================================================
create table if not exists workout_plans (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid references patients(id) on delete cascade not null,
  professional_id  uuid references profiles(id) not null,
  title            text default 'Plano de Treino',
  notes            text,
  active           boolean default true,
  valid_from       date default current_date,
  valid_until      date,
  published_at     timestamptz,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- =====================================================
-- WORKOUT DAYS
-- =====================================================
create table if not exists workout_days (
  id               uuid primary key default gen_random_uuid(),
  workout_plan_id  uuid references workout_plans(id) on delete cascade not null,
  name             text not null,   -- "Treino A — Peito e Tríceps"
  sort_order       int default 0
);

-- =====================================================
-- WORKOUT EXERCISES
-- =====================================================
create table if not exists workout_exercises (
  id               uuid primary key default gen_random_uuid(),
  workout_day_id   uuid references workout_days(id) on delete cascade not null,
  exercise_id      uuid references exercises(id) not null,
  sets             int,
  reps             text,            -- "12" ou "8-12" ou "até falha"
  rest_seconds     int,
  notes            text,
  sort_order       int default 0
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

alter table profiles              enable row level security;
alter table patients              enable row level security;
alter table foods                 enable row level security;
alter table diet_plans            enable row level security;
alter table meals                 enable row level security;
alter table meal_foods            enable row level security;
alter table anthropometric_records enable row level security;
alter table exercises             enable row level security;
alter table workout_plans         enable row level security;
alter table workout_days          enable row level security;
alter table workout_exercises     enable row level security;

-- Helper function: retorna o role do usuário logado
create or replace function my_role()
returns text language sql security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper function: retorna o patient_id do aluno logado (via auth_user_id)
create or replace function my_patient_id()
returns uuid language sql security definer as $$
  select id from patients where auth_user_id = auth.uid() limit 1;
$$;

-- PROFILES
create policy "Usuário vê seu próprio profile"
  on profiles for select using (id = auth.uid());

create policy "Profissional vê profiles de seus alunos"
  on profiles for select using (
    my_role() = 'professional'
  );

-- PATIENTS
create policy "Profissional gerencia seus pacientes"
  on patients for all using (professional_id = auth.uid());

create policy "Aluno vê seu próprio cadastro"
  on patients for select using (auth_user_id = auth.uid());

-- FOODS: todos autenticados leem, profissional escreve
create policy "Alimentos visíveis para todos autenticados"
  on foods for select using (auth.role() = 'authenticated');

create policy "Profissional cria alimentos personalizados"
  on foods for insert with check (
    my_role() = 'professional' and professional_id = auth.uid()
  );

create policy "Profissional edita seus alimentos"
  on foods for update using (
    my_role() = 'professional' and (professional_id = auth.uid() or professional_id is null)
  );

create policy "Profissional desativa seus alimentos"
  on foods for delete using (
    my_role() = 'professional' and professional_id = auth.uid()
  );

-- DIET PLANS
create policy "Profissional gerencia planos de dieta"
  on diet_plans for all using (professional_id = auth.uid());

create policy "Aluno vê seu plano de dieta publicado"
  on diet_plans for select using (
    patient_id = my_patient_id() and published_at is not null
  );

-- MEALS
create policy "Profissional gerencia refeições"
  on meals for all using (
    exists (select 1 from diet_plans where id = diet_plan_id and professional_id = auth.uid())
  );

create policy "Aluno vê suas refeições"
  on meals for select using (
    exists (
      select 1 from diet_plans
      where id = diet_plan_id
        and patient_id = my_patient_id()
        and published_at is not null
    )
  );

-- MEAL FOODS
create policy "Profissional gerencia alimentos das refeições"
  on meal_foods for all using (
    exists (
      select 1 from meals m
      join diet_plans dp on dp.id = m.diet_plan_id
      where m.id = meal_id and dp.professional_id = auth.uid()
    )
  );

create policy "Aluno vê alimentos de suas refeições"
  on meal_foods for select using (
    exists (
      select 1 from meals m
      join diet_plans dp on dp.id = m.diet_plan_id
      where m.id = meal_id
        and dp.patient_id = my_patient_id()
        and dp.published_at is not null
    )
  );

-- ANTHROPOMETRIC RECORDS
create policy "Profissional gerencia avaliações"
  on anthropometric_records for all using (professional_id = auth.uid());

create policy "Aluno vê suas avaliações"
  on anthropometric_records for select using (patient_id = my_patient_id());

-- EXERCISES
create policy "Profissional gerencia exercícios"
  on exercises for all using (professional_id = auth.uid());

create policy "Aluno vê exercícios (plano publicado)"
  on exercises for select using (
    auth.role() = 'authenticated'
  );

-- WORKOUT PLANS
create policy "Profissional gerencia planos de treino"
  on workout_plans for all using (professional_id = auth.uid());

create policy "Aluno vê seu plano de treino publicado"
  on workout_plans for select using (
    patient_id = my_patient_id() and published_at is not null
  );

-- WORKOUT DAYS
create policy "Profissional gerencia dias de treino"
  on workout_days for all using (
    exists (select 1 from workout_plans where id = workout_plan_id and professional_id = auth.uid())
  );

create policy "Aluno vê dias do seu treino"
  on workout_days for select using (
    exists (
      select 1 from workout_plans
      where id = workout_plan_id
        and patient_id = my_patient_id()
        and published_at is not null
    )
  );

-- WORKOUT EXERCISES
create policy "Profissional gerencia exercícios do treino"
  on workout_exercises for all using (
    exists (
      select 1 from workout_days wd
      join workout_plans wp on wp.id = wd.workout_plan_id
      where wd.id = workout_day_id and wp.professional_id = auth.uid()
    )
  );

create policy "Aluno vê exercícios do seu treino"
  on workout_exercises for select using (
    exists (
      select 1 from workout_days wd
      join workout_plans wp on wp.id = wd.workout_plan_id
      where wd.id = workout_day_id
        and wp.patient_id = my_patient_id()
        and wp.published_at is not null
    )
  );

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
-- Execute separadamente no dashboard do Supabase > Storage:
-- 1. Criar bucket "exercise-videos" (privado)
-- 2. Criar bucket "exercise-thumbnails" (público)
-- Ou descomente abaixo se tiver permissão via SQL:
-- insert into storage.buckets (id, name, public) values ('exercise-videos', 'exercise-videos', false);
-- insert into storage.buckets (id, name, public) values ('exercise-thumbnails', 'exercise-thumbnails', true);
