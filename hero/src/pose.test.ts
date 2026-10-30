import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARD_H, LARGE, SLOTS, SMALL, STEP, SWING,
  dealStart, dealTravel, facing, mod, project, reelPose, sceneAt, slotAngle, slotReel, wrap,
} from "./pose.ts";

const near = (a: number, b: number, eps = 1e-6, msg?: string) =>
  assert.ok(Math.abs(a - b) <= eps, msg ?? `expected ${a} to be within ${eps} of ${b}`);
const angles = Array.from({ length: SLOTS }, (_, i) => wrap(i * STEP + 7));

test("0 degrees is the far centre, ±180 the card nearest the camera", () => {
  const far = reelPose(0, 1, LARGE);
  near(far.x, 0); near(far.z, -LARGE.radius); near(far.yaw, 0);
  const front = reelPose(180, 1, SMALL);
  near(front.x, 0, 1e-6); near(front.z, SMALL.radius);
  const side = reelPose(90, 1, LARGE);
  near(side.x, -LARGE.radius); near(side.z, 0, 1e-6);
});

test("x = -sin(a) * radius, z = -cos(a) * radius, yaw = a, once dealt", () => {
  for (const a of angles) {
    const p = reelPose(a, 1, LARGE), r = (a * Math.PI) / 180;
    near(p.x, -Math.sin(r) * LARGE.radius); near(p.z, -Math.cos(r) * LARGE.radius);
    near(wrap(p.yaw - a), 0, 1e-9); near(p.y, 0, 1e-9);
    near(p.scale, LARGE.scale); assert.equal(p.appear, 1);
  }
});

test("the pose is what the CSS transform rotateY(yaw) translate3d(0, y, -radius) scale(s) draws", () => {
  // CSS rotateY(t) maps (x, y, z) to (x cos t + z sin t, y, -x sin t + z cos t)
  for (const f of [0.2, 0.5, 1]) for (const a of angles) {
    const p = reelPose(a, f, SMALL), t = (p.yaw * Math.PI) / 180, z = -SMALL.radius;
    near(p.x, z * Math.sin(t), 1e-9); near(p.z, z * Math.cos(t), 1e-9);
  }
});

test("at formation 0 every card waits, invisible, in one stack at the front", () => {
  for (const a of angles) {
    const p = reelPose(a, 0, SMALL);
    near(wrap(p.yaw - 180), 0, 1e-9); near(p.x, 0, 1e-9); near(p.z, SMALL.radius, 1e-9);
    assert.equal(p.appear, 0);
  }
});

test("the deal travels round the ring in order of angle", () => {
  const order = [...angles].sort((a, b) => dealStart(a) - dealStart(b));
  // each card in the deal is the next slot round the ring from the one before it
  for (let i = 1; i < order.length; i++) near(mod(order[i] - order[i - 1], 360), STEP, 1e-9);
  assert.ok(dealStart(order[order.length - 1]) <= 1 - SWING);
  // and at any moment, no card is further along its swing than a card dealt before it
  for (let f = 0; f <= 1; f += 0.01) {
    const done = order.map((a) => {
      const travel = dealTravel(a);
      return travel < 1 ? 1 : mod(reelPose(a, f, SMALL).yaw - 180, 360) / travel;
    });
    for (let i = 2; i < done.length; i++) assert.ok(done[i] <= done[i - 1] + 1e-9, `card ${i} ahead of ${i - 1} at ${f}`);
  }
});

test("cards fade in as they are dealt and are fully there when they land", () => {
  for (const a of angles) {
    let last = 0;
    for (let f = 0; f <= 1.0001; f += 0.01) {
      const p = reelPose(a, f, SMALL);
      assert.ok(p.appear >= last - 1e-12); last = p.appear;
    }
    assert.equal(last, 1);
  }
});

test("the deal never jumps: small steps in formation make small moves", () => {
  for (const a of angles) {
    let prev = reelPose(a, 0, SMALL);
    for (let f = 0.002; f <= 1; f += 0.002) {
      const p = reelPose(a, f, SMALL);
      const d = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
      assert.ok(d < 2 * Math.PI * SMALL.radius * 0.03, `jump of ${d.toFixed(1)}px at ${f.toFixed(3)} for ${a}`);
      prev = p;
    }
  }
});

test("a card lifts during its swing and is back on the ring when it lands", () => {
  const mid = reelPose(0, dealStart(0) + SWING / 2, SMALL);
  assert.ok(mid.y < -0.05 * CARD_H * SMALL.scale);
  near(reelPose(0, 1, SMALL).y, 0, 1e-9);
});

test("the reveal goes from the small outside ring to the large inside ring", () => {
  assert.deepEqual(sceneAt(0), { ...SMALL });
  assert.deepEqual(sceneAt(1), { ...LARGE });
  const m = sceneAt(0.5);
  near(m.radius, 1130); near(m.tilt, -11); near(m.roll, -10); near(m.perspective, 725); near(m.scale, 1.41);
  assert.deepEqual(sceneAt(-1), sceneAt(0)); assert.deepEqual(sceneAt(2), sceneAt(1));
});

test("the camera starts outside the ring and ends inside it", () => {
  assert.ok(SMALL.perspective > SMALL.radius);
  assert.ok(LARGE.perspective < LARGE.radius);
});

test("fit scales the projected picture and nothing else", () => {
  for (const e of [0, 0.4, 1]) for (const a of angles) {
    const s1 = sceneAt(e), s2 = sceneAt(e, 0.5);
    const p1 = reelPose(a, 1, s1), p2 = reelPose(a, 1, s2);
    assert.equal(p1.behindCamera, p2.behindCamera);
    if (p1.behindCamera) continue;
    const q1 = project(p1, s1), q2 = project(p2, s2);
    near(q2.x, q1.x * 0.5, 1e-6); near(q2.y, q1.y * 0.5, 1e-6);
  }
});

test("behind the camera: only near the front, and only once the camera is inside the ring", () => {
  for (const a of angles) assert.equal(reelPose(a, 1, SMALL).behindCamera, false, `angle ${a}`);
  assert.equal(reelPose(180, 1, LARGE).behindCamera, true);
  assert.equal(reelPose(135, 1, LARGE).behindCamera, true);
  assert.equal(reelPose(0, 1, LARGE).behindCamera, false);
  assert.equal(reelPose(60, 1, LARGE).behindCamera, false);
});

test("faces: the far side faces the camera, the near side of the small ring shows its back", () => {
  assert.ok(facing(reelPose(0, 1, SMALL), SMALL));
  assert.ok(facing(reelPose(0, 1, LARGE), LARGE));
  assert.ok(facing(reelPose(60, 1, LARGE), LARGE));
  assert.ok(!facing(reelPose(180, 1, SMALL), SMALL));
  assert.ok(!facing(reelPose(150, 1, SMALL), SMALL));
});

test("projection: the far centre card sits in the middle, shrunk by its distance", () => {
  const p = project(reelPose(0, 1, LARGE), LARGE);
  near(p.x, 0, 1e-9); near(p.y, 0, 1e-9); near(p.k, LARGE.perspective / (LARGE.perspective + LARGE.radius));
  const r = project(reelPose(-30, 1, LARGE), LARGE);
  assert.ok(r.x > 0, "negative angles are to the right");
});

test("recycling: neighbours hold consecutive reels", () => {
  for (const n of [5, 16, 19, 40]) for (let ring = -900; ring <= 900; ring += 13.7) {
    const slots = Array.from({ length: SLOTS }, (_, s) => s).sort((a, b) => slotAngle(a, ring) - slotAngle(b, ring));
    for (let i = 1; i < SLOTS; i++)
      assert.equal(slotReel(slots[i], ring, n), (slotReel(slots[i - 1], ring, n) + 1) % n, `n=${n} ring=${ring}`);
  }
});

test("recycling: a slot only swaps its reel at the back of the ring", () => {
  for (let s = 0; s < SLOTS; s++) {
    let prev = slotReel(s, -720, 19), prevA = slotAngle(s, -720);
    for (let ring = -720; ring <= 720; ring += 0.5) {
      const r = slotReel(s, ring, 19), a = slotAngle(s, ring);
      if (r !== prev) assert.ok(Math.abs(a) > 170 && Math.abs(prevA) > 170, `slot ${s} swapped at ${a}`);
      prev = r; prevA = a;
    }
  }
});

test("recycling: turning one full step brings the next reel to the centre", () => {
  const centre = (ring: number) => {
    const s = Array.from({ length: SLOTS }, (_, i) => i).find((i) => Math.abs(slotAngle(i, ring)) < 1e-6)!;
    return slotReel(s, ring, 19);
  };
  assert.equal(centre(0), 0);
  assert.equal(centre(-STEP), 1);
  assert.equal(centre(-STEP * 18), 18);
  assert.equal(centre(-STEP * 19), 0);
  assert.equal(centre(STEP), 18);
});

test("pure: same input, same output, and the scene is not touched", () => {
  const s = Object.freeze(sceneAt(0.3));
  assert.deepEqual(reelPose(42, 0.6, s), reelPose(42, 0.6, s));
  assert.deepEqual(reelPose(42 + 360, 0.6, s), reelPose(42, 0.6, s));
});
