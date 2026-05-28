import React, { createContext, useContext, useMemo } from 'react';
import useThemeStore from '../store/themeStore';
import {
  darkColors, lightColors, getGradeColor,
  type ThemeColors, type ThemeMode,
} from '../constants/theme';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  gradeColor: Record<string, string>;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, toggle, setMode } = useThemeStore();

  const value = useMemo<ThemeContextValue>(() => {
    const c = mode === 'dark' ? darkColors : lightColors;
    return {
      mode,
      colors: c,
      isDark: mode === 'dark',
      gradeColor: getGradeColor(c),
      toggle,
      setMode,
    };
  }, [mode, toggle, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
