import { PdfLineAnnoObject } from '@embedpdf/models';
import { applyLineDimensionDerivedState } from '../../geometry/line-dimension';
import { PatchFunction } from '../patch-registry';
import { patchLine } from './line.patch';

export const patchLineMeasurement: PatchFunction<PdfLineAnnoObject> = (orig, ctx) => {
  const basePatch = patchLine(orig, ctx);
  const merged = {
    ...orig,
    ...basePatch,
    ...(ctx.changes.measurement ? { measurement: ctx.changes.measurement } : {}),
    ...(ctx.changes.contents !== undefined ? { contents: ctx.changes.contents } : {}),
  };

  return {
    ...basePatch,
    ...(ctx.changes.measurement ? { measurement: ctx.changes.measurement } : {}),
    ...(ctx.changes.contents !== undefined ? { contents: ctx.changes.contents } : {}),
    ...applyLineDimensionDerivedState(merged),
  };
};
