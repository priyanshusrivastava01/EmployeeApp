/**
 * EMS Authentication Middleware
 * Validates JWT tokens issued at login and attaches user context to requests.
 * All protected routes must use requireAuth before any business logic.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ems-dev-secret-change-in-production';

/**
 * requireAuth — Middleware that validates the Bearer JWT token.
 * Attaches req.user = { id, email, role, organizationId, organizationSlug, name }
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, error: 'Invalid authentication token.' });
    }

    // Attach trusted user context from the verified token payload
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      organizationId: decoded.organizationId,
      organizationSlug: decoded.organizationSlug
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'Authentication service error.' });
  }
}

/**
 * requireRole(roles[]) — Middleware factory to restrict endpoints to specific roles.
 * Must be used AFTER requireAuth.
 * Example: router.get('/admin', requireAuth, requireRole(['admin']), handler)
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }
    const effectiveRoles = [...allowedRoles];
    if (effectiveRoles.includes('admin') && !effectiveRoles.includes('founder')) {
      effectiveRoles.push('founder');
    }
    if (!effectiveRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

/**
 * requireSameOrg — Middleware that ensures a resource's organization_id matches the caller's org.
 * Used when a resource ID is in req.params and needs org verification.
 * Must be used AFTER requireAuth.
 */
function requireSameOrg(req, res, next) {
  const requestedOrgId = req.params.orgId || req.body.organization_id;
  if (requestedOrgId && requestedOrgId !== req.user.organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You cannot access data from another organization.'
    });
  }
  next();
}

/**
 * Generate a JWT token for a successfully authenticated user.
 */
function generateToken(user, organizationId, organizationSlug) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,           // Trusted role from DB, never from client
    organizationId,
    organizationSlug
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, requireRole, requireSameOrg, generateToken };
