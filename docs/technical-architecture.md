# News Credibility Platform – Technical Architecture Documentation

## 1) System Overview

### Problem Statement
Modern digital news ecosystems face three recurring problems:
1. **Low trust in article credibility** due to misinformation and sensationalized content.
2. **Weak provenance guarantees** where article claims and trust outcomes are hard to audit.
3. **Operational fragility** when external scoring/image services fail, causing degraded user experience.

### Objective
Build a layered credibility platform that:
- Scores article trust using multi-signal analysis.
- Tracks author credibility evolution over time.
- Supports admin governance (publish, override, dashboard).
- Adds blockchain-backed verification metadata for immutable audit trails.
- Preserves service reliability through retry/circuit/fallback behavior.

### Key Innovations
- **Hybrid trust model** combining Message/Fact/Context signals (`M/F/C`) into a composite score `f`.
- **Author reputation dynamics** updated with explicit policy thresholds.
- **Admin governance controls** with audit logs and trust override tracking.
- **Blockchain-backed verification metadata** (hash + tx linkage + status).
- **Resilient integration clients** with timeout, retries, and circuit breaker state tracking.
- **Standardized API envelope and structured logging** for consistent observability.

---

## 2) Architecture Design

### Layered Architecture (Current)
The backend follows a layered design to keep concerns isolated:

- **Controllers (Routes)**: HTTP parsing, validation, response mapping.
- **Application Services**: use-case orchestration and workflow rules.
- **Domain Layer**: trust policy math and pure scoring/composition logic.
- **Repositories**: data access abstraction over Mongoose models.
- **Infrastructure Clients/Utils**: external API adapters, blockchain adapter, logging, metrics, auth utilities.

### Architecture Diagram (ASCII)

```text
┌──────────────────────────────────────────────────────────────────────┐
│                           Frontend (Vite/React)                     │
│  Feed UI | Detail UI | Verify button | Typed API client             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTP /api/*
┌───────────────────────────────▼──────────────────────────────────────┐
│                         Controllers (Routes)                         │
│ /api/analyze | /api/image | /api/auth | /api/admin | /api/articles  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ delegates
┌───────────────────────────────▼──────────────────────────────────────┐
│                      Application Service Layer                       │
│ scoreService | adminService | imageTrustService | authService        │
│ authorTrustService | blockchainService | articleVerificationService  │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │                               │
      ┌─────────▼─────────┐            ┌────────▼───────────────────┐
      │  Domain Layer     │            │ Infrastructure Clients      │
      │ trustPolicy       │            │ mlClient | imageWorkerClient│
      │ (M/F/C -> f,      │            │ blockchainClient            │
      │ author update)    │            │ retryCircuitHttp            │
      └─────────┬─────────┘            └────────┬───────────────────┘
                │                                │
┌───────────────▼────────────────────────────────▼─────────────────────┐
│                         Repository Layer                              │
│ articleRepository | authorRepository | imageRepository | auditLogRepo│
└───────────────┬───────────────────────────────────────────────────────┘
                │
      ┌─────────▼─────────┐              ┌──────────────────────────────┐
      │ MongoDB           │              │ Blockchain Network            │
      │ Authors/Articles/ │              │ NewsTrust.sol contract        │
      │ Images/AuditLogs  │              │ storeArticle(hash,trustScore) │
      └───────────────────┘              └──────────────────────────────┘
```

### Module Breakdown

#### Controllers
- `routes/analyze.js`: article analysis endpoint.
- `routes/imageTrust.js`: image trust workflow endpoint.
- `routes/auth.js`: admin login issuance.
- `routes/admin.js`: protected admin operations.
- `routes/articles.js`: verification endpoint (`/api/articles/:id/verify`).

#### Services
- `scoreService`: article scoring orchestration + author update + persistence.
- `adminService`: admin publish, override, dashboard aggregation.
- `authorTrustService`: author trust recalculation from article history.
- `imageTrustService`: image hash/watermark orchestration.
- `blockchainService`: SHA256 + on-chain write orchestration.
- `articleVerificationService`: recompute hash + verify outcome.
- `authService`: admin credential validation + token issuance.

#### Domain
- `trustPolicy`: pure trust composition and author trust mutation policy.

#### Repositories
- `articleRepository`, `authorRepository`, `imageRepository`, `auditLogRepository`.

#### Infra/Utility
- HTTP resilience: `retryCircuitHttp`, `mlClient`, `imageWorkerClient`.
- Blockchain adapter: `blockchainClient`.
- Security helpers: `middleware/auth`, `utils/jwt`.
- Observability: `middleware/requestId`, `utils/logger`, `utils/metrics`.
- Response envelope: `utils/response`.

### Request Lifecycle (Generic)
1. Request enters Express and receives `requestId` middleware.
2. Route validates input and checks auth/role when required.
3. Route delegates to service (thin controller).
4. Service orchestrates domain + repositories + external clients.
5. Repository persists to MongoDB (transaction used when available).
6. Route returns standardized envelope:
   - success: `{ success: true, data }`
   - error: `{ success: false, error }`

---

## 3) Blockchain Integration Design

### Why Blockchain?
Blockchain is used to add **tamper-evident provenance** to article trust artifacts by storing article text hash + trust score + timestamp in immutable ledger storage.

### What Is Stored On-Chain?
From `NewsTrust.sol`:
- `hash` (`bytes32`) – SHA256 of article text.
- `trustScore` (`uint256`) – scaled trust score (`f * 1,000,000`).
- `timestamp` (`uint256`) – block timestamp at write time.

### Failure Isolation Strategy
Blockchain write happens **after article persistence** and only inside `adminService.publishArticleByAdmin()`.

If blockchain write fails:
- Error is logged.
- Publish response still succeeds (no user-facing hard failure).
- `article.blockchainStatus` remains/sets `pending`.
- `blockchainFailureCount` metric increments.

This keeps governance and UX resilient even during chain outage or key/config issues.

### Admin Publish Flow (ASCII)

```text
Admin UI
  │ POST /api/admin/articles
  ▼
admin route (auth+role)
  ▼
adminService.publishArticleByAdmin()
  ▼
scoreService.calculateAndUpdateScores()
  ├─ ML client (or fallback detectors)
  ├─ Article persist
  └─ Author trust update persist
  ▼
blockchainService.writeArticleVerification()
  ├─ SHA256(text)
  └─ blockchainClient.storeArticleOnChain()
        ├─ success → save tx/hash/time/status=success
        └─ fail    → log + metric++ + status=pending
  ▼
auditLogRepository.create(admin.article.publish)
  ▼
API response success (never blocked by chain failure)
```

### Blockchain Verification Flow (ASCII)

```text
Client clicks "Verify Integrity"
  │ GET /api/articles/:id/verify
  ▼
routes/articles.js
  ▼
articleVerificationService.verifyArticleById()
  ├─ load article by id
  ├─ recompute SHA256(article.text)
  ├─ compare with article.blockchainHash
  └─ return {verified, txHash, blockchainTimestamp, blockchainStatus}
  ▼
standard envelope response
```

---

## 4) Trust Scoring Model

### M/F/C Explanation
- **M (Message score)**: linguistic/tonal quality heuristics.
- **F (Fact score)**: factual support estimation (ML or fallback detector strategy).
- **C (Context score)**: context quality and source/page-level indicators.

### Composite Trust Score
Trust score is computed as weighted composition:

`f = alpha*M + beta*F + (1 - alpha - beta)*C`

Where `alpha` and `beta` are env-configurable (`ALPHA`, `BETA`).

### Author Trust Update Policy
For each article score `f`:
- increment `totalArticles`
- if `f >= 0.7`: increase `trustScore` by `+0.05` capped at `1`
- if `f < 0.3`: increment `fakeArticles` and decrease `trustScore` by `-0.1` floored at `0`

### Override Logic
Admin can override article trust score (0..1) with required reason.
- Stores override metadata on article (`overrideReason`, `overrideBy`, `overrideAt`, `originalF`).
- Recalculates affected author trust using article history.
- Emits audit log action `admin.article.trust_override`.

---

## 5) Reliability Features

### Retry Mechanism
External HTTP clients use bounded retry for retryable failures.

### Circuit Breaker
Client-level circuit state tracks consecutive failures and opens for cooldown to prevent cascading overload.

### Timeout Strategy
External calls enforce timeout defaults (configured in client factory) to avoid hung requests and slow resource exhaustion.

### Fallback Strategy
For scoring, if ML API fails, system falls back to local detectors (`messageBased`, `factBased`, `contextBased`).

---

## 6) Database Design

### Core Entities (ER Explanation)

```text
Author (1) ───────────< (N) Article
  │                        │
  │                        └─ stores M/F/C/f and override/blockchain metadata
  │
  └─ credibility aggregates (trustScore, totalArticles, fakeArticles)

Image (independent by sha256 lookup)
AuditLog (append-only actions: actor/action/entityId/metadata/timestamp)
```

### Index Strategy
- `Author.email` unique.
- `Article.url` unique partial index (non-empty URL values).
- `Image.sha256` unique index.
- `Article.blockchainHash` index for verification and operational lookup.

### Consistency Strategy
- Author/article writes in scoring path use optional Mongo transaction (`withTransaction`) where supported.
- Graceful fallback to non-transaction flow when deployment topology lacks transaction support.

---

## 7) Security Design

### JWT Authentication
- Admin login issues signed token.
- Protected endpoints validate bearer token and signature.

### Role-Based Access Control (RBAC)
- Admin routes require `role === "admin"`.

### Admin Protection Scope
- All `/api/admin/*` endpoints are protected via auth + role middleware.
- Publish/override/dashboard operations are inaccessible to non-admin users.

---

## 8) Observability

### Metrics Collected
- `mlFailureCount`
- `fallbackUsageCount`
- `blockchainFailureCount`

### Logging Format
Structured JSON logs with fields such as:
- `timestamp`
- `level`
- `message`
- request/service metadata (`requestId`, actor, path, statusCode, durationMs, etc.)

### Traceability
- `x-request-id` generated or propagated per request.
- Included in route-level failure logging for correlation.

---

## 9) Limitations & Future Work

### Current Limitations
1. Blockchain adapter currently depends on runtime wallet/private key availability and RPC access.
2. No automated test suite coverage yet for new admin/blockchain flows.
3. In-memory metrics reset on service restart (not durable).
4. Contract writes store summary values only; no on-chain historical versioning beyond overwrite-by-hash key.

### Future Work
1. Add integration/unit tests across routes/services/clients.
2. Persist metrics to time-series storage (Prometheus/OpenTelemetry).
3. Add background retry queue for `blockchainStatus=pending` reconciliation.
4. Implement stronger JWT key management/rotation and secret vault integration.
5. Add advanced frontend dashboards for trust trends and author timelines.

---

## 10) Conclusion
The platform now implements a resilient, layered credibility architecture with governance controls, trust analytics, and blockchain-backed verification metadata while preserving thin controllers and clear module boundaries. This design is suitable for iterative enhancement in academic and production-oriented contexts.
