import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, Search, X } from 'lucide-react';
import { api, getToken } from '@/lib/api';
import { AI_PROVIDERS } from '@/lib/ai-providers';
import { NotificationChannels } from '@/components/NotificationChannels';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  IconButton,
  Input,
  PageHeader,
  Select,
  Spinner,
  cx,
} from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { AiSettingsInfo, ModelsResult, TestResult, UsageSummary } from '@/lib/types';

function UsagePanel({ usage }: { usage: UsageSummary | null }) {
  if (!usage || usage.total === 0) {
    return <p className="mt-3 text-sm text-slate-400">近 7 天还没有 AI 调用记录。</p>;
  }
  const maxCalls = Math.max(...usage.byDay.map((d) => d.calls), 1);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
        <span>
          调用 <b className="font-semibold text-slate-900">{usage.total}</b> 次
        </span>
        <span>
          成功 <b className="font-semibold text-emerald-600">{usage.ok}</b>
        </span>
        <span>
          失败 <b className="font-semibold text-rose-500">{usage.failed}</b>
        </span>
        <span>
          tokens <b className="font-semibold text-slate-900">{usage.promptTokens + usage.completionTokens}</b>
        </span>
      </div>
      <div className="mt-4 flex h-16 items-end gap-1.5">
        {usage.byDay.map((day) => (
          <div
            key={day.date}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${day.date}:${day.calls} 次 / ${day.tokens} tokens`}
          >
            <div
              className="w-full rounded-t-md bg-accent-600 transition-colors duration-150 hover:bg-accent-500"
              style={{ height: `${Math.max(6, (day.calls / maxCalls) * 100)}%` }}
            />
            <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ModelPickerProps {
  open: boolean;
  models: string[];
  hint: string;
  loading: boolean;
  error: string | null;
  currentModel: string;
  currentVision: string;
  onClose: () => void;
  onPickText: (model: string) => void;
  onPickVision: (model: string) => void;
  onRetry: () => void;
}

/** 可用模型选择器:勾选 = 圈出候选;「设为文本/视觉」= 直接回填到对应字段 */
function ModelPicker({
  open,
  models,
  hint,
  loading,
  error,
  currentModel,
  currentVision,
  onClose,
  onPickText,
  onPickVision,
  onRetry,
}: ModelPickerProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (open) {
      setChecked([]);
      setKeyword('');
    }
  }, [open]);

  const visible = useMemo(
    () => models.filter((m) => m.toLowerCase().includes(keyword.trim().toLowerCase())),
    [models, keyword],
  );
  const allChecked = visible.length > 0 && visible.every((m) => checked.includes(m));

  function toggle(model: string) {
    setChecked((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
  }

  function toggleAll() {
    setChecked(allChecked ? [] : visible);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">可用模型</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              来自该服务商的 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px]">/models</code> 接口
            </p>
          </div>
          <IconButton onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-10 text-sm text-slate-400">
            <Spinner className="h-5 w-5 text-accent-500" />
            <p className="mt-3">正在拉取模型列表…</p>
          </div>
        )}

        {error && !loading && (
          <div className="mt-4 space-y-3">
            <Alert tone="error">{error}</Alert>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onRetry}>
                重试
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                手动填写
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  placeholder="搜索模型名…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <span className="shrink-0 text-xs text-slate-400">{visible.length} 个</span>
            </div>

            {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}

            <label className="mt-3 flex cursor-pointer items-center gap-2 border-b border-slate-900/6 pb-2.5 text-sm text-slate-600">
              <Checkbox checked={allChecked} onChange={toggleAll} />
              全选(当前筛选下 {visible.length} 个)
              {checked.length > 0 && (
                <span className="ml-auto text-xs text-slate-400">已勾选 {checked.length} 个</span>
              )}
            </label>

            <ul className="mt-1 max-h-72 divide-y divide-slate-900/4 overflow-y-auto">
              {visible.map((m) => {
                const isText = m === currentModel;
                const isVision = m === currentVision;
                return (
                  <li key={m} className="flex items-center gap-2 py-2">
                    <Checkbox
                      checked={checked.includes(m)}
                      onChange={() => toggle(m)}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-700" title={m}>
                      {m}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPickText(m)}
                      className={cx(
                        'shrink-0 rounded-lg px-2 py-1 text-xs transition-colors duration-150',
                        isText
                          ? 'bg-accent-600 font-medium text-white'
                          : 'border border-slate-900/10 text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {isText ? '文本 ✓' : '设为文本'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPickVision(m)}
                      className={cx(
                        'shrink-0 rounded-lg px-2 py-1 text-xs transition-colors duration-150',
                        isVision
                          ? 'bg-emerald-600 font-medium text-white'
                          : 'border border-slate-900/10 text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {isVision ? '视觉 ✓' : '设为视觉'}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="py-6 text-center text-sm text-slate-400">没有匹配的模型名</li>
              )}
            </ul>

            <p className="mt-3 border-t border-slate-900/6 pt-3 text-xs leading-5 text-slate-400">
              点「设为文本 / 设为视觉」会自动填回表单;确认后再点「保存配置」才会生效。
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function Settings() {
  const toast = useToast();
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
  // 可用模型列表(GET {baseUrl}/models)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsHint, setModelsHint] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

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
      toast.success('AI 配置已保存');
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

  /** 拉取可用模型列表:优先用页面上当前填的 Base URL / Key,没填则后端回退到已保存配置 */
  async function fetchModels() {
    setPickerOpen(true);
    setModelsLoading(true);
    setModelsError(null);
    setModels([]);
    setModelsHint('');
    try {
      const res = await api<ModelsResult>('/settings/ai/models', {
        method: 'POST',
        body: {
          baseUrl: baseUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        },
      });
      setModels(res.models);
      setModelsHint(res.hint);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : '获取模型列表失败');
    } finally {
      setModelsLoading(false);
    }
  }

  const currentPreset = AI_PROVIDERS.find((p) => p.key === provider);

  return (
    <div className="animate-fade-up max-w-2xl space-y-6">
      <PageHeader
        title="AI 接入(BYOK)"
        description="使用你自己购买的 API 额度。Key 加密存储在服务端数据库,不会出现在前端和网络请求里。"
      />

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Provider" htmlFor="ai-provider" hint={currentPreset?.hint}>
            <Select id="ai-provider" value={provider} onChange={(e) => onProviderChange(e.target.value)}>
              {AI_PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Base URL" htmlFor="ai-base-url">
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </Field>

          <Field
            label={
              <>
                API Key
                {info?.configured && info.keyHint && (
                  <span className="ml-2 font-normal text-slate-400">
                    已保存({info.keyHint}),留空则不修改
                  </span>
                )}
              </>
            }
            htmlFor="ai-key"
          >
            <Input
              id="ai-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={info?.configured ? '••••••••(留空沿用已保存的 Key)' : 'sk-...'}
              autoComplete="new-password"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="文本模型(抽取用)" htmlFor="ai-model">
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="如 deepseek-chat"
              />
            </Field>
            <Field
              label="视觉模型(截图识别用)"
              htmlFor="ai-vision-model"
              hint={!currentPreset?.supportsVision ? '该 Provider 官方 API 暂不支持图片' : undefined}
            >
              <Input
                id="ai-vision-model"
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                placeholder="如 glm-4.5v / gpt-4o-mini"
              />
            </Field>
          </div>

          <Button
            variant="secondary"
            onClick={() => void fetchModels()}
            disabled={modelsLoading}
            loading={modelsLoading}
            className="w-full border-dashed bg-slate-50/60"
          >
            {!modelsLoading && <Search className="h-4 w-4 text-slate-400" aria-hidden />}
            {modelsLoading ? '正在获取…' : '获取可用模型(不用再猜模型名)'}
          </Button>

          <Field label="每日调用上限(防刷)" htmlFor="ai-daily-limit" className="max-w-40">
            <Input
              id="ai-daily-limit"
              type="number"
              min="0"
              max="1000"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}
          {message && <Alert tone="success">{message}</Alert>}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" loading={saving}>
              {saving ? '保存中…' : '保存配置'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void onTest()}
              disabled={testing || !info?.configured}
              loading={testing}
            >
              {testing ? '测试中…' : '测试连通'}
            </Button>
          </div>

          {testResult && (
            <Alert tone={testResult.ok ? 'success' : 'warning'}>
              {testResult.ok
                ? `连通成功(${testResult.latencyMs}ms,模型 ${testResult.model}):${testResult.reply}`
                : testResult.error}
            </Alert>
          )}
        </form>
      </Card>

      <NotificationChannels />

      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          <Activity className="h-4 w-4 text-slate-400" aria-hidden />
          近 7 天用量
        </h2>
        <UsagePanel usage={usage} />
      </Card>

      <ModelPicker
        open={pickerOpen}
        models={models}
        hint={modelsHint}
        loading={modelsLoading}
        error={modelsError}
        currentModel={model}
        currentVision={visionModel}
        onClose={() => setPickerOpen(false)}
        onPickText={(m) => {
          setModel(m);
          setMessage(`已把 ${m} 填入「文本模型」,记得点保存配置`);
        }}
        onPickVision={(m) => {
          setVisionModel(m);
          setMessage(`已把 ${m} 填入「视觉模型」,记得点保存配置`);
        }}
        onRetry={() => void fetchModels()}
      />
    </div>
  );
}