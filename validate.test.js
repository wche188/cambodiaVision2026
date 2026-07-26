import { describe, it, expect } from 'vitest';
import { validateRequired, sanitizeString } from './validate.js';

describe('validateRequired', () => {
  it('returns null when all required fields are present and non-empty', () => {
    const body = { name: 'John', age: 25, email: 'john@example.com' };
    const result = validateRequired(['name', 'age', 'email'], body);
    expect(result).toBeNull();
  });

  it('returns errors object for missing fields', () => {
    const body = { name: 'John' };
    const result = validateRequired(['name', 'age', 'email'], body);
    expect(result).toEqual({ age: 'Required', email: 'Required' });
  });

  it('treats empty string as missing', () => {
    const body = { name: '', email: 'test@test.com' };
    const result = validateRequired(['name', 'email'], body);
    expect(result).toEqual({ name: 'Required' });
  });

  it('treats whitespace-only string as missing', () => {
    const body = { name: '   ', email: 'test@test.com' };
    const result = validateRequired(['name', 'email'], body);
    expect(result).toEqual({ name: 'Required' });
  });

  it('treats null value as missing', () => {
    const body = { name: null };
    const result = validateRequired(['name'], body);
    expect(result).toEqual({ name: 'Required' });
  });

  it('treats undefined value as missing', () => {
    const body = { name: undefined };
    const result = validateRequired(['name'], body);
    expect(result).toEqual({ name: 'Required' });
  });

  it('accepts non-string truthy values (numbers, objects)', () => {
    const body = { count: 0, items: [] };
    // 0 and [] are falsy/truthy respectively
    const result = validateRequired(['count', 'items'], body);
    // 0 is falsy so it should be flagged as required
    expect(result).toEqual({ count: 'Required' });
  });

  it('returns null for an empty fields array', () => {
    const body = {};
    const result = validateRequired([], body);
    expect(result).toBeNull();
  });
});

describe('sanitizeString', () => {
  it('strips HTML tags from a string', () => {
    const result = sanitizeString('<script>alert("xss")</script>Hello');
    expect(result).toBe('alert("xss")Hello');
  });

  it('strips multiple HTML tags', () => {
    const result = sanitizeString('<p>Hello</p> <b>World</b>');
    expect(result).toBe('Hello World');
  });

  it('trims leading and trailing whitespace', () => {
    const result = sanitizeString('  hello world  ');
    expect(result).toBe('hello world');
  });

  it('both trims whitespace and strips HTML tags', () => {
    const result = sanitizeString('  <div>content</div>  ');
    expect(result).toBe('content');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitizeString(42)).toBe(42);
    expect(sanitizeString(null)).toBeNull();
    expect(sanitizeString(undefined)).toBeUndefined();
    expect(sanitizeString(true)).toBe(true);
  });

  it('returns empty string for whitespace-only input', () => {
    const result = sanitizeString('   ');
    expect(result).toBe('');
  });

  it('handles strings with no HTML tags', () => {
    const result = sanitizeString('plain text');
    expect(result).toBe('plain text');
  });

  it('handles self-closing tags', () => {
    const result = sanitizeString('before<br/>after');
    expect(result).toBe('beforeafter');
  });
});
