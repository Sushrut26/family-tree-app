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
