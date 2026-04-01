import {
  LineEndings,
  PdfAnnotationLineEnding,
  PdfAnnotationSubtype,
  PdfLineAnnoObject,
  PdfMeasurementScale,
  PdfMeasurementUnit,
  Position,
  Rect,
} from '@embedpdf/models';

export interface LineDimensionGeometry {
  measuredStart: Position;
  measuredEnd: Position;
  startLeaderBase: Position;
  endLeaderBase: Position;
  startDimension: Position;
  endDimension: Position;
  startLeaderTip: Position;
  endLeaderTip: Position;
  captionCenter: Position;
  captionAngle: number;
  captionText: string;
  visualRect: Rect;
  handles: [Position, Position, Position, Position];
}

type LineDimensionAnnotation = PdfLineAnnoObject & {
  fontSize?: number;
  fontColor?: string;
};

const MIN_LENGTH = 1e-3;
const DEFAULT_FONT_SIZE = 12;
const MIN_INTERACTION_OFFSET = 12;

function rectFromPoints(points: Position[]): Rect {
  if (!points.length) {
    return { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points.slice(1)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    origin: { x: minX, y: minY },
    size: { width: maxX - minX, height: maxY - minY },
  };
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    origin: {
      x: rect.origin.x - padding,
      y: rect.origin.y - padding,
    },
    size: {
      width: rect.size.width + padding * 2,
      height: rect.size.height + padding * 2,
    },
  };
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

function rotateOffset(offset: Position, angle: number): Position {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: offset.x * cos - offset.y * sin,
    y: offset.x * sin + offset.y * cos,
  };
}

function getArrowLeaderOvershoot(
  ending: PdfAnnotationLineEnding | undefined,
  strokeWidth: number,
): number {
  switch (ending) {
    case PdfAnnotationLineEnding.OpenArrow:
    case PdfAnnotationLineEnding.ClosedArrow:
    case PdfAnnotationLineEnding.ROpenArrow:
    case PdfAnnotationLineEnding.RClosedArrow:
      return strokeWidth * 4.5;
    case PdfAnnotationLineEnding.Slash:
      return strokeWidth * 4.5;
    default:
      return 0;
  }
}

export function isLineDimensionAnnotation(annotation: unknown): annotation is PdfLineAnnoObject {
  if (!annotation || typeof annotation !== 'object') {
    return false;
  }

  const candidate = annotation as PdfLineAnnoObject;
  return (
    candidate.type === PdfAnnotationSubtype.LINE &&
    (candidate.intent === 'LineDimension' || !!candidate.measurement)
  );
}

export function formatMeasurementValue(value: number, unit: PdfMeasurementUnit, precision: number) {
  return `${value.toFixed(precision)} ${unit}`;
}

export function getScaledDistance(
  start: Position,
  end: Position,
  measurementScale: PdfMeasurementScale | null | undefined,
) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (!measurementScale) {
    return null;
  }

  return distance * measurementScale.distance.conversionFactor;
}

export function getLineDimensionLabel(annotation: PdfLineAnnoObject) {
  const scale = annotation.measurement?.measure;
  const distance = getScaledDistance(annotation.linePoints.start, annotation.linePoints.end, scale);
  if (distance === null) {
    return annotation.contents ?? '';
  }
  if (!scale) {
    return annotation.contents ?? '';
  }

  return formatMeasurementValue(
    distance,
    scale.distance.unit,
    annotation.measurement?.measure.distance.precision ?? 2,
  );
}

export function getLineDimensionGeometry(annotation: LineDimensionAnnotation): LineDimensionGeometry {
  const measuredStart = annotation.linePoints.start;
  const measuredEnd = annotation.linePoints.end;
  const dx = measuredEnd.x - measuredStart.x;
  const dy = measuredEnd.y - measuredStart.y;
  const length = Math.max(Math.hypot(dx, dy), MIN_LENGTH);
  const dir = { x: dx / length, y: dy / length };
  const normal = { x: -dir.y, y: dir.x };

  const leaderOffset = annotation.measurement?.leaderOffset ?? 0;
  const leaderLength = annotation.measurement?.leaderLength ?? 0;
  const leaderExtension = annotation.measurement?.leaderExtension ?? 0;
  const dimensionDistance = leaderOffset + leaderLength;
  const dimensionSide = dimensionDistance < 0 ? -1 : 1;
  const interactionDistance =
    Math.abs(dimensionDistance) < MIN_INTERACTION_OFFSET
      ? dimensionSide * MIN_INTERACTION_OFFSET
      : dimensionDistance;
  const startLeaderOvershoot = getArrowLeaderOvershoot(annotation.lineEndings?.start, annotation.strokeWidth);
  const endLeaderOvershoot = getArrowLeaderOvershoot(annotation.lineEndings?.end, annotation.strokeWidth);

  const startLeaderBase = {
    x: measuredStart.x + normal.x * leaderOffset,
    y: measuredStart.y + normal.y * leaderOffset,
  };
  const endLeaderBase = {
    x: measuredEnd.x + normal.x * leaderOffset,
    y: measuredEnd.y + normal.y * leaderOffset,
  };
  const startDimension = {
    x: measuredStart.x + normal.x * dimensionDistance,
    y: measuredStart.y + normal.y * dimensionDistance,
  };
  const endDimension = {
    x: measuredEnd.x + normal.x * dimensionDistance,
    y: measuredEnd.y + normal.y * dimensionDistance,
  };
  const startLeaderTip = {
    x:
      measuredStart.x +
      normal.x * (dimensionDistance + dimensionSide * (leaderExtension + startLeaderOvershoot)),
    y:
      measuredStart.y +
      normal.y * (dimensionDistance + dimensionSide * (leaderExtension + startLeaderOvershoot)),
  };
  const endLeaderTip = {
    x:
      measuredEnd.x +
      normal.x * (dimensionDistance + dimensionSide * (leaderExtension + endLeaderOvershoot)),
    y:
      measuredEnd.y +
      normal.y * (dimensionDistance + dimensionSide * (leaderExtension + endLeaderOvershoot)),
  };

  const captionOffset = annotation.measurement?.captionOffset ?? { x: 0, y: 0 };
  const captionFontSize = annotation.fontSize ?? DEFAULT_FONT_SIZE;
  const captionGap = Math.abs(captionOffset.y);
  const captionSide = captionOffset.y < 0 ? 1 : -1;
  const captionAngle = Math.atan2(dir.y, dir.x);
  const label = getLineDimensionLabel(annotation);
  const captionBase = {
    x: (startDimension.x + endDimension.x) / 2,
    y: (startDimension.y + endDimension.y) / 2,
  };
  const captionShift = rotateOffset(
    {
      x: captionOffset.x,
      y: captionGap * captionSide,
    },
    captionAngle,
  );
  const captionLift =
    annotation.measurement?.captionPosition === 'Top'
      ? {
          x: normal.x * captionSide * (captionFontSize * 0.9),
          y: normal.y * captionSide * (captionFontSize * 0.9),
        }
      : { x: 0, y: 0 };
  const captionCenter = {
    x: captionBase.x + captionShift.x + captionLift.x,
    y: captionBase.y + captionShift.y + captionLift.y,
  };

  const textWidth = estimateTextWidth(label, captionFontSize);
  const halfWidth = textWidth / 2;
  const halfHeight = captionFontSize / 2;
  const corners = [
    rotateOffset({ x: -halfWidth, y: -halfHeight }, captionAngle),
    rotateOffset({ x: halfWidth, y: -halfHeight }, captionAngle),
    rotateOffset({ x: halfWidth, y: halfHeight }, captionAngle),
    rotateOffset({ x: -halfWidth, y: halfHeight }, captionAngle),
  ].map((corner) => ({
    x: captionCenter.x + corner.x,
    y: captionCenter.y + corner.y,
  }));

  const visualRect = expandRect(
    rectFromPoints([
      measuredStart,
      measuredEnd,
      startLeaderBase,
      endLeaderBase,
      startDimension,
      endDimension,
      startLeaderTip,
      endLeaderTip,
      ...corners,
    ]),
    Math.max(annotation.strokeWidth * 3, 12),
  );

  return {
    measuredStart,
    measuredEnd,
    startLeaderBase,
    endLeaderBase,
    startDimension,
    endDimension,
    startLeaderTip,
    endLeaderTip,
    captionCenter,
    captionAngle,
    captionText: label,
    visualRect,
    handles: [
      measuredStart,
      measuredEnd,
      {
        x: measuredStart.x + normal.x * interactionDistance,
        y: measuredStart.y + normal.y * interactionDistance,
      },
      {
        x: measuredEnd.x + normal.x * interactionDistance,
        y: measuredEnd.y + normal.y * interactionDistance,
      },
    ],
  };
}

export function applyLineDimensionDerivedState(
  annotation: PdfLineAnnoObject,
): Partial<PdfLineAnnoObject> {
  if (!isLineDimensionAnnotation(annotation)) {
    return {};
  }

  const geometry = getLineDimensionGeometry(annotation);
  return {
    rect: geometry.visualRect,
    contents: geometry.captionText,
  };
}

export function getLineDimensionHandleVertices(annotation: PdfLineAnnoObject): Position[] {
  return [...getLineDimensionGeometry(annotation).handles];
}

export function updateLineDimensionFromVertices(
  annotation: PdfLineAnnoObject,
  vertices: Position[],
  metadata?: { vertexIndex?: number; handleRole?: string; [key: string]: unknown },
): Partial<PdfLineAnnoObject> {
  if (vertices.length < 4) {
    return {};
  }

  if (!annotation.measurement) {
    return {
      linePoints: {
        start: vertices[0],
        end: vertices[1],
      },
    };
  }

  const measurement = annotation.measurement;
  const originalHandles = getLineDimensionHandleVertices(annotation);
  const movedVertexIndex = metadata?.vertexIndex;
  const movedDistances = vertices.map((vertex, index) =>
    Math.hypot(vertex.x - originalHandles[index].x, vertex.y - originalHandles[index].y),
  );
  const inferredVertexIndex =
    movedVertexIndex ??
    movedDistances.reduce(
      (bestIndex, distance, index, all) => (distance > all[bestIndex] ? index : bestIndex),
      0,
    );
  const inferredHandleRole =
    inferredVertexIndex === 0
      ? 'measure-start'
      : inferredVertexIndex === 1
        ? 'measure-end'
        : inferredVertexIndex === 2
          ? 'offset-start'
          : inferredVertexIndex === 3
            ? 'offset-end'
            : 'unknown';
  const handleRole = metadata?.handleRole ?? inferredHandleRole;
  const nextMeasurement = {
    ...measurement,
    captionOffset: measurement.captionOffset ?? { x: 0, y: 0 },
    leaderLength: measurement.leaderLength ?? 0,
    leaderExtension: measurement.leaderExtension ?? 0,
    leaderOffset: measurement.leaderOffset ?? 0,
  };

  const nextLinePoints =
    handleRole === 'measure-start' || handleRole === 'measure-end'
      ? {
          start: vertices[0],
          end: vertices[1],
        }
      : annotation.linePoints;

  const start = nextLinePoints.start;
  const end = nextLinePoints.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), MIN_LENGTH);
  const normal = { x: -dy / length, y: dx / length };
  const originalDimensionDistance = nextMeasurement.leaderOffset + nextMeasurement.leaderLength;

  if (handleRole === 'offset-start' || handleRole === 'offset-end') {
    const anchor = handleRole === 'offset-start' ? start : end;
    const movedHandle = handleRole === 'offset-start' ? vertices[2] : vertices[3];
    const dimensionDistance =
      (movedHandle.x - anchor.x) * normal.x + (movedHandle.y - anchor.y) * normal.y;
    nextMeasurement.leaderLength = dimensionDistance - (nextMeasurement.leaderOffset ?? 0);
  }

  console.log('[LineDimension][vertex-edit]', {
    annotationId: annotation.id,
    metadata,
    inferredVertexIndex,
    handleRole,
    originalHandles,
    vertices,
    originalLinePoints: annotation.linePoints,
    nextLinePoints,
    originalMeasurement: annotation.measurement,
    nextMeasurement,
  });

  return {
    linePoints: nextLinePoints,
    measurement: nextMeasurement,
  };
}

export function getDimensionLineEndings(annotation: PdfLineAnnoObject): LineEndings | undefined {
  return annotation.lineEndings;
}
