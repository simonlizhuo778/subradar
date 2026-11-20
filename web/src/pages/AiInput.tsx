import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { createRecognizer, describeSpeechError, getSpeechRecognition } from '@/lib/speech';
import type { SpeechRecognitionLike } from '@/lib/speech';
import { CandidateCard } from '@/components/CandidateCard';
import type { AiSettingsInfo, CandidateRow, Category } from '@/lib/types';

export function AiInput() {
  const [info, setInfo] = useState<AiSettingsInfo | null>(null);
  const [mode, setMode] = useState<'image' | 'text'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const previewUrlRef = useRef<string | null>(null);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const speechSupported = getSpeechRecognition() !== null;

  const refreshCandidates = useCallback(async () => {
    try {
      setCandidates(await api<CandidateRow[]>('/candidates'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }, []);

  useEffect(() => {
    void api<AiSettingsInfo>('/settings/ai').then(setInfo).catch(() => undefined);
    void api<Category[]>('/categories').then(setCategories).catch(() => undefined);
    void refreshCandidates();
  }, [refreshCandidates]);

  function setPreview(url: string | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('只支持图片文件');
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    pickFile(e.clipboardData.files?.[0]);
  }

  function clearImage() {
    setFile(null);
    setPreview(null);
  }

  async function extract(overrideText?: string) {
    setError(null);
    setMessage(null);
    setHighlightId(null);
    try {
      if (mode === 'image') {
        if (!file) {
          setError('请先选择 / 粘贴 / 拖入一张截图');
          return;
        }
        setExtracting(true);
        const blob = await compressImage(file);
        const form = new FormData();
        form.append('file', blob, 'screenshot.jpg');
        const token = getToken();
        const res = await fetch('/api/ai/extract/image', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });
        const data = (await res.json().catch(() => null)) as
          | { created?: CandidateRow[]; message?: string }
          | null;
        if (!res.ok) {
          throw new Error(data?.message ?? `识别失败(HTTP ${res.status})`);
        }
        setMessage(data?.message ?? '识别完成');
        setHighlightId(data?.created?.[0]?.id ?? null);
        clearImage();
      } else {
        const input = (overrideText ?? text).trim();
        if (!input) {
          setError('请输入账单短信 / 口述文本');
          return;
        }
        setExtracting(true);
        const data = await api<{ created: CandidateRow[]; message: string }>('/ai/extract/text', {
          method: 'POST',
          body: { text: input.slice(0, 4000) },
        });
        setMessage(data.message);
        setHighlightId(data.created?.[0]?.id ?? null);
        setText('');
      }
      await refreshCandidates();
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败');
    } finally {
      setExtracting(false);
    }
  }

  /* ---------- 语音输入:浏览器本地转写(免费、不耗额度),说完自动接抽取管道 ---------- */

  function startListening() {
    setError(null);
    setMessage(null);
    const recognizer = createRecognizer();
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    finalTextRef.current = '';
    setInterim('');
    setListening(true);

    recognizer.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }
      if (finalChunk) {
        finalTextRef.current += finalChunk;
        setInterim('');
      } else if (interimChunk) {
        setInterim(interimChunk);
      }
    };
    recognizer.onerror = (event) => {
      setError(describeSpeechError(event.error));
    };
    recognizer.onend = () => {
      setListening(false);
      setInterim('');
      const spoken = finalTextRef.current.trim();
      if (spoken) {
        setText(spoken); // 留在输入框里,抽取失败时可直接编辑重试
        void extract(spoken);
      }
    };
    try {
      recognizer.start();
    } catch {
      setListening(false);
    }
  }

  function stopListening() {
    recognizerRef.current?.stop();
  }

  const notConfigured = info && !info.configured;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI 快速录入</h1>
        <p className="mt-1 text-sm text-slate-500">
          丢一张付款截图、粘一段账单短信,AI 抽取成订阅草稿,确认后自动入库并回填历史。
        </p>
      </div>

      {notConfigured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          还没有配置 AI。带上你自己购买的 API Key 去
          <Link to="/settings" className="mx-1 font-medium underline">
            设置 → AI 接入
          </Link>
          ,一分钟即可完成。
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5">
          {(
            [
              { key: 'image', label: '截图 / 照片' },
              { key: 'text', label: '文本(短信/口述)' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                mode === t.key ? 'bg-slate-900 font-medium text-white' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'image' ? (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onPaste={onPaste}
              tabIndex={0}
              className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition focus:outline-none ${
                dragging ? 'border-slate-900 bg-slate-50' : 'border-slate-300 hover:border-slate-400'
              }`}
              onClick={() => document.getElementById('ai-file-input')?.click()}
            >
              {previewUrl ? (
                <div>
                  <img
                    src={previewUrl}
                    alt="待识别截图预览"
                    className="mx-auto max-h-48 rounded-lg"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    {file?.name}(上传前会压缩到长边 1280px)
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-3xl">🖼️</div>
                  <p className="mt-2 text-sm text-slate-600">
                    点击选择、拖入,或直接 <b>Ctrl+V 粘贴</b> 付款截图
                  </p>
                  <p className="mt-1 text-xs text-slate-400">支持手机拍照上传 · 单张 ≤ 5MB</p>
                </div>
              )}
              <input
                id="ai-file-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
            {previewUrl && (
              <button
                onClick={clearImage}
                className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
              >
                移除图片
              </button>
            )}
          </div>
        ) : (
          <div>
            {listening ? (
              <div className="mb-3 flex items-center gap-3 rounded-lg bg-rose-50 px-4 py-3">
                <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-rose-500" />
                <span className="flex-1 truncate text-sm text-rose-700">
                  {interim || '正在听…说完后点右侧按钮'}
                </span>
                <button
                  onClick={stopListening}
                  className="shrink-0 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                >
                  说完了
                </button>
              </div>
            ) : speechSupported ? (
              <button
                onClick={startListening}
                className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                🎙️ 语音输入(浏览器本地转写,免费不耗额度)
              </button>
            ) : (
              <p className="mb-3 text-xs text-slate-400">
                当前浏览器不支持语音识别,可直接输入文本
              </p>
            )}
            <textarea
              className="min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              placeholder={'粘贴账单短信,或直接口述,例如:\n我上个月开了个腾讯视频VIP,30 块一个月,自动续费'}
              value={text}
              maxLength={4000}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void extract()}
            disabled={extracting || listening || notConfigured === true}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {extracting ? '识别中…(消耗模型额度)' : '开始识别'}
          </button>
          <span className="text-xs text-slate-400">识别结果先进待确认队列,不会直接入库</span>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>
        )}
        {message && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">待确认队列</h2>
          <span className="text-sm text-slate-400">{candidates?.length ?? 0} 条待处理</span>
        </div>
        {candidates === null && <p className="text-sm text-slate-400">加载中…</p>}
        {candidates?.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            队列空空如也。去上面识别点什么吧。
          </p>
        )}
        {candidates?.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            categories={categories}
            defaultOpen={candidate.id === highlightId}
            onDone={() => void refreshCandidates()}
            onMessage={setMessage}
          />
        ))}
      </div>
    </div>
  );
}
