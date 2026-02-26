# Architecture Review

## 1) Current Code Structure

### Top-level
- `frontend/`: React + Vite client app.
- `server/`: Express + Mongoose API and scoring logic.
- `server/watermark.py`: Separate Python worker used by Node image-analysis route.

### Backend layout (`server/src`)
- `index.js`: App bootstrap, middleware registration, DB connection, route mounting.
- `db/mongoose.js`: MongoDB connection setup.
- `routes/`: HTTP endpoint handlers (`analyze`, `imageTrust`, legacy `trust`).
- `services/scoreService.js`: Orchestrates scoring + persistence + author trust updates.
- `detectors/`: Local scoring components (`messageBased`, `factBased`, `contextBased`).
- `models/`: Mongoose schemas (`Author`, `Article`, `Image`).
- `trust/trustModel.js`: Alternate trust aggregation algorithm (not wired to routes).
- `utils/watermarkClient.js`: Watermark embed/extract helper.

### Frontend layout (`frontend/src`)
- `App.tsx`: Main UI, article pagination, calls to backend/ML APIs, local cache handling.
- `main.tsx`: Entry point.
- CSS files hold styling.

---

## 2) Services Identified

### Application services
- **Scoring service**: `calculateAndUpdateScores(...)` in `services/scoreService.js`.
  - Responsibilities: dedupe by URL, ensure author exists, call external ML API (with local detector fallback), persist article, mutate author trust stats.
- **Detector services** (domain logic):
  - `computeMessageScore(text)`
  - `computeFactScore(text)`
  - `computeContextScore(url, title, text)`

### Infrastructure/external services
- **MongoDB** (via Mongoose) for persistence.
- **External ML API** (`process.env.ML_API_URL`) for `{M,F,C}` score generation.
- **Flask image worker** (`http://127.0.0.1:6000/`) for watermark/hash/image metadata processing.
- **Wikipedia REST API** inside fact detector.

### Implied services
- **Trust model service** in `trust/trustModel.js` (computed trust components `E/H/G/T`) exists but appears disconnected from active routes.

---

## 3) Controllers Identified

This codebase uses Express route files as controller modules.

- `routes/analyze.js`
  - `POST /api/analyze`
  - Acts as controller for article scoring requests.
- `routes/imageTrust.js`
  - `POST /api/image`
  - Acts as controller for image trust/watermark pipeline.
- `routes/trust.js` (legacy/partially broken)
  - `POST /author`
  - `POST /article`
  - `GET /author/:email`
  - Not mounted in `index.js`, so currently inactive unless manually mounted later.

---

## 4) DB Schema (MongoDB / Mongoose)

### `Author`
- `name: String (required)`
- `email: String (required, unique)`
- `trustScore: Number (default 0.5)`
- `totalArticles: Number (default 0)`
- `fakeArticles: Number (default 0)`
- `createdAt: Date (default now)`

### `Article`
- `url: String`
- `source: String`
- `title: String`
- `text: String`
- `M: Number`
- `F: Number`
- `C: Number`
- `f: Number` (composite trust score)
- `createdAt: Date (default now)`
- `author: ObjectId -> Author (required)`

### `Image`
- `url: String (required)`
- `sha256: String (required)`
- `firstAppeared: Date (default now)`
- `reused: Boolean (default false)`
- `sourceId: String`

### Observed schema-level gaps
- No explicit indexes beyond `Author.email` unique.
- No uniqueness on `Article.url` despite dedupe logic in service.
- No uniqueness on `Image.sha256` despite lookup-by-hash behavior.
- Score fields (`M/F/C/f`) lack min/max validation (expected 0..1).

---

## 5) Missing Separation / Architectural Smells

1. **Route handlers contain infrastructure logic**
   - `imageTrust` route mixes controller concerns with retry logic, external worker IO, and DB persistence.
2. **Service layer mixes orchestration + domain policy + persistence mutation**
   - `scoreService` both computes and applies trust policy updates directly.
3. **Duplicate trust update logic**
   - Similar trust update calculations appear in `scoreService` and `routes/trust.js`.
4. **Ambiguous/inactive trust module**
   - `trust/trustModel.js` provides alternate trust algorithm but is not integrated.
5. **Inconsistent API boundary from frontend**
   - Frontend hardcodes absolute ML URL (`http://172.16.5.182:5000`) and also posts image calls to `'/'`, not explicit backend API routes.
6. **Broken/unsafe legacy controller code**
   - `routes/trust.js` has a `const` reassignment bug in `GET /author/:email` and references undefined vars in fallback branch.
7. **Weak DB constraints for idempotency**
   - Service-level dedupe without DB unique constraints can race under concurrent requests.
8. **Low testability due to tight coupling**
   - External APIs, scoring detectors, and persistence are not abstracted behind interfaces.

---

## 6) Recommended Architectural Improvements

### A. Layering and boundaries
- Introduce a clear layered shape:
  - **Controller layer**: request parsing + response mapping only.
  - **Application services**: use-case orchestration.
  - **Domain layer**: scoring/trust policies as pure functions.
  - **Infrastructure adapters**: Mongo repositories, ML client, watermark worker client.

### B. Split responsibilities into focused modules
- Add:
  - `services/articleAnalysisService` (orchestrates article pipeline)
  - `services/authorTrustService` (single source of trust update policy)
  - `clients/mlClient`, `clients/imageWorkerClient`
  - `repositories/articleRepository`, `authorRepository`, `imageRepository`

### C. Unify trust model strategy
- Decide one trust algorithm path:
  - either current weighted `f_i` + incremental author trust,
  - or `E/H/G/T` model from `trustModel.js`.
- Place chosen policy in one domain module and reuse everywhere.

### D. Harden persistence model
- Add indexes/constraints:
  - `Article.url` unique (if URL is canonical identifier)
  - `Image.sha256` unique
- Add schema validators for score ranges and required fields where applicable.
- Consider transaction/session for “create article + update author” consistency.

### E. API and configuration consistency
- Move all endpoint URLs to config/env on frontend (`VITE_API_BASE_URL`, etc.).
- Frontend should call named backend routes (`/api/analyze`, `/api/image`) consistently.
- Remove dead routes or mount/fix them explicitly.

### F. Reliability/observability
- Standardize error envelope format.
- Add request IDs + structured logs.
- Add timeout/retry strategy in dedicated HTTP clients, not controllers.

### G. Testing strategy
- Unit tests for domain score composition and trust update policies.
- Integration tests for routes with mocked external APIs.
- Contract tests for Python worker response shape.

---

## 7) Suggested Near-term Refactor Plan (Low Risk)

1. Fix/mount or delete `routes/trust.js` and remove duplicated logic.
2. Extract `imageTrust` external call/retry into `imageWorkerClient`.
3. Extract trust mutation to `authorTrustService.update(author, score)`.
4. Add DB unique indexes + migration handling for existing duplicates.
5. Standardize frontend API usage via single API client module.
6. Add minimal test coverage for `scoreService` orchestration behavior.
