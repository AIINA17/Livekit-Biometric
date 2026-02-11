// components/SoundWave.tsx
'use client';

interface SoundWaveProps {
  variant?: 'default' | 'small';
  color?: string;
}

export default function SoundWave({ 
  variant = 'default',
  color = 'var(--accent-primary)' 
}: SoundWaveProps) {
  const barCount = variant === 'small' ? 5 : 7;
  const heights = variant === 'small' 
    ? ['h-2', 'h-4', 'h-6', 'h-4', 'h-2']
    : ['h-3', 'h-5', 'h-8', 'h-6', 'h-8', 'h-5', 'h-3'];

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          className="soundwave-bar"
          style={{
            backgroundColor: color,
            animationDelay: `${index * 0.1}s`,
            height: '8px', // Initial height, will be animated
          }}
        />
      ))}
    </div>
  );
}

/* ============================================
   ALTERNATIVE: Animated Bars with Different Heights
   ============================================ */

export function SoundWaveAnimated({ color = '#D97757' }: { color?: string }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-8">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="w-1 rounded-full animate-soundwave"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================
   STATIC BARS (for screenshots/design)
   ============================================ */

export function SoundWaveStatic({ color = '#D97757' }: { color?: string }) {
  const heights = [8, 16, 24, 20, 24, 16, 8];
  
  return (
    <div className="flex items-end justify-center gap-[3px] h-8">
      {heights.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full"
          style={{
            backgroundColor: color,
            height: `${height}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================
   CARA GANTI STYLE SOUNDWAVE:
   ============================================
   
   1. Warna Bar:
      - Default: var(--accent-primary) (#D97757)
      - Ganti via prop: <SoundWave color="#FF0000" />
      - Atau ganti di globals.css: --accent-primary
   
   2. Jumlah Bar:
      - Default: 7 bars
      - Small variant: 5 bars
      - Ganti di barCount variable
   
   3. Animasi Speed:
      - Defined di globals.css: @keyframes soundwave
      - Duration: 0.8s
      - Ganti di globals.css untuk speed berbeda
   
   4. Bar Width:
      - Sekarang: w-1 (4px)
      - Ganti di soundwave-bar class di globals.css
   
   5. Gap Between Bars:
      - Sekarang: gap-1 (4px)
      - Ganti ke gap-[3px] untuk 3px
   
   6. Container Height:
      - Sekarang: h-8 (32px)
      - Adjust sesuai kebutuhan
   
   PENGGUNAAN:
   
   // Default (7 bars, orange)
   <SoundWave />
   
   // Small (5 bars)
   <SoundWave variant="small" />
   
   // Custom color
   <SoundWave color="#4598C5" />
   
   // Static (no animation)
   <SoundWaveStatic />
   
   // Animated alternative
   <SoundWaveAnimated />
*/