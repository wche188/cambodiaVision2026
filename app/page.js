'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LogOut,
  UserPlus,
  FileText,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import DashboardSummary from './components/DashboardSummary';
import PatientCard from './components/PatientCard';
import StatusBadge from './components/StatusBadge';
import BilingualLabel from './components/BilingualLabel';

const STATUSES = [
  'Registered',
  'Form_Printed',
  'Prepare_for_Surgery',
  'Surgery_Completed',
];

const POLL_INTERVAL = 30000; // 30 seconds

export default function Dashboard() {
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchPatients = useCallback(async () => {
    try {
      let url = '/api/patients';
      const params = [];
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (searchQuery.trim()) params.push(`patient_number=${encodeURIComponent(searchQuery.trim())}`);
      if (params.length) url += '?' + params.join('&');

      const response = await fetch(url);

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const result = await response.json();

      if (result.data) {
        setPatients(result.data);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, router]);

  const fetchCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/patients');

      if (response.status === 401) return;

      const result = await response.json();

      if (result.data) {
        const countMap = {};
        STATUSES.forEach((s) => (countMap[s] = 0));
        result.data.forEach((p) => {
          if (countMap[p.status] !== undefined) {
            countMap[p.status]++;
          }
        });
        setCounts(countMap);
      }
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  }, []);

  const [stationStatuses, setStationStatuses] = useState({});

  const fetchStationStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/stations/status');
      if (res.ok) {
        const d = await res.json();
        setStationStatuses(d.data || {});
      }
    } catch {}
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPatients();
    fetchCounts();
    fetchStationStatuses();
  }, [fetchPatients, fetchCounts, fetchStationStatuses]);

  // 30-second polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPatients();
      fetchCounts();
      fetchStationStatuses();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPatients, fetchCounts, fetchStationStatuses]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    router.push('/login');
  };

  const handleFilterChange = (status) => {
    setStatusFilter(status === statusFilter ? '' : status);
    setPage(1);
    setLoading(true);
  };

  // Paginate patients
  const totalPages = Math.ceil(patients.length / PAGE_SIZE);
  const paginatedPatients = patients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="Cambodia Vision" className="w-10 h-10 rounded-lg object-contain" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-blue-900 tracking-tight">CAMBODIA VISION 2026</h1>
              <p className="text-xs text-blue-600/70 font-medium">Patient Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2 w-full sm:w-auto">
            <Link
              href="/registration"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-all flex-1 sm:flex-initial"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Register</span>
              <span className="sm:hidden">Register</span>
            </Link>

            <Link
              href="/data-report"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white text-blue-700 border border-blue-200 text-sm font-medium rounded-lg hover:bg-blue-50 transition-all flex-1 sm:flex-initial"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Report</span>
              <span className="sm:hidden">Report</span>
            </Link>

            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] text-gray-500 hover:text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition-all flex-1 sm:flex-initial"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Cards */}
        <section>
          <BilingualLabel
            text={{ en: 'Patient Status Summary', km: 'សង្ខេបស្ថានភាពអ្នកជំងឺ' }}
            className="mb-4"
          />
          <DashboardSummary counts={counts} />
        </section>

        {/* Station Queue Indicators */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Station Queue Levels</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { key: 'Doctor', label: 'Doctor', icon: '👨‍⚕️' },
              { key: 'Optometry', label: 'Optom', icon: '👁️' },
              { key: 'Refraction', label: 'Refract', icon: '🔬' },
              { key: 'Glasses_Dispensed', label: 'Glasses', icon: '👓' },
              { key: 'Ear_Therapy', label: 'Ear', icon: '👂' },
              { key: 'Surgery', label: 'Surgery', icon: '🔪' },
            ].map(({ key, label, icon }) => {
              const level = stationStatuses[key] || 'mid';
              const colors = { low: 'bg-green-100 border-green-400 text-green-800', mid: 'bg-yellow-100 border-yellow-400 text-yellow-800', high: 'bg-red-100 border-red-400 text-red-800' };
              const dots = { low: 'bg-green-500', mid: 'bg-yellow-500', high: 'bg-red-500' };
              return (
                <div key={key} className={`rounded-lg border-2 p-2 text-center ${colors[level]}`}>
                  <div className="text-lg">{icon}</div>
                  <p className="text-xs font-medium mt-1">{label}</p>
                  <div className={`w-3 h-3 rounded-full mx-auto mt-1 ${dots[level]}`} />
                </div>
              );
            })}
          </div>
        </section>

        {/* Search Bar */}
        <section>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); setLoading(true); }}
              placeholder="Search by patient number..."
              className="w-full sm:w-64 px-4 py-3 min-h-[44px] pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setPage(1); setLoading(true); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </section>

        {/* Filter Controls */}
        <section>
          <BilingualLabel
            text={{ en: 'Filter by Status', km: 'តម្រងតាមស្ថានភាព' }}
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange('')}
              className={`px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-full transition-colors ${
                statusFilter === ''
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => handleFilterChange(status)}
                className={`px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-full transition-colors ${
                  statusFilter === status
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </section>

        {/* Patient List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <BilingualLabel labelKey="ui.patients" />
            <button
              onClick={() => {
                setLoading(true);
                fetchPatients();
                fetchCounts();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <BilingualLabel labelKey="ui.no_results" className="justify-center" />
              <Link
                href="/registration"
                className="inline-flex items-center gap-2 mt-4 px-5 py-3 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                Register Patient
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Age
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Gender
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Activities
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedPatients.map((patient) => (
                      <tr key={patient.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/patient/${patient.id}`)}>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">
                          {String(patient.patient_number).padStart(4, '0')}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-blue-700 underline">
                          {patient.family_name} {patient.given_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{patient.age}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                          {patient.gender}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={patient.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <PatientActivities patient={patient} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {paginatedPatients.map((patient) => (
                  <div key={patient.id} onClick={() => router.push(`/patient/${patient.id}`)} className="cursor-pointer">
                    <PatientCard patient={patient}>
                      <PatientActivities patient={patient} />
                    </PatientCard>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} ({patients.length} patients)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * PatientActivities — shows stamps for stations visited + form printed indicator.
 */
function PatientActivities({ patient }) {
  let stations = [];
  try {
    stations = typeof patient.stations_visited === 'string'
      ? JSON.parse(patient.stations_visited || '[]')
      : (patient.stations_visited || []);
  } catch {
    stations = [];
  }

  const stamps = [
    { key: 'Doctor', label: 'GP', icon: '👨‍⚕️' },
    { key: 'Optometry', label: 'Optom', icon: '👁️' },
    { key: 'Refraction', label: 'Refr', icon: '🔬' },
    { key: 'Glasses_Dispensed', label: 'Glass', icon: '👓' },
    { key: 'Ear_Therapy', label: 'Ear', icon: '👂' },
    { key: 'Surgery', label: 'Surg', icon: '🔪' },
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Form printed indicator */}
      <span
        className={`inline-flex items-center gap-0.5 w-12 h-7 rounded text-xs font-medium justify-center ${
          patient.form_printed
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-50 text-gray-300'
        }`}
        title={patient.form_printed ? 'Form printed' : 'Not printed'}
      >
        <span className="w-4 text-center">🖨️</span>
        <span className="w-3 text-center">{patient.form_printed ? '✓' : ''}</span>
      </span>

      {/* Station stamps */}
      {stamps.map(({ key, label, icon }) => {
        const visited = stations.includes(key);
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-0.5 w-12 h-7 rounded text-xs font-medium justify-center ${
              visited
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-50 text-gray-300'
            }`}
            title={visited ? `${label}: attended` : `${label}: not yet`}
          >
            <span className="w-4 text-center">{icon}</span>
            <span className="w-3 text-center">{visited ? '✓' : ''}</span>
          </span>
        );
      })}
    </div>
  );
}
