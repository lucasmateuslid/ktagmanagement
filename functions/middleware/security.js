/**
 * Security Middleware for Firebase Functions
 * Implements rate limiting, CORS, HTTPS enforcement, and security headers
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limit store using Firestore for distributed rate limiting
class FirestoreRateLimitStore {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('rate_limits');
  }

  async increment(key) {
    const docRef = this.collection.doc(key);
    const now = Date.now();
    
    try {
      const doc = await docRef.get();
      
      if (!doc.exists) {
        await docRef.set({
          count: 1,
          firstRequest: now,
          lastRequest: now
        });
        return { count: 1, firstRequest: now };
      }
      
      const data = doc.data();
      const newCount = data.count + 1;
      
      await docRef.update({
        count: newCount,
        lastRequest: now
      });
      
      return { count: newCount, firstRequest: data.firstRequest };
    } catch (error) {
      console.error('Rate limit store error:', error);
      // Fallback: allow request if store fails
      return { count: 1, firstRequest: now };
    }
  }

  async reset(key) {
    try {
      await this.collection.doc(key).delete();
    } catch (error) {
      console.error('Rate limit reset error:', error);
    }
  }

  // Cleanup old entries (should be called periodically)
  async cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const snapshot = await this.collection
      .where('lastRequest', '<', cutoff)
      .limit(500)
      .get();
    
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    console.log(`Cleaned up ${snapshot.size} old rate limit entries`);
  }
}

// IP extraction with proxy support
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
};

// Rate limiting middleware factory
const createRateLimiter = (store, options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    action = 'general'
  } = options;

  return async (req, res, next) => {
    const clientIp = getClientIp(req);
    const key = `${action}_${clientIp}`;
    
    const { count, firstRequest } = await store.increment(key);
    const timeWindow = Date.now() - firstRequest;
    
    // Reset counter if outside time window
    if (timeWindow > windowMs) {
      await store.reset(key);
      return next();
    }
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', new Date(firstRequest + windowMs).toISOString());
    
    if (count > maxRequests) {
      const retryAfter = Math.ceil((windowMs - timeWindow) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      console.warn(`Rate limit exceeded for ${clientIp} on ${action}: ${count} requests`);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }
    
    next();
  };
};

// HTTPS enforcement middleware
const enforceHttps = (req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ Non-HTTPS request blocked:', getClientIp(req));
    return res.status(403).json({
      error: 'HTTPS required',
      message: 'This API requires HTTPS connection'
    });
  }
  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Strict CORS
  const allowedOrigins = [
    'https://ktag-manager.web.app',
    'https://ktag-manager.firebaseapp.com',
    'https://k-tag-manager-pro-192841108882.us-west1.run.app',
    process.env.ALLOWED_ORIGIN
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Request validation middleware
const validateRequest = (requiredFields = []) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Missing required fields',
        missingFields
      });
    }
    
    next();
  };
};

// Audit logging
const auditLog = async (db, action, userId, metadata = {}) => {
  try {
    await db.collection('audit_logs').add({
      action,
      userId,
      metadata,
      timestamp: Date.now(),
      createdAt: new Date()
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

module.exports = {
  FirestoreRateLimitStore,
  getClientIp,
  createRateLimiter,
  enforceHttps,
  securityHeaders,
  validateRequest,
  auditLog
};
