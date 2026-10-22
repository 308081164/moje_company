let audioCtx: AudioContext | null = null;
let htmlAudioEl: HTMLAudioElement | null = null;
let htmlUrl: string | null = null;
let lastPlayed = 0;
let queued = false;

function context(): AudioContext | null {
  const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** 手机宽度，或触屏设备（员工 App WebView 走这条）。 */
export function isHandheldClient(): boolean {
  if (typeof window === 'undefined') return false;
  const narrow = window.innerWidth < 1200;
  const touch = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  return narrow || touch;
}

function beepWavUrl(): string {
  if (htmlUrl) return htmlUrl;
  const sampleRate = 22050;
  const samples = Math.floor(sampleRate * 0.18);
  const dataSize = samples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 180) * Math.min(1, (samples - i) / 360);
    const freq = 880 * Math.pow(1240 / 880, t / 0.18);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.35;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  htmlUrl = `data:audio/wav;base64,${btoa(binary)}`;
  return htmlUrl;
}

function htmlAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!htmlAudioEl) {
    htmlAudioEl = new Audio(beepWavUrl());
    htmlAudioEl.preload = 'auto';
    htmlAudioEl.setAttribute('playsinline', 'true');
  }
  return htmlAudioEl;
}

function playOscillator(): boolean {
  const ctx = context();
  if (!ctx || ctx.state !== 'running') return false;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1240, t + 0.07);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.24);
  return true;
}

/** 浏览器会拦截未手势解锁的音频，在点击/触摸后调用一次即可。之后从后台回来也会再试着 resume。 */
export function unlockNotifySound(): void {
  try {
    const ctx = context();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        if (queued) flushQueued();
      });
    }
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      try {
        source.start(0);
      } catch {
        /* 尚未解锁 */
      }
    }
    if (queued && isHandheldClient()) {
      flushQueued();
      return;
    }
    if (isHandheldClient()) primeHtml();
  } catch {
    /* ignore */
  }
}

function flushQueued(): void {
  if (!queued) return;
  queued = false;
  lastPlayed = 0;
  playNotifySound();
}

function primeHtml(): void {
  const el = htmlAudio();
  if (!el) return;
  el.muted = true;
  const primed = el.play();
  const finish = () => {
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    el.muted = false;
  };
  if (primed && typeof primed.then === 'function') primed.then(finish).catch(() => {});
}

export function playNotifySound(): void {
  try {
    const now = Date.now();
    if (now - lastPlayed < 300) return;
    const ctx = context();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (playOscillator()) {
      lastPlayed = now;
      queued = false;
      return;
    }
    if (!isHandheldClient()) return;
    const el = htmlAudio();
    if (!el) {
      queued = true;
      return;
    }
    el.muted = false;
    el.volume = 0.45;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    const played = el.play();
    if (played && typeof played.then === 'function') {
      lastPlayed = now;
      played.then(() => {
        queued = false;
      }).catch(() => {
        queued = true;
      });
      return;
    }
    lastPlayed = now;
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockNotifySound);
  window.addEventListener('keydown', unlockNotifySound);
  window.addEventListener('touchstart', unlockNotifySound, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockNotifySound();
  });
}
