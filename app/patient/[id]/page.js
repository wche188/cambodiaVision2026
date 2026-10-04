'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, User, Phone, MapPin, Calendar, FileText, Loader2, Scissors, Eye, AlertCircle, Stethoscope, Paperclip, Upload, Camera, Edit2, Trash2, Download, X, Check } from 'lucide-react';
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
  const canUploadAttachment = isAdmin || isStationManager;
  const canEditAttachmentNote = isAdmin;
  const canDeleteAttachment = isAdmin;

  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');

  const fetchAttachments = useCallback(async () => {
    setAttachmentsLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}/attachments`);
      if (res.ok) {
        const json = await res.json();
        setAttachments(json.data || []);
      }
    } catch (e) {
      console.error('Error fetching attachments:', e);
    } finally {
      setAttachmentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

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
            {/* Patient Photo (clickable for admin to retake) */}
            <div
              className={`w-40 h-40 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center border border-gray-200 relative group ${isAdmin ? 'cursor-pointer' : ''}`}
              onClick={() => isAdmin && setShowPhotoDialog(true)}
              title={isAdmin ? 'Click to retake / upload photo' : undefined}
            >
              {patient.photo ? (
                <img
                  src={patient.photo}
                  alt={`${patient.given_name} ${patient.family_name}`}
                  className="object-cover w-full h-full"
                />
              ) : (
                <User className="h-16 w-16 text-gray-300" />
              )}
              {isAdmin && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Camera className="h-8 w-8 text-white" />
                </div>
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

        {/* Surgery Information (only after a surgery has been recorded) */}
        {patient.surgery_records && patient.surgery_records.length > 0 && (
          <SurgeryInformation surgeries={patient.surgery_records} />
        )}

        {/* Attachments — uploaded files for this patient (always shown) */}
        <AttachmentsSection
          attachments={attachments}
          loading={attachmentsLoading}
          canUpload={canUploadAttachment}
          canEditNote={canEditAttachmentNote}
          canDelete={canDeleteAttachment}
          patientId={id}
          onUploaded={() => fetchAttachments()}
          onDeleted={() => fetchAttachments()}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          editingNoteValue={editingNoteValue}
          setEditingNoteValue={setEditingNoteValue}
        />
      </main>

      {showPhotoDialog && isAdmin && (
        <PhotoDialog
          patientId={id}
          hasPhoto={!!patient.photo}
          onClose={() => setShowPhotoDialog(false)}
          onUpdated={(newPhoto) => {
            setPatient(prev => prev ? { ...prev, photo: newPhoto } : prev);
            setShowPhotoDialog(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Photo retake / upload dialog (admin only)
// ============================================================
function PhotoDialog({ patientId, hasPhoto, onClose, onUpdated }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Downscale images > 1280px so we don't ship 5MB base64 blobs to the DB
      const processed = await downscaleImage(file, 1280, 0.85);
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(processed);
      });
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: dataUrl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Upload failed (HTTP ${res.status})`);
      }
      const json = await res.json();
      onUpdated(json.data?.photo || dataUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove the patient photo?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Remove failed (HTTP ${res.status})`);
      }
      onUpdated(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {hasPhoto ? 'Replace photo' : 'Add photo'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {/* Camera capture (mobile) */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left"
          >
            <Camera className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">Take photo</p>
              <p className="text-xs text-gray-500">Use the camera (mobile)</p>
            </div>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {/* Upload from device */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left"
          >
            <Upload className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="font-medium text-gray-900">Upload from device</p>
              <p className="text-xs text-gray-500">Choose an image file</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            className="hidden"
          />

          {hasPhoto && (
            <button
              onClick={handleRemove}
              disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-3 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 text-left"
            >
              <Trash2 className="w-5 h-5 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Remove photo</p>
                <p className="text-xs text-red-500">Deletes the current photo</p>
              </div>
            </button>
          )}

          {busy && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Working...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Downscale an image to max width × max height using canvas, with JPEG quality.
// Returns a Promise<File>.
async function downscaleImage(file, maxSide, quality) {
  if (!file.type.startsWith('image/')) return file;
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new window.Image();
    i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = reject;
    i.src = url;
  });
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w0, h0));
  if (scale >= 1 && file.size < 1.5 * 1024 * 1024) {
    // No need to downscale
    return file;
  }
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

// ============================================================
// Attachments section
// ============================================================
function AttachmentsSection({
  attachments, loading, canUpload, canEditNote, canDelete, patientId,
  onUploaded, onDeleted, editingNoteId, setEditingNoteId,
  editingNoteValue, setEditingNoteValue,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [category, setCategory] = useState('document');
  const [noteDraft, setNoteDraft] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/patients/${patientId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          data: dataUrl,
          category,
          note: noteDraft.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Upload failed (HTTP ${res.status})`);
      }
      setNoteDraft('');
      e.target.value = '';
      onUploaded();
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const startEditNote = (att) => {
    setEditingNoteId(att.id);
    setEditingNoteValue(att.note || '');
  };

  const saveNote = async (att) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/attachments/${att.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: editingNoteValue }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Save failed (HTTP ${res.status})`);
      }
      setEditingNoteId(null);
      onUploaded(); // refresh
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (att) => {
    if (!confirm(`Delete "${att.file_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/patients/${patientId}/attachments/${att.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Delete failed (HTTP ${res.status})`);
      }
      onDeleted();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <section
      data-testid="attachments-section"
      className="bg-amber-50 rounded-xl border border-amber-200 p-6"
    >
      <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
        <Paperclip className="w-5 h-5" />
        Attachments
        <span className="text-sm font-normal text-amber-700">ឯកសារភ្ជាប់</span>
        <span className="ml-auto text-xs font-normal text-amber-600">
          {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
        </span>
      </h2>

      {canUpload && (
        <div className="mb-4 p-3 bg-white border border-amber-200 rounded-lg">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                disabled={uploading}
              >
                <option value="document">Document (PDF, DOCX, etc.)</option>
                <option value="note">Note (text/markdown)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-[2]">
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="e.g. Pre-op retinal scan"
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                disabled={uploading}
              />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload file'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
          />
          {uploadError && (
            <p className="mt-2 text-sm text-red-600">{uploadError}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Max 5 MB. Documents, notes, and images are stored in the patient record.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading attachments...
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <AttachmentItem
              key={att.id}
              att={att}
              patientId={patientId}
              canEditNote={canEditNote}
              canDelete={canDelete}
              isEditingNote={editingNoteId === att.id}
              noteValue={editingNoteValue}
              setNoteValue={setEditingNoteValue}
              onStartEditNote={() => startEditNote(att)}
              onCancelEditNote={() => setEditingNoteId(null)}
              onSaveNote={() => saveNote(att)}
              onDelete={() => handleDelete(att)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AttachmentItem({
  att, patientId, canEditNote, canDelete,
  isEditingNote, noteValue, setNoteValue,
  onStartEditNote, onCancelEditNote, onSaveNote, onDelete,
}) {
  const isImage = (att.mime_type || '').startsWith('image/');
  const sizeKb = (att.size_bytes / 1024).toFixed(1);
  const dateLabel = att.created_at
    ? new Date(att.created_at).toLocaleString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
    : '';

  const categoryColor = {
    document: 'bg-blue-100 text-blue-700',
    note: 'bg-yellow-100 text-yellow-700',
    other: 'bg-gray-100 text-gray-700',
  }[att.category] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white border border-amber-200 rounded-lg p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {isImage ? (
          <img
            src={`/api/patients/${patientId}/attachments/${att.id}`}
            alt={att.file_name}
            className="w-12 h-12 object-cover rounded border border-gray-200 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-gray-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 truncate">{att.file_name}</p>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColor}`}>{att.category}</span>
            <span className="text-xs text-gray-400">{sizeKb} KB</span>
            {dateLabel && <span className="text-xs text-gray-400">· {dateLabel}</span>}
          </div>

          {/* Note — view or edit (admin only) */}
          {isEditingNote ? (
            <div className="mt-2 flex gap-1">
              <input
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveNote();
                  if (e.key === 'Escape') onCancelEditNote();
                }}
              />
              <button onClick={onSaveNote} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={onCancelEditNote} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <p className={`text-xs ${att.note ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                {att.note || 'No note'}
              </p>
              {canEditNote && (
                <button
                  onClick={onStartEditNote}
                  className="p-0.5 text-gray-400 hover:text-blue-600 rounded"
                  title="Edit note"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {att.uploaded_by && (
            <p className="text-xs text-gray-400 mt-0.5">uploaded by {att.uploaded_by}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={`/api/patients/${patientId}/attachments/${att.id}`}
            download={att.file_name}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete (admin only)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Surgery Information — appears once a surgery has been recorded
// ============================================================
function SurgeryInformation({ surgeries }) {
  return (
    <section
      data-testid="surgery-information"
      className="bg-purple-50 rounded-xl border border-purple-200 p-6"
    >
      <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
        <Scissors className="w-5 h-5" />
        Surgery Information
        <span className="text-sm font-normal text-purple-700">ព័ត៌មានវះកាត់</span>
        <span className="ml-auto text-xs font-normal text-purple-600">
          {surgeries.length} {surgeries.length === 1 ? 'surgery' : 'surgeries'} performed
        </span>
      </h2>

      <div className="space-y-4">
        {surgeries.map((s, idx) => (
          <SurgeryCard key={s.id} surgery={s} index={surgeries.length > 1 ? idx + 1 : null} />
        ))}
      </div>
    </section>
  );
}

function SurgeryCard({ surgery, index }) {
  const proc = toArray(surgery.procedure_type);
  const iol = toArray(surgery.iol_type);
  const incision = toArray(surgery.incision);
  const alsoUsed = toArray(surgery.also_used);
  const complications = toArray(surgery.complications);
  const eyeLabel = surgery.eye ? surgery.eye.charAt(0).toUpperCase() + surgery.eye.slice(1) : '—';
  const dateLabel = surgery.created_at
    ? new Date(surgery.created_at).toLocaleString('en-GB', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div className="bg-white rounded-lg border border-purple-200 p-4 shadow-sm">
      <div className="flex items-start justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700">
            <Scissors className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {index ? `Surgery #${index}` : 'Surgery'}
            </p>
            <p className="text-xs text-gray-500">{dateLabel}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
          <Eye className="w-3 h-3" />
          {eyeLabel} eye
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <SurgeryField label="Procedure" value={proc} kind="list" />
        <SurgeryField label="IOL" value={iol} kind="list" />
        <SurgeryField label="Incision" value={incision} kind="list" />
        <SurgeryField label="Also Used" value={alsoUsed} kind="list" />
        <SurgeryField
          label="Complications"
          value={complications}
          kind="list"
          tone={complications.length > 0 ? 'warning' : 'muted'}
          full
        />
        <div>
          <p className="text-xs text-gray-500">Surgeon</p>
          <p className="text-sm font-medium text-gray-900 mt-0.5 flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-gray-400" />
            {surgery.surgeon_name || `Surgeon #${surgery.surgeon_id}`}
            {surgery.surgeon_active === 0 && (
              <span className="text-xs text-gray-400 font-normal">(inactive)</span>
            )}
          </p>
        </div>
        {surgery.surgeon_notes && (
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-500">Surgeon Notes</p>
            <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{surgery.surgeon_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SurgeryField({ label, value, kind = 'text', tone, full = false }) {
  const arr = kind === 'list' ? (Array.isArray(value) ? value : value ? [value] : []) : null;
  const isWarning = tone === 'warning';
  const isMuted = tone === 'muted';
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="text-xs text-gray-500">{label}</p>
      {kind === 'list' ? (
        arr && arr.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-1">
            {arr.map((v, i) => (
              <span
                key={i}
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  isWarning
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {String(v)}
              </span>
            ))}
          </div>
        ) : (
          <p className={`text-sm mt-0.5 ${isMuted ? 'text-gray-400' : 'text-gray-900'}`}>
            {isMuted ? 'None' : '—'}
          </p>
        )
      ) : (
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</p>
      )}
    </div>
  );
}

// Coerce scalar/array/JSON to a flat array of strings for display
function toArray(v) {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map(x => x == null ? '' : String(x)).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    if (s[0] === '[') {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(x => String(x)).filter(Boolean);
      } catch {}
    }
    return [s];
  }
  return [String(v)];
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
