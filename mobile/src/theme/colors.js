/**
 * EMS Design System: Light and Dark Theme Palettes
 * Foundations: Approved Professional Teal Palette
 * Light Mode: Fresh Teal & Pure White (#0D9488, #F7FAF9, #FFFFFF, #E6F3F1)
 * Dark Mode: Premium Low-Glare Teal & Dark Charcoal (#14B8A6, #0B1414, #0F1F1F, #133333)
 */

export const lightTheme = {
  // Brand Palette
  primary: '#0D9488',        // Professional teal (Actions, active items, highlights)
  primaryDark: '#0F766E',    // Deep teal for press / active states
  primaryActive: '#0F766E',  // Primary active / hover state
  darkTeal: '#0F766E',       // Deep teal for headers, navigation, dark accents
  darkOlive: '#0F766E',      // Backward-compatible alias for deep teal
  lightTeal: '#E6F3F1',      // Pale teal for badges and subtle tint boxes
  lightOlive: '#E6F3F1',     // Backward-compatible alias for pale teal
  
  // Surfaces & Backgrounds
  surface: '#FFFFFF',        // Pure white surface for Navigation & Modals
  background: '#F7FAF9',     // Very light cool white main page background
  card: '#FFFFFF',           // Pure white card / modal surfaces
  beige: '#E6F3F1',          // Pale teal secondary surface (replaces old beige)
  secondarySurface: '#E6F3F1',// Pale teal secondary surface
  elevatedSurface: '#E6F3F1',// Elevated secondary surface
  cardSubtle: '#F0FDFA',     // Very subtle cool off-white card (Teal 50)
  
  // Typography
  text: '#111827',           // Deep charcoal high-contrast main text
  textPrimary: '#111827',    // Alias for main text
  textSecondary: '#64748B',  // Muted blue-gray for secondary labels
  textMuted: '#94A3B8',      // Muted gray for disabled / tertiary text
  textInverse: '#FFFFFF',    // White text on dark/teal buttons
  
  // Borders & Dividers
  border: '#E2E8F0',         // Light gray-teal subtle border
  borderStrong: '#CBD5E1',   // Emphasized border
  borderFocus: '#0D9488',    // Professional teal focus outline
  disabled: '#94A3B8',       // Muted gray for disabled elements
  
  // Status Colors (Consistent & distinguishable)
  success: '#16A34A',        // Success / Present
  successLight: '#DCFCE7',   // Soft green tint for success badges
  successDark: '#15803D',
  
  warning: '#D97706',        // Warning / On Leave
  warningLight: '#FEF3C7',   // Soft amber tint
  warningDark: '#B45309',
  
  danger: '#DC2626',         // Error / Absent
  dangerLight: '#FEE2E2',    // Soft red tint
  dangerDark: '#B91C1C',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  
  info: '#2563EB',           // Information
  infoLight: '#DBEAFE',
  infoDark: '#1D4ED8',
  
  neutral: '#64748B',        // Secondary / Neutral
  
  // Inputs & Modals
  inputBackground: '#F8FAFC',
  inputBorder: '#E2E8F0',
  modalBackground: '#FFFFFF',
  navigationBackground: '#FFFFFF',
  navigationActive: '#0D9488',
  iconPrimary: '#0D9488',
  iconSecondary: '#64748B',
  
  // Camera & Viewfinder Dark Backdrop
  cameraBackdrop: '#0B1414',
  cameraFrameBorder: '#0D9488',
  modalBackdrop: 'rgba(11, 20, 20, 0.72)'
};

export const darkTheme = {
  // Brand Palette
  primary: '#14B8A6',        // Luminous teal (Bright, clear on dark)
  primaryDark: '#0D9488',    // Bright teal for press states
  primaryActive: '#0D9488',  // Primary active / hover state
  darkTeal: '#14B8A6',       // Teal accent for headers, active pills
  darkOlive: '#14B8A6',      // Backward-compatible alias
  lightTeal: '#133333',      // Dark teal-gray for badges/containers
  lightOlive: '#133333',     // Backward-compatible alias
  
  // Surfaces & Backgrounds
  surface: '#0F1F1F',        // Dark charcoal surface for Navigation & Modals
  background: '#0B1414',     // Deep teal-charcoal low-glare dark page background
  card: '#0F1F1F',           // Dark charcoal card surface
  beige: '#133333',          // Dark teal-gray elevated surface (replaces light beige)
  secondarySurface: '#133333',// Dark teal-gray secondary surface
  elevatedSurface: '#133333',// Elevated secondary surface
  cardSubtle: '#132626',     // Subtle contrast card
  
  // Typography
  text: '#F1F5F9',           // Soft white high-contrast main text
  textPrimary: '#F1F5F9',    // Alias for main text
  textSecondary: '#94A3B8',  // Cool gray secondary text
  textMuted: '#64748B',      // Tertiary text
  textInverse: '#0B1414',    // Inverted text on bright buttons
  
  // Borders & Dividers
  border: '#1F3A3A',         // Dark muted teal border
  borderStrong: '#2A4D4D',   // Emphasized border
  borderFocus: '#14B8A6',    // Luminous teal focus outline
  disabled: '#64748B',       // Muted gray for disabled elements
  
  // Status Colors (Consistent & distinguishable)
  success: '#4ADE80',        // Success / Present
  successLight: '#143320',   // Dark green tint
  successDark: '#22C55E',
  
  warning: '#FBBF24',        // Warning / On Leave
  warningLight: '#332714',   // Dark amber tint
  warningDark: '#D97706',
  
  danger: '#F87171',         // Error / Absent
  dangerLight: '#331C1C',    // Dark red tint
  dangerDark: '#DC2626',
  error: '#F87171',
  errorLight: '#331C1C',
  
  info: '#60A5FA',           // Information
  infoLight: '#1E2E48',
  infoDark: '#3B82F6',
  
  neutral: '#94A3B8',        // Secondary / Neutral
  
  // Inputs & Modals
  inputBackground: '#132626',
  inputBorder: '#1F3A3A',
  modalBackground: '#0F1F1F',
  navigationBackground: '#0F1F1F',
  navigationActive: '#14B8A6',
  iconPrimary: '#14B8A6',
  iconSecondary: '#94A3B8',
  
  // Camera & Viewfinder Dark Backdrop
  cameraBackdrop: '#060A0A',
  cameraFrameBorder: '#14B8A6',
  modalBackdrop: 'rgba(11, 20, 20, 0.85)'
};

// Re-export design tokens for unified access
export * from './designTokens';

// Default export for backward compatibility
export const colors = lightTheme;

export const getColors = (theme = 'light') => (theme === 'dark' ? darkTheme : lightTheme);
