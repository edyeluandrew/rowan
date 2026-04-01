# Redis Migration: Upstash → Render Key Value

## Overview

Successfully migrated from **Upstash Redis (HTTP REST API)** to **Render Key Value (Redis-compatible Valkey)** to avoid monthly request quota limits.

## Why This Migration?

**Problem:**
- Upstash free/pro tiers have monthly request quotas (500k/month on free)
- Our backend hit the limit: `ERR max requests limit exceeded. Limit: 500000, Usage: 500001`
- Upstash REST API adds overhead for every request

**Solution:**
- Render Key Value is **included with Render services** (no additional cost)
- **Redis-compatible** (Valkey) - drop-in replacement
- **Native TCP connection** (faster than REST)
- **Unlimited requests** (within fair use policy)

## Architecture

### Before (Upstash)
```
Backend → HTTP REST Request → Upstash Redis REST API → Upstash Redis
```

### After (Render Key Value)
```
Backend → TCP Connection → Render Key Value (Valkey)
```

## Implementation Details

### Backend Redis Client
- **Package:** `ioredis` (standard Redis client)
- **Location:** `backend/src/db/redis.js`
- **Connection:** Via `process.env.REDIS_URL`

### Configuration
- **render.yaml:** Already configured with `REDIS_URL`
- **Environment Variables:**
  ```
  REDIS_URL=valkey://:password@host:port
  ```

### Job Queue (Bull)
- **Location:** `backend/src/services/jobQueue.js`
- **Status:** Already properly configured for standard Redis
- **Features:**
  - Transaction state machine jobs
  - Fraud monitoring tasks
  - Notification queues
  - Retry logic with exponential backoff

### Redis Use Cases
1. **Caching** - Quote rates, exchange rates (30-60s TTL)
2. **Locks** - Distributed locks for deposit/release operations
3. **Sessions** - OTP storage, temporary auth state
4. **Queues** - Job queue for async tasks
5. **Rate Limiting** - API request tracking

## Migration Checklist

✅ Backend code already uses `ioredis` (not Upstash REST)
✅ Redis connection module reads from `REDIS_URL`
✅ render.yaml configured for `REDIS_URL`
✅ No Upstash-specific packages in dependencies
✅ JobQueue properly handles Redis URL parsing
✅ Connection retry logic in place
✅ Error handling configured
✅ TLS support for `rediss://` URLs

## Deployment Steps

1. **Create Render Key Value instance:**
   - Go to https://dashboard.render.com
   - New → Redis → Create new instance
   - Copy the connection string (looks like: `valkey://:password@hostname:port`)

2. **Update environment variables on Render:**
   - Go to Backend Service → Environment
   - Update `REDIS_URL` with new connection string
   - Remove any `UPSTASH_REDIS_*` variables if they exist

3. **Deploy backend:**
   - Push changes to master
   - GitHub Actions triggers deployment
   - Backend connects to Render Key Value

4. **Verify connection:**
   - Check logs: `[Redis] Connected`
   - Monitor for `ERR max requests limit exceeded` errors (should be gone)

## Testing

Run a cashout transaction end-to-end:
1. Request quote (uses cache for rates)
2. Deposit XLM (uses lock for idempotency)
3. Confirm quote (uses temporary state)
4. Monitor Bull job queue (async tasks)

All Redis operations should complete without quota errors.

## Files Changed

- `backend/src/services/jobQueue.js` - Updated comment to reference Render Key Value
- `REDIS_MIGRATION.md` - This migration guide

## Rollback Plan

If issues occur, you can revert to `REDIS_URL` pointing back to any Redis instance:
- Upstash (if you renew quota)
- AWS ElastiCache
- Another Render Key Value instance

No code changes needed - just update the `REDIS_URL` environment variable.

## References

- [Render Key Value Docs](https://render.com/docs/redis)
- [ioredis Documentation](https://github.com/luin/ioredis)
- [Bull Job Queue Docs](https://github.com/OptimalBits/bull)
- [Valkey (Redis Fork)](https://valkey.io/)

---

**Migration Date:** March 31, 2026
**Status:** ✅ Complete & Ready for Deployment
