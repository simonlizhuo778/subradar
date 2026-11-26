import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import wangcaiUrl from '@/assets/wangcai.gif';
import { useAuth } from '@/lib/auth';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败,请稍后再试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          {/* 旺财 GIF:16:9 横版大留白,按角色包围盒精确裁切到 64px 品牌位 */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden">
            <img
              src={wangcaiUrl}
              alt="旺财"
              draggable={false}
              className="h-[68px] w-auto max-w-none translate-x-[3px] select-none"
            />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            订阅雷达 SubRadar
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">从你的真实账单里,把忘了的订阅找出来</p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="邮箱" htmlFor="email">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@subradar.app"
              />
            </Field>

            <Field label="密码" htmlFor="password">
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && <Alert tone="error">{error}</Alert>}

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? '登录中…' : '登录'}
            </Button>

            <p className="text-center text-sm text-slate-500">
              还没有账号?
              <Link
                className="ml-1 font-medium text-accent-600 transition-colors duration-150 hover:text-accent-700"
                to="/register"
              >
                注册
              </Link>
            </p>

            <p className="rounded-lg border border-slate-900/4 bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
              演示账号:demo@subradar.app / demo1234
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}