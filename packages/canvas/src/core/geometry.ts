import type {
  CanvasElement,
  NormalizedBounds,
  TransformHandle,
  Viewport,
} from "../types";

interface Point {
  x: number;
  y: number;
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: Viewport,
): Point {
  const x = (worldX - viewport.panX) * viewport.zoom;
  const y = (worldY - viewport.panY) * viewport.zoom;
  return { x: x, y: y };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: Viewport,
): Point {
  const x = screenX / viewport.zoom + viewport.panX;
  const y = screenY / viewport.zoom + viewport.panY;
  return { x: 0, y: 0 };
}

export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  angleRad: number,
): { x: number; y: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

export function getElementBounds(
  cnvs_element: CanvasElement,
): NormalizedBounds {
  if (
    cnvs_element.type === "pencil" &&
    cnvs_element.points &&
    cnvs_element.points.length > 0
  ) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of cnvs_element.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  }

  if (cnvs_element.type === "line") {
    if (
      cnvs_element.x1 !== undefined &&
      cnvs_element.y1 !== undefined &&
      cnvs_element.x2 !== undefined &&
      cnvs_element.y2 !== undefined
    ) {
      const minX = Math.min(cnvs_element.x1, cnvs_element.x2);
      const minY = Math.min(cnvs_element.y1, cnvs_element.y2);
      const maxX = Math.max(cnvs_element.x1, cnvs_element.x2);
      const maxY = Math.max(cnvs_element.y1, cnvs_element.y2);
      return {
        x: minX,
        y: minY,
        width: Math.max(6, maxX - minX),
        height: Math.max(6, maxY - minY),
      };
    }
  }

  if (cnvs_element.type === "circle") {
    if (
      cnvs_element.radius !== undefined &&
      cnvs_element.centerX !== undefined &&
      cnvs_element.centerY !== undefined
    ) {
      return {
        x: cnvs_element.centerX - cnvs_element.radius,
        y: cnvs_element.centerY - cnvs_element.radius,
        width: cnvs_element.radius * 2,
        height: cnvs_element.radius * 2,
      };
    }
  }

  const normX =
    cnvs_element.width < 0
      ? cnvs_element.x + cnvs_element.width
      : cnvs_element.x;
  const normY =
    cnvs_element.height < 0
      ? cnvs_element.y + cnvs_element.height
      : cnvs_element.y;
  return {
    x: normX,
    y: normY,
    width: Math.abs(cnvs_element.width || 20),
    height: Math.abs(cnvs_element.height || 20),
  };
}

export function getGroupBounds(
  elements: CanvasElement[],
): NormalizedBounds | null {
  const active = elements.filter((el) => !el.isDeleted);
  if (active.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of active) {
    const b = getElementBounds(el);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  if (minX === Infinity) return null;

  return {
    x: minX,
    y: minY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

export function getHandlePositions(
  bounds: NormalizedBounds,
  viewport: Viewport,
  angleRad = 0,
): Record<TransformHandle, { x: number; y: number }> {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const screenCenter = worldToScreen(cx, cy, viewport);

  const halfW = (bounds.width / 2) * viewport.zoom;
  const halfH = (bounds.height / 2) * viewport.zoom;

  // Unrotated offsets relative to bounding center
  const offsets: Record<TransformHandle, { dx: number; dy: number }> = {
    nw: { dx: -halfW, dy: -halfH },
    n: { dx: 0, dy: -halfH },
    ne: { dx: halfW, dy: -halfH },
    e: { dx: halfW, dy: 0 },
    se: { dx: halfW, dy: halfH },
    s: { dx: 0, dy: halfH },
    sw: { dx: -halfW, dy: halfH },
    w: { dx: -halfW, dy: 0 },
    rot: { dx: 0, dy: -halfH - 24 },
  };

  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const result = {} as Record<TransformHandle, { x: number; y: number }>;
  for (const [key, offset] of Object.entries(offsets)) {
    const rx = offset.dx * cos - offset.dy * sin;
    const ry = offset.dx * sin + offset.dy * cos;
    result[key as TransformHandle] = {
      x: screenCenter.x + rx,
      y: screenCenter.y + ry,
    };
  }

  return result;
}
