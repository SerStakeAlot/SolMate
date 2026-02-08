'use client';

import { useEffect } from 'react';
import { playSound } from '@/utils/sounds';

// Global click sound handler - adds chess sounds to all interactive elements
// Chess board squares are excluded since game components handle their own sounds
export function ClickSounds() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Walk up to find the interactive element that was clicked
      const interactive = target.closest('button, a, [role="button"], input[type="submit"]');
      if (!interactive) return;

      // Skip chess board squares - game components play their own sounds
      if (target.closest('.grid-cols-8')) return;

      playSound('move', 0.3);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
