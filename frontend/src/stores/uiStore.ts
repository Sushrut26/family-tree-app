import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface UIState {
  // Loading states
  isLoading: boolean;
  loadingMessage?: string;

  // Dialog states
  showAddPersonDialog: boolean;
  showEditPersonDialog: boolean;
  showDeleteConfirmDialog: boolean;
  showAddRelationshipDialog: boolean;
  showBulkImportDialog: boolean;

  // Toast notifications
  toasts: Toast[];

  // Sidebar state (for mobile)
  isSidebarOpen: boolean;

  // Actions
  setLoading: (loading: boolean, message?: string) => void;
  setShowAddPersonDialog: (show: boolean) => void;
  setShowEditPersonDialog: (show: boolean) => void;
  setShowDeleteConfirmDialog: (show: boolean) => void;
  setShowAddRelationshipDialog: (show: boolean) => void;
  setShowBulkImportDialog: (show: boolean) => void;
  showToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Initial state
  isLoading: false,
  loadingMessage: undefined,
  showAddPersonDialog: false,
  showEditPersonDialog: false,
  showDeleteConfirmDialog: false,
  showAddRelationshipDialog: false,
  showBulkImportDialog: false,
  toasts: [],
  isSidebarOpen: false,

  // Set global loading state
  setLoading: (loading: boolean, message?: string) => {
    set({ isLoading: loading, loadingMessage: message });
  },

  // Dialog controls
  setShowAddPersonDialog: (show: boolean) => {
    set({ showAddPersonDialog: show });
  },

  setShowEditPersonDialog: (show: boolean) => {
    set({ showEditPersonDialog: show });
  },

  setShowDeleteConfirmDialog: (show: boolean) => {
    set({ showDeleteConfirmDialog: show });
  },

  setShowAddRelationshipDialog: (show: boolean) => {
    set({ showAddRelationshipDialog: show });
  },

  setShowBulkImportDialog: (show: boolean) => {
    set({ showBulkImportDialog: show });
  },

  // Toast notifications
  showToast: (message: string, type: ToastType, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  // Sidebar controls
  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ isSidebarOpen: open });
  },
}));
