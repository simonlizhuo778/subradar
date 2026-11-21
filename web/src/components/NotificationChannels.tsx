import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ChannelType, NotificationChannelInfo, NotificationLogRow } from '@/lib/types';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

const TYPE_LABELS: Record<ChannelType, string> = {
  feishu: '飞书群机器人',
  webhook: '通用 Webhook',
  email: '邮件',
};

const TYPE_HINTS: Record<ChannelType, string> = {
  feishu:
    '在飞书群聊 → 设置 → 群机器人 → 添加机器人 → 自定义机器人,复制 Webhook 地址(形如 https://open.feishu.cn/open-apis/bot/v2/hook/xxx)',
  webhook: '任何接受 POST JSON 的地址,可对接企业微信、钉钉、Server酱或你自己的服务',
  email: '需要 SMTP 服务器信息(QQ 邮箱用授权码,不是登录密码)',
};

interface FormState {
  type: ChannelType;
  label: string;
  target: string;
  secret: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

const EMPTY_FORM: FormState = {
  type: 'feishu',
  label: '我的飞书',
  target: '',
  secret: '',
  smtpHost: '',
  smtpPort: '465',
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
};

export function NotificationChannels() {
  const [channels, setChannels] = useState<NotificationChannelInfo[] | null>(null);
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, logRows] = await Promise.all([
        api<NotificationChannelInfo[]>('/notifications/channels'),
        api<NotificationLogRow[]>('/notifications/logs'),
      ]);
      setChannels(list);
      setLogs(logRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setError(null);
    setMessage(null);
    if (!form.label.trim()) return setError('请填写渠道名称');
    if (!form.target.trim()) return setError(form.type === 'email' ? '请填写收件邮箱' : '请填写推送地址');
    if (form.type === 'email' && (!form.smtpHost.trim() || !form.smtpUser.trim() || !form.smtpPass)) {
      return setError('邮件渠道需要填写 SMTP 服务器、账号与密码/授权码');
    }

    setBusy(true);
    try {
      await api('/notifications/channels', {
        method: 'POST',
        body: {
          type: form.type,
          label: form.label.trim(),
          target: form.target.trim(),
          secret: form.type === 'feishu' ? form.secret.trim() || undefined : undefined,
          smtp:
            form.type === 'email'
              ? {
                  host: form.smtpHost.trim(),
                  port: Number(form.smtpPort) || 465,
                  secure: form.smtpSecure,
                  user: form.smtpUser.trim(),
                  pass: form.smtpPass,
                  from: form.smtpFrom.trim() || undefined,
                }
              : undefined,
        },
      });
      setMessage('渠道已添加,建议立刻点「发送测试」验证一下');
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加失败');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(channel: NotificationChannelInfo) {
    setBusy(true);
    try {
      await api(`/notifications/channels/${channel.id}`, {
        method: 'PATCH',
        body: { enabled: !channel.enabled },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function remove(channel: NotificationChannelInfo) {
    if (!window.confirm(`确定删除渠道「${channel.label}」吗?`)) return;
    setBusy(true);
    try {
      await api(`/notifications/channels/${channel.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  async function test(channel: NotificationChannelInfo) {
    setTestingId(channel.id);
    setError(null);
    setMessage(null);
    try {
      const res = await api<{ ok: boolean; message?: string; error?: string }>(
        `/notifications/channels/${channel.id}/test`,
        { method: 'POST' },
      );
      if (res.ok) {
        setMessage(`✓ ${res.message ?? '测试消息已发送'}`);
      } else {
        setError(`测试失败:${res.error ?? '未知错误'}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">主动提醒渠道</h2>
          <p className="mt-1 text-xs text-slate-500">
            到期前 3 天自动推送到你的手机(飞书/邮件),不用再打开网页查看。
          </p>
        </div>
        <button
          onClick={() => {
            setFormOpen((v) => !v);
            setError(null);
            setMessage(null);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          {formOpen ? '收起' : '+ 添加渠道'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
      )}
      {message && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {formOpen && (
        <div className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>渠道类型</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as ChannelType;
                  setForm({ ...EMPTY_FORM, type, label: TYPE_LABELS[type] });
                }}
              >
                <option value="feishu">飞书群机器人</option>
                <option value="webhook">通用 Webhook</option>
                <option value="email">邮件</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>渠道名称</label>
              <input
                className={inputClass}
                value={form.label}
                maxLength={40}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
          </div>

          <p className="rounded bg-white px-3 py-2 text-xs leading-5 text-slate-500">
            {TYPE_HINTS[form.type]}
          </p>

          <div>
            <label className={labelClass}>
              {form.type === 'email' ? '收件邮箱 *' : 'Webhook 地址 *'}
            </label>
            <input
              className={inputClass}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder={
                form.type === 'email'
                  ? 'me@qq.com'
                  : 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx'
              }
            />
          </div>

          {form.type === 'feishu' && (
            <div>
              <label className={labelClass}>
                签名密钥(可选)
                <span className="ml-1 font-normal text-slate-400">
                  机器人开启「签名校验」时才需要填
                </span>
              </label>
              <input
                className={inputClass}
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="留空表示未开启签名校验"
              />
            </div>
          )}

          {form.type === 'email' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>SMTP 服务器 *</label>
                <input
                  className={inputClass}
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.qq.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>端口</label>
                  <input
                    className={inputClass}
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>加密</label>
                  <select
                    className={inputClass}
                    value={form.smtpSecure ? 'ssl' : 'tsl'}
                    onChange={(e) => setForm({ ...form, smtpSecure: e.target.value === 'ssl' })}
                  >
                    <option value="ssl">SSL(465)</option>
                    <option value="tsl">STARTTLS(587)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>发件账号 *</label>
                <input
                  className={inputClass}
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="me@qq.com"
                />
              </div>
              <div>
                <label className={labelClass}>密码 / 授权码 *</label>
                <input
                  className={inputClass}
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  placeholder="QQ 邮箱填授权码"
                />
              </div>
            </div>
          )}

          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? '保存中…' : '添加渠道'}
          </button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-slate-100">
        {channels === null && <li className="py-3 text-sm text-slate-400">加载中…</li>}
        {channels?.length === 0 && (
          <li className="py-4 text-sm text-slate-400">
            还没有配置任何推送渠道。添加后,到期提醒会主动发到你的手机。
          </li>
        )}
        {channels?.map((channel) => (
          <li key={channel.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {TYPE_LABELS[channel.type] ?? channel.type}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{channel.label}</span>
                {!channel.enabled && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-600">
                    已停用
                  </span>
                )}
                {channel.lastStatus === 'ok' && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600">
                    最近发送成功
                  </span>
                )}
                {channel.lastStatus === 'failed' && (
                  <span
                    className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600"
                    title={channel.lastError ?? undefined}
                  >
                    最近失败
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-400" title={channel.targetHint}>
                {channel.targetHint}
                {channel.lastSentAt && ` · 上次成功 ${formatDate(channel.lastSentAt)}`}
              </div>
              {channel.lastStatus === 'failed' && channel.lastError && (
                <div className="mt-1 text-xs text-rose-500">{channel.lastError}</div>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => void test(channel)}
                disabled={testingId === channel.id}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                {testingId === channel.id ? '发送中…' : '发送测试'}
              </button>
              <button
                onClick={() => void toggle(channel)}
                disabled={busy}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                {channel.enabled ? '停用' : '启用'}
              </button>
              <button
                onClick={() => void remove(channel)}
                disabled={busy}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          onClick={() => setShowLogs((v) => !v)}
          className="text-xs text-slate-500 underline hover:text-slate-800"
        >
          {showLogs ? '收起推送记录' : `查看推送记录(${logs.length})`}
        </button>
        {showLogs && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
            {logs.length === 0 && <li className="text-slate-400">还没有推送记录</li>}
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-2 text-slate-500">
                <span className={log.ok ? 'text-emerald-600' : 'text-rose-500'}>
                  {log.ok ? '✓' : '✗'}
                </span>
                <span className="text-slate-400">{formatDate(log.createdAt)}</span>
                <span className="flex-1 truncate">{log.title}</span>
                {!log.ok && log.error && (
                  <span className="max-w-40 truncate text-rose-500" title={log.error}>
                    {log.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}