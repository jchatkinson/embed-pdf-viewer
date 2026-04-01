import { PdfAnnotationObject, Position } from '@embedpdf/models';

/**
 * Interface for vertex configuration - handles annotation-specific vertex logic
 */
export interface VertexConfig<T extends PdfAnnotationObject> {
  /** Extract vertices from annotation - handles different vertex formats */
  extractVertices: (annotation: T) => Position[];
  /** Optional metadata for each vertex handle */
  extractVertexMetadata?: (
    annotation: T,
  ) => Array<{ handleRole?: string; [key: string]: unknown } | undefined>;
  /** Transform annotation when vertices change */
  transformAnnotation: (
    annotation: T,
    vertices: Position[],
    metadata?: { vertexIndex?: number; handleRole?: string; [key: string]: unknown },
  ) => Partial<T>;
}
