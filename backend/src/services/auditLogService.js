import db from '../db/index.js'
import logger from '../utils/logger.js'

/**
 * Store an admin action in the audit log table.
 * If table doesn't exist, logs to Winston logger as fallback.
 */
async function logAdminAction(adminId, action, details = {}) {
  try {
    // Try to insert into audit_logs table if it exists
    await db.query(
      `INSERT INTO audit_logs (admin_id, action, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [adminId, action, JSON.stringify(details)]
    )
  } catch (err) {
    // Table might not exist - fall back to logger
    logger.info(`[AuditLog] Admin ${adminId}: ${action}`, details)
  }
}

/**
 * Retrieve audit logs with optional filtering.
 */
async function getAuditLogs(filters = {}) {
  try {
    const { page = 1, limit = 50, action, entity_type, search, date_from } = filters
    const offset = (page - 1) * limit

    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params = []
    let paramCount = 0

    if (action) {
      paramCount++
      query += ` AND action = $${paramCount}`
      params.push(action)
    }

    if (entity_type) {
      paramCount++
      query += ` AND details->>'entity_type' = $${paramCount}`
      params.push(entity_type)
    }

    if (search) {
      paramCount++
      query += ` AND (admin_id::text ILIKE $${paramCount} OR details::text ILIKE $${paramCount})`
      params.push(`%${search}%`)
      paramCount++ // for the second ILIKE
      params.push(`%${search}%`)
    }

    if (date_from) {
      // Add one more paramCount ONLY if search was used
      if (search) {
        paramCount++
      } else {
        paramCount++
      }
      query += ` AND created_at >= $${paramCount}`
      params.push(date_from)
    }

    // Get total count
    let countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.count || 0, 10)

    // Get paginated results
    paramCount++
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`
    params.push(limit)
    paramCount++
    query += ` OFFSET $${paramCount}`
    params.push(offset)

    const result = await db.query(query, params)
    const logs = result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }))

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    }
  } catch (err) {
    logger.error('[AuditLog] Error fetching logs:', err)
    throw err
  }
}

/**
 * Get a single audit log entry.
 */
async function getAuditLog(id) {
  try {
    const result = await db.query('SELECT * FROM audit_logs WHERE id = $1', [id])
    if (result.rows.length === 0) return null

    const log = result.rows[0]
    return {
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
    }
  } catch (err) {
    logger.error('[AuditLog] Error fetching single log:', err)
    throw err
  }
}

export default {
  logAdminAction,
  getAuditLogs,
  getAuditLog,
}
