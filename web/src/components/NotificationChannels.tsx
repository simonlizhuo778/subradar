import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, ChevronDown, Plus, Power, Send, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Select,
  Skeleton,
  cx,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import type { ChannelType, NotificationChannelInfo, NotificationLogRow } from '@/lib/types';

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
  const toast = useToast();
  const [channels, setChannels] = useState<NotificationChannelInfo[] | null>(null);
  const [logs, setLogs] = useState<NotificationLogRow[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NotificationChannelInfo | null>(null);

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
      toast.success(`渠道「${form.label.trim()}」已添加`);
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
      toast.success(channel.enabled ? `已停用「${channel.label}」` : `已启用「${channel.label}」`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const channel = pendingDelete;
    setBusy(true);
    try {
      await api(`/notifications/channels/${channel.id}`, { method: 'DELETE' });
      toast.success(`已删除渠道「${channel.label}」`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
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
        toast.success(res.message ?? '测试消息已发送');
      } else {
        setError(`测试失败:${res.error ?? '未知错误'}`);
        toast.error(`测试失败:${res.error ?? '未知错误'}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试失败');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <BellRing className="h-4 w-4 text-slate-400" aria-hidden />
            主动提醒渠道
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            到期前 3 天自动推送到你的手机(飞书/邮件),不用再打开网页查看。
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setFormOpen((v) => !v);
            setError(null);
            setMessage(null);
          }}
        >
          {formOpen ? (
            '收起'
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              添加渠道
            </>
          )}
        </Button>
      </div>

      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      {message && <Alert tone="success" className="mt-3">{message}</Alert>}

      {formOpen && (
        <div className="mt-4 animate-fade-in space-y-3 rounded-xl border border-slate-900/5 bg-slate-50/70 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="渠道类型" htmlFor="ch-type">
              <Select
                id="ch-type"
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as ChannelType;
                  setForm({ ...EMPTY_FORM, type, label: TYPE_LABELS[type] });
                }}
              >
                <option value="feishu">飞书群机器人</option>
                <option value="webhook">通用 Webhook</option>
                <option value="email">邮件</option>
              </Select>
            </Field>
            <Field label="渠道名称" htmlFor="ch-label">
              <Input
                id="ch-label"
                value={form.label}
                maxLength={40}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </Field>
          </div>

          <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
            {TYPE_HINTS[form.type]}
          </p>

          <Field
            label={form.type === 'email' ? '收件邮箱 *' : 'Webhook 地址 *'}
            htmlFor="ch-target"
          >
            <Input
              id="ch-target"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder={
                form.type === 'email'
                  ? 'me@qq.com'
                  : 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx'
              }
            />
          </Field>

          {form.type === 'feishu' && (
            <Field
              label={
                <>
                  签名密钥(可选)
                  <span className="ml-1 font-normal text-slate-400">
                    机器人开启「签名校验」时才需要填
                  </span>
                </>
              }
              htmlFor="ch-secret"
            >
              <Input
                id="ch-secret"
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="留空表示未开启签名校验"
              />
            </Field>
          )}

          {form.type === 'email' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SMTP 服务器 *" htmlFor="ch-smtp-host">
                <Input
                  id="ch-smtp-host"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  placeholder="smtp.qq.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="端口" htmlFor="ch-smtp-port">
                  <Input
                    id="ch-smtp-port"
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                  />
                </Field>
                <Field label="加密" htmlFor="ch-smtp-secure">
                  <Select
                    id="ch-smtp-secure"
                    value={form.smtpSecure ? 'ssl' : 'tsl'}
                    onChange={(e) => setForm({ ...form, smtpSecure: e.target.value === 'ssl' })}
                  >
                    <option value="ssl">SSL(465)</option>
                    <option value="tsl">STARTTLS(587)</option>
                  </Select>
                </Field>
              </div>
              <Field label="发件账号 *" htmlFor="ch-smtp-user">
                <Input
                  id="ch-smtp-user"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder="me@qq.com"
                />
              </Field>
              <Field label="密码 / 授权码 *" htmlFor="ch-smtp-pass">
                <Input
                  id="ch-smtp-pass"
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  placeholder="QQ 邮箱填授权码"
                />
              </Field>
            </div>
          )}

          <Button onClick={() => void submit()} loading={busy}>
            {busy ? '保存中…' : '添加渠道'}
          </Button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-slate-900/5">
        {channels === null && (
          <li className="space-y-2 py-3">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </li>
        )}
        {channels?.length === 0 && (
          <li className="py-4 text-sm leading-6 text-slate-400">
            还没有配置任何推送渠道。添加后,到期提醒会主动发到你的手机。
          </li>
        )}
        {channels?.map((channel) => (
          <li key={channel.id} className="flex flex-wrap items-center gap-3 py-3.5">
            <Badge tone="neutral">{TYPE_LABELS[channel.type] ?? channel.type}</Badge>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{channel.label}</span>
                {!channel.enabled && (
                  <Badge tone="warning" className="px-1.5 text-[10px]">
                    已停用
                  </Badge>
                )}
                {channel.lastStatus === 'ok' && (
                  <Badge tone="success" className="px-1.5 text-[10px]">
                    最近发送成功
                  </Badge>
                )}
                {channel.lastStatus === 'failed' && (
                  <span title={channel.lastError ?? undefined}>
                    <Badge tone="danger" className="px-1.5 text-[10px]">
                      最近失败
                    </Badge>
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
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void test(channel)}
                disabled={testingId === channel.id}
                loading={testingId === channel.id}
              >
                {testingId !== channel.id && <Send className="h-3.5 w-3.5" aria-hidden />}
                {testingId === channel.id ? '发送中…' : '发送测试'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void toggle(channel)}
                disabled={busy}
              >
                <Power className="h-3.5 w-3.5" aria-hidden />
                {channel.enabled ? '停用' : '启用'}
              </Button>
              <IconButton
                tone="danger"
                title="删除渠道"
                aria-label={`删除渠道 ${channel.label}`}
                disabled={busy}
                onClick={() => setPendingDelete(channel)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-slate-900/6 pt-3">
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800"
        >
          <ChevronDown
            className={cx('h-3.5 w-3.5 transition-transform duration-200', showLogs && 'rotate-180')}
            aria-hidden
          />
          {showLogs ? '收起推送记录' : `查看推送记录(${logs.length})`}
        </button>
        {showLogs && (
          <ul className="mt-2 max-h-56 animate-fade-in space-y-1 overflow-y-auto text-xs">
            {logs.length === 0 && <li className="text-slate-400">还没有推送记录</li>}
            {logs.map((log) => (
              <li key={log.id} className="flex items-center gap-2 text-slate-500">
                {log.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden />
                )}
                <span className="shrink-0 text-slate-400">{formatDate(log.createdAt)}</span>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`删除渠道「${pendingDelete?.label ?? ''}」?`}
        description="删除后将不再通过该渠道推送到期提醒。"
        confirmLabel="删除"
        loading={busy && pendingDelete !== null}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </Card>
  );
}