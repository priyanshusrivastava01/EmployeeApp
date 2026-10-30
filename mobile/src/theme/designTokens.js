/**
 * EmployeeApp Design Tokens
 * Standardized typography, spacing, border radii, and visual metrics
 * Aligned with the reference design in Daily Task Reports (media_1793189669633_1757839a.png)
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  gutter: 16
};

export const typography = {
  // Page & Major Titles
  pageTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2
  },

  // Section Headings
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2
  },

  // Card Content & Names
  cardTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2
  },
  cardDept: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1
  },

  // Body & Details
  body: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18
  },
  bodyMedium: {
    fontSize: 13,
    fontWeight: '500'
  },
  caption: {
    fontSize: 11,
    fontWeight: '400'
  },
  captionBold: {
    fontSize: 11,
    fontWeight: '700'
  },

  // Badges & Micro-copy
  badge: {
    fontSize: 10,
    fontWeight: '700'
  },
  micro: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },

  // Numeric KPIs
  kpiNumber: {
    fontSize: 20,
    fontWeight: '800'
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4
  }
};

export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999
};

export const dimensions = {
  buttonHeight: 44,
  buttonSmallHeight: 34,
  inputHeight: 42,
  searchInputHeight: 38,
  avatarSmall: 32,
  avatarMedium: 44,
  avatarLarge: 56,
  cardPadding: 14,
  cardPaddingDense: 10
};

export const shadows = {
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6
  }
};

