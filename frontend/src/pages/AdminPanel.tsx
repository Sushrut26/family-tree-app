import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Shield,
  Users,
  Activity,
  Key,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import type { AuditLog, User } from '../types';

// Schemas
const familyPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FamilyPasswordFormData = z.infer<typeof familyPasswordSchema>;

type TabType = 'users' | 'audit' | 'settings';

interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}

export function AdminPanel() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [isLoading, setIsLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const auditPageSize = 10;

  // Family password form
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const familyPasswordForm = useForm<FamilyPasswordFormData>({
    resolver: zodResolver(familyPasswordSchema),
  });

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await api.get<User[]>('/auth/users');
      setUsers(response.data);
    } catch {
      // If endpoint doesn't exist, just set empty
      setUsers([]);
      console.log('Users endpoint not available');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async (page = 1) => {
    setAuditLoading(true);
    try {
      const response = await api.get<AuditLogResponse>('/audit', {
        params: { limit: auditPageSize, offset: (page - 1) * auditPageSize },
      });
      setAuditLogs(response.data.logs || []);
      setAuditTotalPages(Math.max(1, Math.ceil(response.data.total / auditPageSize)));
      setAuditPage(page);
    } catch {
      showToast('Failed to load audit logs', 'error');
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [showToast]);

  // Handle family password change
  const handleFamilyPasswordChange = async (data: FamilyPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.put('/family-config/update', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      showToast('Family password updated successfully!', 'success');
      familyPasswordForm.reset();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle promote/demote user
  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
      await api.put(`/auth/users/${userId}/role`, { role: newRole });
      showToast(`User role updated to ${newRole}`, 'success');
      fetchUsers();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'audit') {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchUsers, fetchAuditLogs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAuditDetails = (log: AuditLog) => {
    const data = log.actionType === 'DELETE' ? log.oldData : log.newData;
    if (!data) return '-';

    if (log.entityType === 'PERSON') {
      const firstName = data.firstName as string | undefined;
      const lastName = data.lastName as string | undefined;
      const label = [firstName, lastName].filter(Boolean).join(' ').trim();
      return label || '-';
    }

    if (log.entityType === 'RELATIONSHIP') {
      const relationshipType = data.relationshipType as string | undefined;
      const person1Id = data.person1Id as string | undefined;
      const person2Id = data.person2Id as string | undefined;
      const short1 = person1Id ? `${person1Id.slice(0, 6)}...` : 'n/a';
      const short2 = person2Id ? `${person2Id.slice(0, 6)}...` : 'n/a';
      if (relationshipType) {
        return `${relationshipType} (${short1} → ${short2})`;
      }
      return `${short1} → ${short2}`;
    }

    if (log.entityType === 'USER') {
      const role = data.role as string | undefined;
      if (role) return `role=${role}`;
    }

    try {
      return JSON.stringify(data);
    } catch {
      return '-';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'LOGIN':
        return 'bg-amber-100 text-amber-800';
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800';
      case 'LOGIN_FAILED':
        return 'bg-red-100 text-red-800';
      case 'SECURITY_ALERT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-emerald-600"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back to Tree</span>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-600" />
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-700 text-sm font-semibold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <span className="hidden sm:inline text-sm text-gray-700">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200 w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            Users
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'audit'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity size={18} />
            Audit Log
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Key size={18} />
            Settings
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <button
                onClick={fetchUsers}
                disabled={usersLoading}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600"
              >
                <RefreshCw size={16} className={usersLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {usersLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No users found or user endpoint not available.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Joined
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-emerald-700 text-sm font-semibold">
                                {u.firstName?.[0]}{u.lastName?.[0]}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              u.role === 'ADMIN'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleToggleAdmin(u.id, u.role)}
                              className="text-sm text-emerald-600 hover:text-emerald-700"
                            >
                              {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
              <button
                onClick={() => fetchAuditLogs(auditPage)}
                disabled={auditLoading}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600"
              >
                <RefreshCw size={16} className={auditLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {auditLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No audit logs found.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Timestamp
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          User
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Entity
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          IP Address
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            {log.user ? (
                              <span className="font-medium text-gray-900">
                                {log.user.firstName} {log.user.lastName}
                              </span>
                            ) : (
                              <span className="text-gray-400">Unknown</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionColor(
                                log.actionType
                              )}`}
                            >
                              {log.actionType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="text-gray-600">{log.entityType}</span>
                            <span className="text-gray-400 text-xs ml-1">
                              ({log.entityId.slice(0, 8)}...)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatAuditDetails(log)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {log.ipAddress || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Page {auditPage} of {auditTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchAuditLogs(auditPage - 1)}
                      disabled={auditPage <= 1 || auditLoading}
                      className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <button
                      onClick={() => fetchAuditLogs(auditPage + 1)}
                      disabled={auditPage >= auditTotalPages || auditLoading}
                      className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Change Family Password
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                The family password is shared among all family members to access the tree.
                Changing it will require everyone to re-enter the new password.
              </p>

              <form
                onSubmit={familyPasswordForm.handleSubmit(handleFamilyPasswordChange)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Family Password
                  </label>
                  <div className="relative">
                    <input
                      {...familyPasswordForm.register('currentPassword')}
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {familyPasswordForm.formState.errors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {familyPasswordForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Family Password
                  </label>
                  <div className="relative">
                    <input
                      {...familyPasswordForm.register('newPassword')}
                      type={showNewPassword ? 'text' : 'password'}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {familyPasswordForm.formState.errors.newPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {familyPasswordForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    {...familyPasswordForm.register('confirmPassword')}
                    type="password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  {familyPasswordForm.formState.errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {familyPasswordForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Key size={18} />
                      Update Family Password
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
