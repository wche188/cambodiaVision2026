'use client';

/**
 * StatusBadge — colored pill/badge for patient status.
 */

const STATUS_STYLES = {
  Registered: 'bg-blue-100 text-blue-800',
  Form_Printed: 'bg-green-100 text-green-800',
  Prepare_for_Surgery: 'bg-purple-100 text-purple-800',
  Surgery_Completed: 'bg-slate-100 text-slate-800',
  // Legacy statuses (for existing data)
  In_Progress: 'bg-amber-100 text-amber-800',
  Seen_by_GP: 'bg-amber-100 text-amber-800',
  Surgery_Eligible: 'bg-green-100 text-green-800',
  Not_Eligible: 'bg-red-100 text-red-800',
  Surgery_Scheduled: 'bg-purple-100 text-purple-800',
  Complete: 'bg-slate-100 text-slate-800',
};

const STATUS_LABELS = {
  Registered: 'Registered',
  Form_Printed: 'Form Printed',
  Prepare_for_Surgery: 'Prep for Surgery',
  Surgery_Completed: 'Surgery Done',
  // Legacy
  In_Progress: 'In Progress',
  Seen_by_GP: 'Seen by GP',
  Surgery_Eligible: 'Surgery Eligible',
  Not_Eligible: 'Not Eligible',
  Surgery_Scheduled: 'Surgery Scheduled',
  Complete: 'Complete',
};

export default function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-800';
  const label = STATUS_LABELS[status] || (status || '').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}
    >
      {label}
    </span>
  );
}
