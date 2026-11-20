/**
 * 浏览器语音识别(Web Speech API)封装:
 * - Chrome / Edge / Android Chrome 支持;iOS Safari 不支持(降级为纯文本输入)
 * - 免费、本地转写,不消耗 AI 额度;识别结果走既有文本抽取通道
 * - 注意:Chrome 的识别服务在国内网络下可能连不上,onerror 会给出友好提示
 */

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}

interface SpeechErrorEvent {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function createRecognizer(): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognition();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

/** 把浏览器错误码翻译成人话 */
export function describeSpeechError(error: string): string {
  switch (error) {
    case 'not-allowed':
      return '麦克风权限被拒绝,请在浏览器地址栏允许后重试';
    case 'no-speech':
      return '没听到声音,再试一次?';
    case 'network':
      return '语音服务连接失败(Chrome 的识别服务在国内网络下可能不可用),可直接输入文本';
    case 'aborted':
      return '录音已取消';
    default:
      return `语音识别出错:${error}`;
  }
}
