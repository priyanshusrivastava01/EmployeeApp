import { useWindowDimensions, PixelRatio, Platform } from 'react-native';

/**
 * EMS Responsive Design Engine
 * Provides dynamic metrics, fluid typography, and adaptive grid calculations
 * across mobile (320px - 480px), tablet (600px - 900px), and desktop (1024px+)
 */

export function getResponsiveMetrics(width, height) {
  const isLandscape = width > height;
  const isNarrowMobile = width < 400;     // e.g. 320px - 390px (single-column cards to prevent title word break)
  const isVerySmallMobile = width < 360;   // e.g. 320px (iPhone SE 1st gen, Jelly, small Android)
  const isSmallMobile = width < 375;       // e.g. 360px (Samsung A-series, budget Android)
  const isStandardMobile = width >= 375 && width < 412; // e.g. 375px - 390px (iPhone 13/14, standard Android)
  const isLargeMobile = width >= 412 && width < 600;    // e.g. 412px - 432px (Pixel 7/8, Galaxy S22/S23+)
  const isTablet = width >= 600 && width < 1024;        // e.g. 600px - 900px (iPads, Android tablets, foldables)
  const isDesktop = width >= 1024;

  // Base screen horizontal padding
  const screenPadding = isVerySmallMobile ? 12 : isSmallMobile ? 14 : isTablet ? 24 : 16;

  // Available container width inside screen padding
  const contentWidth = width - screenPadding * 2;

  return {
    width,
    height,
    isLandscape,
    isNarrowMobile,
    isVerySmallMobile,
    isSmallMobile,
    isStandardMobile,
    isLargeMobile,
    isTablet,
    isDesktop,
    screenPadding,
    contentWidth
  };
}

/**
 * React Hook for live responsive dimension tracking
 */
export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return getResponsiveMetrics(width, height);
}

/**
 * Fluid font scaler with strict minimum readability guarantee.
 * Never reduces font size below minSize (default 10px).
 */
export function scaleFont(size, width, minSize = 10) {
  if (!width) return size;
  if (width < 340) {
    return Math.max(Math.round(size * 0.88), minSize);
  }
  if (width < 375) {
    return Math.max(Math.round(size * 0.94), minSize);
  }
  if (width >= 768) {
    return Math.round(size * 1.08);
  }
  return size;
}

/**
 * Calculates adaptive column width with exact pixel-perfect gutters.
 * When columns = 1, returns the full container width.
 */
export function getGridCardWidth(containerWidth, columns = 2, gap = 10) {
  if (columns <= 1) return containerWidth;
  const totalGaps = gap * (columns - 1);
  return Math.floor((containerWidth - totalGaps) / columns);
}

/**
 * Returns the optimal column count for dashboard feature cards.
 * For cards containing: [Icon] + Title + Description + [Chevron]:
 * - < 400px: strictly 1 column (spans full content width to guarantee text width >= 210px,
 *             preventing title breaks like "Leave Applicatio n" or cramped cards)
 * - 400px - 599px: 2 columns (comfortable width for large phones >= 400px)
 * - 600px - 899px: 3 columns (tablet portrait / foldables)
 * - >= 900px: 4 columns (desktop & large tablet)
 */
export function getFeatureCardColumns(width) {
  if (!width || width < 400) return 1;
  if (width < 600) return 2;
  if (width < 900) return 3;
  return 4;
}

/**
 * Returns the optimal column count for action module cards (e.g. Admin modules).
 * - < 400px: 2 columns (each card >= 150px)
 * - 400px - 599px: 3 columns
 * - 600px - 899px: 4 columns
 * - >= 900px: 6 columns
 */
export function getActionCardColumns(width) {
  if (!width || width < 400) return 2;
  if (width < 600) return 3;
  if (width < 900) return 4;
  return 6;
}

/**
 * Adaptive modal width helper
 */
export function getModalWidth(screenWidth, maxWidth = 480) {
  if (screenWidth < 360) {
    return screenWidth - 20; // 10px margin on each side
  }
  if (screenWidth < 600) {
    return screenWidth - 32; // 16px margin on each side
  }
  return Math.min(screenWidth - 48, maxWidth);
}

export default {
  getResponsiveMetrics,
  useResponsiveLayout,
  scaleFont,
  getGridCardWidth,
  getFeatureCardColumns,
  getActionCardColumns,
  getModalWidth
};

