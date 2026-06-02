import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../constants/theme';

const THEME_KEY = '@theme_mode';

type ThemeState = {
  mode: ThemeMode;
  isLoaded: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  load: () => Promise<void>;
};

const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  isLoaded: false,

  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(THEME_KEY, mode);
  },

  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(next);
  },

  load: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') {
        set({ mode: saved, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },
}));

export default useThemeStore;
