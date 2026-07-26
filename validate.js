/**
 * Input validation and sanitization utilities.
 * Requirements: 13.3 (parameterized queries), 13.4 (validate/sanitize user input)
 */

/**
 * Validates that all specified fields are present and non-empty in the request body.
 * @param {string[]} fields - Array of field names to check
 * @param {object} body - The request body object
 * @returns {object|null} An errors object mapping field names to error messages, or null if all valid
 */
export function validateRequired(fields, body) {
  const errors = {};
  for (const field of fields) {
    if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
      errors[field] = 'Required';
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Sanitizes a string by stripping HTML tags and trimming whitespace.
 * Returns non-string inputs unchanged.
 * @param {*} input - The value to sanitize
 * @returns {*} The sanitized string, or the original value if not a string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<[^>]*>/g, '');
}
