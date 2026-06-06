-- =====================================================
-- Migração 003 — Substitutos, Medidas Caseiras, Receitas
-- Execute APÓS 002_taco_seed.sql
-- =====================================================

-- =====================================================
-- MEDIDAS CASEIRAS POR ALIMENTO
-- =====================================================
create table if not exists food_measures (
  id           uuid primary key default gen_random_uuid(),
  food_id      uuid references foods(id) on delete cascade not null,
  description  text not null,   -- "1 col. de sopa", "1 xícara chá"
  grams        numeric(8,2) not null,
  sort_order   int default 0
);

create index if not exists food_measures_food_idx on food_measures(food_id);

-- =====================================================
-- SUBSTITUTOS DE ALIMENTOS
-- =====================================================
create table if not exists meal_food_substitutes (
  id                   uuid primary key default gen_random_uuid(),
  meal_food_id         uuid references meal_foods(id) on delete cascade not null,
  food_id              uuid references foods(id) not null,
  quantity_g           numeric(8,2) not null,   -- ajustado para kcal equivalente
  quantity_description text,                    -- "2 col. de sopa (30g)"
  notes                text,
  sort_order           int default 0
);

create index if not exists substitutes_meal_food_idx on meal_food_substitutes(meal_food_id);

-- =====================================================
-- RECEITAS
-- =====================================================
create table if not exists recipes (
  id                      uuid primary key default gen_random_uuid(),
  professional_id         uuid references profiles(id) not null,
  name                    text not null,
  description             text,
  yield_portions          int default 1,
  yield_g_per_portion     numeric(7,2),    -- gramas por porção
  kcal_per_portion        numeric(7,2),
  protein_g_per_portion   numeric(6,2),
  carbs_g_per_portion     numeric(6,2),
  fat_g_per_portion       numeric(6,2),
  fiber_g_per_portion     numeric(6,2),
  instructions            text,
  active                  boolean default true,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create table if not exists recipe_ingredients (
  id                   uuid primary key default gen_random_uuid(),
  recipe_id            uuid references recipes(id) on delete cascade not null,
  food_id              uuid references foods(id),
  name_override        text,        -- para ingredientes sem cadastro no banco
  quantity_g           numeric(8,2),
  quantity_description text,
  sort_order           int default 0
);

-- =====================================================
-- RLS para novas tabelas
-- =====================================================
alter table food_measures           enable row level security;
alter table meal_food_substitutes   enable row level security;
alter table recipes                 enable row level security;
alter table recipe_ingredients      enable row level security;

-- food_measures: leitura por todos autenticados, escrita pelo profissional
create policy "Medidas visíveis para autenticados"
  on food_measures for select using (auth.role() = 'authenticated');

create policy "Profissional insere medidas"
  on food_measures for insert with check (my_role() = 'professional');

create policy "Profissional edita medidas"
  on food_measures for update using (my_role() = 'professional');

-- meal_food_substitutes
create policy "Profissional gerencia substitutos"
  on meal_food_substitutes for all using (
    exists (
      select 1 from meal_foods mf
      join meals m on m.id = mf.meal_id
      join diet_plans dp on dp.id = m.diet_plan_id
      where mf.id = meal_food_id and dp.professional_id = auth.uid()
    )
  );

create policy "Aluno vê substitutos do seu plano"
  on meal_food_substitutes for select using (
    exists (
      select 1 from meal_foods mf
      join meals m on m.id = mf.meal_id
      join diet_plans dp on dp.id = m.diet_plan_id
      where mf.id = meal_food_id
        and dp.patient_id = my_patient_id()
        and dp.published_at is not null
    )
  );

-- recipes
create policy "Profissional gerencia suas receitas"
  on recipes for all using (professional_id = auth.uid());

create policy "Aluno vê receitas do profissional"
  on recipes for select using (
    auth.role() = 'authenticated' and active = true
  );

-- recipe_ingredients
create policy "Profissional gerencia ingredientes"
  on recipe_ingredients for all using (
    exists (select 1 from recipes where id = recipe_id and professional_id = auth.uid())
  );

create policy "Aluno vê ingredientes"
  on recipe_ingredients for select using (
    exists (select 1 from recipes where id = recipe_id and active = true)
  );

-- =====================================================
-- MEDIDAS CASEIRAS — TACO (pré-populadas por food_group)
-- As medidas são inseridas usando subquery pelo nome do alimento
-- =====================================================

-- Helper function para inserir medidas
create or replace function insert_measures(p_food_name text, p_measures jsonb)
returns void language plpgsql as $$
declare
  v_food_id uuid;
  measure jsonb;
  i int := 0;
begin
  select id into v_food_id from foods where name = p_food_name and source = 'TACO' limit 1;
  if v_food_id is null then return; end if;
  for measure in select * from jsonb_array_elements(p_measures) loop
    insert into food_measures (food_id, description, grams, sort_order)
    values (v_food_id, measure->>'d', (measure->>'g')::numeric, i)
    on conflict do nothing;
    i := i + 1;
  end loop;
end;
$$;

-- CEREAIS
select insert_measures('Arroz branco polido cozido', '[
  {"d":"1 col. de sopa cheia (25g)","g":25},
  {"d":"2 col. de sopa (50g)","g":50},
  {"d":"4 col. de sopa (100g)","g":100},
  {"d":"1 escumadeira (120g)","g":120},
  {"d":"1 xícara chá (160g)","g":160}
]'::jsonb);

select insert_measures('Arroz integral cozido', '[
  {"d":"1 col. de sopa cheia (25g)","g":25},
  {"d":"4 col. de sopa (100g)","g":100},
  {"d":"1 xícara chá (160g)","g":160}
]'::jsonb);

select insert_measures('Aveia em flocos', '[
  {"d":"1 col. de sopa (9g)","g":9},
  {"d":"2 col. de sopa (18g)","g":18},
  {"d":"3 col. de sopa (27g)","g":27},
  {"d":"1/2 xícara chá (40g)","g":40},
  {"d":"1 xícara chá (80g)","g":80}
]'::jsonb);

select insert_measures('Pão francês', '[
  {"d":"1/2 unidade (25g)","g":25},
  {"d":"1 unidade (50g)","g":50},
  {"d":"2 unidades (100g)","g":100}
]'::jsonb);

select insert_measures('Pão de forma integral', '[
  {"d":"1 fatia (25g)","g":25},
  {"d":"2 fatias (50g)","g":50},
  {"d":"3 fatias (75g)","g":75}
]'::jsonb);

select insert_measures('Pão de forma tradicional', '[
  {"d":"1 fatia (25g)","g":25},
  {"d":"2 fatias (50g)","g":50}
]'::jsonb);

select insert_measures('Macarrão cozido', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"1 escumadeira (100g)","g":100},
  {"d":"1 prato raso (200g)","g":200}
]'::jsonb);

select insert_measures('Batata doce cozida', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"1 unidade pequena (80g)","g":80},
  {"d":"1 unidade média (130g)","g":130},
  {"d":"1 unidade grande (200g)","g":200}
]'::jsonb);

select insert_measures('Batata inglesa cozida', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"1 unidade pequena (70g)","g":70},
  {"d":"1 unidade média (100g)","g":100},
  {"d":"1 unidade grande (150g)","g":150}
]'::jsonb);

select insert_measures('Tapioca (goma)', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"1 unidade pequena (40g)","g":40},
  {"d":"1 unidade média (60g)","g":60},
  {"d":"1 unidade grande (80g)","g":80}
]'::jsonb);

select insert_measures('Quinoa cozida', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"4 col. de sopa (80g)","g":80},
  {"d":"1 xícara chá (160g)","g":160}
]'::jsonb);

select insert_measures('Cuscuz de milho cozido', '[
  {"d":"1 fatia fina (50g)","g":50},
  {"d":"1 fatia média (100g)","g":100},
  {"d":"1 fatia grande (150g)","g":150}
]'::jsonb);

-- CARNES
select insert_measures('Peito de frango grelhado', '[
  {"d":"1 filé pequeno (70g)","g":70},
  {"d":"1 filé médio (100g)","g":100},
  {"d":"1 filé grande (150g)","g":150},
  {"d":"1 filé extra grande (200g)","g":200}
]'::jsonb);

select insert_measures('Frango desfiado cozido', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"2 col. de sopa (40g)","g":40},
  {"d":"4 col. de sopa (80g)","g":80},
  {"d":"1 xícara chá (120g)","g":120}
]'::jsonb);

select insert_measures('Patinho cozido', '[
  {"d":"1 bife pequeno (80g)","g":80},
  {"d":"1 bife médio (100g)","g":100},
  {"d":"1 bife grande (130g)","g":130}
]'::jsonb);

select insert_measures('Carne moída refogada', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"3 col. de sopa (60g)","g":60},
  {"d":"5 col. de sopa (100g)","g":100},
  {"d":"1 porção (150g)","g":150}
]'::jsonb);

select insert_measures('Alcatra cozida', '[
  {"d":"1 bife pequeno (80g)","g":80},
  {"d":"1 bife médio (100g)","g":100},
  {"d":"1 bife grande (130g)","g":130}
]'::jsonb);

-- PESCADOS
select insert_measures('Atum em lata (em água)', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"1/2 lata (80g)","g":80},
  {"d":"1 lata (170g)","g":170}
]'::jsonb);

select insert_measures('Salmão grelhado', '[
  {"d":"1 file pequeno (80g)","g":80},
  {"d":"1 filé médio (120g)","g":120},
  {"d":"1 filé grande (150g)","g":150}
]'::jsonb);

select insert_measures('Tilápia assada', '[
  {"d":"1 filé pequeno (80g)","g":80},
  {"d":"1 filé médio (120g)","g":120},
  {"d":"1 filé grande (150g)","g":150}
]'::jsonb);

-- OVOS
select insert_measures('Ovo de galinha cozido', '[
  {"d":"1 unidade (50g)","g":50},
  {"d":"2 unidades (100g)","g":100},
  {"d":"3 unidades (150g)","g":150}
]'::jsonb);

select insert_measures('Ovo de galinha mexido', '[
  {"d":"1 unidade (50g)","g":50},
  {"d":"2 unidades (100g)","g":100},
  {"d":"3 unidades (150g)","g":150}
]'::jsonb);

select insert_measures('Clara de ovo cozida', '[
  {"d":"1 clara (30g)","g":30},
  {"d":"2 claras (60g)","g":60},
  {"d":"3 claras (90g)","g":90},
  {"d":"5 claras (150g)","g":150}
]'::jsonb);

select insert_measures('Gema de ovo', '[
  {"d":"1 gema (20g)","g":20},
  {"d":"2 gemas (40g)","g":40},
  {"d":"3 gemas (60g)","g":60}
]'::jsonb);

-- LATICÍNIOS
select insert_measures('Leite integral', '[
  {"d":"1 col. de sopa (15ml)","g":15},
  {"d":"1/2 copo (100ml)","g":100},
  {"d":"1 copo americano (150ml)","g":150},
  {"d":"1 copo (200ml)","g":200}
]'::jsonb);

select insert_measures('Leite desnatado', '[
  {"d":"1/2 copo (100ml)","g":100},
  {"d":"1 copo americano (150ml)","g":150},
  {"d":"1 copo (200ml)","g":200}
]'::jsonb);

select insert_measures('Leite semidesnatado', '[
  {"d":"1/2 copo (100ml)","g":100},
  {"d":"1 copo (200ml)","g":200}
]'::jsonb);

select insert_measures('Iogurte natural integral', '[
  {"d":"1/2 pote (85g)","g":85},
  {"d":"1 pote (170g)","g":170},
  {"d":"1 pote grande (200g)","g":200}
]'::jsonb);

select insert_measures('Iogurte grego natural', '[
  {"d":"1/2 pote (85g)","g":85},
  {"d":"1 pote (170g)","g":170},
  {"d":"1 pote grande (200g)","g":200}
]'::jsonb);

select insert_measures('Iogurte desnatado', '[
  {"d":"1/2 pote (85g)","g":85},
  {"d":"1 pote (170g)","g":170}
]'::jsonb);

select insert_measures('Queijo mussarela', '[
  {"d":"1 fatia fina (15g)","g":15},
  {"d":"1 fatia média (25g)","g":25},
  {"d":"2 fatias (50g)","g":50}
]'::jsonb);

select insert_measures('Queijo cottage', '[
  {"d":"1 col. de sopa (30g)","g":30},
  {"d":"2 col. de sopa (60g)","g":60},
  {"d":"1/2 xícara (100g)","g":100}
]'::jsonb);

select insert_measures('Requeijão cremoso', '[
  {"d":"1 col. de chá (5g)","g":5},
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"2 col. de sopa (30g)","g":30}
]'::jsonb);

-- LEGUMINOSAS
select insert_measures('Feijão carioca cozido', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"3 col. de sopa (45g)","g":45},
  {"d":"1 concha média (86g)","g":86},
  {"d":"1 concha grande (120g)","g":120}
]'::jsonb);

select insert_measures('Feijão preto cozido', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"1 concha média (86g)","g":86},
  {"d":"1 concha grande (120g)","g":120}
]'::jsonb);

select insert_measures('Lentilha cozida', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"3 col. de sopa (60g)","g":60},
  {"d":"1 concha (100g)","g":100}
]'::jsonb);

select insert_measures('Grão-de-bico cozido', '[
  {"d":"1 col. de sopa (20g)","g":20},
  {"d":"3 col. de sopa (60g)","g":60},
  {"d":"1 concha (100g)","g":100}
]'::jsonb);

-- GORDURAS
select insert_measures('Azeite de oliva extra virgem', '[
  {"d":"1 col. de chá (5ml)","g":5},
  {"d":"1 col. de sopa (13ml)","g":13},
  {"d":"2 col. de sopa (26ml)","g":26}
]'::jsonb);

select insert_measures('Manteiga', '[
  {"d":"1 col. de chá (5g)","g":5},
  {"d":"1 col. de sopa (15g)","g":15}
]'::jsonb);

select insert_measures('Óleo de coco', '[
  {"d":"1 col. de chá (5ml)","g":5},
  {"d":"1 col. de sopa (13ml)","g":13}
]'::jsonb);

-- FRUTAS
select insert_measures('Banana prata', '[
  {"d":"1/2 unidade (45g)","g":45},
  {"d":"1 unidade pequena (70g)","g":70},
  {"d":"1 unidade média (90g)","g":90},
  {"d":"1 unidade grande (120g)","g":120}
]'::jsonb);

select insert_measures('Banana nanica', '[
  {"d":"1 unidade pequena (70g)","g":70},
  {"d":"1 unidade média (90g)","g":90},
  {"d":"1 unidade grande (120g)","g":120}
]'::jsonb);

select insert_measures('Maçã fuji', '[
  {"d":"1/2 unidade (65g)","g":65},
  {"d":"1 unidade pequena (100g)","g":100},
  {"d":"1 unidade média (130g)","g":130},
  {"d":"1 unidade grande (170g)","g":170}
]'::jsonb);

select insert_measures('Laranja pera', '[
  {"d":"1 unidade pequena (100g)","g":100},
  {"d":"1 unidade média (130g)","g":130},
  {"d":"1 unidade grande (180g)","g":180}
]'::jsonb);

select insert_measures('Mamão formosa', '[
  {"d":"1 fatia pequena (100g)","g":100},
  {"d":"1 fatia média (150g)","g":150},
  {"d":"1 fatia grande (200g)","g":200}
]'::jsonb);

-- AÇÚCARES
select insert_measures('Mel', '[
  {"d":"1 col. de chá (7g)","g":7},
  {"d":"1 col. de sopa (20g)","g":20}
]'::jsonb);

select insert_measures('Açúcar refinado', '[
  {"d":"1 col. de chá (5g)","g":5},
  {"d":"1 col. de sopa (12g)","g":12}
]'::jsonb);

-- OLEAGINOSAS
select insert_measures('Amendoim torrado sem sal', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"1 punhado (30g)","g":30},
  {"d":"2 punhados (60g)","g":60}
]'::jsonb);

select insert_measures('Castanha do Pará', '[
  {"d":"1 unidade (5g)","g":5},
  {"d":"2 unidades (10g)","g":10},
  {"d":"4 unidades (20g)","g":20}
]'::jsonb);

select insert_measures('Castanha de caju torrada', '[
  {"d":"5 unidades (15g)","g":15},
  {"d":"10 unidades (30g)","g":30}
]'::jsonb);

-- SUPLEMENTOS
select insert_measures('Whey protein concentrado 80%', '[
  {"d":"1 col. de sopa (15g)","g":15},
  {"d":"1 scoop (30g)","g":30},
  {"d":"2 scoops (60g)","g":60}
]'::jsonb);

select insert_measures('Whey protein isolado 90%', '[
  {"d":"1 scoop (30g)","g":30},
  {"d":"2 scoops (60g)","g":60}
]'::jsonb);

-- Remove a função helper temporária (não é mais necessária)
-- drop function insert_measures(text, jsonb);

-- =====================================================
-- Campo source_label na tabela foods (para exibir origem)
-- =====================================================
alter table foods add column if not exists source_label text;

-- Atualiza os rótulos
update foods set source_label = 'TACO' where source = 'TACO';
update foods set source_label = 'Personalizado' where source = 'custom';
