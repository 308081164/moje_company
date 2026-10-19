let audioCtx: AudioContext | null = null;
let unlocked = false;

function context(): AudioContext | null {
  const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** 浏览器会拦截未手势解锁的音频，在点击/按键后调用一次即可。 */
export function unlockNotifySound(): void {
  try {
    const ctx = context();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    unlocked = true;
  } catch {
    /* ignore */
  }
}

export function playNotifySound(): void {
  try {
    unlockNotifySound();
    const ctx = context();
    if (!ctx || ctx.state !== 'running') return;
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
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && !unlocked) {
  const once = () => unlockNotifySound();
  window.addEventListener('pointerdown', once, { once: true });
  window.addEventListener('keydown', once, { once: true });
}
