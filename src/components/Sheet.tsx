import type { CSSProperties, ReactNode } from 'react';
import { useStage } from '../world/hooks';
import { sheetStage, type SheetOptions } from '../world/stages/sheet';

export function Sheet({
  className = '',
  children,
  style,
  ...o
}: SheetOptions & { className?: string; children?: ReactNode; style?: CSSProperties }) {
  const ref = useStage<HTMLDivElement>((el) => sheetStage(el, o), [o.kind, o.fingers, o.screws, o.tape]);
  return (
    <div className={`sheet sheet-${o.kind} ${className}`} style={style}>
      <div className="sheet-bg" ref={ref} aria-hidden />
      {children}
    </div>
  );
}
