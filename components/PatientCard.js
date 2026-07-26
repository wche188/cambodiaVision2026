'use client';

import { User, Calendar, Phone } from 'lucide-react';
import StatusBadge from './StatusBadge';
import BilingualLabel from './BilingualLabel';

/**
 * PatientCard — mobile-friendly card view for a patient.
 * 
 * @param {Object} props
 * @param {Object} props.patient - Patient data object
 * @param {number} props.patient.id
 * @param {string|number} props.patient.patient_number
 * @param {string} props.patient.family_name
 * @param {string} props.patient.given_name
 * @param {number} props.patient.age
 * @param {string} props.patient.gender
 * @param {string} props.patient.status
 * @param {string} props.patient.registration_date
 * @param {React.ReactNode} [props.children] - Optional action buttons
 * @param {string} [props.className] - Additional CSS classes
 */
export default function PatientCard({ patient, children, className = '' }) {
  const formattedNumber = String(patient.patient_number).padStart(4, '0');
  const formattedDate = patient.registration_date
    ? new Date(patient.registration_date).toLocaleDateString()
    : '—';

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 min-w-0 ${className}`}>
      {/* Header: patient number + status */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono text-gray-500">#{formattedNumber}</span>
        <StatusBadge status={patient.status} />
      </div>

      {/* Patient info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-base font-semibold text-gray-900">
            {patient.family_name} {patient.given_name}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{patient.age} yrs</span>
          <span className="capitalize">{patient.gender}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4 flex-shrink-0" />
          <BilingualLabel labelKey="ui.date" />
          <span className="ml-1">{formattedDate}</span>
        </div>
      </div>

      {/* Actions area */}
      {children && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
