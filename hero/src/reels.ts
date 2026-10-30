export interface Reel {
  id: string;
  src: string;    // looping preview, 360x640, no sound
  cover: string;  // its first frame
  full: string;   // the whole ad, with sound
  at: number;     // where this scene starts in the whole ad, s
  client: string;
  title: string;
}

const DUO = "DUO Chocolate";
const BUSHRA = "Bushra’s School";

const duo: [number, string][] = [
  [0.05, "The last bar"], [3.3, "Power level"], [5.12, "Powering up"], [7.45, "The clash"],
  [10.05, "Snap!"], [13, "De canela"], [18.1, "Too good to fight over"],
];
const bushra: [number, string][] = [
  [1, "Lost in school posts"], [7, "The answer"], [10, "Bushra’s School"], [13, "One site for everything"],
  [17.5, "Pick your level"], [22, "Time · room · subject"], [26.6, "Why Bushra’s"], [30.6, "Lessons for every level"],
  [35.6, "Language courses A1–C2"], [40, "Scan the code"], [44, "Follow us"], [46.6, "Khenchela, Algeria"],
];

const make = (prefix: string, full: string, client: string) => ([at, title]: [number, string], i: number): Reel => ({
  id: `${prefix}-${i + 1}`,
  src: `reels/${prefix}-${i + 1}.mp4`,
  cover: `reels/${prefix}-${i + 1}.jpg`,
  full: `reels/${full}`,
  at,
  client,
  title,
});

const a = duo.map(make("duo", "duo-full.mp4", DUO));
const b = bushra.map(make("bus", "bushra-full.mp4", BUSHRA));

/** Both ads, their scenes spread evenly through each other so neighbours on the ring differ. */
export const REELS: Reel[] = [...a, ...b]
  .map((r, i) => ({ r, k: i < a.length ? (i + 0.5) / a.length : (i - a.length + 0.5) / b.length }))
  .sort((p, q) => p.k - q.k)
  .map((p) => p.r);
