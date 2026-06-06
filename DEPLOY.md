# Guia de Deploy — PGF Nutrição

## Passo 1 — Instalar Node.js

Baixe e instale: https://nodejs.org/en (versão LTS)
Depois reinicie o terminal e teste: `node --version`

---

## Passo 2 — Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta gratuita
2. Crie um novo projeto (anote a senha do banco)
3. Vá em **SQL Editor** e execute **na ordem**:
   - Cole todo o conteúdo de `supabase/migrations/001_schema.sql` → Run
   - Cole todo o conteúdo de `supabase/migrations/002_taco_seed.sql` → Run
   - Cole todo o conteúdo de `supabase/migrations/003_substitutes_recipes_measures.sql` → Run

4. Vá em **Settings > API** e copie:
   - `Project URL` → NEXT_PUBLIC_SUPABASE_URL
   - `anon public` key → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - `service_role` key → SUPABASE_SERVICE_ROLE_KEY (⚠️ nunca exponha no front-end)

5. Vá em **Authentication > Settings**:
   - Desative "Confirm email" (para facilitar o login dos alunos)

6. Vá em **Storage** e crie dois buckets:
   - `exercise-videos` (privado)
   - `exercise-thumbnails` (público)

---

## Passo 3 — Criar conta no Supabase como Nutricionista

No SQL Editor, execute:
```sql
-- Substitua pelos seus dados reais
select auth.admin.create_user(json_build_object(
  'email', 'pedro_frey@hotmail.com',
  'password', 'SUA_SENHA_SEGURA',
  'email_confirm', true,
  'user_metadata', json_build_object('role', 'professional', 'full_name', 'Pedro Garrastazu Frey')
));
```

Ou use o painel: **Authentication > Users > Add user** com:
- Email: pedro_frey@hotmail.com
- Role (em metadata): professional

---

## Passo 4 — Criar arquivo .env.local

Copie `.env.local.example` para `.env.local` e preencha:
```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
NEXT_PUBLIC_SITE_URL=https://SEU_APP.vercel.app
```

---

## Passo 5 — Testar localmente

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

---

## Passo 6 — Deploy no GitHub + Vercel

### GitHub
```bash
git init
git add .
git commit -m "primeiro deploy PGF Nutrição"
git branch -M main
git remote add origin https://github.com/Pedrogarras/pgf-nutricao.git
git push -u origin main
```

### Vercel
1. Acesse https://vercel.com e conecte sua conta GitHub
2. Clique em "New Project" → importe o repositório `pgf-nutricao`
3. Em **Environment Variables**, adicione as 4 variáveis do `.env.local`
4. Clique em **Deploy**

---

## Atualizações futuras (sem perder dados)

```bash
# Faça suas alterações no código
git add .
git commit -m "descrição da atualização"
git push origin main
# Vercel faz o deploy automático!
```

Para **mudanças no banco de dados**: sempre crie um novo arquivo de migração
`supabase/migrations/004_nova_feature.sql` e execute no SQL Editor do Supabase.
**Nunca altere as migrações já executadas.**

---

## Login dos alunos

- **Usuário**: Nome completo do paciente (exatamente como cadastrado)
- **Senha**: Data de nascimento no formato `DD/MM/AAAA`

A conta é criada automaticamente no primeiro login do aluno.
