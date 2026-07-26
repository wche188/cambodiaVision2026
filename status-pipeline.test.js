import { describe, it, expect } from 'vitest';
import { isValidTransition, getAllowedTransitions } from './status-pipeline.js';

describe('isValidTransition', () => {
  it('allows Registered → Seen_by_GP', () => {
    expect(isValidTransition('Registered', 'Seen_by_GP')).toBe(true);
  });

  it('allows Seen_by_GP → Surgery_Eligible', () => {
    expect(isValidTransition('Seen_by_GP', 'Surgery_Eligible')).toBe(true);
  });

  it('allows Seen_by_GP → Not_Eligible', () => {
    expect(isValidTransition('Seen_by_GP', 'Not_Eligible')).toBe(true);
  });

  it('allows Surgery_Eligible → Surgery_Scheduled', () => {
    expect(isValidTransition('Surgery_Eligible', 'Surgery_Scheduled')).toBe(true);
  });

  it('allows Surgery_Scheduled → Complete', () => {
    expect(isValidTransition('Surgery_Scheduled', 'Complete')).toBe(true);
  });

  it('rejects Registered → Complete (skipping steps)', () => {
    expect(isValidTransition('Registered', 'Complete')).toBe(false);
  });

  it('rejects Registered → Surgery_Eligible (skipping GP)', () => {
    expect(isValidTransition('Registered', 'Surgery_Eligible')).toBe(false);
  });

  it('rejects backward transition Complete → Registered', () => {
    expect(isValidTransition('Complete', 'Registered')).toBe(false);
  });

  it('rejects transition from terminal state Not_Eligible', () => {
    expect(isValidTransition('Not_Eligible', 'Surgery_Eligible')).toBe(false);
  });

  it('rejects transition from terminal state Complete', () => {
    expect(isValidTransition('Complete', 'Seen_by_GP')).toBe(false);
  });

  it('returns false for an unknown current status', () => {
    expect(isValidTransition('Unknown', 'Registered')).toBe(false);
  });

  it('returns false for a valid current status with unknown target', () => {
    expect(isValidTransition('Registered', 'Unknown')).toBe(false);
  });
});

describe('getAllowedTransitions', () => {
  it('returns ["Seen_by_GP"] for Registered', () => {
    expect(getAllowedTransitions('Registered')).toEqual(['Seen_by_GP']);
  });

  it('returns ["Surgery_Eligible", "Not_Eligible"] for Seen_by_GP', () => {
    expect(getAllowedTransitions('Seen_by_GP')).toEqual(['Surgery_Eligible', 'Not_Eligible']);
  });

  it('returns ["Surgery_Scheduled"] for Surgery_Eligible', () => {
    expect(getAllowedTransitions('Surgery_Eligible')).toEqual(['Surgery_Scheduled']);
  });

  it('returns empty array for Not_Eligible (terminal)', () => {
    expect(getAllowedTransitions('Not_Eligible')).toEqual([]);
  });

  it('returns ["Complete"] for Surgery_Scheduled', () => {
    expect(getAllowedTransitions('Surgery_Scheduled')).toEqual(['Complete']);
  });

  it('returns empty array for Complete (terminal)', () => {
    expect(getAllowedTransitions('Complete')).toEqual([]);
  });

  it('returns empty array for unknown status', () => {
    expect(getAllowedTransitions('Unknown')).toEqual([]);
  });
});
