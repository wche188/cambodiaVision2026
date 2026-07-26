'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, User, Phone, MapPin, Calendar, FileText, Loader2 } from 'lucide-react';
import StatusBadge from '@/app/components/StatusBadge';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function PatientDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [patientRes, sessionRes] = await Promise.all([
          fetch(`/api/patients/${id}`),
          fetch('/api/auth/session'),
        ]);

        if (patientRes.status === 401) {
          router.push('/login');
          return;
        }

        if (patientRes.ok) {
          const json = await patientRes.json();
          setPatient(json.data);
        }

        if (sessionRes.ok) {
          const sData = await sessionRes.json();
          setSession(sData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

  const isAdmin = session?.role === 'admin';
  const isStationManager = session?.role === 'station_manager';
  const canEditStations = isAdmin;
  const canDownloadSurgeryForm = isAdmin || isStationManager;

  const toggleStation = async (station) => {
    if (!isAdmin) return;
    const res = await fetch(`/api/patients/${id}/station`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station }),
    });
    if (res.ok) {
      const json = await res.json();
      setPatient(prev => ({ ...prev, stations_visited: JSON.stringify(json.stationsVisited) }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Patient not found</p>
          <Link href="/" className="text-blue-600 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="ml-auto">
            <StatusBadge status={patient.status} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Photo + Name Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Patient Photo */}
            <div className="w-40 h-40 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-200">
              {patient.photo ? (
                <img
                  src={patient.photo}
                  alt={`${patient.given_name} ${patient.family_name}`}
                  className="object-cover w-full h-full"
                />
              ) : (
                <User className="h-16 w-16 text-gray-300" />
              )}
            </div>

            {/* Name and basic info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                {patient.family_name} {patient.given_name}
              </h1>
              <p className="text-gray-500 font-mono mt-1">#{String(patient.patient_number).padStart(4, '0')}</p>
              <div className="flex flex-wrap gap-3 mt-3 justify-center sm:justify-start">
                <span className="text-sm text-gray-600">{patient.age} yrs</span>
                <span className="text-sm text-gray-600 capitalize">{patient.gender}</span>
                {patient.blood_group && (
                  <span className="text-sm text-gray-600">Blood: {patient.blood_group}</span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/generate-pdf/${patient.id}?type=registration`}
                  onClick={() => {
                    // Mark as printed locally so the UI updates
                    setPatient(prev => prev ? { ...prev, form_printed: 1 } : prev);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Registration Form
                </a>
                {canDownloadSurgeryForm && (
                  <a
                    href={`/api/generate-pdf/${patient.id}?type=surgery`}
                    className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Surgery Form
                  </a>
                )}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex-shrink-0 text-center">
              <img
                src={`/api/patients/${patient.id}/qrcode`}
                alt={`QR: ${patient.patient_number}`}
                className="w-24 h-24 border border-gray-200 rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Scan at station</p>
            </div>
          </div>
        </section>

        {/* Patient Journey Tracker */}
        <PatientJourney stationsVisited={patient.stations_visited} isAdmin={canEditStations} onToggle={toggleStation} />

        {/* Contact & Address */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Contact & Address
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField label={t('form.contact_phone')} value={patient.contact_phone} />
            <InfoField label={t('form.province')} value={patient.province} />
            <InfoField label={t('form.district')} value={patient.district} />
            <InfoField label={t('form.commune')} value={patient.commune} />
            <InfoField label={t('form.village')} value={patient.village} />
            <InfoField label={t('ui.date')} value={patient.registration_date ? new Date(patient.registration_date).toLocaleDateString('en-GB') : ''} />
          </div>
        </section>

        {/* Medical Info */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Medical Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField label={t('form.has_tb')} value={patient.has_tb ? 'Yes' : 'No'} />
            <InfoField label={t('form.is_pregnant')} value={patient.is_pregnant || 'No'} />
            <InfoField label={t('form.reason_for_visit')} value={patient.reason_for_visit} full />
          </div>
        </section>

        {/* GP Examination (if available) */}
        {patient.gp_examination && (
          <section className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-4">
              GP Examination
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label={t('form.visual_acuity_left')} value={patient.gp_examination.visual_acuity_left} />
              <InfoField label={t('form.visual_acuity_right')} value={patient.gp_examination.visual_acuity_right} />
              <InfoField label={t('form.diagnosis_notes')} value={patient.gp_examination.diagnosis_notes} full />
              <InfoField label={t('form.recommendation')} value={patient.gp_examination.recommendation} full />
            </div>
          </section>
        )}

        {/* Surgery Decision (if available) */}
        {patient.surgery_decision && (
          <section className="bg-green-50 rounded-xl border border-green-200 p-6">
            <h2 className="text-lg font-semibold text-green-900 mb-4">
              Surgery Decision
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label={t('form.eligibility')} value={patient.surgery_decision.eligibility === 'Surgery_Eligible' ? 'Eligible' : 'Not Eligible'} />
              {patient.surgery_decision.surgery_type && (
                <InfoField label={t('form.surgery_type')} value={patient.surgery_decision.surgery_type} />
              )}
              {patient.surgery_decision.eye && (
                <InfoField label={t('form.eye')} value={patient.surgery_decision.eye} />
              )}
              {patient.surgery_decision.scheduled_date && (
                <InfoField label={t('form.scheduled_date')} value={new Date(patient.surgery_decision.scheduled_date).toLocaleDateString('en-GB')} />
              )}
              {patient.surgery_decision.ineligibility_reason && (
                <InfoField label={t('form.reason_not_eligible')} value={patient.surgery_decision.ineligibility_reason} full />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function InfoField({ label, value, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-gray-500">{label.en} / {label.km}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );
}

// ============================================================
// Patient Journey — Simple station tracker
// ============================================================
const JOURNEY_STATIONS = [
  { key: 'Doctor', label: 'Doctor', km: 'វេជ្ជបណ្ឌិត', icon: '👨‍⚕️' },
  { key: 'Optometry', label: 'Optometry', km: 'ពិនិត្យភ្នែក', icon: '👁️' },
  { key: 'Refraction', label: 'Refraction', km: 'វាស់វែនតា', icon: '🔬' },
  { key: 'Glasses_Dispensed', label: 'Glasses', km: 'ថ្នាក់វែនតា', icon: '👓' },
  { key: 'Ear_Therapy', label: 'Ear Therapy', km: 'ព្យាបាលត្រចៀក', icon: '👂' },
  { key: 'Surgery', label: 'Surgery', km: 'វះកាត់', icon: '🔪' },
];

function PatientJourney({ stationsVisited = [], isAdmin = false, onToggle }) {
  let stations = [];
  try {
    stations = typeof stationsVisited === 'string' ? JSON.parse(stationsVisited) : (stationsVisited || []);
  } catch {
    stations = [];
  }

  const hasSurgery = stations.includes('Surgery');
  const hasDoctor = stations.includes('Doctor');
  const hasOptometry = stations.includes('Optometry');
  const hasGlasses = stations.includes('Glasses_Dispensed');
  const hasRefraction = stations.includes('Refraction');
  const surgeryWarning = hasSurgery && (!hasDoctor || !hasOptometry);
  const glassesWarning = hasGlasses && !hasRefraction;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Patient Journey <span className="text-sm font-normal text-gray-500">ដំណើរការអ្នកជំងឺ</span>
        {isAdmin && <span className="text-xs text-blue-500 ml-2">(tap to toggle)</span>}
      </h2>

      {/* Registration — always done */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 border-green-500 bg-green-100 text-green-700">
          ✓
        </div>
        <p className="text-sm font-medium text-green-700">Registered / បានចុះឈ្មោះ</p>
      </div>

      {/* Stations */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {JOURNEY_STATIONS.map(({ key, label, km, icon }) => {
          const visited = stations.includes(key);
          return (
            <div
              key={key}
              onClick={() => isAdmin && onToggle && onToggle(key)}
              className={`rounded-lg p-3 text-center border-2 transition-all ${
                visited
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              } ${isAdmin ? 'cursor-pointer hover:shadow-md active:scale-95' : ''}`}
            >
              <div className="text-2xl mb-1">{visited ? '✓' : icon}</div>
              <p className={`text-xs font-medium ${visited ? 'text-green-700' : 'text-gray-500'}`}>
                {label}
              </p>
              <p className={`text-xs ${visited ? 'text-green-500' : 'text-gray-400'}`}>
                {km}
              </p>
              {visited && (
                <p className="text-xs text-green-600 mt-1 font-medium">Attended</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Soft warning for surgery without doctor/optometry */}
      {surgeryWarning && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            ⚠️ Note: Patient had surgery without seeing {!hasDoctor && 'Doctor'}{!hasDoctor && !hasOptometry && ' and '}{!hasOptometry && 'Optometry'} first.
          </p>
        </div>
      )}

      {/* Soft warning for glasses without refraction */}
      {glassesWarning && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            ⚠️ Note: Glasses dispensed without Refraction being done first.
          </p>
        </div>
      )}

      {stations.length === 0 && (
        <p className="mt-3 text-sm text-gray-400">No stations visited yet</p>
      )}
    </section>
  );
}
