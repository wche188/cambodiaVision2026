/**
 * Patient Station Tracking
 *
 * After registration, a patient can visit any station in any order:
 *   - Doctor
 *   - Optometry
 *   - Refraction (eye measurement for glasses)
 *   - Glasses_Dispensed (glasses given after refraction)
 *   - Ear Therapy
 *   - Surgery
 *
 * Soft warnings only (no blocking):
 *   - Surgery warns if Doctor/Optometry not done
 *   - Glasses warns if Refraction not done
 */

export const STATIONS = ['Doctor', 'Optometry', 'Refraction', 'Glasses_Dispensed', 'Ear_Therapy', 'Surgery'];

export const STATION_INFO = {
  Doctor: { label: 'Doctor', km: '\u179C\u17C1\u1787\u17D2\u1787\u1794\u178E\u17D2\u178C\u17B7\u178F', icon: '\u{1F468}\u200D\u2695\uFE0F' },
  Optometry: { label: 'Optometry', km: '\u1796\u17B7\u1793\u17B7\u178F\u17D2\u1799\u1797\u17D2\u1793\u17C2\u1780', icon: '\u{1F441}\uFE0F' },
  Refraction: { label: 'Refraction', km: '\u179C\u17B6\u179F\u17CB\u179C\u17C2\u1793\u178F\u17B6', icon: '\u{1F52C}' },
  Glasses_Dispensed: { label: 'Glasses', km: '\u1790\u17D2\u1793\u17B6\u1780\u17CB\u179C\u17C2\u1793\u178F\u17B6', icon: '\u{1F453}' },
  Ear_Therapy: { label: 'Ear Therapy', km: '\u1796\u17D2\u1799\u17B6\u1794\u17B6\u179B\u178F\u17D2\u179A\u1785\u17C0\u1780', icon: '\u{1F442}' },
  Surgery: { label: 'Surgery', km: '\u179C\u17C7\u1780\u17B6\u178F\u17CB', icon: '\u{1FA7A}' },
};

/**
 * Check if surgery has a warning (Doctor or Optometry not done).
 */
export function checkSurgeryWarning(stationsVisited) {
  const missing = [];
  if (!stationsVisited.includes('Doctor')) missing.push('Doctor');
  if (!stationsVisited.includes('Optometry')) missing.push('Optometry');
  return { warn: missing.length > 0, missing };
}

/**
 * Check if glasses dispensed has a warning (Refraction not done).
 */
export function checkGlassesWarning(stationsVisited) {
  if (!stationsVisited.includes('Refraction')) {
    return { warn: true, missing: ['Refraction'] };
  }
  return { warn: false, missing: [] };
}
