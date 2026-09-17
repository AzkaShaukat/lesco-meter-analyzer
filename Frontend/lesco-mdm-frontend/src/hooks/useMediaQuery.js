// =========================================================
// useMediaQuery - react to a CSS media query from JS
// =========================================================
// Some responsive decisions cannot be made in CSS. Chart axis labels are the
// main one: how many date labels fit depends on how many data points there
// are, which CSS cannot count. A month of daily data drew 31 labels into a
// 375px phone screen and they collapsed into an unreadable smear.
//
// Usage:
//   const isNarrow = useMediaQuery("(max-width: 760px)");
// =========================================================

import { useEffect, useState } from "react";

const getMatch = (query) => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
};

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => getMatch(query));

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    // re-sync in case the viewport changed between render and effect
    setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
};

// The app's phone breakpoint, matching the one the CSS uses for the sidebar
// drawer. Keep the two in step.
export const usePhoneScreen = () => useMediaQuery("(max-width: 760px)");

// How many of `count` axis labels to skip so they stay readable: returns the
// "show every Nth" step for the space available.
export const useAxisLabelStep = (count, { narrowMax = 5, wideMax = 12 } = {}) => {
  const isPhone = usePhoneScreen();
  const max = isPhone ? narrowMax : wideMax;
  if (!count || count <= max) return 1;
  return Math.ceil(count / max);
};

export default useMediaQuery;
