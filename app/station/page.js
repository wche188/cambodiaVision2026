'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { LogOut, Camera, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function StationPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedPatient, setScannedPatient] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        setSession(data);
        setLoading(false);
        if (!data.role) router.push('/login');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const startScanning = () => {
    setScanning(true);
    setScannedPatient(null);
    setConfirmResult(null);

    setTimeout(async () => {
      if (!scannerRef.current) return;

      const html5Qrcode = new Html5Qrcode('qr-reader');
      scannerInstanceRef.current = html5Qrcode;

      try {
        // Get all cameras and find the rear one
        const cameras = await Html5Qrcode.getCameras();
        let cameraId = null;

        if (cameras && cameras.length > 0) {
          // Look for rear/back/environment camera
          const rearCamera = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('rear') ||
            c.label.toLowerCase().includes('environment')
          );
          cameraId = rearCamera ? rearCamera.id : cameras[cameras.length - 1].id;
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        if (cameraId) {
          await html5Qrcode.start(
            cameraId,
            config,
            (decodedText) => {
              html5Qrcode.stop().then(() => {
                scannerInstanceRef.current = null;
                setScanning(false);
                handleScan(decodedText);
              });
            },
            () => {}
          );
        } else {
          // Fallback to facingMode
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              html5Qrcode.stop().then(() => {
                scannerInstanceRef.current = null;
                setScanning(false);
                handleScan(decodedText);
              });
            },
            () => {}
          );
        }
      } catch (err) {
        console.error('Camera error:', err);
        setScanning(false);
        setConfirmResult({ success: false, message: 'Could not access camera' });
      }
    }, 100);
  };

  const stopScanning = () => {
    if (scannerInstanceRef.current) {
      scannerInstanceRef.current.stop().catch(() => {});
      scannerInstanceRef.current = null;
    }
    setScanning(false);
  };

  const handleScan = async (code) => {
    // QR code contains patient number (e.g. "0001" or a URL like /scan/0001)
    let patientNumber = code;

    // Extract number from URL if it's a full URL
    const urlMatch = code.match(/\/scan\/(\w+)/);
    if (urlMatch) patientNumber = urlMatch[1];

    // Remove leading zeros for search but keep original
    try {
      const res = await fetch(`/api/patients?patient_number=${encodeURIComponent(patientNumber)}`);
      const data = await res.json();

      if (data.data && data.data.length > 0) {
        setScannedPatient(data.data[0]);
      } else {
        setConfirmResult({ success: false, message: `Patient #${patientNumber} not found` });
      }
    } catch {
      setConfirmResult({ success: false, message: 'Error looking up patient' });
    }
  };

  const handleConfirm = async () => {
    if (!scannedPatient || !session?.assignedStation) return;

    setConfirming(true);

    // Check if already registered at this station
    let stations = [];
    try {
      stations = Array.isArray(scannedPatient.stations_visited)
        ? scannedPatient.stations_visited
        : JSON.parse(scannedPatient.stations_visited || '[]');
    } catch {
      stations = [];
    }

    if (stations.includes(session.assignedStation)) {
      setConfirmResult({
        success: false,
        message: `${scannedPatient.given_name || ''} #${scannedPatient.patient_number} has already been registered at ${session.assignedStation}.`,
      });
      setScannedPatient(null);
      setConfirming(false);
      return;
    }

    try {
      const res = await fetch(`/api/patients/${scannedPatient.id}/station`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station: session.assignedStation }),
      });

      if (res.ok) {
        setConfirmResult({
          success: true,
          message: `Registered ${scannedPatient.family_name} ${scannedPatient.given_name || ''} #${scannedPatient.patient_number} to ${session.assignedStation}`,
        });
      } else {
        const err = await res.json();
        setConfirmResult({ success: false, message: err.error || 'Failed to register' });
      }
    } catch {
      setConfirmResult({ success: false, message: 'Network error' });
    }

    setScannedPatient(null);
    setConfirming(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const stationLabel = session?.assignedStation?.replace(/_/g, ' ') || 'Unknown';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-blue-900">Station: {stationLabel}</h1>
            <p className="text-xs text-gray-500">Logged in as {session?.username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Station Busy Level Control */}
        <StationBusyControl station={session?.assignedStation} />
        {/* Result message */}
        {confirmResult && (
          <div className={`p-4 rounded-xl border-2 ${
            confirmResult.success
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center gap-3">
              {confirmResult.success
                ? <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                : <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
              }
              <p className={`text-sm font-medium ${confirmResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {confirmResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Scanned patient — confirm screen or surgery form */}
        {scannedPatient && session?.assignedStation === 'Surgery' && (
          <SurgeryForm
            patient={scannedPatient}
            onCancel={() => setScannedPatient(null)}
            onComplete={(msg) => {
              setConfirmResult({ success: true, message: msg });
              setScannedPatient(null);
            }}
            onError={(msg) => {
              setConfirmResult({ success: false, message: msg });
              setScannedPatient(null);
            }}
          />
        )}

        {scannedPatient && session?.assignedStation !== 'Surgery' && (
          <div className="bg-white rounded-xl border-2 border-blue-200 p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">
                {scannedPatient.family_name} {scannedPatient.given_name}
              </p>
              <p className="text-sm text-gray-500 font-mono">#{scannedPatient.patient_number}</p>
            </div>
            <p className="text-sm text-gray-600">
              Register to <span className="font-bold text-blue-700">{stationLabel}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setScannedPatient(null); }}
                className="flex-1 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400"
              >
                {confirming ? 'Confirming...' : 'Confirm ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Scanner */}
        {scanning && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div id="qr-reader" ref={scannerRef} className="w-full" />
            <button
              onClick={stopScanning}
              className="mt-3 w-full py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel Scan
            </button>
          </div>
        )}

        {/* Scan button — main action */}
        {!scanning && !scannedPatient && (
          <button
            onClick={startScanning}
            className="w-full py-6 bg-blue-600 text-white rounded-2xl text-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <Camera className="w-8 h-8" />
            Scan QR Code
          </button>
        )}

        {/* Manual entry fallback */}
        {!scanning && !scannedPatient && (
          <ManualEntry onLookup={handleScan} />
        )}
      </main>
    </div>
  );
}

function ManualEntry({ onLookup }) {
  const [number, setNumber] = useState('');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500 mb-2">Or enter patient number manually:</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="e.g. 0001"
          className="flex-1 px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg text-gray-900"
        />
        <button
          onClick={() => { if (number.trim()) onLookup(number.trim()); }}
          className="px-5 py-3 min-h-[44px] bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Look up
        </button>
      </div>
    </div>
  );
}

function StationBusyControl({ station }) {
  const [level, setLevel] = useState('mid');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!station) return;
    fetch('/api/stations/status')
      .then(r => r.json())
      .then(d => { if (d.data?.[station]) setLevel(d.data[station]); })
      .catch(() => {});
  }, [station]);

  const changeLevel = async (newLevel) => {
    setLevel(newLevel);
    setSaving(true);
    try {
      await fetch('/api/stations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station, level: newLevel }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const levels = [
    { key: 'low', label: 'Low', color: 'bg-green-500', ring: 'ring-green-300' },
    { key: 'mid', label: 'Mid', color: 'bg-yellow-500', ring: 'ring-yellow-300' },
    { key: 'high', label: 'Busy', color: 'bg-red-500', ring: 'ring-red-300' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-700 mb-3">Queue Status</p>
      <div className="flex gap-2">
        {levels.map(({ key, label, color, ring }) => (
          <button
            key={key}
            onClick={() => changeLevel(key)}
            disabled={saving}
            className={`flex-1 py-3 min-h-[44px] rounded-lg text-sm font-bold text-white transition-all ${color} ${
              level === key ? `ring-4 ${ring} scale-105` : 'opacity-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SurgeryForm({ patient, onCancel, onComplete, onError }) {
  const [eye, setEye] = useState('');
  const [procedureType, setProcedureType] = useState([]);
  const [iolType, setIolType] = useState([]);
  const [incisionType, setIncisionType] = useState([]);
  const [alsoUsed, setAlsoUsed] = useState([]);
  const [complications, setComplications] = useState([]);
  const [surgeonId, setSurgeonId] = useState('');
  const [notes, setNotes] = useState('');
  const [surgeons, setSurgeons] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/surgeons')
      .then(r => r.json())
      .then(d => setSurgeons(d.data || []))
      .catch(() => {});
  }, []);

  const toggleArray = (arr, setArr, value) => {
    if (arr.includes(value)) setArr(arr.filter(v => v !== value));
    else setArr([...arr, value]);
  };

  const handleSubmit = async () => {
    if (!eye) { onError('Please select which eye'); return; }
    if (!surgeonId) { onError('Please select a surgeon'); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}/surgery-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eye,
          procedure_type: procedureType,
          iol_type: iolType,
          incision: incisionType,
          also_used: alsoUsed,
          complications,
          surgeon_id: parseInt(surgeonId),
          surgeon_notes: notes,
        }),
      });
      if (res.ok) {
        onComplete(`Surgery recorded for ${patient.family_name} ${patient.given_name || ''} #${patient.patient_number}`);
      } else {
        const err = await res.json();
        onError(err.error || 'Failed to record surgery');
      }
    } catch {
      onError('Network error');
    }
    setSubmitting(false);
  };

  const TickBox = ({ label, checked, onChange }) => (
    <button
      type="button"
      onClick={onChange}
      className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium border-2 transition-all ${
        checked
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-gray-200 text-gray-600 hover:border-blue-300'
      }`}
    >
      {checked ? '☑' : '☐'} {label}
    </button>
  );

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 p-5 space-y-4 max-h-[80vh] overflow-y-auto">
      {/* Patient info */}
      <div className="text-center pb-3 border-b border-gray-100">
        <p className="text-lg font-bold text-gray-900">
          {patient.family_name} {patient.given_name}
        </p>
        <p className="text-sm text-gray-500 font-mono">#{patient.patient_number}</p>
        <p className="text-sm font-medium text-blue-700 mt-1">Surgery Record</p>
      </div>

      {/* Eye selection */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Eye *</p>
        <div className="flex gap-2">
          {['left', 'right', 'both'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setEye(opt)}
              className={`flex-1 py-3 min-h-[44px] rounded-lg text-sm font-medium border-2 transition-all capitalize ${
                eye === opt
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {opt === 'left' ? 'L' : opt === 'right' ? 'R' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      {/* Procedure */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Procedure</p>
        <div className="flex flex-wrap gap-2">
          {['ECCE', 'SIECCE', 'PHACO', 'PTERYGIUM'].map(opt => (
            <TickBox
              key={opt}
              label={opt}
              checked={procedureType.includes(opt)}
              onChange={() => toggleArray(procedureType, setProcedureType, opt)}
            />
          ))}
        </div>
      </div>

      {/* IOL Type */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">IOL Type</p>
        <div className="flex gap-2">
          {['ACIOL', 'PCIOL'].map(opt => (
            <TickBox
              key={opt}
              label={opt}
              checked={iolType.includes(opt)}
              onChange={() => toggleArray(iolType, setIolType, opt)}
            />
          ))}
        </div>
      </div>

      {/* Incision */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Incision</p>
        <div className="flex flex-wrap gap-2">
          {['Temporal Cornea', 'Superior Cornea'].map(opt => (
            <TickBox
              key={opt}
              label={opt}
              checked={incisionType.includes(opt)}
              onChange={() => toggleArray(incisionType, setIncisionType, opt)}
            />
          ))}
        </div>
      </div>

      {/* Also Used */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Also Used</p>
        <div className="flex flex-wrap gap-2">
          {['Vision Blue', 'Sutures', 'Miostat', 'Other'].map(opt => (
            <TickBox
              key={opt}
              label={opt}
              checked={alsoUsed.includes(opt)}
              onChange={() => toggleArray(alsoUsed, setAlsoUsed, opt)}
            />
          ))}
        </div>
      </div>

      {/* Complications */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Complications</p>
        <div className="flex flex-wrap gap-2">
          {['Post Capsular Rupture', 'Vitreous Loss', 'Vitrectomy', 'Iris Prolapse', 'Flat/Shallow AC'].map(opt => (
            <TickBox
              key={opt}
              label={opt}
              checked={complications.includes(opt)}
              onChange={() => toggleArray(complications, setComplications, opt)}
            />
          ))}
        </div>
      </div>

      {/* Surgeon dropdown */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Performed by *</p>
        <select
          value={surgeonId}
          onChange={(e) => setSurgeonId(e.target.value)}
          className="w-full px-4 py-3 min-h-[44px] border border-gray-300 rounded-lg text-gray-900 bg-white"
        >
          <option value="">-- Select Surgeon --</option>
          {surgeons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Surgeon notes */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Surgeon Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional notes..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 resize-none"
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="flex-1 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {submitting ? 'Saving...' : 'Record Surgery ✓'}
        </button>
      </div>
    </div>
  );
}
