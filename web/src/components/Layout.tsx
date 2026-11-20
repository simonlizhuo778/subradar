import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

const NAV = [
  { label: '概览', ready: true },
  { label: '订阅', ready: false, eta: 'W2' },
  { label: '日历', ready: false, eta: 'W2' },
  { label: '统计', ready: false, eta: 'W4' },
  { label: 'AI 录入', ready: false, eta: 'W3' },
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

          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => (
              <span
                key={item.label}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  item.ready ? 'bg-slate-900 font-medium text-white' : 'cursor-not-allowed text-slate-400'
                }`}
                title={item.ready ? undefined : `${item.eta} 上线`}
              >
                {item.label}
                {!item.ready && <sup className="ml-1 text-[10px]">{item.eta}</sup>}
              </span>
            ))}
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
