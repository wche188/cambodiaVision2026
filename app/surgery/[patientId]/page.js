'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, ClipboardCheck, AlertCircle } from 'lucide-react';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function SurgeryEligibilityPage() {
  const router = useRouter();
  const { patientId } = useParams();

  // Patient data state
  const [patient, setPatient] = useState(null);
  const [gpExam, setGpExam] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Form state
  const [eligibility, setEligibility] = useState('');
  const [surgeryType, setSurgeryType] = useState('');
  const [eye, setEye] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Fetch patient data on mount
  useEffect(() => {
    async function fetchPatient() {
      try {
        const res = await fetch(`/api/patients/${patientId}`);
        if (!res.ok) {
          setFetchError('Failed to load patient data');
          return;
        }
        const json = await res.json();
        setPatient(json.data);

        // GP exam data may be included in patient response or available separately
        if (json.data?.gp_examination) {
          setGpExam(json.data.gp_examination);
        }
      } catch (err) {
        console.error('Error fetching patient:', err);
        setFetchError('Failed to load patient data');
      } finally {
        setLoadingPatient(false);
      }
    }

    if (patientId) {
      fetchPatient();
    }
  }, [patientId]);

  const validate = () => {
    const newErrors = {};

    if (!eligibility) {
      newErrors.eligibility = 'Required';
    }

    if (eligibility === 'Surgery_Eligible') {
      if (!surgeryType.trim()) {
        newErrors.surgery_type = 'Required';
      }
      if (!eye) {
        newErrors.eye = 'Required';
      }
    }

    if (eligibility === 'Not_Eligible') {
      if (!reason.trim()) {
        newErrors.reason = 'Required';
      }
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);

    const body = { eligibility };

    if (eligibility === 'Surgery_Eligible') {
      body.surgery_type = surgeryType.trim();
      body.eye = eye;
      if (scheduledDate) {
        body.scheduled_date = scheduledDate;
      }
    } else {
      body.reason = reason.trim();
    }

    try {
      const res = await fetch(`/api/patients/${patientId}/surgery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push('/');
      } else if (res.status === 400) {
        const data = await res.json();
        if (data.errors) {
          setErrors(data.errors);
        } else if (data.error) {
          setErrors({ _general: data.error });
        }
      } else {
        setErrors({ _general: 'An unexpected error occurred' });
      }
    } catch (err) {
      console.error('Submit error:', err);
      setErrors({ _general: 'An unexpected error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loadingPatient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading patient data...</span>
        </div>
      </div>
    );
  }

  // Fetch error state
  if (fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{fetchError}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            ← {t('nav.dashboard').en} / {t('nav.dashboard').km}
          </Link>
        </div>
      </div>
    );
  }

  const surgeryLabel = t('nav.surgery');
  const submitLabel = t('button.submit');

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.dashboard').en} / {t('nav.dashboard').km}
        </Link>

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <ClipboardCheck className="h-7 w-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {surgeryLabel.en} / {surgeryLabel.km}
          </h1>
        </div>

        {/* Patient Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t('ui.patient').en} / {t('ui.patient').km}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">{t('form.given_name').en} / {t('form.given_name').km}</p>
              <p className="text-sm font-semibold text-gray-900">
                {patient?.given_name || '-'} {patient?.family_name || ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('form.age').en} / {t('form.age').km}</p>
              <p className="text-sm font-semibold text-gray-900">{patient?.age || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('form.gender').en} / {t('form.gender').km}</p>
              <p className="text-sm font-semibold text-gray-900">{patient?.gender || '-'}</p>
            </div>
          </div>
        </div>

        {/* GP Exam Summary (if available) */}
        {gpExam && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
              {t('nav.gp_examination').en} / {t('nav.gp_examination').km}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-blue-600">{t('form.visual_acuity_left').en}</p>
                <p className="font-medium text-gray-900">{gpExam.visual_acuity_left || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-blue-600">{t('form.visual_acuity_right').en}</p>
                <p className="font-medium text-gray-900">{gpExam.visual_acuity_right || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-blue-600">{t('form.diagnosis_notes').en}</p>
                <p className="font-medium text-gray-900">{gpExam.diagnosis_notes || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-blue-600">{t('form.recommendation').en}</p>
                <p className="font-medium text-gray-900">{gpExam.recommendation || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* General error message */}
        {errors._general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{errors._general}</p>
          </div>
        )}

        {/* Surgery Eligibility Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Eligibility Radio */}
          <fieldset>
            <legend className="mb-3">
              <BilingualLabel labelKey="form.eligibility" />
            </legend>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 transition-colors has-[:checked]:border-green-500 has-[:checked]:bg-green-50">
                <input
                  type="radio"
                  name="eligibility"
                  value="Surgery_Eligible"
                  checked={eligibility === 'Surgery_Eligible'}
                  onChange={(e) => setEligibility(e.target.value)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  {t('status.surgery_eligible').en} / {t('status.surgery_eligible').km}
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-red-50 transition-colors has-[:checked]:border-red-500 has-[:checked]:bg-red-50">
                <input
                  type="radio"
                  name="eligibility"
                  value="Not_Eligible"
                  checked={eligibility === 'Not_Eligible'}
                  onChange={(e) => setEligibility(e.target.value)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  {t('status.not_eligible').en} / {t('status.not_eligible').km}
                </span>
              </label>
            </div>
            {errors.eligibility && (
              <p className="mt-2 text-sm text-red-600">{errors.eligibility}</p>
            )}
          </fieldset>

          {/* Conditional: Surgery Eligible fields */}
          {eligibility === 'Surgery_Eligible' && (
            <div className="space-y-5 border-t border-gray-100 pt-5">
              {/* Surgery Type */}
              <div>
                <label htmlFor="surgery_type" className="block mb-1.5">
                  <BilingualLabel labelKey="form.surgery_type" />
                </label>
                <input
                  id="surgery_type"
                  type="text"
                  value={surgeryType}
                  onChange={(e) => setSurgeryType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="e.g. Cataract extraction"
                />
                {errors.surgery_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.surgery_type}</p>
                )}
              </div>

              {/* Eye Select */}
              <div>
                <label htmlFor="eye" className="block mb-1.5">
                  <BilingualLabel labelKey="form.eye" />
                </label>
                <select
                  id="eye"
                  value={eye}
                  onChange={(e) => setEye(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="">-- Select / ជ្រើសរើស --</option>
                  <option value="left">{t('common.left').en} / {t('common.left').km}</option>
                  <option value="right">{t('common.right').en} / {t('common.right').km}</option>
                  <option value="both">{t('common.both').en} / {t('common.both').km}</option>
                </select>
                {errors.eye && (
                  <p className="mt-1 text-sm text-red-600">{errors.eye}</p>
                )}
              </div>

              {/* Scheduled Date (optional) */}
              <div>
                <label htmlFor="scheduled_date" className="block mb-1.5">
                  <BilingualLabel labelKey="form.scheduled_date" />
                  <span className="text-xs text-gray-400 ml-2">(optional)</span>
                </label>
                <input
                  id="scheduled_date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          )}

          {/* Conditional: Not Eligible fields */}
          {eligibility === 'Not_Eligible' && (
            <div className="border-t border-gray-100 pt-5">
              <label htmlFor="reason" className="block mb-1.5">
                <BilingualLabel labelKey="form.reason_not_eligible" />
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-none"
                placeholder="Enter reason for ineligibility..."
              />
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {submitLabel.en}...
                </span>
              ) : (
                `${submitLabel.en} / ${submitLabel.km}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
