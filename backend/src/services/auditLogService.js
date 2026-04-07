import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Store an action in the audit log table.
 * Provides complete audit trail for compliance and debugging.
 *
 * @param {object} entry - {
 *   admin_id: string,
 *   actor_role: 'admin'|'system'|'trader'|'user',
 *   action: string,
 *   resource_type: string,
 *   resource_id: uuid,
 *   old_value: object,
 *   new_value: object,
 *   metadata: object,
 *   ip_address: string,
 *   user_agent: string
 * }
 */
async function log(entry) {
  try {
    const {
      admin_id,
      actor_role = 'system',
      action,
      resource_type,
      resource_id,
      old_value = {},
      new_value = {},
      metadata = {},
      ip_address,
      user_agent,
    } = entry;

    // Try to insert into audit_logs table if it exists
    await db.query(
      `INSERT INTO audit_logs (
        admin_id, actor_role, action, resource_type, resource_id,
        old_value, new_value, metadata, ip_address, user_agent, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        admin_id || null,
        actor_role,
        action,
        resource_type,
        resource_id || null,
        JSON.stringify(old_value),
        JSON.stringify(new_value),
        JSON.stringify(metadata),
        ip_address || null,
        user_agent || null,
      ]
    );
  } catch (err) {
    // Table might not exist - fall back to logger
    logger.info(`[AuditLog] ${entry.action}`, {
      role: entry.actor_role,
      resource: entry.resource_type,
      id: entry.resource_id,
      ...entry.metadata,
    });
  }
}

/**
 * Legacy function for backward compatibility
 */
async function logAdminAction(adminId, action, details = {}) {
  return log({
    admin_id: adminId,
    actor_role: 'admin',
    action,
    resource_type: 'admin_action',
    metadata: details,
  });
}

/**
 * Retrieve audit logs with optional filtering.
 */
async function getAuditLogs(filters = {}) {
  try {
    const { page = 1, limit = 50, action, resource_type, search, date_from, admin_id } = filters;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (action) {
      query += ` AND action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (resource_type) {
      query += ` AND resource_type = $${paramCount}`;
      params.push(resource_type);
      paramCount++;
    }

    if (admin_id) {
      query += ` AND admin_id = $${paramCount}`;
      params.push(admin_id);
      paramCount++;
    }

    if (search) {
      query += ` AND (admin_id ILIKE $${paramCount} OR metadata::text ILIKE $${paramCount + 1})`;
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      paramCount += 2;
    }

    if (date_from) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(date_from);
      paramCount++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.count || 0, 10);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const logs = result.rows.map(row => ({
      ...row,
      old_value: typeof row.old_value === 'string' ? JSON.parse(row.old_value) : row.old_value || {},
      new_value: typeof row.new_value === 'string' ? JSON.parse(row.new_value) : row.new_value || {},
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
    }));

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('[AuditLog] Error fetching logs:', err);
    throw err;
  }
}

/**
 * Get a single audit log entry.
 */
async function getAuditLog(id) {
  try {
    const result = await db.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const log = result.rows[0];
    return {
      ...log,
      old_value: typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value || {},
      new_value: typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value || {},
      metadata: typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata || {},
    };
  } catch (err) {
    logger.error('[AuditLog] Error fetching single log:', err);
    throw err;
  }
}

export default {
  log,
  logAdminAction,
  getAuditLogs,
  getAuditLog,
};
