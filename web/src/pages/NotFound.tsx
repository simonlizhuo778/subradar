import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-3xl font-bold text-slate-900">404</h1>
      <p className="text-sm text-slate-500">雷达没有扫描到这个页面</p>
      <Link
        to="/"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        回到首页
      </Link>
    </div>
  );
}
