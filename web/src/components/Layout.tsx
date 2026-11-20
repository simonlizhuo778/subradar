import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  /** 有值表示尚未上线的功能 */
  eta?: string;
}

const NAV: NavItem[] = [
  { label: '概览', to: '/', end: true },
  { label: '订阅', to: '/subscriptions' },
  { label: '日历', to: '/calendar' },
  { label: 'AI 录入', to: '/ai' },
  { label: '统计图表', to: '/stats', eta: 'W4' },
  { label: '设置', to: '/settings' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📡</span>
            <span className="text-lg font-bold text-slate-900">订阅雷达</span>
            <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 sm:inline">
              SubRadar
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) =>
              item.eta ? (
                <span
                  key={item.label}
                  className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-slate-400"
                  title={`${item.eta} 上线`}
                >
                  {item.label}
                  <sup className="ml-1 text-[10px]">{item.eta}</sup>
                </span>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition ${
                      isActive
                        ? 'bg-slate-900 font-medium text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:block">
              {user?.displayName ?? user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
