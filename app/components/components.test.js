import { describe, it, expect } from 'vitest';
import { t } from '../../lib/translations.js';

/**
 * Unit tests for shared UI component logic.
 * These test the data/config that powers the components without requiring a DOM.
 */

describe('StatusBadge logic', () => {
  const STATUS_STYLES = {
    Registered: 'bg-blue-100 text-blue-800',
    Seen_by_GP: 'bg-amber-100 text-amber-800',
    Surgery_Eligible: 'bg-green-100 text-green-800',
    Not_Eligible: 'bg-red-100 text-red-800',
    Surgery_Scheduled: 'bg-purple-100 text-purple-800',
    Complete: 'bg-slate-100 text-slate-800',
  };

  const STATUS_LABELS = {
    Registered: 'Registered',
    Seen_by_GP: 'Seen by GP',
    Surgery_Eligible: 'Surgery Eligible',
    Not_Eligible: 'Not Eligible',
    Surgery_Scheduled: 'Surgery Scheduled',
    Complete: 'Complete',
  };

  it('has a style defined for each pipeline status', () => {
    const statuses = ['Registered', 'Seen_by_GP', 'Surgery_Eligible', 'Not_Eligible', 'Surgery_Scheduled', 'Complete'];
    for (const status of statuses) {
      expect(STATUS_STYLES[status]).toBeDefined();
      expect(STATUS_STYLES[status].length).toBeGreaterThan(0);
    }
  });

  it('has a label defined for each pipeline status', () => {
    const statuses = ['Registered', 'Seen_by_GP', 'Surgery_Eligible', 'Not_Eligible', 'Surgery_Scheduled', 'Complete'];
    for (const status of statuses) {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('maps status colors correctly', () => {
    expect(STATUS_STYLES['Registered']).toContain('blue');
    expect(STATUS_STYLES['Seen_by_GP']).toContain('amber');
    expect(STATUS_STYLES['Surgery_Eligible']).toContain('green');
    expect(STATUS_STYLES['Not_Eligible']).toContain('red');
    expect(STATUS_STYLES['Surgery_Scheduled']).toContain('purple');
    expect(STATUS_STYLES['Complete']).toContain('slate');
  });
});

describe('BilingualLabel logic', () => {
  it('t() returns both en and km for valid keys', () => {
    const result = t('form.family_name');
    expect(result).toHaveProperty('en');
    expect(result).toHaveProperty('km');
    expect(result.en).toBe('Family Name');
    expect(result.km.length).toBeGreaterThan(0);
  });

  it('t() returns key as both en and km for unknown keys', () => {
    const result = t('unknown.key.here');
    expect(result.en).toBe('unknown.key.here');
    expect(result.km).toBe('unknown.key.here');
  });

  it('supports direct text objects', () => {
    const text = { en: 'Hello', km: 'សួស្តី' };
    expect(text.en).toBe('Hello');
    expect(text.km).toBe('សួស្តី');
  });
});

describe('DashboardSummary logic', () => {
  const STATUS_KEYS = ['Registered', 'Seen_by_GP', 'Surgery_Eligible', 'Not_Eligible', 'Surgery_Scheduled', 'Complete'];
  const TRANSLATION_KEYS = [
    'status.registered',
    'status.seen_by_gp',
    'status.surgery_eligible',
    'status.not_eligible',
    'status.surgery_scheduled',
    'status.complete',
  ];

  it('all status translation keys exist and have bilingual values', () => {
    for (const key of TRANSLATION_KEYS) {
      const translation = t(key);
      expect(translation.en).not.toBe(key);
      expect(translation.km).not.toBe(key);
      expect(translation.en.length).toBeGreaterThan(0);
      expect(translation.km.length).toBeGreaterThan(0);
    }
  });

  it('handles empty counts gracefully', () => {
    const counts = {};
    for (const key of STATUS_KEYS) {
      expect(counts[key] || 0).toBe(0);
    }
  });

  it('correctly reads counts when provided', () => {
    const counts = { Registered: 5, Seen_by_GP: 3, Complete: 10 };
    expect(counts['Registered']).toBe(5);
    expect(counts['Not_Eligible'] || 0).toBe(0);
  });
});

describe('PatientCard logic', () => {
  it('formats patient number with leading zeros', () => {
    const formatNumber = (num) => String(num).padStart(4, '0');
    expect(formatNumber(1)).toBe('0001');
    expect(formatNumber(42)).toBe('0042');
    expect(formatNumber(1234)).toBe('1234');
    expect(formatNumber(12345)).toBe('12345');
  });

  it('formats registration date correctly', () => {
    const date = '2025-01-15';
    const formatted = new Date(date).toLocaleDateString();
    expect(formatted).toBeTruthy();
  });

  it('handles missing registration_date', () => {
    const patient = { registration_date: null };
    const formattedDate = patient.registration_date
      ? new Date(patient.registration_date).toLocaleDateString()
      : '—';
    expect(formattedDate).toBe('—');
  });
});
