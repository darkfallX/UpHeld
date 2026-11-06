/**
 * Motion tokens.
 * One in-out curve for everything that moves on its own, and one critically-damped
 * spring (ζ ≈ 1.0, settles in ~0.7s, zero overshoot) for layout morphs.
 */
export const EASE = [0.65, 0, 0.35, 1] as const; // ease-in-out (cubic)
export const EASE_SOFT = [0.45, 0, 0.2, 1] as const; // gentler tail for long travels

const spring = { type: "spring" as const, stiffness: 120, damping: 22, mass: 1 };

export const motionTokens = {
  spring,
  springSnappy: spring,
  springSmooth: { type: "spring" as const, stiffness: 90, damping: 20, mass: 1 },
  easeOutExpo: EASE,
  enterTransition: { duration: 0.75, ease: EASE },
  stagger: 0.07,
  staggerFast: 0.06,
  hover: { duration: 0.35, ease: EASE },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
};

export const stagger = (s = 0.07) => ({ hidden: {}, show: { transition: { staggerChildren: s } } });
