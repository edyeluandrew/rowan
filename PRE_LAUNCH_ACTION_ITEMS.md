# ROWAN — PRE-LAUNCH ACTION ITEMS

**Generated**: Q1 2025  
**Target Deadline**: Public launch Week 4

---

## CRITICAL PATH (Must Complete Before Launch)

### PHASE 1: MVP Launch Readiness (Week 1-2)

#### Task 1.1: Complete Dispute Workflow
- **Owner**: Backend engineer
- **Effort**: 2-3 days
- **Blocking**: Public launch
- **Files**:
  - `backend/src/routes/disputes.js` — endpoints incomplete
  - `backend/src/services/disputeService.js` — core logic
  - `frontend/src/pages/DisputeDetail.jsx` — UI
- **Checklist**:
  - [ ] Create dispute endpoint (user/trader submits reason)
  - [ ] Assign dispute to admin (rotation + load balancing)
  - [ ] Evidence submission (photo/text uploads)
  - [ ] Admin review interface (view evidence, make decision)
  - [ ] Resolution logic (refund user or trader)
  - [ ] Appeal mechanism
  - [ ] SLA tracking (48h target)
  - [ ] Test: create → resolve → verify balances updated

#### Task 1.2: Add Integration Tests
- **Owner**: QA/Backend engineer
- **Effort**: 2-3 days
- **Blocking**: Beta launch
- **Files**:
  - (new) `backend/__tests__/routes/` — route tests
  - (new) `backend/__tests__/services/` — service tests
- **Framework**: Jest + supertest
- **Checklist**:
  - [ ] Test happy path (quote → deposit → match → confirm → release)
  - [ ] Test failure: no traders available
  - [ ] Test failure: trader timeout (180s accept)
  - [ ] Test failure: trader timeout (300s confirm)
  - [ ] Test failure: escrow release failure + retry
  - [ ] Test refund flow
  - [ ] Test state machine guards (invalid transitions)
  - [ ] Test matching engine (trader selection)
  - [ ] Run full suite in CI/CD
- **Success Criteria**: 80%+ coverage on critical paths, all tests passing

#### Task 1.3: Complete Audit Logging
- **Owner**: Backend engineer
- **Effort**: 1 day
- **Blocking**: Public launch
- **Files**:
  - `backend/src/services/auditLogService.js` — needs implementation
  - `backend/src/db/migrations/` — add audit_log table
- **Checklist**:
  - [ ] Create audit_log table (id, timestamp, admin_id, action, resource, before, after)
  - [ ] Log trader suspension/reactivation
  - [ ] Log admin overrides (manual refund, release retry)
  - [ ] Log dispute resolution
  - [ ] Log rate changes
  - [ ] View audit log in admin dashboard
  - [ ] Export audit log (CSV)
- **Success Criteria**: All admin actions logged, searchable by date/admin/action

#### Task 1.4: Load Test WebSocket
- **Owner**: QA/Infrastructure engineer
- **Effort**: 1-2 days
- **Blocking**: Beta launch
- **Setup**:
  - Use k6 or Apache JMeter for load generation
  - Simulate 500 concurrent trader connections
  - Measure: connection time, event delivery latency, disconnect recovery
- **Checklist**:
  - [ ] 500 traders connected (30s ramp-up)
  - [ ] Push 100 requests/sec to traders (latency p50, p95, p99)
  - [ ] Measure lost events during scale test
  - [ ] Simulate network outage (disconnect 50% of traders)
  - [ ] Verify reconnection + event catch-up
  - [ ] Monitor Redis memory (should stay <1GB)
  - [ ] Monitor backend CPU/memory
- **Success Criteria**: p95 latency <1s, 0 lost events, 98%+ connection recovery

---

### PHASE 2: Beta Launch Readiness (Week 2-3)

#### Task 2.1: SMS Notification Full Integration
- **Owner**: Backend engineer
- **Effort**: 1 day
- **Blocking**: Beta launch
- **Files**:
  - `backend/src/services/notificationService.js`
  - `backend/src/services/otpService.js`
- **Checklist**:
  - [ ] OTP SMS delivery (Africa's Talking integration)
  - [ ] Refund notification SMS
  - [ ] Transaction complete SMS
  - [ ] Error handling + retry (3 attempts, exponential backoff)
  - [ ] Test: send SMS from real device (verify delivery)
  - [ ] Fallback to email if SMS fails
  - [ ] Monitor SMS failure rate (dashboard alert if >5%)

#### Task 2.2: Push Notifications (FCM)
- **Owner**: Mobile engineer
- **Effort**: 2 days
- **Blocking**: Public launch
- **Files**:
  - `frontend/public/firebase-messaging-sw.js` — service worker
  - `frontend/src/api/notifications.js` — FCM token registration
  - `backend/src/services/notificationService.js` — send push
- **Checklist**:
  - [ ] Set up Firebase Cloud Messaging (FCM) project
  - [ ] Generate Android `google-services.json`
  - [ ] Generate iOS `GoogleService-Info.plist`
  - [ ] Register FCM tokens on app startup
  - [ ] Send trader request notification via FCM
  - [ ] Test: send push from dashboard (verify on device)
  - [ ] Handle token refresh
  - [ ] Measure delivery rate (target >98%)

#### Task 2.3: iOS Build & Test
- **Owner**: Mobile engineer
- **Effort**: 1-2 days
- **Blocking**: Public launch
- **Files**:
  - `rowan-mobile/ios/` — generate via `capacitor add ios`
- **Checklist**:
  - [ ] Run `capacitor add ios` in rowan-mobile/
  - [ ] Open `rowan-mobile/ios/App/App.xcworkspace` in Xcode
  - [ ] Configure signing (Team ID, provisioning profile)
  - [ ] Build for simulator (arm64)
  - [ ] Test end-to-end flow on simulator
  - [ ] Build for device (if hardware available)
  - [ ] Test Stellar auth flow
  - [ ] Test onboarding flow
  - [ ] Test trader request push notification
  - [ ] Prepare for TestFlight submission

#### Task 2.4: Security Audit (OWASP Top 10)
- **Owner**: Security engineer / Contractor
- **Effort**: 2-3 days
- **Blocking**: Public launch
- **Scope**:
  - [x] Injection (SQL, XSS, Command)
  - [x] Broken Authentication
  - [ ] Sensitive Data Exposure (review encryption, TLS)
  - [ ] XML External Entities (unlikely, no XML parsing)
  - [x] Broken Access Control
  - [ ] Security Misconfiguration
  - [x] Cross-Site Scripting (XSS)
  - [x] Insecure Deserialization
  - [ ] Using Components with Known Vulnerabilities
  - [ ] Insufficient Logging & Monitoring (now has audit log)
- **Checklist**:
  - [ ] Run OWASP ZAP or Burp Community scan
  - [ ] Review all env var handling
  - [ ] Verify no hardcoded secrets
  - [ ] Check rate limiting (global + per-user)
  - [ ] Verify JWT secret length (>32 chars)
  - [ ] Review CORS whitelist (no wildcards)
  - [ ] Verify HTTPS required (TLS 1.2+)
  - [ ] Check for XXE vulnerabilities
  - [ ] Review file upload handling (Supabase)
  - [ ] Assess third-party dependencies (npm audit)

---

### PHASE 3: Public Launch Prep (Week 3-4)

#### Task 3.1: Performance Tuning
- **Owner**: Backend engineer
- **Effort**: 1-2 days
- **Blocking**: Public launch
- **Checklist**:
  - [ ] Profile quote endpoint (target <100ms)
  - [ ] Cache rate data in Redis (30s TTL) — verify quoteEngine uses it
  - [ ] Index database queries (check existing indexes)
  - [ ] Connection pool optimization (test at 100 concurrent connections)
  - [ ] Measure p95 latency across all endpoints
  - [ ] Run load test: 50 TPS for 1 hour (measure memory leaks)

#### Task 3.2: Multi-Server Deployment
- **Owner**: Infrastructure engineer
- **Effort**: 1-2 days
- **Blocking**: Public launch
- **Checklist**:
  - [ ] Deploy 2x backend servers
  - [ ] Set up load balancer (nginx / cloud provider)
  - [ ] Configure session affinity for WebSocket (sticky sessions)
  - [ ] Test: scale from 1→2 servers, verify no disruption
  - [ ] Monitor: Redis connection pooling, database connection limits
  - [ ] Disaster recovery: stop 1 server, verify traffic fails over

#### Task 3.3: Disaster Recovery Drill
- **Owner**: Infrastructure engineer
- **Effort**: 1 day
- **Blocking**: Public launch
- **Checklist**:
  - [ ] Backup production database (daily snapshots)
  - [ ] Restore from backup to staging (test recovery)
  - [ ] Measure RTO (Recovery Time Objective) — target <2 hours
  - [ ] Measure RPO (Recovery Point Objective) — target <1 hour
  - [ ] Document runbook for database restoration
  - [ ] Test Redis persistence (AOF enabled)

#### Task 3.4: Pre-Launch Monitoring Setup
- **Owner**: DevOps engineer
- **Effort**: 1 day
- **Blocking**: Public launch
- **Checklist**:
  - [ ] Set up Application Insights (Azure) or DataDog
  - [ ] Add APM to backend (Node.js instrumentation)
  - [ ] Add APM to frontend (RUM — Real User Monitoring)
  - [ ] Create dashboards:
    - Transactions: count, success rate, avg settlement time
    - Traders: active count, float balance, trust score
    - WebSocket: connections, events/sec, latency
    - Errors: error count, error rate, error types
  - [ ] Set up alerts:
    - Transaction success rate <95% (page on-call)
    - WebSocket latency p95 >2s (page on-call)
    - Database connection pool exhausted (warning)
    - Redis memory >80% (warning)
  - [ ] Create runbook for each alert

---

## SECONDARY PATH (Good to Have, Can Defer)

### Nice-to-Have Items
- [ ] 2FA for admin accounts (TOTP via speakeasy npm)
- [ ] Offline transaction queueing (mobile SQLite + Bull)
- [ ] Trader KYC refresh workflow (annual re-verification)
- [ ] Transaction receipt export (PDF using pdfkit)
- [ ] Leaderboard (top traders by volume/reputation)
- [ ] Referral program (track referrer on user signup)
- [ ] Analytics dashboard (volume over time, popular networks)

---

## VALIDATION GATES

### Alpha Gate (Week 1)
- [ ] End-to-end cashout flow works (manual test)
- [ ] Admin dashboard shows live transactions
- [ ] Trader onboarding completes without errors
- [ ] No critical exceptions in logs (24h run)
- **Go/No-Go**: Deploy to staging, invite beta traders

### Beta Gate (Week 2)
- [ ] All integration tests passing (>80% coverage)
- [ ] Dispute workflow end-to-end tested
- [ ] WebSocket load test passed (500 concurrent traders)
- [ ] Audit logging working (all admin actions logged)
- [ ] SMS notifications delivering >95%
- [ ] Push notifications working (Android + iOS simulator)
- [ ] Security audit passed (no critical findings)
- **Go/No-Go**: Deploy to production, scale to 100-500 traders

### Public Launch Gate (Week 4)
- [ ] 24h production run: zero downtime, zero data loss
- [ ] All metrics healthy (latency <5s, success rate >98%)
- [ ] Multi-server failover tested
- [ ] Disaster recovery drill passed
- [ ] iOS TestFlight submission complete
- [ ] Marketing ready (Twitter, Telegram, Discord)
- [ ] Support team trained
- **Go/No-Go**: Open to public

---

## RESOURCE ALLOCATION

| Role | Week 1 | Week 2 | Week 3 | Week 4 |
|------|--------|--------|--------|--------|
| Backend | Disputes, Tests | SMS, Audit | Performance | Monitoring |
| Frontend | — | Push notif | Perf tune | Monitoring |
| Mobile | — | iOS build, FCM | — | TestFlight |
| DevOps | WebSocket test | Multi-server | DR drill | Go-live |
| QA | Manual testing | Regression | Load test | Final validation |
| Security | — | OWASP audit | Remediation | — |

---

## SUCCESS METRICS

### Alpha (Week 1)
- 10-20 traders actively trading
- 50+ transactions processed
- Zero critical bugs
- Average settlement time <10 min

### Beta (Week 2)
- 100-500 traders active
- 500+ daily transactions
- 98%+ success rate
- Average settlement time <5 min

### Public Launch (Week 4)
- 1000+ traders active
- 2000+ daily transactions
- 99%+ success rate
- Average settlement time 3-5 min
- <0.1% transaction loss
- <2s p95 WebSocket latency

---

## ESCALATION CONTACTS

| Issue | Contact | Escalation |
|-------|---------|-----------|
| Backend outage | Backend lead | CTO |
| Data loss | Database team | CTO |
| Security breach | Security team | CEO |
| Trader disputes | Support lead | COO |
| Performance degradation | DevOps lead | CTO |

---

## SIGN-OFF

Engineering Lead: _______________  
Product Manager: _______________  
CTO: _______________  
CEO: _______________  

---

**Last Updated**: Q1 2025  
**Review Cycle**: Weekly (until public launch)

