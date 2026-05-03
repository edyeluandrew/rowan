# Rowan: Stellar Liquidity Bridge

**Rowan** is a peer-to-peer crypto-to-fiat liquidity bridge connecting Stellar blockchain with mobile money networks (M-Pesa, MTN, Airtel) across East Africa.

![Status](https://img.shields.io/badge/status-production-brightgreen)
![Node.js](https://img.shields.io/badge/node.js-v18+-green)
![License](https://img.shields.io/badge/license-proprietary-blue)

---

## Overview

Rowan enables users to convert XLM (Stellar Lumens) to local fiat currency (UGX, KES, TZS) through a trusted network of OTC traders. The platform uses:

- **Stellar escrow mechanics** for trustless XLM locking
- **Real-time fraud monitoring** with KYC-tiered limits
- **Smart matching algorithm** to find the best available trader
- **Mobile-first architecture** for accessibility in emerging markets

### Key Features

✅ **SEP-10 Web Auth** — Zero-password Stellar wallet login  
✅ **Real-time rates** — Live DEX pricing via Horizon  
✅ **Dual-sided escrow** — XLM locked until fiat confirmed  
✅ **Trader verification** — KYC + Binance P2P history validation  
✅ **Dispute resolution** — Secure refund mechanism  
✅ **Multi-currency** — UGX, KES, TZS support  
✅ **Admin dashboard** — System oversight and configuration  

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

# Install frontend dependencies (wallet app)
cd ../frontend
npm install

# Install trader app dependencies
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

**frontend/.env:**
```bash
VITE_API_URL=https://your-api-domain.com
VITE_STELLAR_NETWORK=testnet
VITE_HOME_DOMAIN=your-frontend-domain.com
```

### Running Locally

```bash
# Terminal 1: Backend API
cd backend
npm run dev  # Starts on http://localhost:4000

# Terminal 2: Wallet Frontend
cd frontend
npm run dev  # Starts on http://localhost:5173

# Terminal 3: Trader App
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

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues (check existing issues first)
- **Security**: Email security@rowan.dev (do not open public security issues)
- **Community**: Join our Discord (link TBD)

---

## Roadmap

- [ ] Live XLM/fiat rates from CoinGecko API
- [ ] Dispute resolution UI improvements
- [ ] Mobile app hardening (biometric auth, secure storage)
- [ ] Advanced analytics dashboard
- [ ] Mainnet support
- [ ] Additional African networks (Orange Money, Vodafone)
- [ ] Stablecoin support (USDC Stellar)

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

**Last Updated**: May 3, 2026  
**Version**: 1.0.0  
**Status**: Production

For the latest info, visit: https://github.com/edyeluandrew/rowan
