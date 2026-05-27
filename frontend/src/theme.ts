export const theme = {
  colors: {
    bg: '#0E0B1F',
    bgAlt: '#15102F',
    surface: '#1E1740',
    surfaceAlt: '#261C52',
    primary: '#8B5CF6',
    primaryDark: '#6D28D9',
    accent: '#22D3EE',
    accentDark: '#0891B2',
    text: '#F8FAFC',
    textMuted: '#A99FD1',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F472B6',
    gold: '#F5C449',
    silver: '#C7D2FE',
    bronze: '#D97706',
    diamond: '#22D3EE',
    platinum: '#A78BFA',
    border: '#2A1F5E',
    cardBack: '#3B2A78',
    flame: '#F97316',
    wave: '#22D3EE',
    leaf: '#34D399',
    bolt: '#FACC15',
  },
  radius: { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  font: {
    h1: 32, h2: 24, h3: 20, body: 16, small: 13, tiny: 11,
  },
  shadow: {
    md: {
      shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 }, elevation: 6,
    }
  }
};
export type Theme = typeof theme;
