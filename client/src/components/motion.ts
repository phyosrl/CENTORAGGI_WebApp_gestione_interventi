import { Variants, Transition } from 'framer-motion';

/**
 * Centralized motion variants for the app.
 * Respects `prefers-reduced-motion` automatically because framer-motion
 * exposes a `MotionGlobalConfig.skipAnimations` (we keep duration short instead).
 */

const easing: Transition['ease'] = [0.22, 1, 0.36, 1]; // easeOutQuint-ish

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easing } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: easing } },
};

/** Stagger container: animate children in sequence */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/** Smooth height collapse/expand for group panels */
export const collapsibleSection: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.22, ease: easing },
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.28, ease: easing },
  },
};
