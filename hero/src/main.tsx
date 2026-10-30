import { createRoot } from "react-dom/client";
import { LazyMotion, domAnimation } from "framer-motion";
import { DealHero } from "./DealHero.tsx";

const el = document.getElementById("deal");
if (el) createRoot(el).render(<LazyMotion features={domAnimation} strict><DealHero /></LazyMotion>);
