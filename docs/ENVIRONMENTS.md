# Environments

This document describes how **fateround** separates its development and
production environments using **Supabase Branching**, how environment variables
map to each environment, and the migration workflow that follows from it.

## 1. Overview

fateround stores all of its game state in Supabase (Postgres). Development work
and database migrations must **never run against live player data**, so dev and
prod use **separate Supabase databases**.

Rather than maintaining two hand-managed Supabase projects (and manually keeping
their schemas in sync), we use **Supabase Branching**. Branching ties database
environments to Git branches: production tracks `main`, a long-lived dev database
tracks `dev`, and every PR gets its own throwaway database. Schema is driven
entirely by the migration files in `supabase/migrations/` (96 and counting), so
all branches converge on the same schema by replaying the same migrations.

The Git branching model this maps onto is already documented in
`CONTRIBUTING.md`:

- `dev` is the integration branch.
- `main` is production.
- Feature branches PR into `dev`; `dev` is then promoted to `main`.

## 2. How Supabase Branching works here

A few facts about Supabase Branching that shape our setup:

- **Pro plan required.** Branching is a paid feature; the Supabase project must
  be on the Pro plan (or higher).
- **Driven from GitHub + config.** Branching is enabled in the Supabase
  Dashboard by connecting this GitHub repository. Supabase reads
  `supabase/config.toml` and applies the SQL in `supabase/migrations/` to create
  each branch's schema.
- **Production branch.** One branch is designated the **production branch** and
  points at the live database. We set this to **`main`**.
- **Preview branches (ephemeral).** When a PR is opened, Supabase spins up an
  **ephemeral preview database**, seeded by running all migrations (plus the
  optional `supabase/seed.sql` if present). It is **torn down when the PR is
  closed/merged**, so it is not for durable data.
- **Persistent branches.** A branch can be marked **persistent** so Supabase
  does not destroy it. We use this for a long-lived branch tracking **`dev`**,
  which serves as the shared **dev database**.
- **Per-branch connection details.** Every branch (production, persistent dev,
  and each preview) has its **own URL and anon key**. These are visible in the
  Dashboard and retrievable via the Management API or the
  `supabase branches` CLI (e.g. `supabase branches get <branch>`).

## 3. One-time setup checklist

These are manual, one-time steps performed in the Supabase Dashboard / repo:

- [ ] **Upgrade the Supabase project to Pro** (required for Branching).
- [ ] Fill in `supabase/config.toml`:
  - [ ] `project_id = "<prod-project-ref>"`
  - [ ] `[db].major_version = <pg-major-version>` (e.g. `15`)
- [ ] In **Dashboard → Branching**, **connect this GitHub repo** and set the
      **production branch to `main`**.
- [ ] Create a **persistent branch** tracking **`dev`** to act as the long-lived
      dev database.

```toml
# supabase/config.toml (minimal)
project_id = "<prod-project-ref>"

[db]
major_version = 15
```

## 4. Environment → Supabase mapping

The app reads two variables in every environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| Environment   | Git branch       | Hosting                                   | Supabase branch              |
| ------------- | ---------------- | ----------------------------------------- | ---------------------------- |
| Production    | `main`           | Vercel Production / AWS **prod** stack    | production branch (`main`)   |
| Staging / dev | `dev`            | Vercel Preview (or AWS **dev** stack)     | persistent `dev` branch      |
| PR previews   | feature branch   | Vercel Preview deploy                     | ephemeral preview branch     |

### Vercel

The **Supabase + Vercel integration auto-injects** the correct branch's
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into each Vercel
deployment — production deploys get the production branch, and each PR's preview
deploy gets that PR's ephemeral preview branch. No manual env wiring needed.

### AWS (self-hosted, Terraform under `infra/`)

The AWS stack (a separate PR) reads `supabase_url` / `supabase_anon_key`
Terraform variables and pushes them into SSM. It supports **per-environment
deploys** via a distinct `name_prefix` (e.g. `fateround-dev` vs
`fateround-prod`) using **separate Terraform workspaces/state**.

For each environment, fetch that branch's credentials and put them in the
matching tfvars file (see `infra/terraform.dev.tfvars.example` and
`infra/terraform.prod.tfvars.example`):

```bash
# Get a branch's connection details
supabase branches get dev   # or: main
```

```hcl
# infra/terraform.dev.tfvars
name_prefix       = "fateround-dev"
supabase_url      = "https://<dev-branch-ref>.supabase.co"
supabase_anon_key = "<dev-branch-anon-key>"
```

```bash
# Deploy each environment in its own workspace
terraform workspace select dev   # or: prod
terraform apply -var-file=terraform.dev.tfvars
```

## 5. Migration workflow under Branching

Migrations are the single source of truth for schema across every branch.

- **Author migrations** as new files in `supabase/migrations/` with **unique,
  increasing numeric prefixes**. **Never edit a migration that has already
  merged** — branches track *applied* history, and rewriting it breaks that
  history (drift / failed replays).
- **On a PR:** the ephemeral preview branch **runs all migrations**, so you test
  schema changes against a real, isolated database before merge.
- **Merging to `dev`:** the persistent `dev` branch applies the new migrations,
  updating the shared dev database.
- **Promoting `dev` → `main`:** the production branch applies the pending
  migrations to the **live** database. Supabase shows a **migration drift / diff**
  before merge — **review it carefully**, since this touches real player data.
- **Rule of thumb:** schema changes **ride along with the code PR** that needs
  them, so code and schema land together on every branch.

## 6. Local development

For local work, create a `.env.local` pointing at the **dev branch** (or a
specific preview branch) — **never at production**:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<dev-branch-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dev-branch-anon-key>
```

Retrieve these from the Dashboard or via `supabase branches get dev`. Pointing
local development at the production branch risks mutating live data and is not
allowed.
