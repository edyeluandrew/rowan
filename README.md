# Rowan

**Rowan** is a Stellar USDC wallet for Uganda: peer-to-peer buy and sell against mobile money, plus airtime, data, and bills. Operated by Beta Tech Labs. Public site: [rowanpay.app](https://rowanpay.app).

![Status](https://img.shields.io/badge/status-testnet-yellow)
![Node.js](https://img.shields.io/badge/node.js-v18+-green)
![License](https://img.shields.io/badge/license-proprietary-blue)

**Network:** Stellar testnet until [docs/ops/MAINNET_CUTOVER_CHECKLIST.md](docs/ops/MAINNET_CUTOVER_CHECKLIST.md) is signed off.  
**Legal:** [Terms](https://rowanpay.app/legal/terms) · [Privacy](https://rowanpay.app/legal/privacy) · pack in [docs/legal/](docs/legal/README.md)

---

## Overview

Users hold Circle USDC on Stellar. Keys stay on the device. In Uganda today:

- **Buy / Sell USDC** — independent P2P traders (MTN / Airtel). Escrow holds USDC until the mobile-money leg is confirmed.
- **Airtime, data, Yaka, bills** — paid in USDC, fulfilled by a utility partner (MarzPay) from Rowan’s prefunded UGX wallet.
- **Collect / Send money** via that partner is not a customer path until float can support it.

Rowan is not a bank and does not claim a payment-institution licence.

### Key Features

- **SEP-10 wallet login** — no password; keys never uploaded
- **P2P marketplace** — trader ads, escrow, disputes
- **Utilities** — airtime, data, supported Uganda bills
- **KYC-tiered limits** and fraud monitoring
- **Trader app** — onboarding, float, fulfilment
- **Admin dashboard** — ops and configuration

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (or Supabase account)
- Redis (or Upstash account)
- Stellar testnet account with funded keypair

### Installation

```bash
# Clone repository
git clone https://github.com/edyeluandrew/rowan.git
cd rowan

# Install backend dependencies
cd backend
npm install

# Install user wallet (web)
cd ../user-web
npm install

# Install mobile wallet + trader app
cd ../rowan-mobile
npm install

# Install admin panel dependencies
cd ../admin
npm install
```

### Environment Setup

Create `.env` files (DO NOT commit these):

**backend/.env:**
```bash
# Server config
PORT=4000
NODE_ENV=production
API_URL=https://your-api-domain.com

# Database (Supabase)
DATABASE_URL=postgresql://...

# Redis (Upstash)
REDIS_URL=redis://...

# JWT Authentication
JWT_SECRET=<your-secure-random-string-min-32-chars>
JWT_EXPIRES_IN=7d

# Stellar
STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
ESCROW_PUBLIC_KEY=G...
ESCROW_SECRET_KEY=S...
SEP10_SIGNING_KEY=S...

# Encryption
ENCRYPTION_KEY=<your-256-bit-key-hex>

# CORS
CORS_ORIGIN=https://your-frontend-domain.com

# Notifications
AFRICA_TALKING_API_KEY=...
AFRICA_TALKING_USERNAME=...

# Rates (fiat conversion, hardcoded fallback)
USDC_TO_UGX=3650
USDC_TO_KES=130
USDC_TO_TZS=2500
```

**user-web/.env** (and similarly `rowan-mobile/.env`):
```bash
VITE_API_URL=https://your-api-domain.com
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

### Running Locally

```bash
# Terminal 1: Backend API
cd backend
npm run dev  # Starts on http://localhost:4000

# Terminal 2: User wallet (web)
cd user-web
npm run dev  # Starts on http://localhost:5176

# Terminal 3: Mobile wallet + trader app
cd rowan-mobile
npm run dev  # Starts on http://localhost:5175

# Terminal 4: Admin Panel
cd admin
npm run dev  # Starts on http://localhost:5174
```

---

## Database Schema Overview

### Core Tables

**users** — Wallet users
- `id`, `stellar_address`, `phone_hash`, `kyc_level`, `daily_limit`, `created_at`

**traders** — OTC traders
- `id`, `email`, `stellar_address`, `usdc_float`, `trust_score`, `verification_status`, `created_at`

**transactions** — Cashout flow state machine
- `id`, `user_id`, `trader_id`, `state`, `xlm_amount`, `usdc_amount`, `fiat_amount`, `stellar_deposit_tx`, `stellar_swap_tx`, `stellar_release_tx`, `created_at`

**quotes** — Rate locks (3-min TTL)
- `id`, `user_id`, `xlm_amount`, `usdc_amount`, `fiat_amount`, `memo`, `locked_rate`, `expires_at`, `is_used`

**disputes** — User complaints
- `id`, `user_id`, `transaction_id`, `status`, `reason`, `created_at`

**audit_logs** — System activity trail
- `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details`, `timestamp`

---

## Development Guidelines

### Code Style
- **JavaScript**: ES modules, async/await preferred
- **React**: Functional components, hooks, Context API for state
- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)

### Testing
```bash
# Run tests (currently in development)
npm run test

# Coverage
npm run test:coverage
```

### Git Workflow
```bash
# Feature branches
git checkout -b feature/description

# Commit messages
git commit -m "feat: description" # or fix:, docs:, style:, refactor:, test:

# Push and create PR
git push origin feature/description
```

### Security Checklist
- ✅ Never commit `.env` files
- ✅ Rotate secrets regularly
- ✅ Use HTTPS in production
- ✅ Validate all inputs server-side
- ✅ Rate-limit sensitive endpoints
- ✅ Hash passwords (bcryptjs, min 12 rounds)
- ✅ Log security events without leaking data

---

## Deployment

### Backend Deployment (Render)

```bash
# Create render.yaml (example in repo)
# Push to GitHub
# Render auto-deploys on main branch

# Render environment variables:
# - All DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
# - Set to production values
```

### Frontend Deployment (Vercel)

```bash
# Connected to GitHub
# Builds automatically on push to main
# Environment: VITE_* variables
```

### Monitoring

- **Error Tracking**: Sentry
- **Logs**: Backend logs aggregated via Render
- **Performance**: Monitor Horizon API latency
- **Uptime**: Status page (uptime.rowan.app)

---

## Troubleshooting

### Common Issues

**404 on GET /api/v1/cashout/status/:id**
- Normal during first 30-40 seconds while Horizon watcher processes deposit
- Frontend has automatic retry logic (3-second intervals)

**WebSocket connection fails**
- Check CORS settings in backend
- Verify socket.io is running on backend
- Check firewall/proxy rules

**Transaction state stuck in TRADER_MATCHED**
- Trader may not have confirmed yet (check /trader/requests)
- Check if trader is suspended (verify trader status in DB)
- Contact admin to investigate

**Rate endpoint returns stale data**
- Redis cache may be stale (TTL: 30 seconds)
- Verify Horizon connection is working
- Check market maker account has resting offers

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows project style guide
- No credentials/secrets in code
- Tests pass locally
- README updated if needed

---

## Support

- **Users:** [support@rowanpay.app](mailto:support@rowanpay.app)
- **Terms / Privacy:** https://rowanpay.app/legal/terms · https://rowanpay.app/legal/privacy
- **Documentation:** [docs/](docs/README.md) (ops, legal, runbooks)
- **Issues:** GitHub Issues (check existing issues first)
- **Security:** email support@rowanpay.app with subject `Security` (do not open public security issues)

---

## Roadmap

- [ ] Recruit and keep live P2P traders (overlapping MTN + Airtel hours)
- [ ] Counsel review of Terms, Privacy, and PDPO registration before open mainnet
- [ ] Stellar mainnet cutover (see ops checklist)
- [ ] Collect / Send money only if UGX float can survive a normal cash-out day
- [ ] Additional corridors beyond Uganda

---

## License

This project is proprietary. All rights reserved.

---

## Team

**Rowan** is built by:
- **Backend**: Node.js/Express specialists
- **Frontend**: React/Mobile developers
- **Blockchain**: Stellar SDK experts
- **Product**: Fintech & P2P specialists

---

## Acknowledgments

- Stellar Development Foundation (stellar.org)
- Supabase team for PostgreSQL hosting
- Upstash for Redis infrastructure
- Africa's Talking for SMS services

---

**Last Updated**: 17 August 2026  
**Status**: Testnet / Uganda P2P + utilities

For the latest info, visit: https://github.com/edyeluandrew/rowan

For the latest info, visit: https://github.com/edyeluandrew/rowan
