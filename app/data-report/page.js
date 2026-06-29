'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Users, Stethoscope, Eye, Ear, Scissors, Glasses, Download, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DataReport() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Detect admin role for nav button
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s && s.role === 'admin') setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/patients/report');
      const json = await res.json();
      if (json.data) setData(json.data);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  // Combine daily data for the chart
  const chartData = (() => {
    if (!data) return [];
    const dateMap = {};

    // Fill last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dateMap[key] = { date: key, registrations: 0, surgeries: 0, glasses: 0, ear: 0, optometry: 0, doctor: 0 };
    }

    if (data.dailyRegistrations) {
      data.dailyRegistrations.forEach(r => {
        if (dateMap[r.date]) dateMap[r.date].registrations = r.count;
      });
    }
    if (data.dailySurgeries) {
      data.dailySurgeries.forEach(r => {
        if (dateMap[r.date]) dateMap[r.date].surgeries = r.count;
      });
    }
    if (data.stationDailyMap) {
      Object.entries(data.stationDailyMap).forEach(([date, stations]) => {
        if (dateMap[date]) {
          dateMap[date].glasses = stations['Glasses_Dispensed'] || 0;
          dateMap[date].ear = stations['Ear_Therapy'] || 0;
          dateMap[date].optometry = stations['Optometry'] || 0;
          dateMap[date].doctor = stations['Doctor'] || 0;
        }
      });
    }

    return Object.values(dateMap).map(d => ({
      ...d,
      label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    }));
  })();

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-blue-900">Mission Report</h1>
              <p className="text-xs text-gray-500">Cambodia Vision 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
            <a
              href="/api/admin/backup"
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
            >
              <Download className="w-4 h-4" />
              Backup
            </a>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Today's highlights */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-blue-600 text-white rounded-xl p-5">
            <p className="text-sm opacity-80">Total Registered</p>
            <p className="text-4xl font-bold mt-1">{data?.totalRegistrations || 0}</p>
          </div>
          <div className="bg-green-600 text-white rounded-xl p-5">
            <p className="text-sm opacity-80">Surgeries Done</p>
            <p className="text-4xl font-bold mt-1">{data?.surgeryCount || 0}</p>
          </div>
        </section>

        {/* Detailed Stats */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Totals</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={Users} label="Registrations" value={data?.totalRegistrations || 0} color="blue" />
            <StatCard icon={Users} label="Male" value={data?.maleCount || 0} color="sky" />
            <StatCard icon={Users} label="Female" value={data?.femaleCount || 0} color="pink" />
            <StatCard icon={Users} label="Child" value={data?.childCount || 0} color="purple" />
            <StatCard icon={Glasses} label="Glasses Dispensed" value={data?.glassesCount || 0} color="amber" />
            <StatCard icon={Scissors} label="Surgery" value={data?.surgeryCount || 0} color="green" />
            <StatCard icon={Ear} label="Ear Treatment" value={data?.earCount || 0} color="orange" />
            <StatCard icon={Stethoscope} label="Doctor" value={data?.doctorCount || 0} color="teal" />
            <StatCard icon={Eye} label="Optometry" value={data?.optometryCount || 0} color="indigo" />
          </div>
        </section>

        {/* Daily Performance Graph */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Performance (Last 14 Days)</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="registrations" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Registrations" />
                <Line type="monotone" dataKey="doctor" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} name="Doctor" />
                <Line type="monotone" dataKey="optometry" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Optometry" />
                <Line type="monotone" dataKey="glasses" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Glasses" />
                <Line type="monotone" dataKey="ear" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} name="Ear" />
                <Line type="monotone" dataKey="surgeries" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Surgery" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Summary */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="space-y-2 text-sm">
            <SummaryRow label="Total Patients Registered" value={data?.totalRegistrations || 0} />
            <SummaryRow label="Gender" value={`${data?.maleCount || 0} Male, ${data?.femaleCount || 0} Female, ${data?.childCount || 0} Children`} />
            <SummaryRow label="Seen by Doctor" value={data?.doctorCount || 0} />
            <SummaryRow label="Seen by Optometry" value={data?.optometryCount || 0} />
            <SummaryRow label="Glasses Dispensed" value={data?.glassesCount || 0} />
            <SummaryRow label="Ear Treatments" value={data?.earCount || 0} />
            <SummaryRow label="Surgeries Performed" value={data?.surgeryCount || 0} />
          </div>
        </section>
      </main>
    </div>
  );
}

const COLORS = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-lg border p-3 ${COLORS[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-600">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}
