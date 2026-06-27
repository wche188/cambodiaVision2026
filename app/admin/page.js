'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, Trash2, KeyRound, ShieldCheck, Upload, FileText } from 'lucide-react';
import BilingualLabel from '@/app/components/BilingualLabel';
import { t } from '@/lib/translations';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [addingUser, setAddingUser] = useState(false);

  // Passphrase form state
  const [newPassphrase, setNewPassphrase] = useState('');
  const [updatingPassphrase, setUpdatingPassphrase] = useState(false);

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

  async function handleAddUser(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAddingUser(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          full_name: newFullName || null,
        }),
      });

      if (res.ok) {
        setSuccess('User created successfully');
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        fetchUsers();
      } else if (res.status === 409) {
        setError('Username already exists');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Add user error:', err);
      setError('Failed to create user');
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(userId, username) {
    const confirmMsg = t('admin.confirm_delete');
    if (!confirm(`${confirmMsg.en}\n${confirmMsg.km}`)) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setSuccess(`User "${username}" deleted`);
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      console.error('Delete user error:', err);
      setError('Failed to delete user');
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            <BilingualLabel labelKey="admin.title" />
          </h1>
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

        {/* Admin Users Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <BilingualLabel labelKey="admin.users" />
          </h2>

          {/* Users Table */}
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
                        <BilingualLabel labelKey="admin.full_name" />
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-gray-700">
                        <BilingualLabel labelKey="admin.created_at" />
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-gray-700">
                        <BilingualLabel labelKey="admin.actions" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-gray-900 font-medium">
                          {user.username}
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {user.full_name || '—'}
                        </td>
                        <td className="py-3 px-2 text-gray-600">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>{t('admin.delete').en}</span>
                          </button>
                        </td>
                      </tr>
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
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{t('admin.delete').en}</span>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600">{user.full_name || '—'}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add User Form */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <BilingualLabel labelKey="admin.add_user" />
            </h3>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="new-username" className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.username').en} / {t('admin.username').km}
                </label>
                <input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Username"
                  disabled={addingUser}
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.password').en} / {t('admin.password').km}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Password"
                  disabled={addingUser}
                />
              </div>
              <div>
                <label htmlFor="new-fullname" className="block text-xs font-medium text-gray-600 mb-1">
                  {t('admin.full_name').en} / {t('admin.full_name').km}
                </label>
                <input
                  id="new-fullname"
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Full Name (optional)"
                  disabled={addingUser}
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={addingUser}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <UserPlus className="h-4 w-4" />
                  {addingUser ? 'Adding...' : `${t('admin.add_user').en} / ${t('admin.add_user').km}`}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Passphrase Section */}
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
                className="w-full px-3 py-3 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
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
        // Refresh template list
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" />
        Document Templates
      </h2>

      {/* Current templates */}
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

      {/* Upload new template */}
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
