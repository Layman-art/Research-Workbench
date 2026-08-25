import { useMemo } from 'react';

const GLYPHS = ['♪', '♫', '♩', '♬', '𝅘𝅥', '𝅘𝅥𝅮'];

interface NoteSpec {
  glyph: string;
  left: string;
  bottom: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

/** 漂浮的摇滚音符（侧边栏 / 月相面板） */
export function FloatingNotes({ count = 7, seed = 1 }: { count?: number; seed?: number }) {
  const notes = useMemo<NoteSpec[]>(() => {
    let s = seed * 9973;
    const rand = () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
    return Array.from({ length: count }, (_, i) => ({
      glyph: GLYPHS[Math.floor(rand() * GLYPHS.length)],
      left: `${8 + rand() * 84}%`,
      bottom: `${4 + rand() * 30}%`,
      size: 13 + rand() * 14,
      duration: 5 + rand() * 6,
      delay: -(rand() * 10) - i * 0.4,
      opacity: 0.22 + rand() * 0.35,
    }));
  }, [count, seed]);

  return (
    <>
      {notes.map((n, i) => (
        <span
          key={i}
          className="music-note"
          style={
            {
              left: n.left,
              bottom: n.bottom,
              fontSize: n.size,
              animationDuration: `${n.duration}s`,
              animationDelay: `${n.delay}s`,
              '--note-opacity': n.opacity,
            } as React.CSSProperties
          }
        >
          {n.glyph}
        </span>
      ))}
    </>
  );
}

/** 行内音符点缀 */
export function InlineNotes({ text = '♪ ♫ ♪' }: { text?: string }) {
  return (
    <span className="notes-inline" aria-hidden>
      {text}
    </span>
  );
}
