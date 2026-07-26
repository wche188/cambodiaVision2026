'use client';

import {
  ClipboardList,
  Printer,
  Stethoscope,
  CheckCircle,
} from 'lucide-react';

/**
 * DashboardSummary — clean summary cards for patient statuses.
 */

const STATUS_CONFIG = [
  {
    key: 'Registered',
    label: 'Registered',
    km: 'បានចុះឈ្មោះ',
    icon: ClipboardList,
    color: 'blue',
  },
  {
    key: 'Form_Printed',
    label: 'Form Printed',
    km: 'បោះពុម្ព',
    icon: Printer,
    color: 'green',
  },
  {
    key: 'Prepare_for_Surgery',
    label: 'Prep for Surgery',
    km: 'រៀបចំវះកាត់',
    icon: Stethoscope,
    color: 'purple',
  },
  {
    key: 'Surgery_Completed',
    label: 'Surgery Done',
    km: 'វះកាត់រួច',
    icon: CheckCircle,
    color: 'slate',
  },
];

const COLORS = {
  blue: { bg: 'bg-blue-50 border-blue-100', icon: 'text-blue-600', count: 'text-blue-800' },
  green: { bg: 'bg-emerald-50 border-emerald-100', icon: 'text-emerald-600', count: 'text-emerald-800' },
  purple: { bg: 'bg-violet-50 border-violet-100', icon: 'text-violet-600', count: 'text-violet-800' },
  slate: { bg: 'bg-slate-50 border-slate-100', icon: 'text-slate-600', count: 'text-slate-800' },
};

export default function DashboardSummary({ counts = {}, className = '' }) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Total count */}
      <div className="bg-white rounded-xl border border-blue-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Total Patients Today</p>
          <p className="text-3xl font-bold text-blue-900">{total}</p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_CONFIG.map(({ key, label, km, icon: Icon, color }) => {
          const count = counts[key] || 0;
          const c = COLORS[color];
          return (
            <div key={key} className={`${c.bg} rounded-xl border p-4 text-center`}>
              <Icon className={`w-5 h-5 ${c.icon} mx-auto mb-2`} />
              <p className={`text-2xl font-bold ${c.count}`}>{count}</p>
              <p className="text-xs font-medium text-gray-600 mt-1">{label}</p>
              <p className="text-xs text-gray-400">{km}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
