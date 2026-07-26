import { describe, it, expect } from 'vitest';
import translations, { t } from './translations.js';

describe('translations module', () => {
  describe('t() function', () => {
    it('returns { en, km } object for a valid key', () => {
      const result = t('form.family_name');
      expect(result).toEqual({ en: 'Family Name', km: 'នាមត្រកូល' });
    });

    it('returns key as both en and km for unknown keys', () => {
      const result = t('unknown.key');
      expect(result).toEqual({ en: 'unknown.key', km: 'unknown.key' });
    });
  });

  describe('all translations have both en and km values', () => {
    const keys = Object.keys(translations);

    it('has at least one translation entry', () => {
      expect(keys.length).toBeGreaterThan(0);
    });

    it.each(keys)('%s has non-empty en and km strings', (key) => {
      const entry = translations[key];
      expect(typeof entry.en).toBe('string');
      expect(entry.en.length).toBeGreaterThan(0);
      expect(typeof entry.km).toBe('string');
      expect(entry.km.length).toBeGreaterThan(0);
    });
  });

  describe('required translation categories', () => {
    it('covers navigation items', () => {
      const navKeys = ['nav.dashboard', 'nav.registration', 'nav.data_report',
        'nav.gp_examination', 'nav.surgery', 'nav.admin', 'nav.login', 'nav.logout'];
      for (const key of navKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers patient registration form labels', () => {
      const formKeys = ['form.patient_number', 'form.family_name', 'form.given_name',
        'form.age', 'form.gender', 'form.contact_phone', 'form.province',
        'form.district', 'form.village', 'form.commune', 'form.reason_for_visit',
        'form.blood_group', 'form.is_pregnant', 'form.has_tb', 'form.photo'];
      for (const key of formKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers GP examination form labels', () => {
      const gpKeys = ['form.visual_acuity_left', 'form.visual_acuity_right',
        'form.diagnosis_notes', 'form.recommendation'];
      for (const key of gpKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers surgery form labels', () => {
      const surgeryKeys = ['form.eligibility', 'form.surgery_type', 'form.eye',
        'form.scheduled_date', 'form.reason_ineligibility'];
      for (const key of surgeryKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers buttons', () => {
      const buttonKeys = ['button.submit', 'button.save', 'button.cancel',
        'button.export_pdf', 'button.login', 'button.logout',
        'button.search', 'button.filter', 'button.clear'];
      for (const key of buttonKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers status names', () => {
      const statusKeys = ['status.registered', 'status.seen_by_gp',
        'status.surgery_eligible', 'status.not_eligible',
        'status.surgery_scheduled', 'status.complete'];
      for (const key of statusKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers validation messages', () => {
      const validationKeys = ['validation.required', 'validation.invalid_credentials',
        'validation.rate_limited', 'validation.invalid_transition',
        'validation.too_many_attempts'];
      for (const key of validationKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers general UI labels', () => {
      const uiKeys = ['ui.patient', 'ui.patients', 'ui.status',
        'ui.actions', 'ui.date', 'ui.no_results'];
      for (const key of uiKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });

    it('covers common labels', () => {
      const commonKeys = ['common.yes', 'common.no', 'common.male', 'common.female',
        'common.child', 'common.left', 'common.right', 'common.both'];
      for (const key of commonKeys) {
        expect(translations[key]).toBeDefined();
        expect(translations[key].en).toBeTruthy();
        expect(translations[key].km).toBeTruthy();
      }
    });
  });
});
