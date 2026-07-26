'use client';

import { t } from '@/lib/translations';

/**
 * BilingualLabel — renders English text primary (larger/bold) and Khmer text secondary (smaller/lighter).
 * 
 * @param {Object} props
 * @param {string} [props.labelKey] - Translation key to look up in translations.js
 * @param {{ en: string, km: string }} [props.text] - Direct text object with en/km values
 * @param {string} [props.className] - Additional CSS classes
 */
export default function BilingualLabel({ labelKey, text, className = '' }) {
  const translation = labelKey ? t(labelKey) : text;

  if (!translation) return null;

  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className="text-sm font-semibold text-gray-900">{translation.en}</span>
      <span className="text-xs text-gray-500 font-khmer">{translation.km}</span>
    </span>
  );
}
