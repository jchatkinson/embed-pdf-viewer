import {
  PdfAnnotationBorderStyle,
  PdfAnnotationSubtype,
  PdfLineAnnoObject,
} from '@embedpdf/models';
import { MouseEvent, useMemo } from '@framework';
import { patching } from '@embedpdf/plugin-annotation';
import {
  getDimensionLineEndings,
  getLineDimensionGeometry,
} from '../../../lib/geometry/line-dimension';

const MIN_HIT_AREA_SCREEN_PX = 20;
const DEFAULT_CAPTION_FONT_SIZE = 12;

function estimateTextWidth(text: string, fontSize: number) {
  return text.length * fontSize * 0.6;
}

interface LineDimensionProps extends Pick<
  PdfLineAnnoObject,
  | 'color'
  | 'contents'
  | 'lineEndings'
  | 'linePoints'
  | 'measurement'
  | 'opacity'
  | 'rect'
  | 'strokeColor'
  | 'strokeDashArray'
  | 'strokeStyle'
  | 'strokeWidth'
> {
  fontSize?: number;
  fontColor?: string;
  scale: number;
  onClick?: (e: MouseEvent<SVGElement>) => void;
  isSelected: boolean;
  appearanceActive?: boolean;
}

export function LineDimension({
  color = 'transparent',
  opacity = 1,
  strokeWidth,
  strokeColor = '#000000',
  strokeStyle = PdfAnnotationBorderStyle.SOLID,
  strokeDashArray,
  rect,
  lineEndings,
  linePoints,
  measurement,
  contents,
  fontSize = DEFAULT_CAPTION_FONT_SIZE,
  fontColor,
  scale,
  onClick,
  isSelected,
  appearanceActive = false,
}: LineDimensionProps): JSX.Element {
  const annotation = useMemo(
    () =>
      ({
        type: PdfAnnotationSubtype.LINE,
        rect,
        linePoints,
        lineEndings,
        strokeWidth,
        strokeColor,
        strokeStyle,
        strokeDashArray,
        color,
        opacity,
        contents,
        measurement,
        fontSize,
        fontColor,
      } as PdfLineAnnoObject & { fontSize?: number; fontColor?: string }),
    [
      rect,
      linePoints,
      lineEndings,
      strokeWidth,
      strokeColor,
      strokeStyle,
      strokeDashArray,
      color,
      opacity,
      contents,
      measurement,
      fontSize,
      fontColor,
    ],
  );
  const geometry = useMemo(() => getLineDimensionGeometry(annotation), [annotation]);

  const local = (point: { x: number; y: number }) => ({
    x: point.x - rect.origin.x,
    y: point.y - rect.origin.y,
  });

  const startLeaderBase = local(geometry.startLeaderBase);
  const endLeaderBase = local(geometry.endLeaderBase);
  const startLeaderTip = local(geometry.startLeaderTip);
  const endLeaderTip = local(geometry.endLeaderTip);
  const startDimension = local(geometry.startDimension);
  const endDimension = local(geometry.endDimension);
  const captionCenter = local(geometry.captionCenter);

  const endings = useMemo(() => {
    const angle = Math.atan2(
      geometry.endDimension.y - geometry.startDimension.y,
      geometry.endDimension.x - geometry.startDimension.x,
    );
    const dimEndings = getDimensionLineEndings(annotation);
    return {
      start: patching.createEnding(
        dimEndings?.start,
        strokeWidth,
        angle + Math.PI,
        startDimension.x,
        startDimension.y,
      ),
      end: patching.createEnding(dimEndings?.end, strokeWidth, angle, endDimension.x, endDimension.y),
    };
  }, [annotation, geometry, strokeWidth, startDimension.x, startDimension.y, endDimension.x, endDimension.y]);

  const hitStrokeWidth = Math.max(strokeWidth, MIN_HIT_AREA_SCREEN_PX / scale);
  const width = rect.size.width * scale;
  const height = rect.size.height * scale;
  const textRotation = (geometry.captionAngle * 180) / Math.PI;
  const captionBoxWidth = estimateTextWidth(geometry.captionText, fontSize) + 10;
  const captionBoxHeight = fontSize + 6;

  const sharedStrokeStyle = {
    stroke: strokeColor,
    strokeWidth,
    strokeLinecap: 'butt' as const,
    strokeLinejoin: 'round' as const,
    ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
      strokeDasharray: strokeDashArray?.join(','),
    }),
  };

  return (
    <svg
      style={{
        position: 'absolute',
        width,
        height,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'visible',
      }}
      width={width}
      height={height}
      viewBox={`0 0 ${rect.size.width} ${rect.size.height}`}
    >
      <g
        onPointerDown={onClick}
        style={{
          pointerEvents: !onClick ? 'none' : isSelected ? 'none' : 'visibleStroke',
          cursor: isSelected ? 'move' : onClick ? 'pointer' : 'default',
        }}
      >
        <line
          x1={startLeaderBase.x}
          y1={startLeaderBase.y}
          x2={startLeaderTip.x}
          y2={startLeaderTip.y}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
        />
        <line
          x1={endLeaderBase.x}
          y1={endLeaderBase.y}
          x2={endLeaderTip.x}
          y2={endLeaderTip.y}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
        />
        <line
          x1={startDimension.x}
          y1={startDimension.y}
          x2={endDimension.x}
          y2={endDimension.y}
          stroke="transparent"
          strokeWidth={hitStrokeWidth}
        />
      </g>

      {!appearanceActive && (
        <>
          <line
            x1={startLeaderBase.x}
            y1={startLeaderBase.y}
            x2={startLeaderTip.x}
            y2={startLeaderTip.y}
            opacity={opacity}
            style={sharedStrokeStyle}
          />
          <line
            x1={endLeaderBase.x}
            y1={endLeaderBase.y}
            x2={endLeaderTip.x}
            y2={endLeaderTip.y}
            opacity={opacity}
            style={sharedStrokeStyle}
          />
          <line
            x1={startDimension.x}
            y1={startDimension.y}
            x2={endDimension.x}
            y2={endDimension.y}
            opacity={opacity}
            style={sharedStrokeStyle}
          />
          {endings.start && (
            <path
              d={endings.start.d}
              transform={endings.start.transform}
              stroke={strokeColor}
              fill={endings.start.filled ? color : 'none'}
              opacity={opacity}
              style={sharedStrokeStyle}
            />
          )}
          {endings.end && (
            <path
              d={endings.end.d}
              transform={endings.end.transform}
              stroke={strokeColor}
              fill={endings.end.filled ? color : 'none'}
              opacity={opacity}
              style={sharedStrokeStyle}
            />
          )}
          {measurement?.showCaption !== false && geometry.captionText && (
            <>
              {measurement?.captionPosition !== "Top" && (
                <rect
                  x={captionCenter.x - captionBoxWidth / 2}
                  y={captionCenter.y - captionBoxHeight / 2}
                  width={captionBoxWidth}
                  height={captionBoxHeight}
                  fill="white"
                  opacity={0.95}
                  rx={2}
                  ry={2}
                  transform={`rotate(${textRotation} ${captionCenter.x} ${captionCenter.y})`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              <text
                x={captionCenter.x}
                y={captionCenter.y}
                fill={fontColor ?? strokeColor}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${textRotation} ${captionCenter.x} ${captionCenter.y})`}
                style={{ pointerEvents: 'none' }}
              >
                {geometry.captionText}
              </text>
            </>
          )}
        </>
      )}
    </svg>
  );
}
