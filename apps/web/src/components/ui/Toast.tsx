'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), 4000);
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().add({ type: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().add({ type: 'error', title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().add({ type: 'warning', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().add({ type: 'info', title, description }),
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  warning: <AlertCircle size={18} className="text-yellow-500" />,
  info: <AlertCircle size={18} className="text-blue-500" />,
};

const BORDERS: Record<ToastType, string> = {
  success: 'border-green-200',
  error: 'border-red-200',
  warning: 'border-yellow-200',
  info: 'border-blue-200',
};

function ToastItem({ toast: t }: { toast: Toast }) {
  const { remove } = useToastStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`flex items-start gap-3 bg-white border ${BORDERS[t.type]} rounded-xl shadow-lg p-4 w-80 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className="shrink-0 mt-0.5">{ICONS[t.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{t.title}</p>
        {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
      </div>
      <button onClick={() => remove(t.id)} className="shrink-0 text-gray-400 hover:text-gray-600">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
