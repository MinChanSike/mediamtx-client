import type { SVGProps } from 'react';

export type GridLayoutShape = '1x1' | '1x2' | '2x2' | '3x3' | '4x4';

const GRID_LAYOUT_DIMENSIONS: Record<GridLayoutShape, { rows: number; columns: number }> = {
  '1x1': { rows: 1, columns: 1 },
  '1x2': { rows: 1, columns: 2 },
  '2x2': { rows: 2, columns: 2 },
  '3x3': { rows: 3, columns: 3 },
  '4x4': { rows: 4, columns: 4 },
};

export default function GridLayoutIcon({
  layout,
  ...props
}: SVGProps<SVGSVGElement> & { layout: GridLayoutShape }) {
  const { rows, columns } = GRID_LAYOUT_DIMENSIONS[layout];
  const size = 20;
  const gap = rows === 1 && columns === 1 ? 0 : 2;
  const padding = 2;
  const cellWidth = (size - padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (size - padding * 2 - gap * (rows - 1)) / rows;

  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      focusable="false"
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      {...props}
    >
      {Array.from({ length: rows * columns }, (_, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        return (
          <rect
            key={index}
            x={padding + column * (cellWidth + gap)}
            y={padding + row * (cellHeight + gap)}
            width={cellWidth}
            height={cellHeight}
            rx={1}
          />
        );
      })}
    </svg>
  );
}
