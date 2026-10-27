import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Computes a fail-safe top inset for both Android and iOS devices.
 * On Android, react-native-safe-area-context can return top = 0 in many
 * configurations (especially Expo Go, edge-to-edge, or before layout passes).
 * StatusBar.currentHeight reliably provides the actual Android system status bar height.
 * This helper guarantees the top inset is NEVER 0 on Android (minimum 24dp fallback).
 */
export function getSafeTopInset(insetsTop = 0) {
  if (Platform.OS === 'android') {
    const statusBarHeight = StatusBar.currentHeight || 0;
    return Math.max(statusBarHeight, insetsTop || 0, 24);
  }
  return insetsTop || 0;
}

/**
 * Custom hook returning guaranteed safe insets across iOS and Android devices.
 */
export function useSafeAppInsets() {
  const insets = useSafeAreaInsets();
  return {
    ...insets,
    top: getSafeTopInset(insets?.top),
    bottom: insets?.bottom || 0,
    rawTop: insets?.top || 0
  };
}

export default {
  getSafeTopInset,
  useSafeAppInsets
};

