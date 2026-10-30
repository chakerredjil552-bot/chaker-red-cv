import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, m, useMotionValue, useTransform, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { SLOTS, SMALL, facing, reelPose, slotAngle, slotReel } from "./pose.ts";
import { REELS, type Reel } from "./reels.ts";
import { useCopy } from "./copy.ts";
import { Loader } from "./Loader.tsx";
import { Wall } from "./Wall.tsx";

const FORMATION_S = 2.6;
const EXPANSION_S = 1.9;
const EXPANSION_EASE = [0.5, 0, 0.15, 1] as const;
/** If the network never delivers, the reveal goes ahead this long after the deal has finished. */
const PATIENCE_MS = 4500;

const html = document.documentElement;
const SCROLL_KEYS = new Set([" ", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

/** The reels the loader waits for: the covers and previews on the cards that face the camera when the deal lands. */
function frontReels(): Set<string> {
  const ids = new Set<string>();
  for (let s = 0; s < SLOTS; s++)
    if (facing(reelPose(slotAngle(s, 0), 1, SMALL), SMALL)) ids.add(REELS[slotReel(s, 0, REELS.length)].id);
  return ids;
}

/** A line of the headline that rises out of a mask as `mv` goes from `from` to `to`. */
function Rise({ mv, from, to, children, className }: { mv: MotionValue<number>; from: number; to: number; children: ReactNode; className?: string }) {
  const t = useTransform(mv, [from, to], [0, 1]);
  const y = useTransform(t, (v) => `${(1 - v) * 105}%`);
  return (
    <span className={"dh-mask " + (className ?? "")}>
      <m.span className="dh-line" style={{ y, opacity: t }}>{children}</m.span>
    </span>
  );
}

function Lightbox({ reel, onClose, closeLabel }: { reel: Reel; onClose: () => void; closeLabel: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); back?.focus?.(); };
  }, [onClose]);
  return (
    <m.div
      className="dh-box" role="dialog" aria-modal="true" aria-label={`${reel.client}: ${reel.title}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <m.div className="dh-box-in" initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        <video
          ref={video} src={`${reel.full}#t=${reel.at}`} poster={reel.cover} controls playsInline autoPlay
          onLoadedMetadata={(e) => { if (e.currentTarget.currentTime < reel.at - 0.5) e.currentTarget.currentTime = reel.at; }}
        />
        <div className="dh-box-cap"><b>{reel.client}</b><span>{reel.title}</span></div>
        <button ref={close} type="button" className="dh-close" onClick={onClose} aria-label={closeLabel}>✕</button>
      </m.div>
    </m.div>
  );
}

export function DealHero() {
  const copy = useCopy();
  const reduced = useMemo(() => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const instant = reduced || location.hash === "#edit";

  // the two values that drive everything
  const formation = useMotionValue(instant ? 1 : 0);
  const expansion = useMotionValue(instant ? 1 : 0);

  const [entering, setEntering] = useState(!instant);
  const [formed, setFormed] = useState(instant);
  const [late, setLate] = useState(false);
  const [open, setOpen] = useState<Reel | null>(null);
  const section = useRef<HTMLElement>(null);
  const runs = useRef<AnimationPlaybackControls[]>([]);
  const started = useRef(instant);

  // real progress: which of the front covers and previews have arrived
  const preload = useMemo(frontReels, []);
  const total = preload.size * 2;
  const got = useRef(new Set<string>());
  const [loaded, setLoaded] = useState(0);
  const onAsset = useCallback((key: string) => {
    if (got.current.has(key) || !preload.has(key.slice(2))) return;
    got.current.add(key);
    setLoaded(got.current.size);
  }, [preload]);
  const ready = loaded >= total || late;

  const finish = useCallback(() => {
    if (!html.classList.contains("deal-entering")) return;
    html.classList.remove("deal-entering");
    setEntering(false);
  }, []);

  const skip = useCallback(() => {
    runs.current.forEach((r) => r.stop());
    started.current = true;
    formation.set(1);
    expansion.set(1);
    setFormed(true);
    finish();
  }, [expansion, finish, formation]);

  // --ex on <html> lets the page's header and dock arrive with the reveal
  useLayoutEffect(() => {
    const put = (v: number) => html.style.setProperty("--ex", v.toFixed(3));
    put(expansion.get());
    return expansion.on("change", put);
  }, [expansion]);

  // formation: the deal, linear
  useEffect(() => {
    if (instant) { html.classList.remove("deal-entering"); return; }
    html.classList.add("deal-entering");
    try { history.scrollRestoration = "manual"; } catch { /* old browsers */ }
    window.scrollTo(0, 0);
    const run = animate(formation, 1, { duration: FORMATION_S, ease: "linear" });
    runs.current.push(run);
    run.then(() => setFormed(true));
    return () => run.stop();
  }, [formation, instant]);

  useEffect(() => {
    if (!formed || ready || instant) return;
    const t = setTimeout(() => setLate(true), PATIENCE_MS);
    return () => clearTimeout(t);
  }, [formed, ready, instant]);

  // expansion: only once the deal is done AND the assets are in, whichever is later
  useEffect(() => {
    if (!formed || !ready || started.current) return;
    started.current = true;
    const run = animate(expansion, 1, { duration: EXPANSION_S, ease: EXPANSION_EASE });
    runs.current.push(run);
    run.then(finish);
  }, [expansion, finish, formed, ready]);

  // while the entrance plays: no scrolling; Escape and Tab end it at once
  useEffect(() => {
    if (!entering) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { skip(); return; }
      if (e.key === "Tab") {
        // the skip button goes away with the loader: start the visitor's tabbing at the top of the page
        e.preventDefault();
        skip();
        requestAnimationFrame(() => document.querySelector<HTMLElement>(".top a[href]:not([tabindex='-1']), .top button")?.focus());
        return;
      }
      if (SCROLL_KEYS.has(e.key)) e.preventDefault();
    };
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", key);
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
    };
  }, [entering, skip]);

  // the reveal, all read off expansion so nothing is queued: it overlaps the cards still settling
  const white = useTransform(expansion, [0, 0.42], [1, 0]);
  const shade = useTransform(expansion, [0.25, 0.9], [0, 1]);
  const frameX = useTransform(expansion, [0.3, 0.8], [0, 1]);
  const frameY = useTransform(expansion, [0.4, 0.9], [0, 1]);
  const labels = useTransform(expansion, [0.7, 1], [0, 1]);

  const nameParts = copy.name.split(" ");
  const onClose = useCallback(() => setOpen(null), []);

  return (
    <>
      <section id="top" ref={section} className="dh" aria-label={copy.name} dir={copy.dir}>
        <m.div className="dh-white" style={{ opacity: white }} aria-hidden="true" />
        <Wall
          reels={REELS} formation={formation} expansion={expansion} locked={entering} reduced={reduced}
          preload={preload} onAsset={onAsset} onOpen={setOpen} section={section} watchLabel={watchWord(copy.lang)}
        />
        <m.div className="dh-shade" style={{ opacity: shade }} aria-hidden="true" />

        <div className="dh-frame" aria-hidden="true">
          <m.i className="dh-fx t" style={{ scaleX: frameX }} />
          <m.i className="dh-fx b" style={{ scaleX: frameX }} />
          <m.i className="dh-fy l" style={{ scaleY: frameY }} />
          <m.i className="dh-fy r" style={{ scaleY: frameY }} />
          <m.span className="dh-tag l" style={{ opacity: labels }}>{copy.ads} — {REELS.length} {copy.reels}</m.span>
          <m.span className="dh-tag r" style={{ opacity: labels }}>{copy.place}</m.span>
        </div>

        <div className="dh-copy">
          {copy.status && (
            <Rise mv={expansion} from={0.42} to={0.8} className="dh-status-wrap">
              <span className="dh-status"><i />{copy.status}</span>
            </Rise>
          )}
          <h1 className="dh-name">
            {nameParts.map((w, i) => (
              <Rise key={i + w} mv={expansion} from={0.45 + i * 0.07} to={0.88 + i * 0.05}>{w}</Rise>
            ))}
          </h1>
          <Rise mv={expansion} from={0.58} to={0.95} className="dh-role-wrap"><span className="dh-role">{copy.alt} · {copy.role}</span></Rise>
          <Rise mv={expansion} from={0.64} to={1} className="dh-ctas-wrap">
            <span className="dh-ctas">
              {copy.wa && <a className="btn red lg" href={copy.wa} target="_blank" rel="noopener">{copy.waLabel}</a>}
              <button type="button" className="btn lg" data-go="work">{copy.seeWork} →</button>
            </span>
          </Rise>
        </div>
        <m.div className="dh-hint" style={{ opacity: labels }} aria-hidden="true"><span>←</span>{copy.drag}<span>→</span></m.div>
      </section>

      {entering && (
        <Loader
          expansion={expansion} progress={total ? loaded / total : 1} loaded={loaded} total={total}
          brand={copy.name} caption={copy.loading} skipLabel={copy.skip} onSkip={skip}
        />
      )}
      <AnimatePresence>{open && <Lightbox key={open.id} reel={open} onClose={onClose} closeLabel={copy.close} />}</AnimatePresence>
    </>
  );
}

function watchWord(lang: string): string {
  return lang === "ar" ? "شاهد" : lang === "fr" ? "Regarder" : "Watch";
}
