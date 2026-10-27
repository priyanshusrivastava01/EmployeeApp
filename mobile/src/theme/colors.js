/**
 * EMS Design System: Light and Dark Theme Palettes
 * Foundations: Premium Olive Green, Sage, Warm Off-White, and Low-Glare Dark Olive
 */

export const lightTheme = {
  // Brand Palette
  primary: '#687747',        // Primary Olive (Actions, active items, highlights)
  primaryDark: '#57643A',    // Darker Olive for press states
  darkOlive: '#414C30',      // Deep Olive for headers, navigation, dark accents
  lightOlive: '#E8EDDC',     // Light Olive for badges and subtle tint boxes
  
  // Surfaces & Backgrounds
  surface: '#FFFFFF',        // Fully Opaque White Surface for Navigation & Modals
  background: '#F7F7F0',     // Main Warm Off-White Page Background
  card: '#FFFFFF',           // Crisp White Card / Modal Surfaces
  beige: '#EFEEE4',          // Beige Subtle Surface
  elevatedSurface: '#EFEEE4',// Elevated secondary surface
  cardSubtle: '#FBFBF8',     // Very Subtle Off-White Card
  
  // Typography
  text: '#292D26',           // Charcoal High-Contrast Main Text
  textPrimary: '#292D26',    // Alias for main text
  textSecondary: '#73776C',  // Soft Muted Text for secondary labels
  textMuted: '#8E9287',      // Subtle Tertiary Text
  textInverse: '#FFFFFF',    // White text on dark/olive buttons
  
  // Borders & Dividers
  border: '#DDE1D3',         // Subtle Border
  borderStrong: '#C5CBB7',   // Emphasized Border
  borderFocus: '#687747',    // Focus Outline
  
  // Semantic Accents
  success: '#527A45',        // Forest Green for Verified status
  successLight: '#EDF3EB',   // Soft Green Tint for success badges
  successDark: '#3F5E34',
  
  warning: '#C28424',        // Warm Amber for Review/Pending
  warningLight: '#FAF4E8',   // Soft Amber Tint
  warningDark: '#9E6A1B',
  
  danger: '#C0392B',         // Muted Carmine for Errors / Sign Out
  dangerLight: '#FDF2F0',    // Soft Red Tint
  dangerDark: '#962D22',
  
  // Camera & Viewfinder Dark Backdrop
  cameraBackdrop: '#1E2319',
  cameraFrameBorder: '#687747',
  modalBackdrop: 'rgba(41, 45, 38, 0.72)'
};

export const darkTheme = {
  // Brand Palette
  primary: '#A3B879',        // Primary Olive (Bright, clear on dark)
  primaryDark: '#8DA066',    // Darker tone for press states
  darkOlive: '#687747',      // Olive Accent for headers, active pills
  lightOlive: '#343D2D',     // Deep sage-olive tint for badges/containers
  
  // Surfaces & Backgrounds
  surface: '#242920',        // Fully Opaque Dark Olive-Charcoal Surface for Navigation & Modals
  background: '#191C17',     // Low-glare dark page background
  card: '#242920',           // Deep olive-charcoal card surface
  beige: '#2D3327',          // Elevated surface (replaces light beige)
  elevatedSurface: '#2D3327',// Elevated secondary surface
  cardSubtle: '#2A3024',     // Subtle contrast card
  
  // Typography
  text: '#F1F2E9',           // Warm high-contrast off-white main text
  textPrimary: '#F1F2E9',    // Alias for main text
  textSecondary: '#B7BBAE',  // Muted sage-grey secondary text
  textMuted: '#868B7E',      // Tertiary text
  textInverse: '#191C17',    // Inverted text on bright buttons
  
  // Borders & Dividers
  border: '#3B4235',         // Low-contrast olive-grey border
  borderStrong: '#4C5544',   // Emphasized border
  borderFocus: '#A3B879',    // Focus outline
  
  // Semantic Accents
  success: '#A3B879',        // Light Olive for success
  successLight: '#2C3626',   // Dark Green Tint
  successDark: '#8DA066',
  
  warning: '#E5A84B',        // Clear Amber
  warningLight: '#3B3122',   // Dark Amber Tint
  warningDark: '#C28424',
  
  danger: '#E57373',         // Soft Red for Destructive/Errors
  dangerLight: '#3A2323',    // Dark Red Tint
  dangerDark: '#C0392B',
  
  // Camera & Viewfinder Dark Backdrop
  cameraBackdrop: '#131611',
  cameraFrameBorder: '#A3B879',
  modalBackdrop: 'rgba(15, 17, 13, 0.85)'
};

// Default export for backward compatibility
export const colors = lightTheme;

export const getColors = (theme = 'light') => (theme === 'dark' ? darkTheme : lightTheme);
