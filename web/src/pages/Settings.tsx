import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, getToken } from '@/lib/api';
import { AI_PROVIDERS } from '@/lib/ai-providers';
import type { AiSettingsInfo, TestResult, UsageSummary } from '@/lib/types';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

function UsagePanel({ usage }: { usage: UsageSummary | null }) {
  if (!usage || usage.total === 0) {
    return <p className="mt-2 text-sm text-slate-400">近 7 天还没有 AI 调用记录。</p>;
  }
  const maxCalls = Math.max(...usage.byDay.map((d) => d.calls), 1);
  return (
    <div className="mt-3">
      <div className="flex gap-4 text-sm text-slate-600">
        <span>
          调用 <b className="text-slate-900">{usage.total}</b> 次
        </span>
        <span>
          成功 <b className="text-emerald-600">{usage.ok}</b>
        </span>
        <span>
          失败 <b className="text-rose-500">{usage.failed}</b>
        </span>
        <span>
          tokens <b className="text-slate-900">{usage.promptTokens + usage.completionTokens}</b>
        </span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {usage.byDay.map((day) => (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1" title={`${day.date}:${day.calls} 次 / ${day.tokens} tokens`}>
            <div
              className="w-full rounded-t bg-slate-800"
              style={{ height: `${Math.max(6, (day.calls / maxCalls) * 100)}%` }}
            />
            <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [provider, setProvider] = useState('deepseek');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [dailyLimit, setDailyLimit] = useState('50');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function refresh() {
    try {
      const [s, u] = await Promise.all([
        api<AiSettingsInfo>('/settings/ai'),
        api<UsageSummary>('/usage'),
      ]);
      setInfo(s);
      setUsage(u);
      if (s.configured) {
        setProvider(s.provider ?? 'custom');
        setBaseUrl(s.baseUrl ?? '');
        setModel(s.model ?? '');
        setVisionModel(s.visionModel ?? '');
        setDailyLimit(String(s.dailyLimit ?? 50));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function onProviderChange(key: string) {
    setProvider(key);
    const preset = AI_PROVIDERS.find((p) => p.key === key);
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModel(preset.defaultModel);
      setVisionModel(preset.defaultVisionModel);
    }
    setTestResult(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!info?.configured && !apiKey.trim()) {
      setError('首次配置必须填写 API Key');
      return;
    }
    if (provider === 'custom' && !baseUrl.trim()) {
      setError('自定义 Provider 必须填写 Base URL');
      return;
    }
    setSaving(true);
    try {
      const result = await api<AiSettingsInfo>('/settings/ai', {
        method: 'PUT',
        body: {
          provider,
          baseUrl: baseUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          model: model.trim() || undefined,
          visionModel: visionModel.trim() || undefined,
          dailyLimit: Number(dailyLimit) || 0,
        },
      });
      setInfo(result);
      setApiKey('');
      setMessage('已保存。Key 已加密存储(AES-256-GCM)。');
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // 测试走后端代理,Key 不经过浏览器
      const token = getToken();
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTestResult((await res.json()) as TestResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '测试请求失败');
    } finally {
      setTesting(false);
    }
  }

  const currentPreset = AI_PROVIDERS.find((p) => p.key === provider);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI 接入(BYOK)</h1>
        <p className="mt-1 text-sm text-slate-500">
          使用你自己购买的 API 额度。Key 加密存储在服务端数据库,不会出现在前端和网络请求里。
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <label className={labelClass}>Provider</label>
          <select className={inputClass} value={provider} onChange={(e) => onProviderChange(e.target.value)}>
            {AI_PROVIDERS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          {currentPreset?.hint && (
            <p className="mt-1 text-xs text-slate-400">{currentPreset.hint}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Base URL</label>
          <input
            className={inputClass}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </div>

        <div>
          <label className={labelClass}>
            API Key
            {info?.configured && info.keyHint && (
              <span className="ml-2 font-normal text-slate-400">
                已保存({info.keyHint}),留空则不修改
              </span>
            )}
          </label>
          <input
            className={inputClass}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={info?.configured ? '••••••••(留空沿用已保存的 Key)' : 'sk-...'}
            autoComplete="new-password"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>文本模型(抽取用)</label>
            <input
              className={inputClass}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="如 deepseek-chat"
            />
          </div>
          <div>
            <label className={labelClass}>视觉模型(截图识别用)</label>
            <input
              className={inputClass}
              value={visionModel}
              onChange={(e) => setVisionModel(e.target.value)}
              placeholder="如 glm-4.5v / gpt-4o-mini"
            />
            {!currentPreset?.supportsVision && (
              <p className="mt-1 text-xs text-amber-500">该 Provider 官方 API 暂不支持图片</p>
            )}
          </div>
        </div>

        <div className="max-w-40">
          <label className={labelClass}>每日调用上限(防刷)</label>
          <input
            className={inputClass}
            type="number"
            min="0"
            max="1000"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
          />
        </div>

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        {message && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{message}</div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={testing || !info?.configured}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连通'}
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {testResult.ok
              ? `✓ 连通成功(${testResult.latencyMs}ms,模型 ${testResult.model}):${testResult.reply}`
              : `✗ ${testResult.error}`}
          </div>
        )}
      </form>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">近 7 天用量</h2>
        <UsagePanel usage={usage} />
      </div>
    </div>
  );
}
