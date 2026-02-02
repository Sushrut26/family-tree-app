/**
 * Utility helpers for handling Express request parameters
 */

/**
 * Safely extract a string parameter from req.params or req.query
 * Handles the case where Express might return string | string[]
 */
export function getStringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

/**
 * Safely extract an optional string parameter
 */
export function getOptionalStringParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Extract client IP address (handles proxies via X-Forwarded-For)
 */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string | undefined } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
