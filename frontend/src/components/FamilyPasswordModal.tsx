import { useAuthStore } from '../stores/authStore';

export function FamilyPasswordModal() {
  const { showFamilyPasswordModal } = useAuthStore();

  if (!showFamilyPasswordModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Family Password</h2>
        <p className="text-muted mb-6">
          Please enter the family password to access the tree.
        </p>
        <p className="text-center text-sm text-muted">Modal - To be implemented</p>
      </div>
    </div>
  );
}
