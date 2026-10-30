/*
 * Geometry of the reel ring. Every card on the hero is placed by these functions and nothing else:
 * the loader deal, the reveal and the idle spin are all just different inputs to reelPose.
 *
 * Angles are in degrees. 0 is the far centre of the ring, ±180 is the slot nearest the camera.
 * Ring space: x to the right, y down, z toward the camera (the CSS convention).
 */

export interface Scene {
  radius: number;      // px
  tilt: number;        // deg, rotateX of the ring (negative: seen from above)
  roll: number;        // deg, rotateZ of the ring (dutch angle)
  perspective: number; // px, camera distance from the ring centre
  scale: number;       // card scale
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;           // deg, rotateY of the card; its face looks at the ring's axis
  scale: number;
  appear: number;        // 0..1 opacity while the card is being dealt
  behindCamera: boolean; // some part of the card is at or behind the camera plane
}

export const SLOTS = 16;
export const STEP = 360 / SLOTS;
export const CARD_W = 270;
export const CARD_H = 480;

/** Expansion 0: a small ring seen from above and outside, on a dutch angle. */
export const SMALL: Readonly<Scene> = Object.freeze({ radius: 460, tilt: -22, roll: -20, perspective: 1000, scale: 0.52 });
/** Expansion 1: a large ring, the camera level and inside it. */
export const LARGE: Readonly<Scene> = Object.freeze({ radius: 1800, tilt: 0, roll: 0, perspective: 450, scale: 2.3 });

/** Share of the formation one card spends swinging out; the rest of the timeline staggers the start times. */
export const SWING = 0.36;
/** How high a card lifts at the middle of its swing, in card heights. */
export const LIFT = 0.12;
/** The deal starts each card slightly smaller and grows it to full size as it lands. */
export const DEAL_SCALE = 0.84;

const DEG = Math.PI / 180;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mod = (a: number, n: number): number => ((a % n) + n) % n;
/** Wraps an angle into [-180, 180). */
export const wrap = (a: number): number => mod(a + 180, 360) - 180;
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * The camera at a point of the reveal. `fit` scales the whole scene for the viewport: multiplying the radius, the
 * camera distance and the card scale by the same factor scales the projected picture by that factor and nothing else.
 */
export function sceneAt(expansion: number, fit = 1): Scene {
  const t = clamp01(expansion);
  return {
    radius: lerp(SMALL.radius, LARGE.radius, t) * fit,
    tilt: lerp(SMALL.tilt, LARGE.tilt, t),
    roll: lerp(SMALL.roll, LARGE.roll, t),
    perspective: lerp(SMALL.perspective, LARGE.perspective, t) * fit,
    scale: lerp(SMALL.scale, LARGE.scale, t) * fit,
  };
}

/** Degrees a card travels from the stack at the front to its resting angle, going round the ring: [0, 360). */
export function dealTravel(angle: number): number {
  return mod(wrap(angle) - 180, 360);
}

/** Where a card's swing starts on the formation timeline. Ordered by angle, so the deal travels round the ring. */
export function dealStart(angle: number): number {
  return (dealTravel(angle) / 360) * (1 - SWING);
}

/**
 * Pose of the card whose resting angle is `angle`, at `formation` (0: every card stacked at the front,
 * 1: every card dealt to its angle), in `scene`.
 */
export function reelPose(angle: number, formation: number, scene: Scene): Pose {
  const travel = dealTravel(angle);
  const t = clamp01((clamp01(formation) - dealStart(angle)) / SWING);
  const e = easeOutCubic(t);

  const yaw = wrap(180 + travel * e);
  const a = yaw * DEG;
  const x = -Math.sin(a) * scene.radius;
  const z = -Math.cos(a) * scene.radius;
  const scale = scene.scale * lerp(DEAL_SCALE, 1, e);
  const y = -Math.sin(Math.PI * t) * LIFT * CARD_H * scale;

  // depth after the ring's tilt (the roll turns about the view axis and leaves depth alone), plus the card's own
  // reach toward the camera from its width (turned by yaw) and its height (turned by tilt)
  const tl = scene.tilt * DEG;
  const depth = y * Math.sin(tl) + z * Math.cos(tl);
  const reach = (CARD_W / 2) * scale * Math.abs(Math.sin(a)) * Math.cos(tl) + (CARD_H / 2) * scale * Math.abs(Math.sin(tl));
  const behindCamera = depth + reach >= scene.perspective * 0.96;

  return { x, y, z, yaw, scale, appear: smooth(clamp01(t / 0.3)), behindCamera };
}

/** Screen position of a card's centre relative to the stage centre, in px, and its perspective factor. */
export function project(pose: Pose, scene: Scene): { x: number; y: number; k: number } {
  const tl = scene.tilt * DEG, rl = scene.roll * DEG;
  const y1 = pose.y * Math.cos(tl) - pose.z * Math.sin(tl);
  const z1 = pose.y * Math.sin(tl) + pose.z * Math.cos(tl);
  const x2 = pose.x * Math.cos(rl) - y1 * Math.sin(rl);
  const y2 = pose.x * Math.sin(rl) + y1 * Math.cos(rl);
  const k = scene.perspective / Math.max(1e-6, scene.perspective - z1);
  return { x: x2 * k, y: y2 * k, k };
}

/** True when the card's face, not its back, is turned toward the camera. */
export function facing(pose: Pose, scene: Scene): boolean {
  const a = pose.yaw * DEG, tl = scene.tilt * DEG;
  const y1 = pose.y * Math.cos(tl) - pose.z * Math.sin(tl);
  const z1 = pose.y * Math.sin(tl) + pose.z * Math.cos(tl);
  // the face normal points at the ring's axis: (sin a, 0, cos a), turned by the tilt
  const n = [Math.sin(a), -Math.cos(a) * Math.sin(tl), Math.cos(a) * Math.cos(tl)];
  return -pose.x * n[0] - y1 * n[1] + (scene.perspective - z1) * n[2] > 0;
}

/** Current angle of a DOM slot when the ring has turned by `ring` degrees. */
export function slotAngle(slot: number, ring: number): number {
  return wrap(slot * STEP + ring);
}

/**
 * Which reel a DOM slot holds. The 16 slots form a window onto an endless strip of reels: a slot's strip position is
 * (angle - ring) / STEP, so neighbours always hold consecutive reels, and a slot only changes reel when it wraps
 * through ±180, the back of the ring, where it can't be seen.
 */
export function slotReel(slot: number, ring: number, reelCount: number): number {
  const lap = Math.floor((slot * STEP + ring + 180) / 360);
  return mod(slot - SLOTS * lap, reelCount);
}
