export type ThemeColors = {
  bg: string;
  surface: string;
  card: string;
  cardBorder: string;

  primary: string;
  primaryDim: string;
  primaryDark: string;

  accent: string;
  accentDim: string;

  gold: string;
  goldDim: string;

  danger: string;
  dangerDim: string;

  text: string;
  textSecondary: string;
  textMuted: string;

  divider: string;

  gradeCommon: string;
  gradeRare: string;
  gradeEpic: string;
  gradeLegendary: string;

  overlay: string;
  overlayLight: string;
};

export const darkColors: ThemeColors = {
  bg: '#0B0B14',
  surface: '#14142B',
  card: '#1C1C3A',
  cardBorder: '#2A2A4A',

  primary: '#3EEBBE',
  primaryDim: 'rgba(62, 235, 190, 0.15)',
  primaryDark: '#2BC9A0',

  accent: '#7C4DFF',
  accentDim: 'rgba(124, 77, 255, 0.15)',

  gold: '#FFB300',
  goldDim: 'rgba(255, 179, 0, 0.15)',

  danger: '#FF5252',
  dangerDim: 'rgba(255, 82, 82, 0.15)',

  text: '#EEEEF6',
  textSecondary: '#9898B0',
  textMuted: '#5E5E7A',

  divider: '#2A2A4A',

  gradeCommon: '#78788A',
  gradeRare: '#4A9EFF',
  gradeEpic: '#B266FF',
  gradeLegendary: '#FFB300',

  overlay: 'rgba(11,11,20,0.85)',
  overlayLight: 'rgba(11,11,20,0.8)',
};

export const lightColors: ThemeColors = {
  bg: '#F5F5FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#E8E8F0',

  primary: '#2BC9A0',
  primaryDim: 'rgba(43, 201, 160, 0.12)',
  primaryDark: '#1FA882',

  accent: '#7C4DFF',
  accentDim: 'rgba(124, 77, 255, 0.1)',

  gold: '#F5A623',
  goldDim: 'rgba(245, 166, 35, 0.12)',

  danger: '#FF4757',
  dangerDim: 'rgba(255, 71, 87, 0.1)',

  text: '#1A1A2E',
  textSecondary: '#5A5A7A',
  textMuted: '#9898B0',

  divider: '#E8E8F0',

  gradeCommon: '#8E8EA0',
  gradeRare: '#3B8BFF',
  gradeEpic: '#9B4DFF',
  gradeLegendary: '#F5A623',

  overlay: 'rgba(0,0,0,0.6)',
  overlayLight: 'rgba(0,0,0,0.5)',
};

export type ThemeMode = 'dark' | 'light';

export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export function getGradeColor(c: ThemeColors): Record<string, string> {
  return {
    common: c.gradeCommon,
    rare: c.gradeRare,
    epic: c.gradeEpic,
    legendary: c.gradeLegendary,
  };
}

export const GRADE_COLOR: Record<string, string> = getGradeColor(darkColors);

export const GRADE_LABEL: Record<string, string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};
