import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Radar,
  Settings,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import wangcaiUrl from '@/assets/wangcai.gif';
import { NotificationBell } from '@/components/NotificationBell';
import { cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon: LucideIcon;
  /** 有值表示尚未上线的功能 */
  eta?: string;
}

const NAV: NavItem[] = [
  { label: '概览', to: '/', end: true, icon: LayoutDashboard },
  { label: '订阅', to: '/subscriptions', icon: ListChecks },
  { label: '日历', to: '/calendar', icon: CalendarDays },
  { label: 'AI 录入', to: '/ai', icon: Sparkles },
  { label: '账单导入', to: '/bills', icon: FileSpreadsheet },
  { label: '统计图表', to: '/stats', icon: BarChart3 },
  { label: '设置', to: '/settings', icon: Settings },
];

function navClass(isActive: boolean): string {
  return cx(
    'rounded-lg px-3 py-1.5 text-sm transition-colors duration-150',
    isActive
      ? 'bg-accent-50 font-medium text-accent-700'
      : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900',
  );
}

/** 用户菜单:头像首字母 + 下拉(昵称 / 邮箱 / 退出) */
function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user?.displayName ?? user?.email ?? '';
  const initial = (name.trim()[0] ?? 'U').toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/80 text-xs font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-300/70"
        title={name}
        aria-label="用户菜单"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-56 animate-scale-in rounded-xl border border-slate-900/8 bg-white p-1.5 shadow-pop">
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user?.displayName ?? '用户'}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-slate-900/6" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4 text-slate-400" aria-hidden />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-slate-900/6 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            {/* 蓝色雷达图标暂时隐藏(保留结构方便随时恢复),旺财作为品牌标识 */}
            <span className="hidden h-8 w-8 items-center justify-center rounded-[10px] bg-accent-600 text-white shadow-btn">
              <Radar className="h-4.5 w-4.5" aria-hidden />
            </span>
            {/* 旺财 GIF 为 16:9 横版大留白,按角色包围盒精确裁切到 36px 品牌位 */}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden">
              <img
                src={wangcaiUrl}
                alt="旺财"
                draggable={false}
                className="h-[40px] w-auto max-w-none translate-x-[2px] select-none"
              />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">订阅雷达</span>
            <span className="hidden rounded-md bg-slate-900/5 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:inline">
              SubRadar
            </span>
          </NavLink>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) =>
              item.eta ? (
                <span
                  key={item.label}
                  className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm text-slate-400"
                  title={`${item.eta} 上线`}
                >
                  {item.label}
                  <sup className="ml-1 text-[10px]">{item.eta}</sup>
                </span>
              ) : (
                <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => navClass(isActive)}>
                  {item.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        {/* 移动端导航:可横滑,7 项全可达 */}
        <nav className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-2.5 md:hidden">
          {NAV.map((item) =>
            item.eta ? (
              <span
                key={item.label}
                className="shrink-0 cursor-not-allowed rounded-full border border-slate-900/8 bg-white px-3 py-1.5 text-[13px] text-slate-400"
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
                  cx(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-150',
                    isActive
                      ? 'border-accent-600 bg-accent-600 font-medium text-white shadow-btn'
                      : 'border-slate-900/8 bg-white text-slate-600',
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}