'use client';

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { MotionConfig, motion, useDragControls } from 'motion/react';

export type WidgetSize = 'sm' | 'wide' | 'tall' | 'lg';

export interface WidgetItem {
  id: string;
  size: WidgetSize;
  label?: string;
}

export interface DraggableWidgetGridProps {
  items?: WidgetItem[];
  onChange?: (items: WidgetItem[]) => void;
  renderItem?: (item: WidgetItem, size: WidgetSize) => ReactNode;
  editable?: boolean;
  maxColumns?: number;
  cellSize?: number;
  gap?: number;
  radius?: number;
  className?: string;
}

type Placement = { id: string; col: number; row: number; w: number; h: number };

const SPANS: Record<WidgetSize, { col: number; row: number }> = {
  sm: { col: 1, row: 1 },
  wide: { col: 2, row: 1 },
  tall: { col: 1, row: 2 },
  lg: { col: 2, row: 2 },
};

const SIZE_LABELS: Record<WidgetSize, string> = {
  sm: 'Small',
  wide: 'Wide',
  tall: 'Tall',
  lg: 'Large',
};

const DEFAULT_ITEMS: WidgetItem[] = [
  { id: 'widget-1', size: 'wide' },
  { id: 'widget-2', size: 'sm' },
  { id: 'widget-3', size: 'sm' },
  { id: 'widget-4', size: 'wide' },
];

const useIsoLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function span(item: WidgetItem, columns: number) {
  return {
    w: Math.min(SPANS[item.size].col, columns),
    h: SPANS[item.size].row,
  };
}

/** Packs widgets into the first available cells while preserving their order. */
function layout(items: WidgetItem[], columns: number): Placement[] {
  if (!items.length || columns < 1) return [];
  const occupied = new Set<string>();
  const result: Placement[] = [];

  for (const item of items) {
    const { w, h } = span(item, columns);
    let row = 0;
    let placed = false;
    while (!placed) {
      for (let col = 0; col <= columns - w; col += 1) {
        let free = true;
        for (let y = row; y < row + h && free; y += 1) {
          for (let x = col; x < col + w; x += 1) {
            if (occupied.has(`${x}:${y}`)) free = false;
          }
        }
        if (!free) continue;
        for (let y = row; y < row + h; y += 1) {
          for (let x = col; x < col + w; x += 1) occupied.add(`${x}:${y}`);
        }
        result.push({ id: item.id, col, row, w, h });
        placed = true;
        break;
      }
      row += 1;
    }
  }
  return result;
}

function move(items: WidgetItem[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const SPRING = { type: 'spring', visualDuration: 0.38, bounce: 0.16 } as const;
const SHADOW_REST =
  '0 1px 2px rgba(15,23,42,.05), 0 0 0 rgba(15,23,42,0)';
const SHADOW_LIFTED =
  '0 24px 52px -16px rgba(15,23,42,.35), 0 8px 20px -8px rgba(15,23,42,.2)';

type WidgetHandlers = {
  start: (id: string) => void;
  drag: (id: string, x: number, y: number) => void;
  end: (id: string) => void;
  key: (event: ReactKeyboardEvent, id: string) => void;
};

const Widget = memo(function Widget({
  item,
  placement,
  editable,
  active,
  position,
  count,
  hintId,
  handlers,
  renderItem,
}: {
  item: WidgetItem;
  placement: Placement;
  editable: boolean;
  active: boolean;
  position: number;
  count: number;
  hintId: string;
  handlers: WidgetHandlers;
  renderItem?: (item: WidgetItem, size: WidgetSize) => ReactNode;
}) {
  const controls = useDragControls();
  const pointer = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  return (
    <motion.li
      data-widget-id={item.id}
      tabIndex={editable ? 0 : undefined}
      aria-label={item.label ?? `${SIZE_LABELS[item.size]} widget`}
      aria-describedby={editable ? hintId : undefined}
      aria-posinset={position}
      aria-setsize={count}
      layout="position"
      drag={editable}
      dragListener={false}
      dragControls={controls}
      dragSnapToOrigin
      dragMomentum={false}
      onPointerDown={(event) => {
        if (!editable || event.button !== 0 || !event.isPrimary) return;
        pointer.current = { x: event.clientX, y: event.clientY };
        moved.current = false;
        controls.start(event);
      }}
      onDragStart={() => handlers.start(item.id)}
      onDrag={(_, info) => {
        moved.current = true;
        handlers.drag(item.id, pointer.current.x + info.offset.x, pointer.current.y + info.offset.y);
      }}
      onDragEnd={() => handlers.end(item.id)}
      onKeyDown={(event) => handlers.key(event, item.id)}
      onClickCapture={(event) => {
        if (moved.current) {
          event.preventDefault();
          event.stopPropagation();
          moved.current = false;
        }
      }}
      animate={{
        scale: active ? 1.035 : 1,
        boxShadow: active ? SHADOW_LIFTED : SHADOW_REST,
      }}
      whileDrag={{ scale: 1.035, boxShadow: SHADOW_LIFTED }}
      transition={SPRING}
      className={`relative min-w-0 rounded-[var(--widget-radius)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        editable
          ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing'
          : ''
      }`}
      style={{
        gridColumn: `${placement.col + 1} / span ${placement.w}`,
        gridRow: `${placement.row + 1} / span ${placement.h}`,
        zIndex: active ? 20 : 0,
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-[var(--widget-radius)] bg-card text-card-foreground ring-1 ring-border">
        {renderItem?.(item, item.size)}
      </div>
    </motion.li>
  );
});

export function DraggableWidgetGrid({
  items: initialItems,
  onChange,
  renderItem,
  editable = true,
  maxColumns = 4,
  cellSize = 215,
  gap = 12,
  radius = 18,
  className = '',
}: DraggableWidgetGridProps) {
  const [items, setItems] = useState(() => initialItems ?? DEFAULT_ITEMS);
  const [metrics, setMetrics] = useState({ unit: 0, columns: 0 });
  const [active, setActive] = useState<string | null>(null);
  const grid = useRef<HTMLUListElement | null>(null);
  const itemsRef = useRef(items);
  const hintId = useId();
  const minColumns = Math.min(2, Math.max(1, maxColumns));

  useIsoLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (width < 1) return;
      const columns = Math.max(
        minColumns,
        Math.min(maxColumns, Math.round(width / cellSize)),
      );
      const unit = (width - gap * (columns - 1)) / columns;
      setMetrics((current) =>
        current.columns === columns && Math.abs(current.unit - unit) < 0.5
          ? current
          : { unit, columns },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [cellSize, gap, maxColumns, minColumns]);

  const columns = metrics.columns || maxColumns;
  const placements = useMemo(() => layout(items, columns), [items, columns]);
  const placementById = useMemo(
    () => new Map(placements.map((placement) => [placement.id, placement])),
    [placements],
  );
  useIsoLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const commit = useCallback(
    (next: WidgetItem[], notify = false) => {
      itemsRef.current = next;
      setItems(next);
      if (notify) onChange?.(next);
    },
    [onChange],
  );

  const handlers = useMemo<WidgetHandlers>(
    () => ({
      start: setActive,
      drag: (id, x, y) => {
        const elements = grid.current?.querySelectorAll<HTMLElement>('[data-widget-id]');
        if (!elements) return;
        const target = [...elements].find((element) => {
          if (element.dataset.widgetId === id) return false;
          const rect = element.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        if (!target?.dataset.widgetId) return;
        const current = itemsRef.current;
        const from = current.findIndex((item) => item.id === id);
        const to = current.findIndex((item) => item.id === target.dataset.widgetId);
        if (from !== to) commit(move(current, from, to));
      },
      end: () => {
        setActive(null);
        onChange?.(itemsRef.current);
      },
      key: (event, id) => {
        if (!editable || !event.altKey) return;
        const delta =
          event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? 1
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? -1
              : 0;
        if (!delta) return;
        event.preventDefault();
        const current = itemsRef.current;
        const from = current.findIndex((item) => item.id === id);
        const next = move(current, from, from + delta);
        if (next !== current) {
          commit(next, true);
          requestAnimationFrame(() =>
            grid.current?.querySelector<HTMLElement>(
              `[data-widget-id="${CSS.escape(id)}"]`,
            )?.focus(),
          );
        }
      },
    }),
    [commit, editable, onChange],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`relative w-full ${className}`}
        style={{ '--widget-radius': `${radius}px` } as CSSProperties}
      >
        {editable && (
          <p id={hintId} className="sr-only">
            Drag to rearrange. On a keyboard, hold Alt and press an arrow key.
          </p>
        )}
        <ul
          ref={grid}
          data-slot="widget-grid"
          className="m-0 grid w-full list-none p-0"
          style={{
            gap,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: metrics.unit
              ? `${Math.round(metrics.unit)}px`
              : `minmax(${cellSize * 0.75}px, auto)`,
          }}
        >
          {items.map((item, index) => {
            const placement = placementById.get(item.id);
            if (!placement) return null;
            return (
              <Widget
                key={item.id}
                item={item}
                placement={placement}
                editable={editable}
                active={active === item.id}
                position={index + 1}
                count={items.length}
                hintId={hintId}
                handlers={handlers}
                renderItem={renderItem}
              />
            );
          })}
        </ul>
      </div>
    </MotionConfig>
  );
}

export default DraggableWidgetGrid;