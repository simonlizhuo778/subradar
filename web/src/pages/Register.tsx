import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim() || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败,请稍后再试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-pop">
            <Radar className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">创建账号</h1>
          <p className="mt-1.5 text-sm text-slate-500">注册后自动为你创建 9 个默认订阅分类</p>
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
                placeholder="you@example.com"
              />
            </Field>

            <Field label="昵称(可选)" htmlFor="displayName">
              <Input
                id="displayName"
                type="text"
                maxLength={30}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="怎么称呼你"
              />
            </Field>

            <Field label="密码(至少 8 位)" htmlFor="password">
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && <Alert tone="error">{error}</Alert>}

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? '注册中…' : '注册并登录'}
            </Button>

            <p className="text-center text-sm text-slate-500">
              已有账号?
              <Link
                className="ml-1 font-medium text-accent-600 transition-colors duration-150 hover:text-accent-700"
                to="/login"
              >
                登录
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}