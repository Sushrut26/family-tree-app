import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useTreeStore } from '../stores/treeStore';

const familyPasswordSchema = z.object({
  password: z.string().min(1, 'Family password is required'),
});

type FamilyPasswordFormData = z.infer<typeof familyPasswordSchema>;

export function FamilyPasswordModal() {
  const { showFamilyPasswordModal, verifyFamilyPassword, isLoading, error, clearError, logout } = useAuthStore();
  const { fetchTree } = useTreeStore();
  const { showToast } = useUIStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FamilyPasswordFormData>({
    resolver: zodResolver(familyPasswordSchema),
  });

  if (!showFamilyPasswordModal) return null;

  const onSubmit = async (data: FamilyPasswordFormData) => {
    clearError();
    try {
      await verifyFamilyPassword(data.password);
      await fetchTree().catch(() => {
        // Tree fetch errors handled elsewhere
      });
      showToast('Family access granted!', 'success');
      reset();
    } catch {
      // Error is handled by the store
    }
  };

  const handleLogout = () => {
    logout();
    reset();
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Family Access</h2>
          <p className="text-gray-600">
            Enter the family password to access the tree. This protects your family's data from unauthorized access.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="familyPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Family Password
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="familyPassword"
                autoFocus
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                placeholder="Enter family password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Lock size={20} />
                Access Family Tree
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
