# Platform Architecture — Master Document

> **Status**: Authoritative · **Version**: 1.1 · **Last revised**: 2026-05-31
> **Scope**: Internal multi-store AI ecommerce production platform.
> **Audience**: Anyone implementing, operating, reviewing, or extending the platform.
>
> This document is the **single source of truth** for the platform's
> architecture. Every implementation task references it. When an
> implementation contradicts this document, the document wins — fix the
> implementation OR open a `docs/architecture/decisions/` ADR to amend
> the document. Do not silently diverge.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Architectural principles](#2-architectural-principles)
3. [Glossary](#3-glossary)
4. [Current state — frozen snapshot](#4-current-state--frozen-snapshot)
5. [Target architecture — one paragraph](#5-target-architecture--one-paragraph)
6. [Monorepo strategy](#6-monorepo-strategy)
7. [Folder structure](#7-folder-structure)
8. [Store model — multi-store from day one](#8-store-model--multi-store-from-day-one)
9. [Universal Product schema](#9-universal-product-schema)
10. [Publisher abstraction](#10-publisher-abstraction)
11. [AI generation pipeline](#11-ai-generation-pipeline)
12. [Provider system](#12-provider-system)
13. [Database & schema strategy](#13-database--schema-strategy)
14. [Storage strategy](#14-storage-strategy)
15. [Queue & worker strategy](#15-queue--worker-strategy)
16. [Security strategy](#16-security-strategy)
17. [Scaling strategy](#17-scaling-strategy)
18. [Deployment strategy](#18-deployment-strategy)
19. [Draft / preview / publish flow](#19-draft--preview--publish-flow)
20. [Anti-patterns — explicit non-goals](#20-anti-patterns--explicit-non-goals)
21. [Migration phases](#21-migration-phases)
22. [Implementation roadmap](#22-implementation-roadmap)
23. [Decision log](#23-decision-log)
24. [Future extensibility](#24-future-extensibility)
25. [Appendix — open questions](#25-appendix--open-questions)
26. [Execution roadmap & live project memory (Steps 1–4)](#26-execution-roadmap--live-project-memory-steps-14)

---

## 1. Executive summary

We are building an **internal multi-store AI ecommerce production
platform**. From day one the codebase is a **monorepo** that hosts
multiple storefronts (`apps/fanaa/`, future `apps/<store>/`) and a
**central AI Studio** (`apps/studio/`) that generates structured product
content and publishes it into each store through a **publisher
abstraction**.

The AI Studio is **niche-aware** and **store-aware**: it takes a
supplier URL, 1–5 supplier images, and optional positioning notes, and
produces a publish-ready, Arabic-first product object tuned to the
target store's brand, niche, and templates. The same Studio can publish
to Fanaa today, to a sibling beauty/wellness store tomorrow, and — when
the publisher interface is implemented — to Shopify, TikTok Shop, or
any external system later.

**The existing Fanaa storefront is sacred.** All migration work is
**infrastructure-first**: code moves into the monorepo verbatim, no
business logic is rewritten, no PDP / checkout / thank-you / analytics
/ tracking / order behaviour changes. The monorepo migration must be
indistinguishable to Saudi end-users.

**Infrastructure decisions (final):**

- **Monorepo tooling**: `pnpm` workspaces + Turborepo
- **AI Studio runtime**: Next.js App Router (separate app from Fanaa)
- **Queue**: Inngest Cloud (durable step functions)
- **Object storage**: Cloudflare R2 (zero egress, S3-compatible)
- **Database**: PostgreSQL via Prisma (admin) + SQLAlchemy (orders) —
  single instance, multi-schema
- **Reasoning + Arabic copywriting**: Anthropic Claude 3.5 Sonnet
- **Image generation**: fal.ai (Flux Pro 1.1 + Recraft v3 for Arabic
  text in image)
- **URL scraping**: Firecrawl
- **OpenAI**: fallback only, never primary

---

## 2. Architectural principles

These are **non-negotiable**. Every implementation decision must satisfy
all eight. If a decision can't, escalate it as an ADR before
implementing.

1. **Production storefront is sacred.** Fanaa's storefront, checkout,
   upsell, thank-you, tracking, pixels, webhooks, Sheets sync, and
   admin analytics behave **identically** before and after every
   platform change. End-to-end smoke tests pass at every phase
   boundary.
2. **Infrastructure-first migration.** Code moves into the monorepo
   structure unchanged. Refactors, rewrites, and "while we're in
   there" cleanups are explicitly forbidden during migration phases.
3. **Multi-store from day one.** No code references Fanaa by name in
   the AI engine, providers, publishers, schemas, prompts, or worker
   logic. The Fanaa store is a **config**, not a special case.
4. **Universal output, store-specific rendering.** The AI generates a
   **Universal Product** — a normalized, store-agnostic shape.
   Publishers transform Universal Product into store-native shapes.
5. **Provider lock-in is a defect.** No code outside
   `packages/ai-engine/providers/` ever imports an AI vendor SDK
   directly. All provider calls go through the registry.
6. **Durable workflows over fire-and-forget.** Every generation step is
   a retryable, replayable Inngest step. No `asyncio.create_task`-style
   ghosts for anything that must succeed.
7. **Drafts and preview gate every publish.** No content goes live
   without preview + human approval. Auto-publish is a footgun.
8. **Cost ceilings are first-class.** Every draft has a hard cost
   budget. A misbehaving prompt cannot run up a $50 image bill
   overnight.

---

## 3. Glossary

| Term | Meaning |
|------|---------|
| **Platform** | The full monorepo: apps + services + packages. |
| **Storefront** | A customer-facing site (e.g. `apps/fanaa/`). |
| **Studio** | The internal AI production app (`apps/studio/`). |
| **Store** | A logical brand (Fanaa, Trendora, …) with its own niche, brand, templates, R2 bucket, and publisher. Storefront ↔ Store is 1:1. |
| **StoreConfig** | The single object describing a store — id, niche, brand, locale, currency, publisher, R2 bucket. |
| **BrandProfile** | Visual + tonal brand attributes (palette, fonts, voice). |
| **NicheProfile** | Category-specific tuning (beauty/wellness vs. fashion vs. electronics). |
| **Universal Product** | The canonical AI output schema. Store-agnostic. |
| **Publisher** | Adapter that materialises a Universal Product into a store-native shape. |
| **Pipeline** | The 13-stage AI generation process. |
| **Run** | One execution of the pipeline against one draft. |
| **Step** | One stage of a run (research, copy, image-gen, etc.). |
| **Artifact** | The output of a step — versioned, regeneratable. |
| **Asset** | A binary in R2 — uploaded supplier image OR generated image. |
| **Draft** | A `StudioDraft` row aggregating runs, artifacts, and assets. |
| **PR-publish** | Publishing by committing to `apps/<store>/data/products.ts` via the GitHub API (Octokit). |

---

## 4. Current state — frozen snapshot

Captured 2026-05-21. Use as the "before" boundary for migration.

### Repository layout (today)

```
mystores/                                     monorepo root (single repo)
├─ app/                                       Next.js 15 storefront (App Router)
│  ├─ admin/                                  Admin analytics (JWT-gated)
│  ├─ products/[slug]/                        Generic PDP
│  ├─ sugarbear/                              Bespoke landing for p_004
│  └─ thank-you/[orderId]/                    COD confirmation
├─ backend/                                   FastAPI orders service
│  └─ app/api/routes/{health,orders,geo,diagnostics}.py
├─ components/                                React UI
├─ data/products.ts                           Static catalog (4 SKUs)
├─ lib/                                       Storefront utilities (i18n, types, …)
├─ prisma/schema.prisma                       Admin analytics models
├─ docker-compose.yml                         3 services: web · api · postgres
└─ README.md
```

### Running services (today)

| Service | Container | Role |
|---------|-----------|------|
| `elfanaa_web` | Next.js 15 | Storefront + admin |
| `elfanaa_api` | FastAPI | Orders, pricing, pixels server-side |
| `elfanaa_database` | Postgres 16 | Both Prisma (admin) and SQLAlchemy (orders) |

### Not provisioned today

- ❌ Redis / queue
- ❌ Object storage (S3 / R2)
- ❌ AI provider keys
- ❌ Inngest
- ❌ Background workers
- ❌ DB-backed catalog (catalog is a TS file)

### Existing Prisma models (untouched by this migration)

`Visitor`, `Session`, `Event`, `OrderMirror`, `OrderMirrorItem`,
`TrafficQuality`, `AdminAudit`.

### Existing FastAPI SQLAlchemy models (untouched)

`Order`, `OrderItem`, `OrderEvent`.

### Existing admin nav (untouched)

```ts
[Overview, Orders, Funnel, Products, Geo, Traffic Quality, Settings]
```

---

## 5. Target architecture — one paragraph

A pnpm + Turborepo monorepo with **two app types** (storefronts at
`apps/<store>/` and a single Studio at `apps/studio/`), **two service
types** (`services/api/` FastAPI for orders, future workers if split),
and a **shared package layer** (`packages/`) that hosts the catalog
schema, AI engine, store registry, publisher registry, Prisma client,
and shared utilities. The AI Studio dispatches generation runs to
Inngest Cloud; workers call AI providers through a registry; outputs
are versioned in Postgres and stored in store-scoped R2 buckets. On
publish, the relevant **Publisher adapter** materialises the Universal
Product into the store's native shape (FanaaPublisher commits to
`apps/fanaa/data/products.ts`; future ShopifyPublisher posts to the
Shopify Admin API). The current Fanaa storefront is migrated into
`apps/fanaa/` byte-for-byte during phase A — no logic changes, only
moves.

### High-level system topology

```mermaid
flowchart TB
  subgraph Apps["apps/"]
    direction TB
    Studio["studio<br/>(Next.js admin)"]
    Fanaa["fanaa<br/>(Next.js storefront)"]
    Future["other stores...<br/>(future)"]
  end

  subgraph Services["services/"]
    API["api<br/>(FastAPI · orders)"]
  end

  subgraph Packages["packages/"]
    direction TB
    AIEngine["ai-engine"]
    Catalog["catalog-schema"]
    Publishers["publishers"]
    Stores["stores"]
    DB["db (Prisma)"]
    Shared["shared"]
  end

  subgraph Infra["External services"]
    Inngest["Inngest Cloud"]
    R2["Cloudflare R2"]
    Claude["Anthropic Claude"]
    FAL["fal.ai"]
    Firecrawl["Firecrawl"]
  end

  PG[(Postgres)]

  Studio --> AIEngine
  Studio --> Publishers
  Studio --> Stores
  AIEngine --> Inngest
  Inngest --> AIEngine
  AIEngine --> Claude
  AIEngine --> FAL
  AIEngine --> Firecrawl
  AIEngine --> R2
  Studio --> DB
  Publishers --> Fanaa
  Publishers --> Future
  Fanaa --> API
  Studio --> DB
  API --> PG
  DB --> PG
```

---

## 6. Monorepo strategy

### Tooling

| Choice | Picked | Rejected | Reason |
|--------|--------|----------|--------|
| Package manager / workspaces | **pnpm** | npm, yarn | Fastest install, strictest dedup, best workspace ergonomics. |
| Task runner / caching | **Turborepo** | Nx, none | Free remote cache on Vercel; minimal config; first-class Next.js. |
| TypeScript config | **shared `tsconfig.base.json`** | per-package configs from scratch | Single strictness baseline; each package extends. |
| Lint / format | **shared ESLint + Prettier config in `packages/config/`** | per-package | Consistency. |
| Versioning | **fixed workspace versions, no Changesets yet** | Changesets, semver | We don't publish packages externally; internal-only. |

### Workspace boundaries

- **`apps/*`** — Deployable Next.js or static apps. May depend on any
  `packages/*`. **Never** depend on another `apps/*`.
- **`services/*`** — Non-Next.js services (FastAPI, future workers).
  Independent build/deploy.
- **`packages/*`** — Shared libraries. May depend on other
  `packages/*` but never on `apps/*` or `services/*`.
- **`infra/*`** — Dockerfiles, EasyPanel manifests, Inngest configs,
  R2 bucket policies. No application code.
- **`docs/*`** — This document and its companions. No code.
- **`scripts/*`** — One-off operational scripts (catalog seeding,
  embedding backfills, migrations).

### Cross-app dependency rules

- A storefront (e.g. `apps/fanaa/`) **must not** depend on the Studio
  package surface for runtime — only on its publisher's *output*
  (committed `data/products.ts`).
- The Studio **may** depend on `packages/stores/` to know how to
  generate for a given store, but **never** imports from
  `apps/<store>/` directly.
- This keeps each storefront deployable independently of Studio
  changes.

---

## 7. Folder structure

The full target structure after Phase A migration. Paths marked
`(NEW)` do not exist today; `(MOVED)` exists today and is relocated
verbatim; `(KEPT)` exists today and stays where it is.

```
mystores/
├─ apps/
│  ├─ fanaa/                            (MOVED — current Next.js storefront + admin)
│  │  ├─ app/                           ↳ today's app/ folder verbatim
│  │  ├─ components/                    ↳ today's components/
│  │  ├─ data/products.ts               ↳ today's catalog file
│  │  ├─ lib/                           ↳ today's lib/
│  │  ├─ public/                        ↳ today's public/
│  │  ├─ middleware.ts                  ↳ today's middleware
│  │  ├─ next.config.mjs                ↳ today's config (paths updated)
│  │  ├─ package.json                   ↳ depends on @platform/* packages
│  │  └─ tsconfig.json                  ↳ extends ../../tsconfig.base.json
│  │
│  └─ studio/                           (NEW — multi-store AI production app)
│     ├─ app/
│     │  ├─ (auth)/                     ↳ login flow
│     │  ├─ drafts/                     ↳ list + create
│     │  ├─ drafts/[draftId]/
│     │  │  ├─ page.tsx                 ↳ canvas (sections + regen)
│     │  │  ├─ preview/page.tsx         ↳ live preview iframe
│     │  │  ├─ publish/page.tsx         ↳ publish confirmation
│     │  │  └─ runs/[runId]/page.tsx    ↳ run timeline + step logs
│     │  ├─ stores/                     ↳ store registry view
│     │  ├─ assets/                     ↳ R2 asset browser
│     │  ├─ providers/                  ↳ provider health + cost view
│     │  └─ settings/
│     ├─ api/
│     │  └─ admin/studio/               ↳ wizard + run + publish endpoints
│     ├─ components/                    ↳ Studio-only UI
│     ├─ middleware.ts                  ↳ JWT gate (mirrors fanaa pattern)
│     ├─ next.config.mjs
│     └─ package.json
│
├─ services/
│  ├─ api/                              (MOVED — FastAPI orders, formerly backend/)
│  │  ├─ app/
│  │  ├─ requirements.txt
│  │  ├─ Dockerfile
│  │  └─ pyproject.toml
│  │
│  └─ workers/                          (OPTIONAL · phase D — split-out Inngest workers)
│
├─ packages/
│  ├─ catalog-schema/                   (NEW — Universal Product + extensions)
│  │  ├─ src/
│  │  │  ├─ universal.ts                ↳ UniversalProduct type
│  │  │  ├─ extensions/                 ↳ per-store extension types
│  │  │  ├─ niches/                     ↳ niche-specific shape additions
│  │  │  ├─ locales.ts                  ↳ LocalizedString helpers (lifted from lib/types.ts)
│  │  │  └─ index.ts
│  │  └─ package.json                   ↳ @platform/catalog-schema
│  │
│  ├─ ai-engine/                        (NEW — provider-agnostic pipeline)
│  │  ├─ src/
│  │  │  ├─ providers/
│  │  │  │  ├─ contracts.ts             ↳ TextProvider, ImageProvider, …
│  │  │  │  ├─ registry.ts              ↳ env-driven resolver + chain
│  │  │  │  ├─ anthropic.ts
│  │  │  │  ├─ openai.ts                ↳ fallback only
│  │  │  │  ├─ fal.ts
│  │  │  │  ├─ firecrawl.ts
│  │  │  │  └─ index.ts
│  │  │  ├─ pipeline/
│  │  │  │  ├─ research.ts
│  │  │  │  ├─ vision.ts
│  │  │  │  ├─ strategy.ts
│  │  │  │  ├─ structure.ts
│  │  │  │  ├─ copy.ts
│  │  │  │  ├─ creative-prompts.ts
│  │  │  │  ├─ image-gen.ts
│  │  │  │  ├─ image-post.ts
│  │  │  │  ├─ social-proof.ts
│  │  │  │  ├─ upsell-match.ts
│  │  │  │  └─ assemble.ts              ↳ → UniversalProduct
│  │  │  ├─ schemas/                    ↳ Zod schemas per stage output
│  │  │  ├─ prompts/
│  │  │  │  ├─ system/                  ↳ system prompts (parameterized by NicheProfile)
│  │  │  │  └─ user/                    ↳ per-stage builders
│  │  │  └─ index.ts
│  │  └─ package.json                   ↳ @platform/ai-engine
│  │
│  ├─ publishers/                       (NEW — publisher adapters)
│  │  ├─ src/
│  │  │  ├─ contracts.ts                ↳ Publisher interface
│  │  │  ├─ registry.ts                 ↳ resolve by storeId
│  │  │  ├─ fanaa/
│  │  │  │  ├─ index.ts                 ↳ FanaaPublisher
│  │  │  │  ├─ to-fanaa-product.ts      ↳ UniversalProduct → fanaa Product
│  │  │  │  └─ commit-products-ts.ts    ↳ Octokit write to apps/fanaa/data/products.ts
│  │  │  ├─ shopify/                    (PLACEHOLDER · phase D)
│  │  │  └─ tiktok-shop/                (PLACEHOLDER · phase D)
│  │  └─ package.json                   ↳ @platform/publishers
│  │
│  ├─ stores/                           (NEW — store config registry)
│  │  ├─ src/
│  │  │  ├─ contracts.ts                ↳ StoreConfig, BrandProfile, NicheProfile, Templates
│  │  │  ├─ registry.ts                 ↳ getStore(id) + listStores()
│  │  │  ├─ niches/
│  │  │  │  ├─ beauty-wellness.ts
│  │  │  │  ├─ fashion.ts                  (future)
│  │  │  │  └─ electronics.ts              (future)
│  │  │  └─ stores/
│  │  │     └─ fanaa.ts                 ↳ Fanaa StoreConfig instance
│  │  └─ package.json                   ↳ @platform/stores
│  │
│  ├─ workers/                          (NEW — Inngest functions)
│  │  ├─ src/
│  │  │  ├─ client.ts                   ↳ new Inngest({ id: "platform" })
│  │  │  ├─ functions/
│  │  │  │  ├─ run-pipeline.ts          ↳ orchestrator
│  │  │  │  ├─ regenerate-section.ts
│  │  │  │  ├─ retry-failed-step.ts
│  │  │  │  └─ publish-draft.ts
│  │  │  └─ middleware/
│  │  │     ├─ with-draft-lock.ts
│  │  │     ├─ with-cost-ceiling.ts
│  │  │     └─ with-store-context.ts
│  │  └─ package.json                   ↳ @platform/workers
│  │
│  ├─ prompts/                          (NEW — reusable prompt fragments)
│  │  ├─ src/
│  │  │  ├─ voice/                      ↳ tone + style fragments per BrandProfile
│  │  │  ├─ guardrails/                 ↳ safety, factuality, no-claims fragments
│  │  │  └─ contexts/                   ↳ Saudi cultural pack, GCC dialect notes
│  │  └─ package.json                   ↳ @platform/prompts
│  │
│  ├─ ui/                               (NEW — minimal shared admin primitives, OPTIONAL)
│  │  └─ src/                           ↳ Studio-shared only — storefront keeps its own
│  │
│  ├─ db/                               (MOVED — Prisma schema + client)
│  │  ├─ prisma/schema.prisma           ↳ today's prisma/schema.prisma
│  │  ├─ src/
│  │  │  ├─ client.ts                   ↳ PrismaClient singleton export
│  │  │  └─ types.ts                    ↳ re-exports for type ergonomics
│  │  └─ package.json                   ↳ @platform/db
│  │
│  ├─ shared/                           (NEW — small utilities)
│  │  ├─ src/
│  │  │  ├─ id/                         ↳ cuid / ulid helpers
│  │  │  ├─ logger/                     ↳ structured logger
│  │  │  ├─ env/                        ↳ Zod-validated env loader
│  │  │  ├─ result/                     ↳ Result<T,E> helpers
│  │  │  └─ index.ts
│  │  └─ package.json                   ↳ @platform/shared
│  │
│  └─ config/                           (NEW — shared eslint/prettier/tsconfig presets)
│     ├─ eslint/
│     ├─ prettier/
│     └─ tsconfig/
│
├─ infra/
│  ├─ docker/                           (MOVED — Dockerfiles per app/service)
│  │  ├─ fanaa.Dockerfile
│  │  ├─ studio.Dockerfile
│  │  └─ api.Dockerfile
│  ├─ docker-compose.yml                (MOVED — paths updated)
│  ├─ easypanel/                        (NEW — manifests per service)
│  ├─ inngest/                          (NEW — local dev config)
│  └─ r2/                               (NEW — bucket policy specs)
│
├─ docs/
│  └─ architecture/
│     ├─ PLATFORM.md                    (THIS DOCUMENT)
│     ├─ RUNBOOK.md                     (future)
│     ├─ MIGRATION-LOG.md               (future — append-only)
│     └─ decisions/                     (future — ADRs)
│
├─ scripts/                             (KEPT — top-level operational scripts)
├─ pnpm-workspace.yaml                  (NEW)
├─ turbo.json                           (NEW)
├─ tsconfig.base.json                   (NEW)
├─ package.json                         (root — workspace orchestration)
├─ README.md                            (KEPT — points to docs/architecture/PLATFORM.md)
└─ .env.example                         (KEPT — extended with new platform vars)
```

### Package naming convention

All shared packages use the `@platform/*` namespace:
`@platform/catalog-schema`, `@platform/ai-engine`, `@platform/publishers`,
etc. Apps depend on these by name in their `package.json`.

---

## 8. Store model — multi-store from day one

The Studio NEVER hardcodes Fanaa. A store is a config:

### `StoreConfig` (contract sketch, lives in `packages/stores/`)

```ts
type StoreId = string;          // "fanaa" | "trendora" | …
type NicheId =
  | "beauty_wellness"
  | "fashion"
  | "electronics"
  | "home"
  | "fitness"
  | string;                     // open string for future niches

type PublisherId =
  | "fanaa"
  | "shopify"
  | "tiktok_shop"
  | string;

type StoreStatus = "live" | "incubating" | "archived";

interface StoreConfig {
  id: StoreId;
  displayName: LocalizedString;

  status: StoreStatus;

  // Catalog character
  niche: NicheId;
  defaultLocale: Locale;          // "ar"
  supportedLocales: Locale[];     // ["ar", "en"]
  currency: string;               // "SAR"
  market: string;                 // "SA" (ISO 3166-1)

  // Branding + tone
  brand: BrandProfile;
  nicheProfile: NicheProfile;

  // Generation templates available for this store
  templates: StoreTemplates;

  // Publisher binding
  publisher: PublisherId;

  // Storage scope
  r2Bucket: string;               // "fanaa-assets"
  r2PublicBaseUrl: string;        // "https://cdn.elfanaa.com"

  // Routing
  domains: string[];              // ["elfanaa.com"]
  appWorkspace: string;           // "apps/fanaa"

  // Operational
  costCeilingPerDraftUsd: number; // default 5
  approvedProviders?: Partial<ProviderAllowlist>;  // override defaults
}
```

### `BrandProfile`

```ts
interface BrandProfile {
  name: LocalizedString;
  tagline: LocalizedString;
  palette: {
    bg: string;          // hex
    surface: string;
    ink: string;
    accent: string;
    accentSoft: string;
    success: string;
  };
  typography: {
    sans: string;
    display: string;
    arabic: string;
    arabicDisplay: string;
  };
  voice: {
    register: "luxury" | "playful" | "clinical" | "youthful" | "premium-utility";
    dialect: "MSA" | "Saudi" | "Khaleeji" | "Egyptian" | "Levantine";
    forbidden_words: string[];          // claims, superlatives, etc.
    house_style_notes: string;          // free-text "always do / never do"
  };
}
```

### `NicheProfile`

```ts
interface NicheProfile {
  id: NicheId;
  /** Section taxonomy this niche supports */
  sections: SectionKind[];
  /** Niche-specific Universal Product extensions (e.g. ingredients) */
  productExtensions: ProductExtensionKind[];
  /** Claims/legal guardrails — system prompt fragment */
  legalGuardrails: string;
  /** Realistic results-window for "when do results appear?" copy */
  expectationsModel: ExpectationsModel;
  /** Default ad-hook angles for this niche */
  defaultAngles: string[];
}
```

### `StoreTemplates`

```ts
interface StoreTemplates {
  /** Generic PDP route — store-specific template ID */
  defaultPdp: "fanaa.generic_pdp" | "fanaa.bespoke_landing" | string;
  /** Which sections are available */
  sectionLibrary: SectionKind[];
  /** Section ordering preferences per template */
  orderings: Record<string, SectionKind[]>;
}
```

### How Fanaa becomes a config

Fanaa today has:
- Generic PDP at `app/products/[slug]/page.tsx`
- Bespoke landing at `app/sugarbear/page.tsx`
- Arabic copy in `lib/i18n/dictionaries.ts` + `app/sugarbear/copy.ts`
- Brand palette in `styles/tokens.css`

These become **inputs** to a `StoreConfig` instance for Fanaa. Nothing
in `apps/fanaa/` reads from the Studio; nothing in the Studio reads
from `apps/fanaa/` (only its config in `packages/stores/`).

---

## 9. Universal Product schema

The single most important contract in the platform.

### Why universal?

If the AI engine outputs a Fanaa-shaped object, adding a second store
requires rewriting the engine. If the AI engine outputs a universal
shape, adding a second store requires writing a new **publisher**.
Publishers are small and replaceable; engines are large and not.

### Shape (canonical, lives in `packages/catalog-schema/`)

```ts
import type { LocalizedString, Money, Locale } from "./locales";

export interface UniversalProduct {
  // ── Identity ────────────────────────────────────────────────────
  /** Stable, generated. Format: `up_<cuid>`. */
  id: string;
  /** SEO slug generated from title. Store publishers may override. */
  slug: string;
  /** Niche this product was generated for. */
  niche: NicheId;
  /** Generating store context (for provenance, not store-coupling). */
  storeContext: StoreId;
  generationRunId: string;
  generatedAt: string;            // ISO-8601

  // ── Customer-facing core ───────────────────────────────────────
  title: LocalizedString;
  description: LocalizedString;
  headline?: LocalizedString;
  subheadline?: LocalizedString;

  // ── Value content ──────────────────────────────────────────────
  benefits: ProductBenefit[];        // 4–6 typical
  features?: ProductFeature[];       // optional, niche-specific
  ingredients?: ProductIngredient[]; // beauty/wellness niche
  specifications?: ProductSpec[];    // electronics/fashion niche
  certifications?: ProductCert[];    // SFDA, CE, …

  // ── Visual ─────────────────────────────────────────────────────
  images: ProductImage[];            // hero first, then gallery
  lifestyleImages?: ProductImage[];

  // ── Social proof ──────────────────────────────────────────────
  reviews: ProductReview[];          // 3–6 generated, realistic
  rating?: { value: number; count: number };

  // ── Conversion ────────────────────────────────────────────────
  faq: ProductFaq[];                 // 5–7 COD-objection-tuned

  // ── Pricing hints (publisher decides offers) ─────────────────
  priceHint: Money;                  // suggested unit price
  marginNotes?: string;              // internal: "supplier $X, ship $Y"

  // ── Ad / paid marketing ──────────────────────────────────────
  hooks: AdHook[];                   // 5 hooks for Meta/TikTok

  // ── Cross-sell suggestions ────────────────────────────────────
  upsellSuggestions?: string[];      // universal product IDs

  // ── Provenance ────────────────────────────────────────────────
  sources: {
    supplierUrl: string;
    scrapedAt: string;
    uploadedImages: string[];       // r2 keys
  };
}
```

Supporting types (`ProductBenefit`, `ProductFaq`, `ProductReview`, etc.)
mirror the current Fanaa `lib/types.ts` shapes but with `LocalizedString`
fields for every customer-facing string. Fanaa-specific fields (e.g.
`offerTiers`, `landingPath`, `stockLeft`) live in **publisher-specific
extensions**, not in the universal shape.

### Niche extensions

Each niche can extend the universal shape:

```ts
// packages/catalog-schema/src/niches/beauty-wellness.ts
export interface BeautyWellnessExtension {
  skinTypes?: ("oily" | "dry" | "combination" | "sensitive")[];
  concerns?: ("aging" | "hydration" | "pigmentation")[];
  routineSuggestion?: RoutineStep[];
}
```

The Studio runs niche-specific pipeline stages that populate these.
Publishers may or may not consume them.

---

## 10. Publisher abstraction

### Why a publisher abstraction?

Different stores live in different worlds. Fanaa stores its catalog in
a TypeScript file. A future Shopify store will use the Shopify Admin
API. A future TikTok Shop will use TikTok's catalog API. The
**Publisher** abstracts away "where does the live product live?".

### Contract (`packages/publishers/src/contracts.ts`)

```ts
export interface Publisher {
  /** Stable identifier — matches StoreConfig.publisher */
  id: PublisherId;

  /** Pre-flight validation. Catches schema mismatches before commit. */
  validate(opts: {
    universalProduct: UniversalProduct;
    storeConfig: StoreConfig;
  }): Promise<ValidationResult>;

  /**
   * Materialise the universal product into the store's native shape
   * and write/commit/post it to wherever the store reads from.
   */
  publish(opts: {
    draftId: string;
    universalProduct: UniversalProduct;
    storeConfig: StoreConfig;
    actor: string;            // admin email — for audit
  }): Promise<PublishResult>;

  /** Remove or hide a previously-published product. */
  unpublish(opts: {
    productId: string;
    storeConfig: StoreConfig;
    actor: string;
  }): Promise<UnpublishResult>;

  /** Render a preview in the store's actual chrome. */
  preview(opts: {
    universalProduct: UniversalProduct;
    storeConfig: StoreConfig;
  }): Promise<PreviewLocation>;
}

export interface PublishResult {
  storeId: StoreId;
  storeProductId: string;     // slug for Fanaa, gid for Shopify, etc.
  liveUrl: string;
  /** Git SHA for PR-publishers; null for API-publishers. */
  commitSha?: string;
  /** External system reference (Shopify product ID, etc.). */
  externalRef?: string;
  publishedAt: string;
}
```

### Reference implementation: `FanaaPublisher`

- **Materialise**: `UniversalProduct → Fanaa Product (lib/types.ts)`.
  Adds `landingPath` only if the chosen template is bespoke; computes
  `offerTiers` from `priceHint` via Fanaa's existing pricing rules;
  uses `LocalizedString` directly.
- **Write**: append/update the entry in `apps/fanaa/data/products.ts`
  via the Octokit REST API. Opens a PR if `STORE_PUBLISH_MODE=pr`,
  commits to main directly if `=direct`. Default is `pr` for safety.
- **Preview**: returns a Studio-internal URL that renders the actual
  `apps/fanaa/` PDP component tree against a `Product` object held in
  memory (no temporary commit).

### Future publishers (placeholders, not implemented yet)

| Publisher | Mechanism | Trigger |
|-----------|-----------|---------|
| `ShopifyPublisher` | Shopify Admin GraphQL `productCreate` | When the first Shopify-backed store is added. |
| `TikTokShopPublisher` | TikTok Shop Catalog API | Future. |
| `MetaCatalogPublisher` | Meta Commerce Catalog feed | Future — likely paired alongside a primary publisher rather than as a sole publisher. |

A store may have **one primary publisher** + N **broadcast publishers**
(future). The primary publisher owns the live URL; broadcast publishers
mirror the product to ad-platform catalogs.

---

## 11. AI generation pipeline

13 stages. Every stage is a typed Inngest `step.run()`. Every stage's
output is validated by a Zod schema. Every stage receives the
`StoreConfig` as context so prompts adapt automatically.

### Pipeline overview

```mermaid
flowchart LR
  I[Intake] --> R[Research]
  R --> V[Vision]
  V --> S[Strategy]
  S --> ST[Structure]
  ST --> C[Copy]
  C --> CP[Creative Prompts]
  CP --> IG[Image Gen]
  IG --> IP[Image Post-process]
  IP --> SP[Social Proof + FAQ + Hooks]
  SP --> UM[Upsell Match]
  UM --> A[Assemble Universal Product]
  A --> RDY[Ready for Preview]
```

### Stage-by-stage contract

| # | Stage | Lives in | Provider | Latency | Failure mode |
|---|-------|----------|----------|---------|--------------|
| 01 | Intake | `apps/studio/api/admin/studio/drafts/route.ts` | none (sync) | <800ms | Zod-reject on submit |
| 02 | Research / scrape | `ai-engine/pipeline/research.ts` | Firecrawl → Browserless fallback | 10–30s | If both fail, mark skipped; downstream uses only vision |
| 03 | Vision analysis | `ai-engine/pipeline/vision.ts` | Claude 3.5 vision (primary) | 8–15s | retry-once-higher-temp; skip on second fail |
| 04 | Strategy synthesis | `ai-engine/pipeline/strategy.ts` | Claude 3.5 | 12–20s | Zod-validated; auto-retry with "fix JSON" reprompt |
| 05 | Section structure | `ai-engine/pipeline/structure.ts` | Claude 3.5 | 6–10s | Fallback to `StoreConfig.templates.orderings.default` |
| 06 | Arabic copywriting | `ai-engine/pipeline/copy.ts` | Claude 3.5 (Arabic system prompt + BrandProfile.voice) | 25–45s | Validate AR codepoint coverage; rewrite if mixed-locale bleeds |
| 07 | Creative prompts | `ai-engine/pipeline/creative-prompts.ts` | Claude 3.5 | 5–10s | Always emits hero prompt; lifestyle prompts optional |
| 08 | Image generation | `ai-engine/pipeline/image-gen.ts` | fal.ai Flux Pro 1.1 (primary), Recraft v3 (text-in-image) | 20–60s parallel | Per-prompt 3× retry + provider fallback; partial success accepted |
| 09 | Image post-process | `ai-engine/pipeline/image-post.ts` | Sharp (in-worker) + optional fal.ai upscale | 3–8s | Skip variant on Sharp throw |
| 10 | Social proof + FAQ + hooks | `ai-engine/pipeline/social-proof.ts` | Claude 3.5 | 10–18s | Realistic-name + dialect validation; reject if generic |
| 11 | Upsell match | `ai-engine/pipeline/upsell-match.ts` | pgvector cosine over `StudioAsset.embedding` | <2s | Fallback to store best-sellers |
| 12 | Assembly | `ai-engine/pipeline/assemble.ts` | pure TS | <500ms | Validate against `UniversalProduct` schema |
| 13 | Ready | `workers/run-pipeline.ts` terminal step | DB transition | <200ms | terminal |

### Pipeline kernel (sketch)

```ts
export const runPipeline = inngest.createFunction(
  {
    id: "studio/run-pipeline",
    concurrency: { key: "event.data.draftId", limit: 1 },
    onFailure: notifyStudioEvent,
  },
  { event: "studio/draft.dispatch" },
  async ({ event, step }) => {
    const storeConfig = await step.run("load-store", () =>
      stores.get(event.data.storeId)
    );

    const research = await step.run("research", () =>
      pipeline.research(event.data.supplierUrl, storeConfig)
    );
    const vision = await step.run("vision", () =>
      pipeline.vision(event.data.uploadedAssetKeys, storeConfig)
    );
    const strategy = await step.run("strategy", () =>
      pipeline.strategy({ research, vision, storeConfig })
    );
    const structure = await step.run("structure", () =>
      pipeline.structure({ strategy, storeConfig })
    );
    const copy = await step.run("copy", () =>
      pipeline.copy({ strategy, structure, storeConfig })
    );
    const prompts = await step.run("creative-prompts", () =>
      pipeline.creativePrompts({ strategy, structure, storeConfig })
    );
    const images = await Promise.all(
      prompts.images.map((p, i) =>
        step.run(`image-${i}`, () => pipeline.imageGen(p, storeConfig))
      )
    );
    const processed = await step.run("image-post", () =>
      pipeline.imagePost({ images, storeConfig })
    );
    const social = await step.run("social-proof", () =>
      pipeline.socialProof({ strategy, storeConfig })
    );
    const upsells = await step.run("upsell-match", () =>
      pipeline.upsellMatch({ strategy, storeConfig })
    );
    const universal = await step.run("assemble", () =>
      pipeline.assemble({
        research, vision, strategy, structure, copy, prompts,
        images: processed, social, upsells, storeConfig,
      })
    );

    await step.run("mark-ready", () =>
      drafts.markReady(event.data.draftId, universal)
    );
  }
);
```

### Per-section regeneration

Each section is also exposed as a standalone Inngest function (e.g.
`regenerateCopy`, `regenerateImages`). The Studio UI shows a
"regenerate" button per section. The function runs the stage in
isolation, writes a new `StudioArtifact` version, and the draft's
preview rebuilds.

---

## 12. Provider system

### Contracts (`packages/ai-engine/src/providers/contracts.ts`)

```ts
export interface TextProvider {
  id: ProviderId;
  generate<T>(opts: {
    system: string;
    prompt: string;
    schema?: ZodSchema<T>;      // structured output when set
    temperature?: number;
    maxTokens?: number;
    storeId: StoreId;           // for cost attribution
    runId?: string;
  }): Promise<TextResult<T>>;
}

export interface VisionProvider {
  id: ProviderId;
  analyze<T>(opts: {
    images: ImageRef[];         // R2 keys or absolute URLs
    instructions: string;
    schema?: ZodSchema<T>;
    storeId: StoreId;
    runId?: string;
  }): Promise<VisionResult<T>>;
}

export interface ImageProvider {
  id: ProviderId;
  cost: { perImageUsd: number };
  generate(opts: {
    prompt: string;
    negative?: string;
    size: { w: number; h: number };
    referenceImages?: ImageRef[];
    storeId: StoreId;
    runId?: string;
  }): Promise<ImageResult>;     // { r2Key, bytes, seed, durationMs }
}

export interface ScraperProvider {
  id: ProviderId;
  fetch(url: string, opts?: ScrapeOptions): Promise<ScrapeResult>;
}

export interface EmbeddingProvider {
  id: ProviderId;
  embed(opts: { input: string; storeId: StoreId }): Promise<number[]>;
}
```

### Registry (`packages/ai-engine/src/providers/registry.ts`)

```ts
type ProviderChain<T> = {
  primary: T;
  fallbacks: T[];
};

export const registry = {
  text: resolveChain<TextProvider>("STUDIO_TEXT_PROVIDERS"),
  vision: resolveChain<VisionProvider>("STUDIO_VISION_PROVIDERS"),
  image: resolveChain<ImageProvider>("STUDIO_IMAGE_PROVIDERS"),
  scraper: resolveChain<ScraperProvider>("STUDIO_SCRAPER_PROVIDERS"),
  embedding: resolveChain<EmbeddingProvider>("STUDIO_EMBED_PROVIDERS"),
};
```

Each env var is a comma-separated chain: `anthropic,openai` means
Anthropic primary, OpenAI fallback. A `StoreConfig` can override the
chain via `approvedProviders`.

### Adapter table

| Capability | Adapter | Vendor | Status | Env keys |
|-----------|---------|--------|--------|----------|
| Text — reasoning + Arabic | `anthropic.ts` | Anthropic | Required | `ANTHROPIC_API_KEY` |
| Text — fallback | `openai.ts` | OpenAI | Fallback only | `OPENAI_API_KEY` |
| Vision | `anthropic.ts` (vision) | Anthropic | Required | (same) |
| Vision — fallback | `openai.ts` (vision) | OpenAI | Fallback only | (same) |
| Image — photo | `fal.ts` (Flux Pro 1.1) | fal.ai | Required | `FAL_KEY` |
| Image — Arabic text in image | `fal.ts` (Recraft v3) | fal.ai | Required | (same) |
| Scraper | `firecrawl.ts` | Firecrawl | Required | `FIRECRAWL_API_KEY` |
| Embedding | `openai.ts` (text-embedding-3-small) | OpenAI | Required | `OPENAI_API_KEY` |

OpenAI is **fallback only** for text and vision, **primary** for
embeddings (cheap, stable, multilingual enough). No other vendor
relationships are part of v1.

### Provider observability

Every provider call writes to `StudioStep`:

- `providerId` — which adapter
- `tokensIn`, `tokensOut` — billing
- `costCents` — pre-computed via adapter's price table
- `latencyMs`
- `attemptCount`
- `errorMessage` on fail

A `/admin/studio/providers` dashboard rolls these up.

---

## 13. Database & schema strategy

### One Postgres instance, two ORMs (unchanged)

- **Prisma** owns the admin/analytics schema and the new Studio schema.
- **SQLAlchemy** (FastAPI) owns the orders schema.
- They share the same Postgres database; tables are namespaced by
  prefix (`Studio*`, `Order*`, `Visitor`/`Session`/`Event`).

### New Studio tables (added to `packages/db/prisma/schema.prisma`)

```prisma
model StudioStore {
  id              String   @id              // matches StoreId in code
  displayName     String
  status          StudioStoreStatus
  configHash      String                    // SHA of last applied StoreConfig
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  drafts          StudioDraft[]
  events          StudioEvent[]
  @@index([status])
}

enum StudioStoreStatus { live incubating archived }

model StudioDraft {
  id              String   @id @default(cuid())
  storeId         String
  store           StudioStore @relation(fields: [storeId], references: [id])
  slug            String                    // generated, unique per store
  title           String
  supplierUrl     String?
  notes           String?
  positioning     String?
  status          StudioDraftStatus @default(intake)
  template        String                    // matches StoreTemplates entry
  costCents       Int      @default(0)
  publishedAt     DateTime?
  publishedRef    String?                   // commitSha or externalRef
  createdBy       String                    // admin email
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  runs            StudioRun[]
  assets          StudioAsset[]
  artifacts       StudioArtifact[]
  @@unique([storeId, slug])
  @@index([storeId, status])
  @@index([createdAt])
}

enum StudioDraftStatus {
  intake generating ready publishing published archived failed
}

model StudioRun {
  id              String   @id @default(cuid())
  draftId         String
  draft           StudioDraft @relation(fields: [draftId], references: [id])
  inngestRunId    String?                   // for replay deep-link
  status          StudioRunStatus @default(queued)
  costCents       Int      @default(0)
  startedAt       DateTime?
  finishedAt      DateTime?
  errorMessage    String?
  inputSnapshot   Json                      // for deterministic replay
  steps           StudioStep[]
  @@index([draftId])
  @@index([status])
}

enum StudioRunStatus { queued running succeeded failed cancelled }

model StudioStep {
  id              String   @id @default(cuid())
  runId           String
  run             StudioRun @relation(fields: [runId], references: [id])
  kind            String                    // "research" | "strategy" | …
  status          StudioStepStatus @default(pending)
  providerId      String?
  inputHash       String?                   // for content-addressed caching
  attemptCount    Int      @default(0)
  costCents       Int      @default(0)
  tokensIn        Int?
  tokensOut       Int?
  latencyMs       Int?
  startedAt       DateTime?
  finishedAt      DateTime?
  errorMessage    String?
  output          Json?
  @@index([runId, kind])
}

enum StudioStepStatus { pending running succeeded failed skipped }

model StudioArtifact {
  id                String   @id @default(cuid())
  draftId           String
  draft             StudioDraft @relation(fields: [draftId], references: [id])
  kind              String                  // section identifier
  locale            String?                 // "ar" | "en" | null
  version           Int      @default(1)
  isCurrent         Boolean  @default(true)
  payload           Json                    // structured output
  generatedByStepId String?
  createdAt         DateTime @default(now())
  @@unique([draftId, kind, locale, version])
  @@index([draftId, isCurrent])
}

model StudioAsset {
  id          String   @id @default(cuid())
  draftId     String
  draft       StudioDraft @relation(fields: [draftId], references: [id])
  source      StudioAssetSource
  r2Bucket    String                        // store-scoped bucket
  r2Key       String   @unique
  contentType String
  bytes       Int
  width       Int?
  height      Int?
  altAr       String?
  altEn       String?
  embedding   Unsupported("vector(1536)")?  // pgvector
  createdAt   DateTime @default(now())
  @@index([draftId, source])
}

enum StudioAssetSource { upload scraped generated }

model StudioEvent {
  id          String   @id @default(cuid())
  storeId     String?
  store       StudioStore? @relation(fields: [storeId], references: [id])
  draftId     String?
  kind        String                        // "draft.created" | "publish.committed" | …
  actor       String                        // email or "system"
  payload     Json?
  createdAt   DateTime @default(now())
  @@index([storeId, kind, createdAt])
  @@index([draftId, createdAt])
}
```

### Migration discipline

- Studio schema lands as an **additive** Prisma migration. Zero changes
  to existing analytics tables.
- FastAPI's SQLAlchemy schema is untouched.
- pgvector extension is added on the same Postgres instance.

---

## 14. Storage strategy

### Cloudflare R2

| Concern | Decision |
|---------|----------|
| Bucket per store | `<storeId>-assets` (e.g. `fanaa-assets`) |
| Bucket access | Private origin + public CDN on a store-owned subdomain |
| Public URL pattern | `https://cdn.<store>.com/<r2Key>` |
| Upload mode | Browser → presigned PUT (no bytes through Studio server) |
| Key naming | `studio/<draftId>/<sourceKind>/<ulid>.<ext>` |
| Lifecycle | Drafts archived >180 days → R2 lifecycle rule deletes assets |

### Why R2 not S3

- $0 egress (every `next/image` variant rewrite is free).
- S3-compatible API — every existing tool/SDK works.
- Single-org billing alongside the storefront's Cloudflare presence.

---

## 15. Queue & worker strategy

### Inngest Cloud (final)

- **Why Cloud and not self-hosted**: zero ops, free tier covers months
  of internal use, observability UI included.
- **Function organisation**: one `Inngest({ id: "platform" })` client in
  `packages/workers/src/client.ts`. Functions are imported by both:
  - `apps/studio/api/admin/inngest/route.ts` (webhook receiver)
  - Any future split-out worker app (Phase D)

### Concurrency rules

| Function | Concurrency key | Limit |
|----------|----------------|-------|
| `run-pipeline` | `draftId` | 1 (no parallel runs per draft) |
| `regenerate-section` | `draftId + sectionKind` | 1 |
| `image-gen` (sub-step) | `storeId` | 8 (per-store image fan-out cap) |
| `publish-draft` | `draftId` | 1 |

### Retries

| Step kind | Max attempts | Backoff |
|-----------|-------------|---------|
| Provider call (text/vision/image) | 3 | 1s → 5s → 25s |
| Sharp post-processing | 2 | linear |
| Octokit publish | 5 | exponential, jittered |
| Assemble | 1 | n/a (deterministic) |

### Replay

A failed run's UI exposes "Replay from step X" — Inngest's native
feature. Replaying is free if the step is a pure function of its
inputs (true for all stages except image gen, which is intentionally
non-deterministic and uses cached `seed` for partial determinism).

### Cost ceilings

`packages/workers/src/middleware/with-cost-ceiling.ts` wraps the
pipeline orchestrator. After each step it checks
`draft.costCents > storeConfig.costCeilingPerDraftUsd * 100` and
cancels with a `cost_exceeded` failure if so. Default `$5`.

### Why not pg-boss / graphile-worker

Initial recommendation included these as "zero new infra" options.
**Final decision is Inngest Cloud** because (a) the platform is already
adding Cloudflare R2 and AI vendor accounts so "zero new accounts" is
no longer a tiebreaker, and (b) Inngest's step-function model is a
direct match for the pipeline shape; graphile-worker would force us
to rebuild orchestration plumbing the team would otherwise spend on
prompts.

---

## 16. Security strategy

### Identity & auth

| Surface | Mechanism |
|---------|-----------|
| Fanaa admin | Existing JWT cookie (`ADMIN_AUTH_COOKIE` / `_fa_admin`). Unchanged. |
| Studio admin | Same JWT cookie scheme, separate cookie name (`_studio_session`) to allow simultaneous sessions across apps. |
| Inngest webhook → Studio | Inngest signing key in env (`INNGEST_SIGNING_KEY`) |
| Studio → providers | Per-provider API keys in env; no per-user credentials |
| Publish via PR | Single bot GitHub PAT with `repo` scope on this repository only |
| R2 uploads | Browser-side presigned PUTs; presign endpoint requires Studio JWT |

### Role separation

Studio defines roles in `StudioEvent.actor`. Initial role set:

- `studio:owner` — full publish, draft delete, provider config
- `studio:editor` — draft create + regenerate, no publish
- `studio:viewer` — read-only

Roles encoded in the JWT payload as `studio_role`. Middleware enforces
on every Studio API route.

### Provider key vault

Provider keys live **only** in env, **never** in DB. Studio operators
do not see keys; they see a `providers/` health page listing
configured providers and recent error rates.

### Audit log

`StudioEvent` is the audit trail. Every state transition (`draft.*`,
`run.*`, `step.*`, `publish.*`) writes an event with `actor`. Events
are immutable.

### Secrets in transit

- All inter-service HTTPS in prod (EasyPanel handles cert termination).
- No secrets in URLs, query strings, or logs (logger redacts
  `Authorization`, `set-cookie`, `apiKey` patterns by default).

---

## 17. Scaling strategy

| Resource | Today | At 10× | Mitigation |
|----------|-------|--------|-----------|
| Inngest concurrency | Default 200 | 1000+ | Configure per-function caps; throttle image-gen to 8 parallel per store |
| Provider RPS | Anthropic 50 RPS · fal.ai 10 RPS | Throttled | Adapter-level token-bucket; auto-degrade to fallback chain |
| Postgres writes | Analytics dominates | StudioEvent + StudioStep heavy | Partition `StudioEvent` at 1M rows; archive runs > 90 days |
| R2 bandwidth | $0 egress | Same | None needed — R2 chosen for this |
| Bundle size | Provider SDKs heavy | Bigger | Workers server-only; tree-shake adapters; never ship to client |
| `data/products.ts` line count | 4 SKUs / 800 LoC | 50 SKUs / 10000 LoC | Phase B → C: migrate Fanaa to DB-backed catalog (deferred) |
| Number of stores | 1 (Fanaa) | 5+ | Multi-store from day 1 — no scaling step needed for "add store" |

### Vertical limits

- **Single Postgres instance** is fine up to ~1M Studio events and
  ~50k drafts. Beyond that, move `Studio*` schema to a separate
  database within the same cluster (Prisma supports it via separate
  schemas).
- **Single Inngest project** holds many functions; no scaling action
  required.
- **Studio app** is stateless; horizontal scale by adding instances.

---

## 18. Deployment strategy

### EasyPanel (current platform)

Today: 3 containers (`web`, `api`, `database`). After Phase A: 4 (split
`web` → `fanaa` + `studio`). After Phase C: N storefronts + 1 studio +
1 api.

### Container plan

| Container | Source | Build |
|-----------|--------|-------|
| `fanaa` | `apps/fanaa/` | `infra/docker/fanaa.Dockerfile` |
| `studio` | `apps/studio/` | `infra/docker/studio.Dockerfile` |
| `api` | `services/api/` | `infra/docker/api.Dockerfile` |
| `database` | Postgres image | unchanged |
| Future store | `apps/<store>/` | per-store Dockerfile |

### Image build

Turborepo's remote cache speeds CI on shared package changes. Each
container's Dockerfile builds only the relevant workspace using
`pnpm deploy` semantics (or `pnpm --filter <app> deploy` to a thin
output folder).

### Per-deploy boundaries

- **Storefront changes** (`apps/fanaa/`) → deploy only `fanaa` container.
- **Studio changes** (`apps/studio/`) → deploy only `studio` container.
- **Shared package changes** (`packages/*`) → deploy all dependent
  containers (Turborepo's `--filter` graph gives the list).
- **API changes** (`services/api/`) → deploy only `api` container.
- **Schema changes** (`packages/db/prisma/`) → migration runs as part
  of `studio` container start (Studio owns the schema).

### Environment

- **Local dev**: pnpm at root; `pnpm dev` runs everything via Turborepo;
  Inngest dev server runs locally in a separate terminal.
- **Staging**: optional separate EasyPanel project pointing to a
  separate Postgres + R2 bucket; same Inngest project with `STUDIO_ENV=staging`.
- **Production**: current EasyPanel project, extended with new
  containers.

### Storefront-deploy invariance

Phase A's success criterion: changing **anything** in `apps/studio/`,
`packages/ai-engine/`, `packages/publishers/`, `packages/workers/`
**must not require a Fanaa storefront redeploy**. This is the firewall
that keeps the production storefront safe.

---

## 19. Draft / preview / publish flow

```mermaid
sequenceDiagram
  actor Op as Studio operator
  participant UI as Studio UI
  participant API as Studio API
  participant DB as Postgres (Prisma)
  participant Q as Inngest Cloud
  participant W as Workers (TS)
  participant R2 as Cloudflare R2
  participant P as AI Providers
  participant Pub as FanaaPublisher
  participant GH as GitHub

  Op->>UI: paste supplier URL + images + notes
  UI->>API: POST /api/admin/studio/drafts
  API->>R2: presigned PUT (browser uploads directly)
  API->>DB: insert StudioDraft + StudioAsset rows
  API->>Q: event "studio/draft.dispatch"
  Q->>W: invoke run-pipeline
  loop 13 stages
    W->>P: provider call (text / vision / image / scrape)
    W->>R2: store generated images
    W->>DB: write StudioStep + StudioArtifact
  end
  W->>DB: StudioDraft.status = ready
  UI->>API: GET /api/admin/studio/drafts/[id]/preview
  API->>DB: assemble UniversalProduct from artifacts
  API->>Pub: preview(universalProduct, storeConfig)
  Pub-->>UI: PreviewLocation (in-memory Product render)
  Op->>UI: regenerate sections as needed
  Op->>UI: click "Publish"
  UI->>API: POST /api/admin/studio/drafts/[id]/publish
  API->>Q: event "studio/draft.publish"
  Q->>W: invoke publish-draft
  W->>Pub: publish(universalProduct, storeConfig)
  Pub->>GH: Octokit commit/PR to apps/fanaa/data/products.ts
  Pub-->>W: PublishResult
  W->>DB: StudioDraft.status = published, publishedRef = commitSha
  W->>Q: event "studio/publish.committed" (fans out to n8n later)
```

### Key invariants

- Preview never writes to disk in the storefront repo.
- Publish always writes via the publisher's mechanism (PR or API), never
  directly to a storefront app's filesystem at runtime.
- Status transitions: `intake → generating → ready → publishing →
  published`. `failed` is reachable from `generating` or `publishing`.
  No reverse transitions.
- An archived draft can never be republished — clone it instead.

### Regeneration semantics

- **Full re-run**: dispatch a new `studio/draft.dispatch`. Creates a
  new `StudioRun` row. All previous artifacts remain (versioned).
- **Section re-run**: dispatch `studio/section.regenerate` with the
  section kind. Creates one new artifact version; marks previous
  versions as `isCurrent = false`.

### Publish modes per store

`StoreConfig` exposes:

```ts
publishMode: "pr" | "direct";   // PR creates a GitHub PR; direct commits to main
publishBranchPrefix?: string;   // e.g. "studio/" for PR mode
publishAutoMerge?: boolean;     // PR mode only
```

Fanaa defaults to `pr` with `publishAutoMerge: false` — human review
remains a gate.

---

## 20. Anti-patterns — explicit non-goals

These are **not** decisions to revisit — they are commitments to
refuse. If anyone proposes one, point them at this section.

1. **Multi-app coupling**. `apps/fanaa/` and `apps/studio/` never
   import from each other at runtime. Cross-app contracts live only in
   `packages/*`.
2. **Hardcoded "Fanaa" anywhere outside `packages/stores/stores/fanaa.ts`
   and `apps/fanaa/`**. The engine, publishers, schemas, prompts, and
   workers all read from `StoreConfig`. No `if (storeId === "fanaa")`
   branches.
3. **n8n as the generation pipeline**. n8n is allowed for outbound ops
   glue only (Slack on publish, future Sheets sync). The 13-stage
   pipeline is TypeScript code in `packages/ai-engine/`.
4. **Direct vendor SDK imports in pipeline files**. `pipeline/copy.ts`
   never imports `@anthropic-ai/sdk`. All vendor calls go through the
   registry.
5. **Image bytes in Postgres**. Always R2 + foreign-key `r2Key`.
6. **A new Python worker service**. AI orchestration stays in
   TypeScript. FastAPI stays focused on orders.
7. **Auto-publish without preview**. Even on a confident draft, the
   publish button is a human click.
8. **Storefront writes to its own filesystem at runtime**. The
   storefront serves static (or ISR) content. All catalog mutations go
   through a publisher commit + redeploy.
9. **Cross-store data leakage**. R2 buckets, embeddings, and prompt
   logs are store-scoped. Studio never trains or re-uses one store's
   data on another store without explicit operator action.
10. **"Temporary" Fanaa-shaped fields in `UniversalProduct`**. If
    Fanaa needs a field universal doesn't have, it goes in the
    publisher's extension layer, not the universal shape.

---

## 21. Migration phases

Four phases, executed in strict order. **No phase begins until the
previous one is verified green.**

### Phase A — Monorepo skeleton (infrastructure-first, non-destructive)

**Goal**: Codebase reorganised into the target monorepo structure with
zero behavioural change.

**Scope**:
- Set up pnpm workspaces, Turborepo, `tsconfig.base.json`.
- Move `app/`, `components/`, `data/`, `lib/`, `public/`, `prisma/`,
  `middleware.ts`, `next.config.mjs`, etc. into `apps/fanaa/`.
- Move `backend/` into `services/api/`.
- Create empty `apps/studio/` Next.js scaffold (login + empty
  dashboard, JWT-protected).
- Create empty `packages/{catalog-schema, ai-engine, publishers,
  stores, workers, prompts, db, shared, config}` with stub exports.
- Update `infra/docker/*.Dockerfile` paths.
- Update EasyPanel manifests to point at new container builds.
- Update `.env.example` with new platform env vars.
- README points to `docs/architecture/PLATFORM.md`.

**Out of scope** (explicitly):
- Any storefront behaviour changes.
- Any Studio business logic.
- Any AI integration.

**Verification gate**:
- Storefront smoke test: every PDP loads identically; checkout flow
  unchanged; thank-you page renders; admin login + analytics work.
- API smoke test: orders endpoint unchanged.
- No new errors in logs.
- `pnpm install` and `pnpm build` complete cleanly.
- `pnpm dev` runs every workspace successfully.

### Phase B — Studio MVP (single store: Fanaa)

**Goal**: Generate one Fanaa product end-to-end through the pipeline,
preview it, publish it as a PR.

**Scope**:
- `packages/catalog-schema/`: `UniversalProduct` + Fanaa extension.
- `packages/stores/`: Fanaa `StoreConfig` complete.
- `packages/ai-engine/`: provider registry + Anthropic, fal.ai,
  Firecrawl, OpenAI adapters; full 13-stage pipeline.
- `packages/workers/`: `run-pipeline`, `regenerate-section`,
  `publish-draft` functions wired to Inngest Cloud.
- `packages/publishers/fanaa/`: `FanaaPublisher` with PR-mode publish.
- `apps/studio/`: intake wizard, draft list, draft canvas,
  per-section regenerate, preview route, publish action.
- R2 bucket `fanaa-assets` provisioned + CDN subdomain set up.
- Inngest Cloud project created + signing key in env.
- Provider keys provisioned in env.
- Prisma migration applied: all `Studio*` tables created.

**Verification gate**:
- Generate one supplier URL → live Fanaa SKU (manually approved PR).
- All 13 stages complete in < 5 minutes.
- Total cost per draft < $1 (target $0.40).
- Per-section regenerate works for at least: copy, images, FAQ.
- Preview renders against the actual Fanaa PDP components.
- Storefront smoke test: still green.

### Phase C — Multi-store enablement

**Goal**: Demonstrate the system is genuinely multi-store by adding a
second store from configuration only.

**Scope**:
- Choose second store (placeholder: `apps/trendora/`). Could be a
  parallel Saudi store in fashion, fitness, or kids — pick the next
  business priority.
- `apps/<store>/` scaffolded as a Next.js storefront (copy structure
  from `apps/fanaa/`, replace branding/copy).
- `packages/stores/stores/<store>.ts`: new StoreConfig.
- `packages/publishers/<store>/`: if Trendora is also TS-file-backed
  (likely), use a parameterized version of `FanaaPublisher`; otherwise
  new publisher.
- Studio UI: store switcher; drafts scoped to the active store.

**Verification gate**:
- Generate one product for store 2 with zero code changes inside
  `packages/ai-engine/`. (If engine changes are needed, the abstraction
  failed and we fix it before declaring phase done.)
- Fanaa storefront still smoke-test green.
- Store 2 storefront loads and renders the published product.

### Phase D — Ops + external publishers + DB catalog (when business demands)

**Goal**: Take Studio from internal MVP to a daily production tool.

**Scope** (any subset, as priorities dictate):
- n8n outbound glue: Slack notifications on publish/fail; Sheets
  append for audit trail; Meta Catalog feed sync.
- Embedding-based upsell match across the multi-store catalog.
- Phase-out of `data/products.ts` per store — DB-backed catalog with
  codegen for SSG.
- ShopifyPublisher / TikTokShopPublisher when first relevant store
  needs them.
- A/B testable copy variants on publish.
- Studio role expansion (editor / viewer roles fully enforced).

**Verification gate per scope item**: same — storefront smoke test
green; relevant publisher round-trips data; ops glue does its job.

---

## 22. Implementation roadmap

The roadmap is **the order in which work happens**. Each milestone
ships independently. Each milestone has a verification gate. **No
milestone is "started" until its predecessor is "verified green"** —
this is the firewall.

### Dependency diagram

```mermaid
flowchart TB
  M1["M1 · Monorepo plumbing"] --> M2["M2 · Studio skeleton"]
  M2 --> M3["M3 · Catalog schema + Stores"]
  M3 --> M4["M4 · Provider registry"]
  M4 --> M5["M5 · Pipeline core"]
  M5 --> M6["M6 · Inngest wiring"]
  M6 --> M7["M7 · Publisher: Fanaa"]
  M7 --> M8["M8 · Studio UI (wizard + canvas)"]
  M8 --> M9["M9 · End-to-end happy path"]
  M9 --> M10["M10 · Production hardening"]
  M10 --> M11["M11 · Multi-store proof"]
  M11 --> M12["M12 · Ops glue + DB catalog (Phase D)"]
```

### Milestones detail

| ID | Title | Owns | Verification |
|----|-------|------|--------------|
| **M1** | Monorepo plumbing | pnpm workspace, Turborepo, tsconfig base, move Fanaa to `apps/fanaa/`, FastAPI to `services/api/`, Prisma to `packages/db/` | Fanaa smoke test green; CI builds all workspaces |
| **M2** | Studio skeleton | New `apps/studio/` with JWT-gated login + empty dashboard, same auth pattern as Fanaa admin | Studio login works; redirects unauth users; no Studio routes affect Fanaa |
| **M3** | Catalog schema + Stores | `packages/catalog-schema/` (UniversalProduct + Fanaa extension); `packages/stores/` (StoreConfig contract + Fanaa StoreConfig); types only, no logic | TS builds; no runtime usage yet |
| **M4** | Provider registry | `packages/ai-engine/providers/` (contracts + Anthropic + fal.ai + Firecrawl + OpenAI adapters); env-driven registry | Health-check script calls each provider with a 1-token ping |
| **M5** | Pipeline core | `packages/ai-engine/pipeline/*` (13 stage functions, Zod schemas, prompt builders); pure TypeScript, no Inngest yet | Unit tests per stage with mocked providers |
| **M6** | Inngest wiring | `packages/workers/` (Inngest client + run-pipeline + regenerate + publish functions); webhook route in `apps/studio/api/admin/inngest/route.ts` | End-to-end test: dispatch run, observe steps in Inngest cloud UI |
| **M7** | Publisher: Fanaa | `packages/publishers/fanaa/` (UniversalProduct → Fanaa Product mapping; Octokit PR writer); preview function returning in-memory rendered Product | Manual: write a hand-crafted UniversalProduct, publish, open PR, merge, see new SKU on Fanaa |
| **M8** | Studio UI | Intake wizard, draft list, draft canvas with per-section regenerate, preview route, publish flow | UI works against M7 publisher |
| **M9** | E2E happy path | Connect intake → workers → publisher; SSE progress streaming; cost ceiling middleware | One real supplier URL → live Fanaa SKU in < 5 min, < $1, manual PR approval |
| **M10** | Production hardening | Idempotency keys, content-addressed step caching, full retry coverage, replay UI, provider health dashboard, asset browser | 10 drafts end-to-end without manual intervention |
| **M11** | Multi-store proof | Add `apps/<store>/`, StoreConfig, publisher; Studio store-switcher | Generate one product for store 2 with **no code changes in ai-engine**; Fanaa unchanged |
| **M12** | Ops + Phase D | n8n webhook on `publish.committed`; Slack/Sheets glue; (when needed) ShopifyPublisher; (when needed) DB-backed catalog migration | Per-scope-item smoke tests |

### Safest rollout order — explicit reasoning

- **M1 must be first** because every later milestone references the
  monorepo structure. Doing M1 last would force a giant retroactive
  refactor.
- **M3 (schemas) before M4 (providers)** because providers receive
  `storeId: StoreId` as a typed argument from M3.
- **M4 (providers) before M5 (pipeline)** because every pipeline stage
  calls a provider.
- **M5 (pipeline as pure functions) before M6 (Inngest wiring)** so
  pipeline stages are unit-testable without the queue layer.
- **M7 (publisher) before M8 (UI)** so the UI's publish button has
  something real to call.
- **M9 (end-to-end happy path) before M10 (hardening)** because
  hardening without an e2e path is premature optimisation.
- **M11 (multi-store proof) before M12 (ops glue)** because the
  abstraction must be proven before we invest in ecosystem
  integrations.

### When each phase is "done"

- **Phase A done** = M1 verified.
- **Phase B done** = M2 → M10 verified.
- **Phase C done** = M11 verified.
- **Phase D done** = scope items chosen for the milestone are
  individually verified; this phase has no fixed endpoint.

---

## 23. Decision log

ADRs (Architecture Decision Records) live in
`docs/architecture/decisions/` once we start changing things. The
foundational decisions are captured below; future amendments append
to that folder.

| # | Decision | Why | Rejected |
|---|----------|-----|----------|
| 1 | Monorepo from day 1 | Multi-store is a guaranteed need; deferring it means a painful split later | Multi-repo, polyrepo |
| 2 | pnpm + Turborepo | Best workspace ergonomics + free remote cache | Nx (overkill), yarn (slower), bun (newer) |
| 3 | Studio as a separate Next.js app, not inside fanaa | Storefront-deploy invariance; clean blast radius | Studio inside `apps/fanaa/app/admin/studio/` |
| 4 | Inngest Cloud for the queue | Step-function model fits pipeline shape; zero ops | graphile-worker (more boilerplate), n8n (wrong tool) |
| 5 | Universal Product schema | Multi-store requires it; cheaper than rewriting engine per store | Fanaa-shaped output, generic JSON |
| 6 | Publisher abstraction | Different stores live in different worlds (TS file vs Shopify API) | Hardcoded TS-file write path |
| 7 | Cloudflare R2 for assets | $0 egress, S3-compatible, single Cloudflare org | S3+CloudFront (expensive), Postgres (lethal) |
| 8 | Anthropic Claude primary | Best Arabic copywriting quality, best structured outputs | OpenAI primary (worse Arabic), Gemini (less mature for structured) |
| 9 | fal.ai for images | Multi-model platform; one API for Flux + Recraft | Replicate (good but more model fragmentation), Vertex Imagen (org friction) |
| 10 | PR-mode publish default | Human review gate without process overhead | Direct-to-main, manual copy-paste |
| 11 | One Postgres instance | At our scale, separation is premature | Two Postgres (Studio + Storefront) |
| 12 | TypeScript-only AI engine | Type safety end-to-end; no language boundary inside the pipeline | Python worker sibling, polyglot pipeline |

When this list changes, increment the document version at the top and
append an ADR to the decisions folder.

---

## 24. Future extensibility

### Where new things land

| New thing | Lands in |
|-----------|----------|
| New store (TS-file-backed) | `apps/<store>/` + `packages/stores/stores/<store>.ts` + reuse `FanaaPublisher` (parameterized) |
| New store (Shopify-backed) | `apps/<store>/` (or none if pure Shopify) + new `packages/publishers/shopify/` |
| New niche | `packages/stores/niches/<niche>.ts` + niche-specific pipeline stage tweaks in `ai-engine/` |
| New section type | Add to `SectionKind` enum + add a generator stage if needed + publisher knows how to render it |
| New AI provider | Adapter in `packages/ai-engine/providers/<vendor>.ts` + add to registry env |
| New image model from existing vendor | Extend the vendor adapter; no architecture change |
| New publisher target (Meta catalog) | `packages/publishers/<target>/` registered as a broadcast publisher |
| New role | Extend `studio_role` enum; update middleware |
| New analytics signal | Goes into existing `Event` model in Prisma (untouched analytics schema) |

### What's intentionally NOT abstracted (yet)

- **Pricing engine** stays per-store. The universal product has a
  `priceHint`; each store has its own offer logic. Premature
  unification would force the wrong shape.
- **Cart / checkout** stays per-store. Each storefront owns its
  conversion flow.
- **Pixel tracking** stays per-store. Each store has its own ad
  accounts.

When a second store proves these need sharing, lift them into
`packages/*` at that time — not before.

---

## 25. Appendix — open questions

These need a decision before M1 starts. Each must have a captured
answer in `docs/architecture/decisions/` once resolved.

1. **Inngest Cloud account**: same org as the engineering team, or a
   dedicated platform account?
2. **GitHub App vs PAT for publishing**: GitHub App is more secure
   long-term; PAT on a dedicated bot user is faster. Default: PAT, plan
   to migrate to App in Phase D.
3. **R2 organization**: do we add buckets to the same Cloudflare
   account as the storefront, or a dedicated platform account?
4. **Cost budget for the platform itself**: Inngest, R2, Anthropic,
   fal.ai, Firecrawl. Suggested initial monthly cap: $200 hard,
   $400 soft alert.
5. **PR auto-merge or manual?**: Suggested default — Fanaa PRs require
   manual merge for the first 30 published products, then revisit.
6. **Staging environment**: do we want one before M11, or stay
   prod-only? Suggested — stay prod-only until M11 then split.
7. **Inngest dev runtime in local docker-compose**: yes/no. Suggested
   — no, use Inngest dev server directly via `pnpm dev:inngest`.
8. **Studio domain**: `studio.elfanaa.com`? Separate domain entirely?

Capture answers as the platform proceeds. Do not let unanswered
questions block M1.

---

> **Authority**: When in doubt, this document is right and the code is
> wrong. Open an ADR, update the document, then change the code.

> **Maintenance**: This document is reviewed at the end of every
> milestone. Drift between code and document is a defect; fix the
> drift, not by tolerating it.

---

## 26. Execution roadmap & live project memory (Steps 1–4)

> **Purpose.** §22 (M1–M12) is the *original* build order and remains the
> canonical milestone ledger. This section is the **operator-facing
> execution narrative** layered on top of it: the "Steps" the platform
> owner reasons in, the current live state of the deployed system, and a
> continuously-updated record of decisions, discoveries, blockers, and
> recommendations. **Keep this section current as work proceeds** — it is
> the project's working memory across sessions.

### 26.1 Step ↔ milestone mapping

| Step | Theme | Maps to milestones | Status |
|------|-------|--------------------|--------|
| **Step 1** | Infrastructure / foundations | M1–M4 (monorepo, studio shell, schemas, provider registry) | ✅ Complete |
| **Step 2** | Image + publishing pipeline, rendering reliability, fal integration, DB-backed catalog | M5–M10 happy path + M12 DB catalog migration | ✅ Complete (infra) |
| **Step 3** | Intelligence layer — intake utilisation, audience/awareness/sophistication targeting, emotional angle, copy quality, **product-identity-preserving imagery** | Deepens M5 (pipeline core / prompt depth) | 🚧 Core landed 2026-05-31; pending live quality validation |
| **Step 4** | Premium storefront generation — rich section architecture, storytelling, CRO structure, dynamic section selection | Deepens M5 + M7/M8 (publisher + draft mapping) + storefront | ⛔ Not started (documented below) |

> Note: "Step" numbers are an execution lens, not a replacement for the
> M-milestones. A Step can advance several milestones' depth at once.

### 26.2 Current project state (as of 2026-05-31)

**Working end-to-end:** Intake → generation → publish → DB catalog
(`storefront_catalog_product`) → shop → PDP → cart. fal image generation
works; R2 + `cdn.elfanaa.com` custom domain serve assets; generated hero
images render everywhere; older products backfilled via re-publish.

**Deployed reference commit:** Studio at `23db6bf`;
`R2_PUBLIC_BASE_URL_FANAA=https://cdn.elfanaa.com` on `studio` and `web`.

> **RESOLVED (2026-05-31) — Step 3 validated in production at `537d1a1`.**
> The identity-loss root cause (vision sent bare R2 keys → blind → generic
> hallucination; §26.10) is fixed and the Step 3 bundle (targeting threading,
> audience directive, vision-grounded creative prompts, Kontext img2img) is
> committed and deployed. Live validation on **Beef Tallow Honey Balm** (§26.11)
> confirms identity now flows Intake → Vision → Strategy → Copy → Image. The
> earlier "validation" that surfaced the bug had run the pre-Step-3 pipeline
> (HEAD was `23db6bf`); that is now history.

**Known quality gap that motivated Step 3** (evidence-based trace, 2026-05-31):

1. **Targeting barely influences output.** All 8 targeting selectors are
   flattened into a human-readable string (`renderTargetingAsNotes`) stuffed
   into `operatorNotes`, which reaches **only the `strategy` stage**. The raw
   `intakeMetadata.targeting` object is persisted but **never read** by the
   orchestrator. `copy`, `creative_prompts`, `structure` receive **zero**
   targeting fields directly — they only inherit whatever `strategy` chose to
   echo. There is no enforcement that awareness/sophistication/angle/tone shape
   the copy.
2. **Generated images do not preserve product identity.** `image_gen` is pure
   text-to-image (Flux Pro 1.1). The fal adapter *supports* `referenceImages`
   (`image_url`) but **no caller ever sets it**. The uploaded product photo is
   used only by the `vision` stage (as text) and as a fallback hero — never as
   image conditioning. Flux therefore invents a plausible product.
3. **Page structure is a thin fixed template.** `structure` output is computed
   then **dropped** (assemble/copy/creative ignore it). Many `SectionKind`s
   (`ingredients`, `results_expectation`, `guarantee`, `comparison`,
   `creative_strip`, `founders_note`) are schema-defined but never generated.
   `product-to-draft` emits a fixed ~7-section shape. → **Step 4.**

### 26.3 Step 3 — goals & success criteria

**Objective:** the elaborate intake selections must measurably change the
output, and AI imagery must depict the *actual* uploaded product.

Success criteria:

- [x] Structured `targeting` flows from `IngestJob.intakeMetadata.targeting`
      through the orchestrator into `strategy`, `copy`, and `creative_prompts`
      (additive, backward-compatible — absence = legacy behaviour). *Landed
      2026-05-31.*
- [x] A single **audience-directive** prompt module deterministically maps each
      targeting enum to an enforced instruction (awareness playbook,
      sophistication framing, emotional-angle lever, tone register, demographic
      address, market/locale). Injected into the system prompt of the text
      stages so the model cannot ignore it.
      (`packages/ai-engine/src/prompts/audience-directive.ts`.)
- [x] Operator `market`/`toneStyle` selections override the store defaults in
      the prompt where set — the directive block declares "when a directive
      conflicts with a generic default, the directive wins".
- [x] `creative_prompts` is grounded in the real product via vision attributes
      (category, form factor, packaging, colours, label text), so even
      text-to-image shots stay on-identity.
- [x] **img2img**: the operator's primary uploaded photo is passed to fal
      `flux-pro/kontext` as `image_url` for the hero, preserving product
      identity. **Hard fallback** to today's text-to-image hero on any
      Kontext failure — never regress to the intake-image fallback.
- [x] All changes covered by unit tests; `ai-engine` (67) + `worker` (30) suites
      green; all 14 workspaces typecheck clean.

- [x] **Validated in production (2026-05-31, build `537d1a1`).** See §26.11 for
      the Beef Tallow Honey Balm live result. Vision sees the uploaded image;
      product identity flows through strategy → copy → creative → hero; the
      generic-skincare hallucination is gone; the hero preserves the uploaded
      product (Kontext img2img).

**Step 3 production status: COMPLETE & validated.** The intelligence layer
(identity preservation + targeting) works in production. The remaining product
gap — page is structurally generic, placeholder sections, no premium CRO/mobile
architecture — is **Step 4 scope**, not a Step 3 defect.

**Out of scope for Step 3** (→ Step 4): rich multi-section generation,
dynamic section selection, storefront section rendering, `foundersNote`
end-to-end, offer-ladder/cost-breakdown consumption.

### 26.4 Step 4 — execution plan (revised 2026-05-31, evidence-based)

**Objective:** turn generated pages from generic templates into **mobile-first,
conversion-focused GCC direct-response landing pages** for paid-social → mobile
→ COD traffic.

#### 26.4.1 Critical discoveries that REVISE the original plan

A deep trace of the generation + rendering paths (2026-05-31) surfaced
architecture facts the original §26.4 bullet list did not account for:

1. **Two-renderer fork — the validated page is NOT the production storefront.**
   - AI content (benefits/reviews/FAQ) renders on **Studio `/p/[slug]`** via
     `@platform/runtime-renderer` (`renderSection` switch over the *builder*
     section kinds), driven by `DraftDocument.sections`. The "Moon/Zap/Shield"
     headings are this renderer printing the **Lucide icon NAME as 28px text**
     (`runtime-renderer/src/sections.tsx` ~139). That proves the validated
     screenshots are the Studio preview.
   - The **production storefront** `apps/fanaa/app/products/[slug]/page.tsx`
     renders a **fixed, hardcoded** order (`ProductGallery`, `ProductDetails`,
     `ProductBenefits`, `ProductIngredients`, `ProductLifestyle`,
     `ProductReviews`, `ProductFAQ`, `RelatedProducts`) from **flat `Product`
     CRO fields sourced from the `data/products.ts` snapshot**. It does **not**
     read AI `sections[]`. AI-published rows go through `synthesiseProductFromRow`
     → **commerce fields only** (hero + price) → benefits/FAQ/reviews are
     **empty** on the real store. Studio `/p/` is explicitly commented as "what
     real visitors *would* see when M12 wires apps/fanaa to this renderer".
   - **Therefore Step 4 must also do the deferred M12 wiring**: make the
     customer-facing domain render the AI-generated page dynamically.
2. **Three competing section taxonomies.** `catalog-schema` `SectionKind`
   (pipeline: hero, benefits, ingredients, lifestyle, results_expectation,
   social_proof, faq, guarantee, cross_sell, creative_strip, comparison,
   founders_note, press_strip, specifications, sticky_cta) ≠ `builder-schema`
   (hero, benefits, before_after, testimonials, cta, faq, sticky_cta, video,
   image_gallery, rich_text) ≠ fanaa fixed components. No 1:1 mapping. Step 4
   needs ONE canonical section contract + one registry.
3. **Most "rich" sections are never generated.** Today only hero, benefits,
   faq, social_proof (as testimonials), partial lifestyle (images) and partial
   sticky_cta have any pipeline footprint. `ingredients`, `results_expectation`,
   `guarantee`, `comparison`, `creative_strip`, a **mechanism/how-it-works**
   kind (doesn't even exist in the taxonomy), and `founders_note` (generated by
   copy, then **dropped at assemble**) are NOT produced. So Step 4 = generate
   content AND render it.
4. **`structure` stage output is computed then dropped** (assemble/copy/creative
   ignore it) and it never receives `targeting` → no awareness/sophistication-
   aware ordering is possible yet.
5. **Already-generated-but-unrendered data to reclaim:** `strategy.persona`,
   `strategy.objections[].neutraliser`, full `benefitAngles`, `copy.foundersNote`,
   `socialProof.hooks[1..n]`, `lifestyleImages`, `vision.*`.

#### 26.4.2 Revised target architecture

- **One canonical page model** = ordered `sections[]` with typed, bilingual
  content per section (the AI's `structure` ordering + per-section content).
- **One production landing surface on the customer domain** that renders those
  sections **dynamically** through a **fanaa-native, mobile-first premium
  section registry** (kind → component), wrapped in the existing **commerce
  shell** (offer selector, add-to-cart, cart drawer, sticky mobile CTA, COD,
  scarcity, trust).   **DECIDED (ADR-S4-1, 2026-05-31):** extend the production fanaa PDP
  `apps/fanaa/app/products/[slug]` into a dynamic section-driven renderer that
  renders AI `sections[]` when present and **falls back to the existing fixed
  curated layout** when absent. Additive (no regression for curated products),
  keeps the commerce shell + premium components, stays on elfanaa.com. Rejected:
  promoting the generic Studio `runtime-renderer` to production (no commerce, not
  premium); a separate `/p/[slug]` route (splits the funnel + analytics).
- **Mobile-first as the design driver** (base = mobile; progressive `min-width`):
  ATF hero+price+CTA, persistent sticky mobile CTA, CTAs repeated between
  sections, social proof surfaced early, COD/trust band, scarcity, fast LCP.
- **DECIDED (ADR-S4-2, 2026-05-31): the `structure` stage is deterministic.**
  Section ordering/selection is computed from awareness + sophistication by a
  pure planner (`planSectionOrder`), not an LLM. Rationale: ordering is a CRO
  policy (Schwartz), not creative generation; determinism is required to test
  "different awareness ⇒ different structure", removes a per-draft LLM call
  (cost + latency), and eliminates the invalid-ordering failure path. The LLM
  still owns all *creative* output (copy, `section_content`). Trade-off
  accepted: ordering logic now lives in code (versioned, reviewable, testable)
  rather than a prompt — which is the point. Selection is expressed as ordering
  (de-prioritise), never exclusion, so the "never drop grounded content"
  invariant from ADR-S4-1's renderer holds end-to-end. Rejected: feeding the
  audience directive into the existing LLM structure prompt (nondeterministic,
  untestable, still capped by the section library, and pure cost).

#### 26.4.3 Phased delivery

- **4.0 Foundations — DONE (`14c80da`).** Added `how_it_works`/`transformation`
  SectionKinds; fixed the benefit-icon rendering bug (PascalCase Lucide tokens
  no longer printed as text in the Studio preview); reclaimed `foundersNote`
  end-to-end (UniversalProduct + assemble + product-to-draft rich_text section);
  ADR-S4-1 recorded. Tests: ai-engine 72, runtime-renderer 12, studio 31.
- **4.1 Content generation — DONE (generation side).** New `section_content`
  pipeline stage (stage 11b) generates mechanism/how-it-works, ingredients (from
  vision/research, "omit if unknown"), results/expectations timeline, guarantee,
  and comparison — all bilingual, product-fidelity + locale-bleed guarded.
  Objections are reclaimed from `strategy.objections` (no extra call).
  `SectionContent` is a canonical catalog-schema type; `assemble` now distributes
  it onto `UniversalProduct.{ingredients, sectionContent}` and **finally consumes
  the `structure` ordering** as `UniversalProduct.sectionOrder`. Wired through the
  worker orchestrator (PIPELINE_STAGES + dispatch). Tests: ai-engine 78, worker 39.
  Remaining 4.1: thread `targeting` into the `structure` stage (folded into 4.3).
- **4.2 Dynamic mobile-first rendering — DONE.** Two halves shipped:
  - **(a) Data path.** The pipeline's `UniversalProduct` CRO surface is projected
    into a new canonical `CroContent` type (`@platform/catalog-schema`,
    permissive read-boundary Zod schema), carried as an opaque `croContent` JSON
    bag on `DraftDocument` (populated by `product-to-draft`), persisted through
    the publish flow (`drafts-service` → persistence `storefront_catalog_product`
    repository) into a new `cro_content JSONB` column (Prisma migration
    `0006_catalog_cro_content`), and hydrated onto the fanaa `Product` by
    `merge.ts::coerceCroContent` (defensive "drop-malformed, never-throw"
    coercers consistent with the existing badge/rating/offerTiers pattern — a
    bad projection degrades to a commerce-only product, never a 500). Decision:
    embed on `DraftDocument`/catalog row rather than join
    `studio_published_product.document` — simplest maintainable path, reuses the
    existing hybrid-catalog loader, no extra query at render time. fanaa stays
    self-contained (local section types, no catalog-schema dependency).
  - **(b) Rendering.** New `ProductSections` orchestrator on the production fanaa
    PDP (`/products/[slug]`) renders the AI `sectionOrder` inside the existing
    commerce shell (gallery + buy box above, related products below). New
    mobile-first, RTL-aware, self-guarding section components: `ProductHowItWorks`
    (mechanism), `ProductResults` (week-by-week timeline), `ProductGuarantee`
    (risk-reversal band), `ProductComparison` (us-vs-usual), `ProductObjections`,
    `ProductFoundersNote` (editorial quote). AI order leads; `DEFAULT_ORDER`
    backfills any grounded section the structure stage omitted (nothing grounded
    is ever dropped). Curated/legacy products carry no `sectionOrder`/
    `sectionContent`, so they fall through to a default order whose effective
    output is **byte-identical** to the pre-Step-4 fixed layout (benefits →
    ingredients → lifestyle → reviews → FAQ) — no curated page regresses. Every
    section self-renders to `null` without content, so placeholder/empty sections
    are eliminated by construction. Tests: fanaa 128 (incl. 4 new cro_content
    hydration cases), persistence 80, builder/catalog-schema 41.
  - **Deploy note:** requires `prisma migrate deploy` (adds `cro_content`) +
    Prisma client regen on the services that read/write the catalog (studio
    writes, fanaa/web reads). Loader uses `findMany` with no explicit `select`,
    so the column is picked up automatically once present. Backfill: re-publish
    AI products to populate `cro_content` (older rows render commerce-only until
    re-published — same backfill pattern as the image pipeline).
- **4.3 Awareness/sophistication-aware composition — DONE (ADR-S4-2).** The
  `structure` stage is now **deterministic**: section ordering is computed from
  `targeting.awarenessLevel` + `sophisticationLevel` by a pure
  `planSectionOrder` planner (`ai-engine/src/pipeline/awareness-ordering.ts`),
  not an LLM. Rationale: ordering is a CRO *policy* (Schwartz awareness model),
  not a creative task — making it deterministic is the only way to *test* the
  success criterion ("different awareness ⇒ different structure"), and it
  removes a per-draft LLM round-trip (cost/latency) plus the entire
  "model returned an invalid ordering" failure surface.
  - Awareness sets where the page starts: unaware → mechanism/education +
    founder story first; problem-aware → benefit promise → mechanism → proof;
    solution-aware → comparison/differentiation first; product-aware → proof +
    risk-reversal first; most-aware → proof + offer, tight, minimal education.
  - Sophistication re-weights *what evidence convinces*: beginner promotes
    mechanism + ingredients; advanced promotes comparison + unique mechanism +
    proof; expert promotes founder POV + comparison and demotes generic
    benefit/hype.
  - Selection is **ordering, not exclusion**: the planner emits every
    store-supported section (no grounded content is ever dropped); empty
    sections self-render to null in fanaa, and the renderer's backfill is a
    no-op because the order is already complete. `hero` is pinned first,
    `cross_sell`→`sticky_cta` last. Output is always a valid permutation of the
    store `sectionLibrary` (extended with `how_it_works` + `comparison`).
  - No-targeting drafts preserve the store default ordering exactly (legacy
    behaviour). Worker wiring: `structure` makes no provider call; cost
    accounting drops from 6→5 text calls/draft. Tests: ai-engine 89
    (+8 structure, +7 planner), worker 39, stores green.
- **4.4 QA + live validation — IN PROGRESS.** Unit tests done (ai-engine 89,
  worker 39, fanaa 128, persistence 80). Live production validation procedure is
  documented in **§26.4.6**; awaiting deploy + operator evidence.

#### 26.4.4 Success criteria

- AI-published product renders a **rich, product-specific** page on the
  **customer domain** with ≥6 populated, real sections and **zero placeholder/
  empty sections**.
- Section **ordering varies by product + awareness stage** (evidence: two
  different awareness inputs produce different orderings).
- Mechanism/how-it-works, ingredients, results, guarantee, founders note, FAQ,
  social proof all render with product-real content (not generic filler).
- **Mobile-first verified:** ATF hero+price+CTA on a 390px viewport, sticky
  mobile CTA persists through scroll, readable type scale, no horizontal
  overflow.
- Benefit cards show real Lucide icons + marketing titles (bug gone).

#### 26.4.5 Risks & dependencies

- **Risk:** scope/regression on the live storefront PDP (commerce machinery is
  polished). Mitigate by additive dynamic rendering behind the existing shell +
  a fallback to the current fixed layout when sections are absent.
- **Risk:** AI hallucinating ingredients/mechanism. Mitigate with hard
  product-fidelity grounding (vision/research only) + "omit if unknown".
- **Risk:** more generation stages = higher cost/latency (per §17 ceiling).
  Mitigate by batching section content into fewer LLM calls.
- **Dependency / DECISION:** confirm the production landing surface (fanaa
  `/products/[slug]` vs a fanaa `/p/[slug]` vs Studio preview) before 4.2.
- **Dependency:** `NicheProfile.expectationsModel` for results blocks;
  `intakeMetadata.offers`/`costBreakdown` for offer ladders (optional this step).

#### 26.4.6 Roadmap revision vs original §26.4

Original plan assumed "render dynamically" was a small consumption change. It is
not — the production storefront ignores AI sections entirely and most rich
content is never generated. Step 4 is therefore re-scoped into the 5 phases
above, with the **M12 storefront-render wiring** explicitly pulled in.

#### 26.4.7 Phase 4.4 — production deploy + validation procedure

This is the authoritative, repeatable procedure for validating Step 4 end-to-end
on production. Run it after any change to the generation pipeline, the CRO data
path, or the fanaa section renderer.

**1. Services to deploy (rebuild from the Step-4 commit `69f2f54` or later):**
- **studio** (`elfanaa_studio`) — runs the generation pipeline (worker is
  embedded) AND owns the publish path that writes `cro_content`. MUST rebuild so
  `prisma generate` picks up the `cro_content` column (Prisma only selects
  columns known at client-generate time; a stale client silently omits it on
  read and **errors** on write).
- **web** (fanaa storefront, elfanaa.com) — reads `cro_content` and renders the
  dynamic `ProductSections`. MUST rebuild for the same Prisma-client reason +
  the new renderer code.
- **api/backend** — NOT involved in Step 4 (COD orders only). No redeploy
  required. Adding a nullable column is backward-compatible for it.
- No new environment variables are required for Step 4.

**2. Migrations:** exactly one pending — `0006_catalog_cro_content` (adds
`storefront_catalog_product.cro_content JSONB`, nullable, backward-compatible).
Apply once to the shared DB via either:
- Set `STUDIO_AUTO_MIGRATE=true` on the studio service (entrypoint runs
  `prisma migrate deploy` against `ADMIN_DATABASE_URL` on boot), OR
- EasyPanel → elfanaa_studio → Shell →
  `prisma migrate deploy --schema=/app/packages/db/prisma/schema.prisma`.
Verify: `_prisma_migrations` contains `0006_catalog_cro_content`.

**3. Re-publish / regenerate:** rich content (`sectionContent`, `sectionOrder`,
`foundersNote`, `cro_content`) only exists for products whose **draft was
produced by the Step-4 pipeline**. Re-publishing a pre-Step-4 draft does NOT
backfill it (its UniversalProduct predates the `section_content` stage).
Therefore validation requires **fresh pipeline runs** on the deployed studio,
then publish. Older products stay commerce-only until regenerated (expected;
same backfill pattern as the image pipeline).

**4. Test products (run fresh intakes):**
- **Beef Tallow Honey Balm** — identity + richness regression (the Step-3
  validation product).
- **SmileEase** (purple teeth-whitening) — the original identity-failure product;
  proves identity + rich sections together.
- **Awareness A/B:** run the SAME product twice with different targeting —
  e.g. `awarenessLevel: unaware` vs `most-aware` (optionally vary
  `sophisticationLevel: beginner` vs `expert`) — to prove ordering differs.

**5. URLs to validate (per published product):**
- Production PDP: `https://elfanaa.com/products/<slug>` (the conversion surface).
- Studio run detail / preview: `/studio/runs/<runId>` and `/p/<slug>` (to read
  the generated `sectionOrder` + the structure step's `rationale`, which is
  `awareness:<level>` for targeted runs).
- `/shop` + cart: confirm the product card + add-to-cart still work.

**6. Mobile success criteria (Chrome DevTools, 390px width — iPhone 12/13/14):**
- **ATF:** hero image (the real uploaded product) + title + price + add-to-cart
  visible within the first viewport.
- **Sticky CTA:** the mobile sticky add-to-cart bar persists through the scroll.
- **Rich sections render** with product-real content (not generic filler):
  mechanism/how-it-works, ingredients, results timeline, comparison, objections,
  founder's note, guarantee, FAQ, reviews.
- **No placeholder sections** and **no raw token text** (no "Moon/Zap/Shield"
  /PascalCase icon names rendered as words); benefit cards show real icons.
- **Awareness ordering differs** between the two A/B runs (e.g. unaware leads
  with how-it-works; most-aware leads with social proof + guarantee).
- **RTL correct** for Arabic; **no horizontal overflow**; readable type scale.
- Curated products (e.g. /sugarbear and snapshot SKUs) are **unchanged**.

**7. Evidence to capture:**
- Full-page 390px screenshot of each test PDP (Beef Tallow + SmileEase).
- Side-by-side 390px screenshots of the awareness A/B pair showing the section
  order differs.
- The generated `sectionOrder` for each run (from Studio run detail) + the
  structure step `rationale` (`awareness:<level>`).
- Confirmation `cro_content` is non-null for the new rows (Studio publish
  success, or a `SELECT slug, cro_content IS NOT NULL FROM
  storefront_catalog_product WHERE source='ai_generated'` spot check).
- The deployed studio + web build SHAs (NavBar pill / boot banner) = `69f2f54`+.

#### 26.4.8 Post-validation findings (2026-06-01) — evidence-based, blocks "Step 4 complete"

Live mobile validation (390px) of two awareness-A/B PDPs against the Sugarbear
benchmark surfaced four quality/architecture gaps. These were investigated by
tracing the real code paths (not hypotheses). Step 4 is **technically** complete
but **quality-incomplete** until Phases 4.5–4.8 below land.

**Permanent principle (re-affirmed): MOBILE-FIRST.** ~all traffic is Meta/TikTok/
Snapchat → mobile. The PDP is designed primarily for mobile conversion: image-first
stacked layouts, short copy, visual hierarchy, CTA reappearing every 2–3 scrolls.
Desktop is secondary/progressive-enhancement only.

**Finding 1 — Hero/lifestyle image durability is best-effort, silent, and unverified
(recurring black/empty hero).**
- `persistGeneratedImages` rehosts to R2 best-effort; every failure path silently
  "keeps the vendor URL" (`apps/studio/lib/studio/persist-generated-images.ts`).
  fal URLs are ephemeral → they 404 after expiry. `resolveCatalogImageRef` passes
  any `https://` through untouched, so a rotting fal URL ships to the PDP.
- It iterates **only `product.images`** — `product.lifestyleImages` (a separate
  array in `assemble.ts`) is **never rehosted** → lifestyle shots always rot.
- The Studio preview renderer uses a plain `<img>` (`runtime-renderer/Media.tsx`)
  and `apps/studio/next.config.mjs` has **no `images.remotePatterns`** and no
  `SafeProductImage` fallback → bare keys/broken URLs render as broken/black boxes.
- The cream "image pending" placeholder (fanaa fallback) is *not* black, so a black
  hero means the fallback isn't firing — the stored hero is a rotten/unresolvable
  URL, not a clean miss.
- **Impact:** the LCP/hero conversion asset is non-deterministic and silently rots;
  this is the recurring hero bug.

**Finding 2 — Premium visual gap: PDP is text-heavy, not visual-first.**
- The Step-4 sections (`ProductHowItWorks`, `ProductResults`, `ProductComparison`,
  `ProductObjections`, `ProductGuarantee`, `ProductFoundersNote`) render **no image**;
  `ProductSections` passes only `product`. Image-to-section ratio ≈ 1:8–1:10 vs
  Sugarbear's ≈ 1:1. Step 4 delivered information architecture, not visual composition.

**Finding 3 — Generated images underutilized + lossy projection.**
- N lifestyle images are generated but `CroContent` carries only ONE `lifestyleImage`;
  the rest never reach the storefront and are never rendered. No section other than
  the gallery + one lifestyle band uses imagery.

**Finding 4 — Research/intake depth is thin (root cause of "generic copy").**
- Supplier URL IS crawled (firecrawl) but `research.ts` never throws — on failure it
  silently returns `skipped` with no operator signal (Alibaba/Amazon anti-bot makes
  this common). Only `research.markdown` reaches strategy (sliced 8k); copy reads the
  distilled strategy brief, NOT raw research (double summarization → dilution).
- `research.images` (supplier product/ingredient/before-after photos) is scraped then
  **discarded** — no downstream consumer. Image-gen uses only the single uploaded
  reference for the hero.
- The intake form (`intake-validator.ts`) has **no structured fields** for product
  name, benefits, ingredients, or before/after assets — that content only enters via
  free-text `operatorNotes`. Effectively ~0% of supplied content facts are reliably
  used. No OCR/label extraction exists.

**Additional issues discovered:** silent scrape failure has no operator signal; no
image health/observability (a publish-time HEAD check would catch every hero
recurrence); `CroContent` is lossy by design (1 lifestyle image).

**Revised roadmap — shortest path to the final vision (priority order):**
- **Phase 4.5 — Image reliability (foundation).** Rehost ALL generated images incl.
  `lifestyleImages` + future section images; verified-durable publish gate (never
  persist a non-`cdn.elfanaa.com`/non-`data:` hero; block/retry on failure with a
  clear operator error); unify the image contract across both renderers (shared
  `resolveImageRef` + Studio `remotePatterns` + a SafeImage-equivalent in preview);
  guarantee a non-black terminal state.
- **Phase 4.6 — Visual composition layer.** `IMAGE + COPY` variants for every major
  section, mobile-first image-first stacked; plumb images through
  `CroContent`/`SectionContent`; curated-safe text-only fallback.
- **Phase 4.7 — Typed multi-image generation.** Generate hero + mechanism +
  transformation + lifestyle[] + ingredient + founder + proof, all identity-grounded
  via the product reference.
- **Phase 4.8 — Research depth.** Surface scrape-skip to the operator; consume
  `research.images`; add structured intake (benefits/ingredients/before-after); feed
  grounded facts to copy + image-gen; add OCR/label extraction.

#### 26.4.9 Phase 4.5 — image reliability architecture (DONE 2026-06-01)

Permanent, architecture-level fix for the recurring hero/lifestyle image failure
(§26.4.8 Finding 1). Prioritised durable correctness over per-surface patches.

**ADR-S4-3 — Durability is created at persist time and GUARANTEED at the publish
boundary; rendering never trusts a vendor URL.**

Three layers, defence-in-depth:

1. **Re-host EVERY generated image at persist time** —
   `apps/studio/lib/studio/persist-generated-images.ts` now iterates BOTH
   `product.images` (hero + gallery) AND `product.lifestyleImages` (previously
   skipped → the root cause of rotting lifestyle bands). Runs right after
   generation while vendor (fal) URLs are still alive. Extracted a reusable
   `rehostImageUrl()` helper (returns the durable ref or `null`).

2. **Single source of truth for ref→URL resolution + durability** — new
   `@platform/storage/public-url` module:
   - `resolveStorageRef(raw, { cdnBase })` — turns data:/http(s)/r2://`/bare-key
     into a fetchable URL (rewriting the private R2 S3 endpoint → public CDN), or
     `null`.
   - `isDurablePublicUrl(url, cdnBase)` — classifies our-CDN / inline-data as
     durable vs. foreign/vendor (will rot).
   - `resolvePublicCdnBase(env, fallback)` — guards against the private-endpoint
     misconfig. fanaa keeps its behaviour-identical mirror
     (`resolveCatalogImageRef`) because it is intentionally decoupled from the
     workspace packages for its standalone Docker bundle; both are pinned by
     tests (`packages/storage/src/__tests__/public-url.test.ts` +
     `apps/fanaa/__tests__/catalog-merge.test.ts`).

3. **Verified-durable hero gate at publish** —
   `drafts-service.ts::prepareDurableHeroUrl`: resolve the draft hero; if not
   durable, attempt one last-chance re-host; if still not durable, persist
   `null` (deterministic placeholder, NEVER black) + a publish warning
   (`hero_image_not_durable`). The storefront is now **structurally incapable**
   of receiving a rotting vendor hero.

**Renderer hardening (non-black terminal state):**
- `apps/studio/next.config.mjs` gains `images.remotePatterns` for
  `cdn.elfanaa.com` (parity with fanaa) so any next/image consumer can optimise
  the durable host.
- `packages/runtime-renderer/src/styles.css` paints the hero media wrapper +
  `<img>` with the warm-sand placeholder colour, so a broken/decoding image in
  the Studio preview reveals brand cream — never a black void (the renderer is
  server-safe and has no client onError).
- fanaa gallery already sits on `bg-brand-soft` and `SafeProductImage` swaps to
  the cream placeholder on error — unchanged.

**Additional weakness discovered + fixed (not image-specific):** the Studio UI
stage mirror `STAGE_ORDER` (`pipeline-stages.ts`) had drifted from the worker's
`PIPELINE_STAGES` since Phase 4.1 — it was missing `section_content` (11 vs 12),
so the conformance test failed and the progress bar mislabeled stages. Re-synced
the list, labels, descriptions, and the "Stage N of 12" copy; updated the stale
hardcoded `11`/`2/11` expectations in `pipeline-stages.test.ts`.

**Tests added/updated:** `public-url.test.ts` (16), `persist-generated-images.test.ts`
(lifestyle rehost + skip/guard), `hero-gate.test.ts` (gate never emits vendor),
`pipeline-stages.test.ts` (12-stage conformance). Full suites green: storage 79,
studio 458, fanaa 128, worker 39, runtime-renderer 12.

**Net effect:** hero + lifestyle images are durable end-to-end; the storefront
can never render a black/rotten hero; the Studio preview degrades to cream, not
black; and the image contract has a single tested spec. This unblocks Phase 4.6
(visual composition) which assumes reliable, durable images.

### 26.5 Architecture decisions (Step 3)

- **ADR-S3-1 — Targeting is passed as a structured object, not only as
  serialized notes.** The orchestrator now reads
  `job.intakeMetadata?.targeting` and passes it into stage inputs. The legacy
  `operatorNotes` serialization is retained (belt-and-suspenders / freeform
  notes still flow) but the structured object is the authoritative signal.
- **ADR-S3-2 — One audience-directive builder, injected via the system
  prompt.** Lives at `packages/ai-engine/src/prompts/audience-directive.ts`.
  Pure function `Targeting → string`. Injected into `buildSystemPrompt` as an
  appended block so every text stage shares one canonical interpretation and
  the model treats it as a hard constraint, not a hint.
- **ADR-S3-3 — img2img via `fal-ai/flux-pro/kontext`, hero-only, with hard
  fallback.** Kontext is the identity-preserving editor ($0.04/img, same as
  Flux 1.1). Reference URL is resolved from `job.uploadedImages[0]` against
  `StoreConfig.r2PublicBaseUrl` (with the same S3-endpoint guard the fanaa
  read-side uses). If no servable public URL is resolvable, or Kontext fails,
  the hero degrades to the existing text-to-image path — guaranteeing no
  regression versus the current working state.
- **ADR-S3-4 — fal adapter shapes input per model family.** Kontext rejects
  `image_size`/`negative_prompt`; it takes `image_url` + `aspect_ratio`. The
  adapter branches on the model id so the Flux 1.1 path is byte-for-byte
  unchanged.

### 26.6 Major discoveries (running log)

- 2026-05-31 — Confirmed `referenceImages` is dead across the repo (only
  defined in `contracts.ts`/`fal.ts`); production image gen is text-only.
- 2026-05-31 — `intakeMetadata.targeting`, `offers`, `costBreakdown` are
  persisted on the run record but never consumed by the worker.
- 2026-05-31 — `structure` stage output is computed and then ignored by
  every downstream stage; `assemble` accepts it in its input type but never
  reads it.
- 2026-05-31 — `copy` generates `foundersNote`, but `assemble` drops it
  (not present on `UniversalProduct`).
- **2026-05-31 (ROOT CAUSE) — the `vision` stage is blind on every
  uploaded-image run.** Intake persists images as **bare R2 keys**
  (`ImageUploader` stores `{ src: presigned.ref.key }`). The orchestrator
  passed those keys straight to the vision provider, and the Anthropic adapter
  sends them as `image.source.url`. A bare key is not a fetchable URL → the API
  call throws → `vision.ts` retries once, fails, and returns `{ skipped: true }`
  **silently**. With vision skipped (and research often skipped/empty for
  upload-only intakes), `strategy` has **no product signal** and fabricates a
  product consistent only with Fanaa's hardcoded beauty/skincare brand voice.
  This is why SmileEase (teeth-whitening) produced skincare copy + a generic
  cream-jar hero. See §26.10.

### 26.7 Blockers / risks

- **fal Kontext is not unit-testable against the live API here.** Mitigated by
  (a) mocked adapter tests for input shaping + fallback, and (b) the hard
  text-to-image fallback so a Kontext outage cannot break hero generation.
- **Reference URL must be publicly fetchable by fal.** If `r2PublicBaseUrl`
  is ever misconfigured to the private S3 endpoint, the resolver skips img2img
  (falls back) rather than passing an unservable URL.

### 26.8 Future recommendations

- Add an internal "regenerate single image with stronger identity lock" action
  once Kontext quality is observed in production.
- Consider a `targetingFingerprint` on the run so identical intake produces a
  reproducible draft (aids A/B and caching).
- Revisit whether `StoreConfig.market` should be derived per-run from intake
  rather than fixed per store, once multi-market demand is real.

### 26.9 Change log for this section

- 2026-05-31 — Section created. Step 1–2 marked complete; Step 3 started
  (audience directive, structured targeting threading, img2img via Kontext).
- 2026-05-31 — Step 3 core implementation landed. Files touched:
  - `packages/ai-engine/src/prompts/audience-directive.ts` (new) — `Targeting`
    → enforced directive; `buildAudienceDirective` + `summariseAudience`.
  - `packages/ai-engine/src/prompts/system.ts` — accepts + appends
    `audienceDirective`.
  - `packages/ai-engine/src/prompts/{strategy,copy,creative-prompts}.ts` —
    accept `targeting`; creative-prompts now grounded in vision product-identity
    attributes; identity-preservation system rules added.
  - `packages/ai-engine/src/pipeline/{strategy,copy,creative-prompts}.ts` +
    `types-{strategy,copy,creative-prompts}.ts` — thread `targeting`.
  - `packages/ai-engine/src/pipeline/{image-gen.ts,types-image-gen.ts}` —
    hero img2img-with-fallback; `referenceImage` input; `DEFAULT_IMG2IMG_MODEL`.
  - `packages/ai-engine/src/providers/{contracts.ts,adapters/fal.ts}` —
    `aspectRatio` passthrough; Kontext model-aware input shaping + pricing.
  - `packages/worker/src/runtime/orchestrator.ts` — pass `targeting` to 3
    stages; `resolveReferenceImage()` resolves the uploaded photo to a servable
    public URL for img2img (S3-endpoint-guarded).
  - Tests: new `prompts/__tests__/audience-directive.test.ts`; targeting +
    img2img cases added to strategy/copy/creative-prompts/image-gen suites.
  - Verification: `ai-engine` 67 tests, `worker` 30 tests green; `pnpm -r
    typecheck` clean across all 14 workspaces.
- 2026-05-31 — **Product-identity investigation + root-cause fix** (§26.10).
  Vision image-URL resolution fix + product-fidelity prompt guards. Files:
  - `packages/worker/src/runtime/orchestrator.ts` — new exported
    `resolvePublicImageUrl()`; vision dispatch now resolves bare R2 keys →
    public CDN URLs before calling the vision provider; `resolveReferenceImage`
    refactored to reuse it.
  - `packages/ai-engine/src/prompts/strategy.ts` + `copy.ts` — "PRODUCT
    FIDELITY" hard rule (never substitute a generic store-typical product).
  - `packages/ai-engine/src/prompts/copy.ts` + `pipeline/copy.ts` — copy user
    prompt now carries vision `productCategory` + `visibleText` directly.
  - Tests: new `worker/src/__tests__/resolve-public-image-url.test.ts` (8
    cases). `worker` 38, `ai-engine` 67 green; both packages typecheck clean.
- 2026-05-31 — **Identity-flow evidence harness** (real-code proof for the
  SmileEase validation). New deterministic traces drive the real stages with
  mocked provider I/O and capture exactly what each stage receives:
  - `packages/ai-engine/src/pipeline/__tests__/identity-flow.trace.test.ts` —
    proves (1) bare key → vision throws → SKIPPED → strategy gets "(No vision
    summary)"; (2) resolved CDN URL → vision returns the SmileEase identity;
    (3) strategy, (4) copy, (5a) creative-prompts user prompts all carry the
    teeth-whitening identity; (5b) image-gen hero call uses `flux-pro/kontext`
    with the real photo URL as the img2img reference + identity-lock prompt.
  - `packages/worker/src/__tests__/identity-flow.trace.test.ts` — proves the
    orchestrator resolves the bare key to the public CDN URL before BOTH the
    vision and image providers, and threads structured targeting into the text
    stages' system prompts (`AUDIENCE & POSITIONING DIRECTIVE`, `PRODUCT-AWARE`,
    `LUXURIOUS`). `worker` 39, `ai-engine` 72 green.
- 2026-05-31 — Step 3 **validated in production** (`537d1a1`) via Beef Tallow
  Honey Balm (§26.11). §26.2 critical note flipped to RESOLVED; §26.3 marked
  validated. **Step 4 plan revised** (§26.4) after an evidence trace of the
  generation + rendering paths: discovered the two-renderer fork (production
  fanaa PDP ignores AI sections; validated page is the Studio preview), three
  competing section taxonomies, that most rich sections are never generated, and
  the benefit-icon rendering bug. Step 4 re-scoped into 5 phases incl. the
  deferred M12 storefront-render wiring, mobile-first.
- 2026-05-31 — Step 4 **Phase 4.0** shipped (`14c80da`): taxonomy + icon-bug fix
  + foundersNote reclaim. Step 4 **Phase 4.1** (generation side) shipped: new
  `section_content` stage (mechanism/ingredients/results/guarantee/comparison),
  canonical `SectionContent` type, assemble distributes it + consumes the
  `structure` ordering (`sectionOrder`), objections reclaimed from strategy.
  Tests: ai-engine 78, worker 39, studio 31, runtime-renderer 12. Next: 4.2
  (fanaa dynamic mobile-first section registry) + 4.3 (awareness-aware ordering).
- 2026-05-31 — Step 4 **Phase 4.2** shipped (data path + rendering). New
  `CroContent` projection persisted to `storefront_catalog_product.cro_content`
  (Prisma migration `0006`) and hydrated onto the fanaa `Product` via defensive
  coercers. New `ProductSections` orchestrator renders the AI `sectionOrder`
  inside the production PDP commerce shell with mobile-first, RTL-aware section
  components (how-it-works, results timeline, guarantee, comparison, objections,
  founder's note); curated pages degrade byte-identically to the legacy fixed
  layout. Tests: fanaa 128 (+4 cro_content hydration), persistence 80.
  **Deploy:** `prisma migrate deploy` + client regen (studio writes, fanaa/web
  reads); re-publish AI products to backfill `cro_content`. Next: 4.3
  (awareness/sophistication-aware ordering) + 4.4 (mobile live validation).
- 2026-05-31 — Step 4 **Phase 4.3** shipped (ADR-S4-2). The `structure` stage is
  now **deterministic**: a pure `planSectionOrder` planner orders/selects
  sections from `awarenessLevel` + `sophisticationLevel` (Schwartz), replacing
  the LLM call. Different awareness levels and sophistication levels now produce
  meaningfully different page structures (proven by tests). `how_it_works` +
  `comparison` added to the fanaa section library. Removed a per-draft LLM
  round-trip (6→5 text calls). Tests: ai-engine 89 (+8 structure deterministic,
  +7 planner), worker 39, stores green. Next: 4.4 (mobile live re-validation on
  Beef Tallow / SmileEase).

### 26.10 Product-identity pipeline investigation (2026-05-31)

**Trigger:** live validation. Uploaded *SmileEase* (purple teeth-whitening /
colour-corrector serum, V34). Output: skincare cream-jar hero + Arabic copy
about skin softness (`بشرتك تستحق لمسة صادقة — نعومة حقيقية`). Both image **and**
copy were wrong → identity lost upstream of image generation.

**End-to-end trace (where identity survives vs dies):**

| Stage | Carries identity? | Evidence |
|---|---|---|
| Intake upload | ✅ key stored | `ImageUploader` → `{ src: <R2 key> }` |
| `IngestJob.uploadedImages` | ✅ bare key | orchestrator input |
| **`vision`** | ❌ **DIES HERE** | bare key sent as `image.source.url` → API throws → `{ skipped:true }` silently |
| `research` | ⚠️ only if a real supplier URL was scraped; upload-only intakes → skipped/empty |
| `strategy` | ❌ no signal → fabricates from store brand voice | `formatVisionForPrompt` returns `undefined`; research empty |
| `copy` | ❌ inherits generic skincare persona | hero promise already off-product |
| `creative_prompts` | ❌ generic beauty jar | no real category/colours |
| `image_gen` | ❌ text-to-image invents a jar | img2img code not deployed |
| `assemble` | ✅ faithfully assembles the wrong product | n/a |

**Root cause (primary):** vision is blind on every uploaded-image run because
intake stores **bare R2 keys** and nothing resolved them to a fetchable URL
before the vision provider call. Vision silently skips; the pipeline then
invents a generic skincare product from Fanaa's hardcoded beauty brand voice.

**Root cause (secondary, compounding):** the entire Step 3 implementation was
**uncommitted** (HEAD `23db6bf`), so targeting threading, the audience
directive, vision-grounded creative prompts, and Kontext img2img were **not in
the validated build** at all.

**Fixes implemented (this session):**

1. **Vision image-URL resolution (the fix).**
   `resolvePublicImageUrl(src, r2PublicBaseUrl)` composes bare R2 keys /
   `r2://` refs into public `cdn.elfanaa.com` URLs (S3-endpoint-guarded), and
   the `vision` dispatch resolves every uploaded image before the provider
   call. Vision can now actually see the product → `strategy` receives
   `Category / Label text / Colours` → identity propagates to copy + creative +
   image. `resolveReferenceImage` (img2img) reuses the same helper.
2. **Product-fidelity guardrails.** `strategy` and `copy` system prompts now
   carry a hard rule: anchor to the EXACT product from vision/research; never
   substitute a generic store-typical (skincare) product even when the item is
   outside the store's usual niche.
3. **Concrete identity into copy.** The `copy` user prompt now includes the
   vision `productCategory` + `visibleText` directly (previously copy only saw
   the strategy hero promise + form factor).

**Targeting-field audit (deployed `23db6bf` reality):**

| Intake field | Status (deployed) | After Step 3 commit |
|---|---|---|
| Market | partial — serialized into `operatorNotes` → strategy only | directive into strategy+copy+creative; can override store default |
| Gender | partial — strategy only | directive into all 3 text stages |
| Age range | partial — strategy only | directive into all 3 |
| Awareness stage | partial — strategy only | enforced awareness playbook in all 3 |
| Sophistication level | partial — strategy only | enforced framing in all 3 |
| Emotional angle | partial — strategy only | enforced lever in all 3 |
| Tone style | partial — strategy only | enforced register in all 3 |
| Language | used — drives AR/EN copy locale | unchanged |
| Target audience (free text) | partial — via operatorNotes | flows as before + directive |
| **Product type** | **NOT CAPTURED** — no intake field exists | still not captured → recommend adding (Step 3.1/4) |
| **Problems addressed** | **NOT CAPTURED** — no intake field exists | still not captured → recommend adding (Step 3.1/4) |

Net: before this work targeting was *partially used* (strategy-only, as prose)
and product identity was *lost at vision*. The fix restores identity; the Step 3
commit makes targeting *actively enforced* across all text stages. "Product
type" and "Problems addressed" are genuinely **absent from intake** and remain a
recommended enhancement.

**Step 3 status answers:**

1. **Is Step 3 truly complete?** No. Code is complete and tested but
   **uncommitted/undeployed**, and it was masking the vision root cause. After
   committing + deploying this session's fix, Step 3 is *code-complete* and
   awaits one clean live re-validation.
2. **% actually working in production today (`23db6bf`):** ~15%. Only
   `Language` reliably influences output; identity is broken on every
   upload-only run. After deploy of this session's fix: ~85% (identity restored
   + targeting enforced); the remaining ~15% is live-quality tuning of Kontext
   identity-lock and audience reflection.
3. **What remains before Step 4 can start safely:** (a) commit + deploy
   §26.10 fix + the Step 3 changes; (b) one live run of SmileEase showing
   teeth-whitening copy + an on-identity hero; (c) confirm targeting choices are
   visibly reflected. No further code is blocking.
4. **Exact fixes:** see "Fixes implemented" above (vision URL resolution;
   product-fidelity guards; vision identity into copy prompt) + the Step 3
   bundle (§26.9).
5. **Validation:** `worker` 38 tests (incl. 8 new resolver regression tests),
   `ai-engine` 67 tests, both typecheck clean. Live validation pending deploy.

### 26.11 Live validation results

**2026-05-31 — SmileEase (purple teeth-whitening serum):** the failure case that
exposed the §26.10 root cause. Pre-fix output was a generic skincare cream-jar
hero + skin-softness Arabic copy. Root cause: vision blind on bare-key images →
generic hallucination from the store brand voice.

**2026-05-31 — Beef Tallow Honey Balm (build `537d1a1`, post-fix):** PASS for
Step 3 objectives.
- Vision now sees the uploaded product image.
- Identity flows Intake → Vision → Strategy → Copy → Image generation.
- Hero uses the actual uploaded product (no invented product).
- Copy is about balm / honey / hydration — on-product, not generic.
- Product category + visible label text reach copy generation.
- **Step 3 validated in production.**

Confirmed remaining gaps (all **Step 4**, not Step 3 defects): page structure
still generic; placeholder/empty sections; no premium sales architecture; no
mechanism storytelling; no ingredient/founder/transformation/results blocks; no
awareness-aware layout; not yet a premium mobile-first GCC CRO experience.

> **Surface caveat (evidence):** the validated rich page is the **Studio
> `/p/[slug]` runtime-renderer preview** (the "Moon/Zap/Shield" icon-name
> headings are that renderer's signature bug). The production storefront PDP
> (`apps/fanaa/.../products/[slug]`) does **not** yet render AI sections — see
> §26.4.1. Wiring that is core Step 4 work.
