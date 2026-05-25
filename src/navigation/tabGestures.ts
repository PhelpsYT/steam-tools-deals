/**
 * Shared state between TabNavigator and the four tab screens.
 *
 * - The tab-bar indicator animation lives inside TabNavigator (it owns the
 *   animated bar), but each tab screen needs to publish drag amounts to it
 *   while the user pans horizontally.
 * - TabNavigator also reads `isSwipeNavigation` to suppress duplicate
 *   animations when a navigation was triggered by a swipe rather than a
 *   tap.
 *
 * Keeping these mutable globals + their accessors in a leaf module breaks
 * the require-cycle that otherwise forms when TabNavigator imports the
 * screens *and* the screens import from TabNavigator.
 */

// ─── Swipe-navigation flag ───────────────────────────────────────────────────

let isSwipeNavigation = false;

export const setSwipeNavigation = (value: boolean) => {
  isSwipeNavigation = value;
};

export const getSwipeNavigation = () => isSwipeNavigation;

// ─── Indicator-stretch callbacks ─────────────────────────────────────────────

let onIndicatorStretch: ((stretch: number, direction: number) => void) | null = null;
let onIndicatorReset: (() => void) | null = null;

/** Publish a drag amount to the tab bar. No-op if no listener is registered. */
export const setIndicatorStretch = (stretch: number, direction: number) => {
  onIndicatorStretch?.(stretch, direction);
};

/** Tell the tab bar to release any active stretch and animate back to rest. */
export const resetIndicatorStretch = () => {
  onIndicatorReset?.();
};

/** TabNavigator wires its animation into these on mount, clears on unmount. */
export const registerIndicatorStretchCallback = (
  cb: (stretch: number, direction: number) => void,
) => {
  onIndicatorStretch = cb;
};

export const registerIndicatorResetCallback = (cb: () => void) => {
  onIndicatorReset = cb;
};

export const clearIndicatorCallbacks = () => {
  onIndicatorStretch = null;
  onIndicatorReset = null;
};
