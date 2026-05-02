# Vilar DS — Architecture & Documentation Technique

## 1. Schéma d'Architecture Global

```
Internet
   │
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Nginx (reverse proxy · TLS · rate-limiting · static cache)      │
└────────────┬─────────────────────────┬──────────────────────────┘
             │                         │
      ┌──────▼──────┐          ┌───────▼──────┐
      │  Next.js    │          │   NestJS API  │
      │  (SSR/RSC)  │  HTTP    │   /api/v1     │
      │  :3000      │◄────────►│   :4000       │
      └─────────────┘          └───────┬───────┘
                                       │
              ┌────────────────────────┼────────────────┐
              │                        │                │
      ┌───────▼──────┐        ┌────────▼──────┐  ┌─────▼──────┐
      │  PostgreSQL  │        │    Redis       │  │  Bull MQ   │
      │  :5432       │        │    :6379       │  │  (queues)  │
      └──────────────┘        └───────────────┘  └────────────┘
              │
      ┌───────▼──────┐
      │  Prometheus  │──► Grafana
      └──────────────┘
```

## 2. Choix Techniques — Justifications

### Architecture : Monolithe Modulaire
- Vélocité maximale pour une team < 15 ingénieurs
- Séparation claire des domaines (modules NestJS isolés)
- Extractable en microservices sans refonte : chaque module a ses propres DTO, service, controller
- Shopify, Basecamp, GitHub ont tous démarré monolithes

### Multi-tenancy : tenant_id + RLS PostgreSQL
- Schema-per-tenant = N connexions PostgreSQL = coût prohibitif à 10k tenants
- `tenant_id` en colonne + index = isolation efficace + 1 pool de connexions
- RLS (Row Level Security) activable pour renforcer l'isolation au niveau DB
- Migration vers schema-per-tenant possible progressivement pour les gros clients

### Communication : REST + BullMQ (pas GraphQL, pas Kafka)
- REST = documentation Swagger gratuite, DX excellente, pas de N+1 à gérer
- BullMQ sur Redis = queues async pour emails, PDF, crons (pas besoin de Kafka avant 1M events/jour)
- WebSockets natifs NestJS si chat/notifications temps réel nécessaire

### Auth : JWT (15min) + Refresh (7j) + OAuth Google
- Access tokens courts = révocation rapide en cas de compromission
- Refresh tokens = pas de re-login fréquent
- Stateless = scalabilité horizontale native

## 3. Arborescence Projet

```
vilar-ds-saas/
├── apps/
│   ├── api/                            # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/               # JWT, OAuth, refresh
│   │   │   │   ├── users/              # CRUD + RBAC
│   │   │   │   ├── tenants/            # Multi-tenancy + plans
│   │   │   │   ├── billing/            # Stripe + webhooks
│   │   │   │   ├── crm/                # Contacts + interactions
│   │   │   │   ├── invoicing/          # Factures + paiements + PDF
│   │   │   │   ├── hr/                 # Employés + congés + pointage
│   │   │   │   ├── dashboard/          # KPIs agrégés
│   │   │   │   └── health/             # Health checks
│   │   │   ├── common/
│   │   │   │   ├── decorators/         # @CurrentUser, @Roles, @Public
│   │   │   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   │   │   ├── interceptors/       # Logging, Transform
│   │   │   │   ├── filters/            # AllExceptionsFilter
│   │   │   │   ├── pipes/              # StrictValidationPipe
│   │   │   │   └── middleware/         # TenantMiddleware
│   │   │   ├── database/               # PrismaService (global)
│   │   │   ├── queue/                  # BullMQ processors
│   │   │   ├── config/                 # ConfigService + validation
│   │   │   ├── events/                 # Typed domain events
│   │   │   ├── app.module.ts
│   │   │   └── main.ts                 # Bootstrap + Swagger + Helmet
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Schéma complet
│   │   │   └── seed.ts
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                            # Next.js 14 Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── auth/login/         # Login page
│       │   │   ├── auth/register/      # Register page
│       │   │   ├── dashboard/          # Protected layout + pages
│       │   │   │   ├── layout.tsx      # Auth guard + Sidebar
│       │   │   │   ├── page.tsx        # Dashboard KPIs
│       │   │   │   ├── crm/            # CRM pages
│       │   │   │   ├── invoicing/      # Invoicing pages
│       │   │   │   ├── hr/             # HR pages
│       │   │   │   └── billing/        # Billing pages
│       │   │   ├── layout.tsx          # Root layout
│       │   │   └── globals.css         # Tailwind + design tokens
│       │   ├── components/
│       │   │   ├── layout/Sidebar.tsx
│       │   │   └── providers/
│       │   ├── hooks/useAuth.ts
│       │   ├── lib/
│       │   │   ├── api.ts              # Axios + refresh interceptor
│       │   │   └── auth.service.ts
│       │   ├── store/auth.store.ts     # Zustand persisted
│       │   └── types/index.ts          # Shared TypeScript types
│       ├── Dockerfile
│       ├── next.config.js
│       └── package.json
│
├── infrastructure/
│   ├── nginx/
│   │   ├── nginx.conf                  # Nginx config (rate-limit, gzip)
│   │   └── conf.d/default.conf         # Virtual hosts
│   ├── prometheus/
│   │   └── prometheus.yml
│   └── grafana/dashboards/
│
├── scripts/
│   └── init-db.sql                     # PostgreSQL extensions + roles
│
├── .github/workflows/
│   └── ci.yml                          # CI/CD pipeline
│
├── docker-compose.yml                  # Dev + staging
├── docker-compose.prod.yml             # Production overrides
├── .env.example
├── package.json                        # Yarn workspaces root
└── ARCHITECTURE.md
```

## 4. Schéma Base de Données (relations principales)

```
Tenant (1) ──── (N) User
Tenant (1) ──── (N) Contact ──── (N) Interaction
Tenant (1) ──── (N) Invoice ──── (N) InvoiceLineItem
                                 (N) InvoicePayment
Contact  (1) ──── (N) Invoice
Tenant (1) ──── (N) Employee ──── (N) EmployeeLeave
                                   (N) EmployeeTimesheet
Tenant (1) ──── (N) AuditLog
Tenant (1) ──── (N) UsageRecord
Tenant (1) ──── (N) WebhookEvent
User   (1) ──── (N) UserPermission
```

## 5. Rôles RBAC (hiérarchie)

| Rôle          | Niveau | Accès                                           |
|---------------|--------|--------------------------------------------------|
| SUPER_ADMIN   | 100    | Toute la plateforme (Vilar DS admins)            |
| TENANT_ADMIN  | 80     | Tous les modules, settings, billing, users       |
| MANAGER       | 60     | CRM, Facturation, RH, création users             |
| ACCOUNTANT    | 50     | CRM (lecture), Facturation complète              |
| EMPLOYEE      | 30     | Lecture CRM/Factures, RH (son profil)            |
| READONLY      | 10     | Lecture seule sur tout                           |

## 6. Plans & Quotas

| Plan       | Utilisateurs | Factures/mois | Contacts | Employés | Features                    |
|------------|-------------|---------------|----------|----------|-----------------------------|
| FREE       | 2           | 10            | 100      | 5        | CRM basique, facturation    |
| PRO        | 10          | 200           | 2 000    | 50       | + Analytics, PDF, avancé    |
| ENTERPRISE | ∞           | ∞             | ∞        | ∞        | + API, SSO, branding custom |

## 7. Events du Bus Interne

| Événement                  | Déclencheur              | Consommateurs                    |
|---------------------------|--------------------------|----------------------------------|
| user.registered           | POST /auth/register      | MailProcessor (welcome email)    |
| invoice.created           | POST /invoicing          | Queue PDF, UsageRecord           |
| invoice.sent              | POST /invoicing/:id/send | MailProcessor (send to client)   |
| invoice.paid              | POST /invoicing/:id/pay  | Contact stats update             |
| payment.succeeded         | Stripe webhook           | Tenant plan activation           |
| subscription.started      | Stripe checkout complete | Tenant upgrade                   |
| subscription.cancelled    | Stripe sub deleted       | Tenant downgrade to FREE         |

## 8. Roadmap de Scaling (0 → 1 → 10 000 clients)

### Phase 0 — VPS (0–100 clients)
- 1 VPS 8 vCPU / 16 GB RAM
- Docker Compose
- PostgreSQL + Redis sur le même serveur
- Nginx en reverse proxy
- Sauvegardes PostgreSQL via cron → S3

### Phase 1 — VPS multi-instances (100–1 000 clients)
- 2 VPS (app) + 1 VPS (DB) + 1 VPS (Redis)
- Nginx upstream avec 2 réplicas API + 2 réplicas Web
- PostgreSQL en mode replica (hot standby)
- Redis Sentinel pour la HA
- CDN pour les assets statiques (CloudFront)

### Phase 2 — Cloud managé (1 000–10 000 clients)
- Migration vers AWS/GCP sans refonte (app stateless)
- ECS/Cloud Run pour les containers (auto-scaling)
- RDS PostgreSQL multi-AZ
- ElastiCache Redis Cluster
- S3/GCS pour les PDF et documents
- CloudFront pour le frontend Next.js
- SES pour les emails transactionnels

### Phase 3 — Microservices sélectifs (> 10 000 clients)
- Extraire BillingService (charge la plus critique)
- Extraire InvoicingService (génération PDF intensive)
- API Gateway (Kong ou AWS API GW)
- Event streaming Kafka si > 1M events/jour
- Elasticsearch pour recherche avancée

## 9. Sécurité — Checklist OWASP

- ✅ Injection SQL : Prisma ORM + requêtes paramétrées
- ✅ Auth brisée : JWT courts (15min) + refresh, bcrypt rounds=12
- ✅ Exposition données sensibles : passwordHash jamais sérialisé, HTTPS only
- ✅ XXE : pas d'XML parsing
- ✅ Broken Access Control : RolesGuard + TenantMiddleware sur toutes routes
- ✅ Misconfiguration : Helmet, server_tokens off, security headers
- ✅ XSS : Next.js escaping natif, CSP headers
- ✅ Désérialisations non sécurisées : class-validator whitelist=true
- ✅ Rate limiting : ThrottlerModule + Nginx limit_req
- ✅ Logging insuffisant : Winston structuré + AuditLog en DB

## 10. Variables d'Environnement Requises (production)

Voir `.env.example` pour la liste complète.

Secrets à injecter via GitHub Secrets / AWS Secrets Manager :
- `JWT_ACCESS_SECRET` (min 32 chars, random)
- `JWT_REFRESH_SECRET` (min 32 chars, random)
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SMTP_PASS`
- `AWS_SECRET_ACCESS_KEY`
