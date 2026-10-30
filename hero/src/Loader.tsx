import { useEffect, useLayoutEffect, useRef } from "react";
import { m, useTransform, type MotionValue } from "framer-motion";

const DIGITS = "0123456789".split("");

/** A mono counter whose every digit is its own column that rolls to the next value. */
export function Counter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  const digits = String(v).padStart(3, "0").split("");
  const lead = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return (
    <div className="dl-count" aria-hidden="true">
      {digits.map((d, i) => (
        <span key={i} className={"dl-col" + (i < lead ? " is-lead" : "")}>
          <span className="dl-strip" style={{ transform: `translate3d(0,${-Number(d) * 10}%,0)` }}>
            {DIGITS.map((n) => <span key={n}>{n}</span>)}
          </span>
        </span>
      ))}
    </div>
  );
}

const GLYPHS = "<>/\\[]{}=+*#%&@$01";

/** Text that scrambles into place letter by letter, holds, and scrambles again. */
export function Scramble({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0, last = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 45) return;
      last = now;
      const t = ((now - t0) % 2600) / 1000;
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const shown = t > 0.15 + i * 0.05 && t < 2.15 + i * 0.02;
        s += ch === " " || shown ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      if (el.textContent !== s) el.textContent = s;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <span ref={ref} className="dl-cap-text" aria-hidden="true">{text}</span>;
}

/**
 * The brand word. It sits top left while the loader runs; as `flight` goes 0 to 1 it flies into the header
 * wordmark's exact position and size, and hands over to it on landing.
 */
export function Brand({ text, flight, ink }: { text: string; flight: MotionValue<number>; ink: MotionValue<string> }) {
  const ref = useRef<HTMLSpanElement>(null);
  const geo = useRef({ dx: 0, dy: 0, s: 1 });

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current, dst = document.querySelector<HTMLElement>(".top .wordmark");
      if (!el || !dst) return;
      const r = dst.getBoundingClientRect();
      const s = parseFloat(getComputedStyle(dst).fontSize) / parseFloat(getComputedStyle(el).fontSize);
      // offsetLeft/Top of a fixed element ignore its transform, so this works mid-flight too
      geo.current = { dx: r.left - el.offsetLeft, dy: r.top - el.offsetTop, s };
    };
    measure();
    window.addEventListener("resize", measure);
    document.addEventListener("cr:hero", measure);
    return () => { window.removeEventListener("resize", measure); document.removeEventListener("cr:hero", measure); };
  }, []);

  const x = useTransform(flight, (v) => geo.current.dx * v);
  const y = useTransform(flight, (v) => geo.current.dy * v);
  const scale = useTransform(flight, (v) => 1 + (geo.current.s - 1) * v);
  const opacity = useTransform(flight, (v) => (v >= 1 ? 0 : 1));
  return (
    <m.span ref={ref} className="dl-brand" aria-hidden="true" style={{ x, y, scale, opacity, color: ink }}>
      {text}
    </m.span>
  );
}

interface LoaderProps {
  expansion: MotionValue<number>;
  progress: number; // 0..1, real
  loaded: number;
  total: number;
  brand: string;
  caption: string;
  skipLabel: string;
  onSkip: () => void;
}

/** The loader's UI. Its backdrop is the hero's white layer, so the cards keep moving while it clears. */
export function Loader({ expansion, progress, loaded, total, brand, caption, skipLabel, onSkip }: LoaderProps) {
  const ui = useTransform(expansion, [0, 0.16], [1, 0]);
  const flight = useTransform(expansion, [0, 0.55], [0, 1]);
  const ink = useTransform(expansion, [0, 0.3], ["#0a0a0a", "#f6f4f4"]);
  const pct = Math.round(progress * 100);
  return (
    <div className="dl">
      <Brand text={brand} flight={flight} ink={ink} />
      <m.div className="dl-ui" style={{ opacity: ui }}>
        <button type="button" className="dl-skip" onClick={onSkip}>
          {skipLabel} <kbd>Esc</kbd>
        </button>
        <div className="dl-meter" role="progressbar" aria-label={caption} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="dl-cap">
            <Scramble text={caption} />
            <span className="dl-of">{String(loaded).padStart(2, "0")}/{String(total).padStart(2, "0")}</span>
          </div>
          <Counter value={pct} />
        </div>
      </m.div>
    </div>
  );
}
