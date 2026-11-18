type AudioContextConstructor = typeof AudioContext;

let sharedContext: AudioContext | null = null;

function audioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return candidate ?? null;
}

function ensureContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  const Constructor = audioContextConstructor();
  if (!Constructor) return null;
  try {
    sharedContext = new Constructor();
    return sharedContext;
  } catch {
    return null;
  }
}

export function unlockNotificationSound(): void {
  const context = ensureContext();
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume().catch(() => undefined);
  }
}

function chime(context: AudioContext): void {
  const now = context.currentTime;
  const tones = [880, 1174.66];
  tones.forEach((frequency, index) => {
    const start = now + index * 0.14;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  });
}

export function playNewOrderChime(): boolean {
  const context = ensureContext();
  if (!context) return false;
  try {
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    chime(context);
    return true;
  } catch {
    return false;
  }
}