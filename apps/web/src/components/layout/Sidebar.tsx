'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Users, FileText, UserCheck, BarChart3,
  Settings, LogOut, Building2, CreditCard,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'CRM', href: '/dashboard/crm', icon: <Users size={18} /> },
  { label: 'Facturation', href: '/dashboard/invoicing', icon: <FileText size={18} /> },
  { label: 'RH', href: '/dashboard/hr', icon: <UserCheck size={18} /> },
  { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 size={18} /> },
  { label: 'Abonnement', href: '/dashboard/billing', icon: <CreditCard size={18} />, roles: ['TENANT_ADMIN'] },
  { label: 'Paramètres', href: '/dashboard/settings', icon: <Settings size={18} />, roles: ['TENANT_ADMIN', 'MANAGER'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role ?? '');
  });

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Vilar DS</p>
            <p className="text-gray-400 text-xs">{user?.tenant.slug}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 px-3 mb-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-gray-400 text-xs truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
