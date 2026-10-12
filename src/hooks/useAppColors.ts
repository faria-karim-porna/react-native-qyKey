import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import { useSettingsStore, resolveIsDark } from '@/store/settingsStore';

export interface AppColors {
  /** Root background (behind circuit) */
  rootBg: string;
  /** Translucent overlay tinted over the circuit */
  overlay: string;
  /** Primary text (titles, headings) */
  textPrimary: string;
  /** Secondary text (body, descriptions, labels) */
  textSecondary: string;
  /** Muted text (hints, footnotes) */
  textMuted: string;
  /** Card / raised surface background */
  card: string;
  /** Card raised border — top & left (light edge in light mode, subtle in dark) */
  cardBorderTL: string;
  /** Card raised border — bottom & right (shadow edge) */
  cardBorderBR: string;
  /** Card shadow color */
  cardShadow: string;
  /** Input / inset surface background */
  inputBg: string;
  /** Input text color */
  inputText: string;
  /** Accent color (buttons, active indicators, links) */
  accent: string;
  /** Accent when pressed */
  accentPressed: string;
  /** Button text on accent background */
  buttonText: string;
  /** Section label (uppercase) */
  sectionLabel: string;
  /** Separator / divider line */
  separator: string;
  /** Status bar style: 'light' or 'dark' content */
  statusBarStyle: 'light' | 'dark';
  /** Circuit board background */
  circuitBg: string;
  /** Circuit wire color */
  circuitWire: string;
  /** Circuit glow background */
  circuitGlow: string;
}

const LIGHT: AppColors = {
  rootBg: '#ffffff',
  overlay: '#e0e5eccc',
  textPrimary: '#3a3a3a',
  textSecondary: '#444444',
  textMuted: '#444444',
  card: 'rgba(224,229,236,0.92)',
  cardBorderTL: 'rgba(0,0,0,0.15)',
  cardBorderBR: 'rgba(255,255,255,0.8)',
  cardShadow: '#000',
  inputBg: '#d1d9e6',
  inputText: '#444444',
  accent: '#8594aa',
  accentPressed: '#707f9a',
  buttonText: '#ffffff',
  sectionLabel: '#444444',
  separator: 'rgba(0,0,0,0.08)',
  statusBarStyle: 'dark',
  circuitBg: '#ffffff',
  circuitWire: '#8594aa',
  circuitGlow: '#d9e0ef',
};

const DARK: AppColors = {
  rootBg: '#242933',
  overlay: 'rgba(46,52,64,0.88)',
  textPrimary: '#eceff4',
  textSecondary: '#d8dee9',
  textMuted: '#a0a8b8',
  card: 'rgba(59,66,82,0.92)',
  cardBorderTL: 'rgba(255,255,255,0.08)',
  cardBorderBR: 'rgba(0,0,0,0.4)',
  cardShadow: '#000',
  inputBg: '#3b4252',
  inputText: '#eceff4',
  accent: '#81a1c1',
  accentPressed: '#6b8aad',
  buttonText: '#2e3440',
  sectionLabel: '#a0a8b8',
  separator: 'rgba(255,255,255,0.08)',
  statusBarStyle: 'light',
  circuitBg: '#242933',
  circuitWire: '#81a1c1',
  circuitGlow: '#3b4252',
};

/**
 * Subscribe to the OS color scheme. useSyncExternalStore is needed because
 * Appearance is an external, mutable global — without a subscription a
 * mid-session dark/light toggle would never re-render the app.
 */
function subscribe(callback: () => void) {
  const sub = Appearance.addChangeListener((prefs: { colorScheme?: string | null }) => {
    // Ignore changes while the scheme can't be read yet (e.g. SSR/bridging edge cases)
    if (prefs.colorScheme) callback();
  });
  return () => sub.remove();
}

export function useSystemIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme() === 'dark',
    () => false
  );
}

export function useAppColors(): AppColors {
  const theme = useSettingsStore((s) => s.theme);
  const systemIsDark = useSystemIsDark();
  return resolveIsDark(theme, systemIsDark) ? DARK : LIGHT;
}
