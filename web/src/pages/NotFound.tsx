import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { Button } from '@/components/ui';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
      <Radar className="h-14 w-14 text-slate-300" aria-hidden />
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">404</h1>
      <p className="text-sm text-slate-500">雷达没有扫描到这个页面</p>
      <Link to="/">
        <Button>回到首页</Button>
      </Link>
    </div>
  );
}