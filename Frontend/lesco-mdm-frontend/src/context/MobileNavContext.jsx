// =========================================================
// MOBILE NAV (the sidebar drawer on phones)
// =========================================================
// On a phone the sidebar cannot sit permanently beside the content: at 375px
// it took 190px of the screen and the page's own buttons were pushed off the
// right edge with no way to scroll to them. Below the breakpoint the sidebar
// becomes a drawer that slides in over the page, opened by a button in the
// TopBar.
//
// TopBar and Sidebar are rendered as SIBLINGS by each page, not nested, so the
// open/closed flag has to live above both - hence this context. It is provided
// once in main.jsx, which means none of the nine page components had to change.
//
// `hasSidebar` is registered by the Sidebar itself on mount. The TopBar shows
// its menu button only when a sidebar is actually on the page, so the Landing
// page (which has no sidebar) does not get a button that opens nothing.
// =========================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const MobileNavContext = createContext(null);

export const MobileNavProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarCount, setSidebarCount] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Called by Sidebar on mount/unmount. A count rather than a boolean because
  // React can mount the next page's sidebar before unmounting the old one.
  const registerSidebar = useCallback(() => {
    setSidebarCount((n) => n + 1);
    return () => setSidebarCount((n) => Math.max(0, n - 1));
  }, []);

  // Escape closes the drawer - it covers the page, so there must be a way out
  // that is not hunting for the scrim.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Don't let a drawer stay open if the window is widened back to desktop,
  // where the sidebar is permanent and the drawer styling no longer applies.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 761px)");
    const onChange = (e) => {
      if (e.matches) setIsOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // While the drawer is open the page behind it must not scroll.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      hasSidebar: sidebarCount > 0,
      registerSidebar,
    }),
    [isOpen, open, close, toggle, sidebarCount, registerSidebar]
  );

  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
};

// Safe outside the provider (returns inert values) so a component can be
// rendered in isolation without blowing up.
export const useMobileNav = () =>
  useContext(MobileNavContext) || {
    isOpen: false,
    open: () => {},
    close: () => {},
    toggle: () => {},
    hasSidebar: false,
    registerSidebar: () => () => {},
  };

export default MobileNavContext;
