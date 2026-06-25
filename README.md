# Gimbiya Mall — Backend Engineering

**Node.js + Express + tRPC + MongoDB + Firebase**

> High-integrity, type-safe backend for the Gimbiya Mall multi-tenant e-commerce and logistics platform.

---

## Stack

| Technology | Version | Role |
|---|---|---|
| Node.js | ≥ 18 | Runtime |
| TypeScript | ^5.3 | Language (strict mode) |
| Express | ^4.18 | HTTP server |
| tRPC | ^11 | Type-safe API layer |
| MongoDB + Mongoose | ^8 | Primary database |
| Firebase Admin | ^12 | Auth + Storage |
| Zod | ^3.22 | Input validation |
| bcryptjs | ^2.4 | OTP hashing |
| ioredis | ^5 | Session caching + rate limiting |

---

## Directory Structure

```
server/
├── index.ts              # Entry point — Express + tRPC bootstrap
├── pricing.ts            # SINGLE SOURCE OF TRUTH for all financial logic
├── config/
│   ├── firebase.ts       # Firebase Admin SDK init
│   ├── mongodb.ts        # Mongoose connection + retry logic
│   └── redis.ts          # Redis client (Upstash compatible)
├── middleware/
│   ├── auth.ts           # Firebase JWT verify → tRPC context + role guards
│   └── rateLimiter.ts    # Redis-backed rate limiting
├── models/
│   ├── User.ts           # User schema (role + state + KYC)
│   ├── Product.ts        # Product + inventory (Kobo pricing)
│   ├── Order.ts          # Order lifecycle + OTP hash + escrow
│   ├── EscrowLedger.ts   # Double-entry ledger + InventoryAudit (append-only)
│   └── CartItem.ts       # Cart items + Category
├── routers/
│   ├── index.ts          # Root AppRouter merge
│   ├── buyer.ts          # Catalog, cart, checkout, order tracking
│   ├── ceo.ts            # National telemetry, KYC, governance
│   ├── merchant.ts       # Product listings, pricing, settlement
│   ├── stock.ts          # Inventory adjustments, manifests, audit log
│   └── delivery.ts       # Job claiming, OTP handover, GPS
├── types/
│   ├── index.ts          # Enums, interfaces (AuthenticatedUser, PricingResult…)
│   └── schemas.ts        # Zod validation schemas for all procedure inputs
└── utils/
    ├── sseService.ts     # Server-Sent Events manager (real-time push)
    └── otpService.ts     # OTP generation + bcrypt hashing
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/gimbiya-mall-backend.git
cd gimbiya-mall-backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required values:
- `MONGODB_URI` — MongoDB Atlas connection string
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin service account (full JSON as string)
- `REDIS_URL` — Upstash Redis connection string (optional in development)
- `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_CONTRACT_CODE`

### 3. Run development server

```bash
npm run dev
```

Server starts on `http://localhost:8080`

---

## Critical Implementation Rules

### 1. Atomic Stock Updates (MANDATE)

```typescript
// ✅ CORRECT — atomic, race-condition safe
await Product.findOneAndUpdate(
  { _id: productId, stock: { $gte: quantity } },  // $gte guard
  { $inc: { stock: -quantity } },                  // atomic decrement
  { new: true }
);

// ❌ FORBIDDEN — race condition, over-allocation risk
const product = await Product.findById(productId);
product.stock = product.stock - quantity;
await product.save();
```

### 2. Financial Values — Always in Kobo

```typescript
// ✅ CORRECT — integer Kobo
const priceKobo = 1250000;  // ₦12,500.00

// ❌ FORBIDDEN — floating point errors
const priceNaira = 12500.00;  // Never store this
```

### 3. OTP Security Contract

```typescript
// At checkout — OTP is created as a pair:
const { rawOtp, otpHash } = await createOtpPair();
// rawOtp  → returned to buyer UI ONLY, ONCE, never stored
// otpHash → stored in order.riderOtpHash, never returned to any client

// At delivery — rider submits OTP received from buyer:
const valid = await verifyOtp(submittedOtp, order.riderOtpHash);
// If valid → proceed with escrow release
// If invalid → throw UNAUTHORIZED
```

### 4. State Boundary Enforcement

```typescript
// ✅ CORRECT — state from authenticated session
const stateFilter = { assignedState: ctx.user.assignedState };

// ❌ FORBIDDEN — state from client body (can be spoofed)
const stateFilter = { assignedState: input.state };
```

### 5. Append-Only Ledgers

`EscrowLedger` and `InventoryAudit` collections have **no UPDATE or DELETE** operations anywhere in the codebase. Every state change appends a new document.

---

## API Reference

All endpoints are tRPC procedures available at `/api/trpc`.

### Buyer Router (`buyer.*`)

| Procedure | Type | Access |
|---|---|---|
| `buyer.getRegionalCatalog` | Query | Public |
| `buyer.updateCart` | Mutation | buyer |
| `buyer.getCart` | Query | buyer |
| `buyer.initializeEscrowCheckout` | Mutation | buyer |
| `buyer.getOrderStatus` | Query | buyer |
| `buyer.getOrderHistory` | Query | buyer |
| `buyer.cancelOrder` | Mutation | buyer |

### CEO Router (`ceo.*`)

| Procedure | Type | Access |
|---|---|---|
| `ceo.getNationalTelemetry` | Query | super_admin |
| `ceo.processKYCAdjudication` | Mutation | super_admin |
| `ceo.getKycQueue` | Query | super_admin |
| `ceo.revokeUserAccess` | Mutation | super_admin |
| `ceo.getEscrowSummary` | Query | super_admin, auditor |
| `ceo.getSystemMetrics` | Query | super_admin |

### Merchant Router (`merchant.*`)

| Procedure | Type | Access |
|---|---|---|
| `merchant.publishNewListing` | Mutation | business_owner+ |
| `merchant.getMyListings` | Query | business_owner+ |
| `merchant.updateListingPrice` | Mutation | business_owner+ |
| `merchant.toggleListingActive` | Mutation | business_owner+ |
| `merchant.getSettlementLedger` | Query | business_owner+ |
| `merchant.getMerchantAnalytics` | Query | business_owner+ |

### Stock Router (`stock.*`)

| Procedure | Type | Access |
|---|---|---|
| `stock.getWarehouseManifest` | Query | stock_manager+ |
| `stock.adjustInventoryVolume` | Mutation | stock_manager+ |
| `stock.processInboundManifest` | Mutation | stock_manager+ |
| `stock.flagDamagedStock` | Mutation | stock_manager+ |
| `stock.getProductAuditLog` | Query | stock_manager+ |

### Delivery Router (`delivery.*`)

| Procedure | Type | Access |
|---|---|---|
| `delivery.getAvailableJobs` | Query | delivery |
| `delivery.getMyDeliveries` | Query | delivery |
| `delivery.claimDispatchAssignment` | Mutation | delivery |
| `delivery.finalizeSecureHandover` | Mutation | delivery |
| `delivery.updateRiderLocation` | Mutation | delivery |

---

## Real-Time Events (SSE)

Connect at: `GET /api/events/subscribe`  
Header: `Authorization: Bearer <firebase_jwt>`

| Event | Triggered By | Received By |
|---|---|---|
| `order:status_changed` | Any status update | Buyer, Merchant |
| `order:rider_assigned` | Rider claims job | Buyer, Merchant |
| `inventory:low_stock` | Stock drops ≤ threshold | Merchant |
| `escrow:released` | OTP handover confirmed | Merchant |
| `kyc:status_changed` | CEO adjudicates | Affected user |

---

## Financial Engine (`server/pricing.ts`)

The **Single Source of Truth** for all monetary calculations.

```
Gross Order Total  = Σ (unitPriceKobo × quantity)
Platform Fee       = round(grossTotal × 0.015)   // 1.5%
Merchant Net       = grossTotal − platformFee
```

Never call these calculations outside `pricing.ts`.

---

## Deployment

### Railway (Backend)

```bash
# railway.toml is pre-configured
railway up
```

### Environment variables to set in Railway dashboard:
- All values from `.env.example`

### Health check: `GET /health`
