# Admin Module Structure

## Routes
- `POST /api/auth/login` - admin login, returns JWT.
- `POST /api/admin/articles` - publish article as admin.
- `POST /api/admin/articles/:id/trust-override` - override article trust score (with reason).
- `GET /api/admin/dashboard` - admin dashboard metrics.
- `GET /api/articles/:id/verify` - verify article integrity against stored blockchain hash.

## Layering
- **Controllers (routes)**
  - `server/src/routes/auth.js`
  - `server/src/routes/admin.js`
  - `server/src/routes/articles.js`
- **Middleware**
  - `server/src/middleware/auth.js` (JWT + admin RBAC)
  - `server/src/middleware/requestId.js` (request tracing)
- **Application Services**
  - `server/src/services/adminService.js`
  - `server/src/services/authService.js`
  - `server/src/services/authorTrustService.js`
  - `server/src/services/blockchainService.js`
  - `server/src/services/articleVerificationService.js`
- **Domain**
  - `server/src/domain/trustPolicy.js` (existing trust policy reused)
- **Infrastructure**
  - `server/src/repositories/auditLogRepository.js`
  - `server/src/repositories/articleRepository.js`
  - `server/src/repositories/authorRepository.js`
  - `server/src/models/AuditLog.js`
  - `server/src/clients/blockchainClient.js`
  - `server/src/utils/jwt.js`
  - existing ML/image worker clients

## Audit Log Actions
- `admin.article.publish`
- `admin.article.trust_override`

## Blockchain Write Flow
1. Admin publishes via `POST /api/admin/articles`.
2. `adminService.publishArticleByAdmin()` calls `scoreService` (existing scoring path).
3. After persistence, `blockchainService` computes SHA256(text) and writes `{hash, trustScore, timestamp}` via `blockchainClient`.
4. Article stores blockchain metadata (`blockchainHash`, `blockchainTxHash`, `blockchainStatus`, `blockchainTimestamp`).
5. On blockchain failure, publish still succeeds, status is `pending`, failure metric increments, and error is logged.
