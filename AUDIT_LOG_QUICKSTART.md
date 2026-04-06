# Audit Log Dashboard - Quick Start Guide

## 🚀 What's New

A production-ready **Audit Log Dashboard** has been added to the Rowan admin panel. Admins can now view complete operational history including:

- ✅ Trader approvals/suspensions
- ✅ Dispute resolutions
- ✅ Transaction overrides
- ✅ Rate updates
- ✅ System alerts
- ✅ All admin actions with full metadata

## 📍 Where to Find It

**URL:** `http://localhost:5174/audit-logs` (when logged in as admin)  
**Navigation:** Sidebar → "Audit Logs" (FileText icon, bottom of menu)

## 🎯 Features

### View Logs
- **50 logs per page** (paginated)
- **Expandable rows** for detailed JSON metadata
- **Color-coded actions** (green=success, red=error, blue=change, yellow=warning)
- **Show previous/new state** for tracked changes

### Filter Logs

1. **Search**
   - Admin email
   - Entity ID (trader/transaction/dispute)
   - Any details metadata

2. **Action Type**
   - trader_approved, trader_suspended, trader_reactivated
   - dispute_resolved, dispute_escalated
   - transaction_force_refunded, transaction_force_completed
   - rate_updated, alert_resolved
   - And more...

3. **Entity Type**
   - Trader, Transaction, Dispute
   - Escrow, Rate, Alert, Admin, System

4. **Date Range**
   - From date picker (filters logs after that date)

### Expand Row Details
- Full JSON `details` object
- Previous state (before/after comparisons)
- New state (after changes)
- All metadata captured at log time

## ⚙️ Installation & Setup

### Step 1: Run Database Migration

The audit logs feature requires a new database table. Run this migration:

**Option A: Via Supabase CLI**
```bash
cd backend
supabase db push  # Creates tables in Supabase
```

**Option B: Direct SQL**
```bash
psql $DATABASE_URL < backend/supabase/migrations/20260406_create_audit_logs_table.sql
```

**Option C: Via application startup** (if auto-migrations enabled)
No action needed - runs automatically

### Step 2: Restart Backend
```bash
cd backend
npm run dev
```

Backend will now:
- Serve new API endpoints
- Log all admin actions to database
- Enable audit log retrieval

### Step 3: Restart Admin App
```bash
cd admin
npm run dev
```

Admin app will now:
- Show "Audit Logs" in sidebar
- Serve audit logs page at `/audit-logs`
- Allow viewing and filtering logs

## 🧪 Quick Test

1. **Log in** to admin panel
2. **Navigate** to any feature (Traders, Disputes, etc.)
3. **Perform an action** (e.g., suspend a trader, resolve a dispute)
4. **Click "Audit Logs"** in sidebar
5. **See your action** appear in the log
6. **Click the chevron** to expand and see full metadata

## 📊 API Endpoints

If integrating with external tools:

```bash
# Get audit logs (with optional filters)
GET /api/v1/admin/audit-logs?page=1&limit=50&action=trader_suspended&entity_type=trader

# Get single log
GET /api/v1/admin/audit-logs/:id

# Log an action (called automatically)
POST /api/v1/admin/audit-log
Body: { "action": "trader_suspended", "details": {...} }
```

## 🔍 Understanding the Data

### Example Log Entry
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "admin_id": "user-123",
  "admin_email": "admin@rowan.app",
  "action": "trader_suspended",
  "entity_type": "trader",
  "entity_id": "trader-456",
  "details": {
    "reason": "Suspicious activity detected",
    "trader_name": "John Trader",
    "previous_status": "ACTIVE",
    "new_status": "SUSPENDED"
  },
  "created_at": "2026-04-06T14:23:45Z"
}
```

### What Gets Logged

| Action | Entity | Details Captured |
|--------|--------|---------------------|
| trader_suspended | Trader | Reason, previous/new status, trader info |
| trader_approved | Trader | Trader ID, email, name |
| dispute_resolved | Dispute | Outcome, refund amount, dispute reason |
| transaction_force_refunded | Transaction | Amount, reason |
| rate_updated | Rate | Previous rate, new rate |
| alert_resolved | Alert | Alert type, severity |

## ⚡ Performance

- **Fast queries** via indexes on: action, admin_id, created_at, details
- **Pagination** (50 per page) prevents loading large datasets
- **Search** works on admin email, entity IDs, metadata
- **Filters combine** (e.g., trader_suspended + last 7 days)

## 🔐 Security

- ✅ Admin-only access (protected by AuthContext + authAdmin middleware)
- ✅ Row-level security on audit_logs table
- ✅ Immutable audit trail (logs not deleted, only created)
- ✅ Foreign key to users table (admin accountability)

## ❓ FAQ

**Q: Why don't I see logs?**  
A: Make sure database migration ran. Check admin actions are being performed (they should trigger logs).

**Q: Can I delete audit logs?**  
A: No - by design. Immutable audit trail for compliance.

**Q: Why is my action not showing up?**  
A: Check that POST /api/v1/admin/audit-log was called. If it fails, falls back to Winston logger.

**Q: Can I export audit logs?**  
A: Not yet, but planned. For now, you can query the database directly or use the API.

**Q: How far back do logs go?**  
A: As far as your database stores them. Implement retention policy as needed.

## 📞 Support

If audit logs aren't working:

1. Check **browser console** for errors
2. Check **backend logs** (winston logger)
3. Verify **database migration** ran
4. Test **API endpoint** directly:
   ```bash
   curl http://localhost:3001/api/v1/admin/audit-logs \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

## 🎓 Files Added/Modified

```
Frontend:
├── admin/src/features/audit-logs/          [NEW]
├── admin/src/shared/services/api/auditLogs.js [NEW]
├── admin/src/App.jsx                       [MODIFIED - Added route]
└── admin/src/features/layout/components/Sidebar.jsx [MODIFIED - Added nav]

Backend:
├── backend/src/services/auditLogService.js [NEW]
├── backend/src/routes/admin.js             [MODIFIED - Added endpoints]
└── backend/supabase/migrations/20260406_create_audit_logs_table.sql [NEW]
```

## ✅ Verification Checklist

- [ ] Database migration completed
- [ ] Backend restarted
- [ ] Admin app restarted
- [ ] Can log in to admin panel
- [ ] Sidebar shows "Audit Logs" link
- [ ] Can navigate to `/audit-logs`
- [ ] Audit logs page loads (empty if no actions yet)
- [ ] Can perform a test action (suspend trader)
- [ ] New action appears in audit log
- [ ] Can expand row to see details
- [ ] Can filter by action type
- [ ] Can search by admin/entity

---

**Ready to go!** Your admin dashboard now has complete operational visibility. 🎉
