'use client';

import { useState, useEffect, useRef } from 'react';
import { KeyRound, ShieldCheck, Upload, FileText, Download, Eye, EyeOff } from 'lucide-react';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Passphrase form state
  const [newPassphrase, setNewPassphrase] = useState('');
  const [updatingPassphrase, setUpdatingPassphrase] = useState(false);

  // Change-password state (per row)
  const [editingUserId, setEditingUserId] = useState(null);
  const [pwValue, setPwValue] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [confirmAdminPwd, setConfirmAdminPwd] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassphrase(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setUpdatingPassphrase(true);

    try {
      const res = await fetch('/api/admin/passphrase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: newPassphrase }),
      });

      if (res.ok) {
        setSuccess('Passphrase updated successfully');
        setNewPassphrase('');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to update passphrase');
      }
    } catch (err) {
      console.error('Change passphrase error:', err);
      setError('Failed to update passphrase');
    } finally {
      setUpdatingPassphrase(false);
    }
  }

  function openPasswordEditor(userId) {
    setEditingUserId(userId);
    setPwValue('');
    setPwConfirm('');
    setConfirmAdminPwd('');
    setShowPw(false);
    setError('');
    setSuccess('');
  }

  function cancelPasswordEditor() {
    setEditingUserId(null);
    setPwValue('');
    setPwConfirm('');
    setConfirmAdminPwd('');
    setShowPw(false);
  }

  async function savePassword(userId, username) {
    setError('');
    setSuccess('');

    if (pwValue.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (pwValue !== pwConfirm) {
      setError('New password and confirmation do not match');
      return;
    }
    if (!confirmAdminPwd) {
      setError('Enter your own password to confirm');
      return;
    }

    setSavingPw(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pwValue,
          confirm_password: confirmAdminPwd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(`Password updated for "${username}"`);
        cancelPasswordEditor();
      } else {
        setError(data.error || 'Failed to update password');
      }
    } catch (err) {
      setError('Failed to update password');
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              <BilingualLabel labelKey="admin.title" />
            </h1>
          </div>
          <a
            href="/api/admin/backup"
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Download className="w-4 h-4" />
            Backup DB
          </a>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Admin Users Section — read-only list + per-row Change Password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            <BilingualLabel labelKey="admin.users" />
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            New users are added via direct database access only. The admin
            panel can change passwords for existing users.
          </p>

          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500 text-sm">
              <BilingualLabel labelKey="admin.no_users" />
            </p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 font-medium text-gray-700">
                        <BilingualLabel labelKey="admin.username" />
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">
                        Role
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">
                        Station
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-700">
                        <BilingualLabel labelKey="admin.actions" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <Row
                        key={user.id}
                        user={user}
                        editing={editingUserId === user.id}
                        pwValue={pwValue}
                        setPwValue={setPwValue}
                        pwConfirm={pwConfirm}
                        setPwConfirm={setPwConfirm}
                        confirmAdminPwd={confirmAdminPwd}
                        setConfirmAdminPwd={setConfirmAdminPwd}
                        showPw={showPw}
                        setShowPw={setShowPw}
                        savingPw={savingPw}
                        onEdit={() => openPasswordEditor(user.id)}
                        onCancel={cancelPasswordEditor}
                        onSave={() => savePassword(user.id, user.username)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">{user.username}</span>
                      {editingUserId !== user.id && (
                        <button
                          onClick={() => openPasswordEditor(user.id)}
                          className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <KeyRound className="h-4 w-4" />
                          <span>Password</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Role: <span className="text-gray-700">{user.role}</span>
                      {user.assigned_station && (
                        <> · Station: <span className="text-gray-700">{user.assigned_station}</span></>
                      )}
                    </p>
                    {editingUserId === user.id && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <RowForm
                          pwValue={pwValue} setPwValue={setPwValue}
                          pwConfirm={pwConfirm} setPwConfirm={setPwConfirm}
                          confirmAdminPwd={confirmAdminPwd} setConfirmAdminPwd={setConfirmAdminPwd}
                          showPw={showPw} setShowPw={setShowPw}
                          savingPw={savingPw}
                          onCancel={cancelPasswordEditor}
                          onSave={() => savePassword(user.id, user.username)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Change Passphrase Section (volunteers) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-600" />
            <BilingualLabel labelKey="admin.change_passphrase" />
          </h2>
          <form onSubmit={handleChangePassphrase} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="new-passphrase" className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.new_passphrase').en} / {t('admin.new_passphrase').km}
              </label>
              <input
                id="new-passphrase"
                type="password"
                value={newPassphrase}
                onChange={(e) => setNewPassphrase(e.target.value)}
                required
                className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                placeholder="Enter new passphrase"
                disabled={updatingPassphrase}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={updatingPassphrase}
                className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <KeyRound className="h-4 w-4" />
                {updatingPassphrase ? 'Updating...' : `${t('admin.update').en} / ${t('admin.update').km}`}
              </button>
            </div>
          </form>
          <p className="mt-3 text-xs text-gray-500">
            This changes the shared passphrase used by all volunteers to log in.
          </p>
        </div>

        {/* Template Management */}
        <TemplateManager />
      </div>
    </div>
  );
}

// Per-row component for desktop
function Row({ user, editing, pwValue, setPwValue, pwConfirm, setPwConfirm, confirmAdminPwd, setConfirmAdminPwd, showPw, setShowPw, savingPw, onEdit, onCancel, onSave }) {
  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-3 px-2 text-gray-900 font-medium">
          {user.username}
        </td>
        <td className="py-3 px-2 text-gray-600 text-xs">
          {user.role}
        </td>
        <td className="py-3 px-2 text-gray-600 text-xs">
          {user.assigned_station || '—'}
        </td>
        <td className="py-3 px-2 text-right">
          {editing ? (
            <button
              onClick={onCancel}
              className="px-3 py-2 min-h-[44px] text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </button>
          )}
        </td>
      </tr>
      {editing && (
        <tr className="bg-blue-50/30">
          <td colSpan={4} className="py-3 px-2">
            <RowForm
              pwValue={pwValue} setPwValue={setPwValue}
              pwConfirm={pwConfirm} setPwConfirm={setPwConfirm}
              confirmAdminPwd={confirmAdminPwd} setConfirmAdminPwd={setConfirmAdminPwd}
              showPw={showPw} setShowPw={setShowPw}
              savingPw={savingPw}
              onCancel={onCancel} onSave={onSave}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Inline form shared between desktop row and mobile card
function RowForm({ pwValue, setPwValue, pwConfirm, setPwConfirm, confirmAdminPwd, setConfirmAdminPwd, showPw, setShowPw, savingPw, onCancel, onSave }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            New password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={pwValue}
              onChange={(e) => setPwValue(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2.5 min-h-[44px] pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Confirm new password <span className="text-red-500">*</span>
          </label>
          <input
            type={showPw ? "text" : "password"}
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="w-full px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="Repeat new password"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Your admin password <span className="text-red-500">*</span>
          <span className="ml-1 text-gray-400">(for re-authentication)</span>
        </label>
        <input
          type="password"
          value={confirmAdminPwd}
          onChange={(e) => setConfirmAdminPwd(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full sm:w-1/2 px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          placeholder="Re-enter YOUR current password"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={savingPw}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <KeyRound className="h-4 w-4" />
          {savingPw ? 'Saving…' : 'Save password'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={savingPw}
          className="px-4 py-2.5 min-h-[44px] text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TemplateManager() {
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [templates, setTemplates] = useState([]);
  const fileInputRef = useRef(null);
  const [selectedType, setSelectedType] = useState('registration');

  useEffect(() => {
    fetch('/api/admin/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.data || []))
      .catch(() => {});
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', selectedType);

    try {
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(`✓ ${data.message}`);
        const listRes = await fetch('/api/admin/templates');
        const listData = await listRes.json();
        setTemplates(listData.data || []);
      } else {
        setUploadMsg(`✕ ${data.error}`);
      }
    } catch {
      setUploadMsg('✕ Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        Document Templates
      </h2>

      <div className="mb-4 space-y-2">
        <p className="text-sm text-gray-600">Current active templates:</p>
        {templates.map((tpl) => (
          <div key={tpl.name} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-medium text-gray-700">{tpl.name}</span>
            <span className="text-xs text-gray-400 ml-auto capitalize">{tpl.type}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-medium text-gray-700 mb-3">Upload new template (.docx)</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2.5 min-h-[44px] border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
          >
            <option value="registration">Registration Template</option>
            <option value="surgery">Surgery Template</option>
          </select>

          <label className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Choose File'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {uploadMsg && (
          <p className={`mt-3 text-sm ${uploadMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
            {uploadMsg}
          </p>
        )}

        <p className="mt-3 text-xs text-gray-400">
          Upload a .docx file with placeholders like {'{patient_number}'}, {'{family_name}'}, etc. The previous template is automatically backed up.
        </p>
      </div>
    </div>
  );
}