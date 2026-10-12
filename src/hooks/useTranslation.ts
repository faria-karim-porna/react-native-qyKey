import { useSettingsStore } from '@/store/settingsStore';
import translations, { type TranslationKeys } from '@/data/translations';

/**
 * Returns the translated string for the current language.
 * Usage: const t = useTranslation(); then t.settingsTitle, etc.
 */
export function useTranslation(): Record<TranslationKeys, string> {
  const language = useSettingsStore((s) => s.language);
  return translations[language];
}
