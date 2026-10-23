import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './colors';

const THEME_STORAGE_KEY = '@ems_appearance_preference';

const ThemeContext = createContext({
  preference: 'system', // 'system' | 'light' | 'dark'
  theme: 'light',       // 'light' | 'dark'
  isDark: false,
  colors: lightTheme,
  setPreference: async () => {},
});

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState('system');
  const [isReady, setIsReady] = useState(false);

  // Load persisted theme preference on app start
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setPreferenceState(saved);
        }
      } catch (err) {
        console.warn('Failed to load theme preference from storage:', err);
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const setPreference = async (newPref) => {
    if (newPref !== 'system' && newPref !== 'light' && newPref !== 'dark') return;
    setPreferenceState(newPref);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newPref);
    } catch (err) {
      console.warn('Failed to persist theme preference:', err);
    }
  };

  // Determine active theme based on user preference and system setting
  const activeTheme = preference === 'system'
    ? (systemColorScheme === 'dark' ? 'dark' : 'light')
    : preference;

  const isDark = activeTheme === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        preference,
        theme: activeTheme,
        isDark,
        colors,
        setPreference,
        isReady
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
