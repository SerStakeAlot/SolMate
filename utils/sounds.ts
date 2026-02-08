// Shared chess sound utility for the entire app
// Lazily creates Audio elements to avoid SSR issues

type SoundType = 'move' | 'capture' | 'check' | 'castle';

let sounds: Record<SoundType, HTMLAudioElement> | null = null;
let initialized = false;

function getSounds(): Record<SoundType, HTMLAudioElement> | null {
  if (typeof window === 'undefined') return null;
  if (sounds) return sounds;
  if (initialized) return null;

  initialized = true;
  try {
    const move = new Audio('/sounds/move.ogg');
    const capture = new Audio('/sounds/capture.ogg');
    const check = new Audio('/sounds/check.ogg');
    const castle = new Audio('/sounds/castle.ogg');

    [move, capture, check, castle].forEach(audio => {
      audio.load();
      audio.volume = 0.5;
    });

    sounds = { move, capture, check, castle };
    return sounds;
  } catch {
    return null;
  }
}

export function playSound(type: SoundType, volume = 0.5) {
  const s = getSounds();
  if (!s) return;

  const audio = s[type];
  if (audio) {
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = volume;
    clone.play().catch(() => {});
  }
}
