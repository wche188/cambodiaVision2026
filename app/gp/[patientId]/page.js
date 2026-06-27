'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Stethoscope, Loader2, User } from 'lucide-react';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function GPExaminationPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.patientId;

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    visual_acuity_left: '',
    visual_acuity_right: '',
    diagnosis_notes: '',
    recommendation: '',
  });

  // Fetch patient data on mount
  useEffect(() => {
    async function fetchPatient() {
      try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (!response.ok) {
          setLoading(false);
          return;
        }
        const result = await response.json();
        setPatient(result.data);
      } catch (err) {
        console.error('Error fetching patient:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPatient();
  }, [patientId, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(`/api/patients/${patientId}/gp-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.push('/');
      } else if (response.status === 400) {
        const data = await response.json();
        if (data.errors) {
          setErrors(data.errors);
        } else if (data.error) {
          setErrors({ _general: data.error });
        }
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        const data = await response.json().catch(() => ({}));
        setErrors({ _general: data.error || 'An error occurred' });
      }
    } catch (err) {
      console.error('GP exam submission error:', err);
      setErrors({ _general: 'An error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = t('button.submit');
  const gpExamLabel = t('nav.gp_examination');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600 text-sm">Loading patient data...</p>
        </div>
      </div>
    );
  }

  // Patient not found
  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Patient not found</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900">
              {gpExamLabel.en}
            </h1>
            <span className="text-sm text-gray-500">{gpExamLabel.km}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Patient Summary Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Patient Photo */}
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
              {patient.photo ? (
                <Image
                  src={patient.photo}
                  alt={`${patient.given_name} ${patient.family_name}`}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                <User className="h-10 w-10 text-gray-400" />
              )}
            </div>

            {/* Patient Info */}
            <div className="flex-1 space-y-1">
              <h2 className="text-xl font-bold text-gray-900">
                {patient.given_name} {patient.family_name}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>
                  <BilingualLabel labelKey="form.age" className="inline" />{' '}
                  <span className="font-medium text-gray-900">{patient.age}</span>
                </span>
                <span>
                  <BilingualLabel labelKey="form.gender" className="inline" />{' '}
                  <span className="font-medium text-gray-900">{patient.gender}</span>
                </span>
              </div>
              {patient.reason_for_visit && (
                <div className="text-sm text-gray-600 mt-2">
                  <BilingualLabel labelKey="form.reason_for_visit" className="inline" />{' '}
                  <span className="font-medium text-gray-900">
                    {patient.reason_for_visit}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* General Error */}
        {errors._general && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{errors._general}</p>
          </div>
        )}

        {/* GP Examination Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-3">
            {gpExamLabel.en} / {gpExamLabel.km}
          </h3>

          {/* Visual Acuity Left */}
          <div>
            <label htmlFor="visual_acuity_left" className="block mb-1.5">
              <BilingualLabel labelKey="form.visual_acuity_left" />
            </label>
            <input
              id="visual_acuity_left"
              name="visual_acuity_left"
              type="text"
              value={formData.visual_acuity_left}
              onChange={handleChange}
              placeholder="e.g. 6/12"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                errors.visual_acuity_left ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              disabled={submitting}
            />
            {errors.visual_acuity_left && (
              <p className="mt-1 text-sm text-red-600">{errors.visual_acuity_left}</p>
            )}
          </div>

          {/* Visual Acuity Right */}
          <div>
            <label htmlFor="visual_acuity_right" className="block mb-1.5">
              <BilingualLabel labelKey="form.visual_acuity_right" />
            </label>
            <input
              id="visual_acuity_right"
              name="visual_acuity_right"
              type="text"
              value={formData.visual_acuity_right}
              onChange={handleChange}
              placeholder="e.g. 6/6"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                errors.visual_acuity_right ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              disabled={submitting}
            />
            {errors.visual_acuity_right && (
              <p className="mt-1 text-sm text-red-600">{errors.visual_acuity_right}</p>
            )}
          </div>

          {/* Diagnosis Notes */}
          <div>
            <label htmlFor="diagnosis_notes" className="block mb-1.5">
              <BilingualLabel labelKey="form.diagnosis_notes" />
            </label>
            <textarea
              id="diagnosis_notes"
              name="diagnosis_notes"
              value={formData.diagnosis_notes}
              onChange={handleChange}
              rows={4}
              placeholder="Enter diagnosis notes..."
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-y ${
                errors.diagnosis_notes ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              disabled={submitting}
            />
            {errors.diagnosis_notes && (
              <p className="mt-1 text-sm text-red-600">{errors.diagnosis_notes}</p>
            )}
          </div>

          {/* Recommendation */}
          <div>
            <label htmlFor="recommendation" className="block mb-1.5">
              <BilingualLabel labelKey="form.recommendation" />
            </label>
            <textarea
              id="recommendation"
              name="recommendation"
              value={formData.recommendation}
              onChange={handleChange}
              rows={4}
              placeholder="Enter recommendation..."
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 resize-y ${
                errors.recommendation ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              disabled={submitting}
            />
            {errors.recommendation && (
              <p className="mt-1 text-sm text-red-600">{errors.recommendation}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{submitLabel.en}...</span>
                </>
              ) : (
                <span>{submitLabel.en} / {submitLabel.km}</span>
              )}
            </button>
            <Link
              href="/"
              className="flex-1 sm:flex-initial text-center py-3 px-6 rounded-lg font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('button.cancel').en} / {t('button.cancel').km}
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
