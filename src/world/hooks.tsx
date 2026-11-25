// React glue for the bench.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { LetterStage, type Letter, type LetterOptions } from './letters';
import { whenWorld, type Stage, type World } from './World';

/** Attach a 3D stage to a DOM element for as long as it is mounted. */
export function useStage<T extends HTMLElement>(
  make: (el: T, world: World) => Stage | null,
  deps: unknown[] = [],
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let drop: (() => void) | undefined;
    const cancel = whenWorld((w) => {
      if (!ref.current) return;
      drop = w.lazy(ref.current, () => {
        if (!ref.current) return;
        const s = make(ref.current, w);
        if (s) off = w.add(s);
      });
    });
    return () => {
      cancel();
      drop?.();
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export interface LettersProps extends LetterOptions {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
  className?: string;
  style3d?: CSSProperties;
  /** hide from assistive tech when the same words are elsewhere */
  decorative?: boolean;
  /** called once the meshes exist */
  onLetters?: (letters: Letter[], stage: LetterStage, world: World) => void | (() => void);
  children?: ReactNode;
}

export function Letters({
  text,
  as: Tag = 'div',
  className = '',
  decorative,
  onLetters,
  style3d,
  style,
  depth,
  curve,
  bevel,
  shy,
  lift,
}: LettersProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let clean: void | (() => void);
    let drop: (() => void) | undefined;
    const cancel = whenWorld((w) => {
      if (!ref.current) return;
      const opt: LetterOptions = { style };
      if (depth !== undefined) opt.depth = depth;
      if (curve !== undefined) opt.curve = curve;
      if (bevel !== undefined) opt.bevel = bevel;
      if (shy !== undefined) opt.shy = shy;
      if (lift !== undefined) opt.lift = lift;
      drop = w.lazy(ref.current, () => {
        if (!ref.current) return;
        const s = new LetterStage(ref.current, opt);
        s.onReady = (l) => {
          clean = onLetters?.(l, s, w);
        };
        off = w.add(s);
      });
    });
    return () => {
      cancel();
      drop?.();
      off?.();
      if (typeof clean === 'function') clean();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, style, depth, curve, bevel, shy]);

  const T = Tag as any;
  return (
    <T ref={ref} className={`l3d l3d-${style} ${className}`} style={style3d} aria-hidden={decorative || undefined}>
      {!decorative && <span className="sr">{text}</span>}
      {text.split(' ').map((w, wi, all) => (
        <span className="l3d-w" aria-hidden key={wi}>
          {Array.from(w).map((c, i) => (
            <span className="l3d-c" data-ch={c} key={i}>
              {c}
            </span>
          ))}
          {wi < all.length - 1 ? <span className="l3d-s">&nbsp;</span> : null}
        </span>
      ))}
    </T>
  );
}
