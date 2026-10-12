import { NativeModules } from 'react-native';

const { QyKey } = NativeModules;
const isAvailable = !!QyKey;

export function useQyKeyBridge() {
  return {
    isDefaultKeyboard: (): Promise<boolean> =>
      isAvailable ? QyKey.isDefaultKeyboard() : Promise.resolve(false),
    isKeyboardEnabled: (): Promise<boolean> =>
      isAvailable ? QyKey.isKeyboardEnabled() : Promise.resolve(false),
    openKeyboardSettings: (): void => {
      if (isAvailable) QyKey.openKeyboardSettings();
    },
    showInputMethodPicker: (): void => {
      if (isAvailable) QyKey.showInputMethodPicker();
    },

    savePreferences: (prefs: Record<string, any>): Promise<void> =>
      isAvailable ? QyKey.savePreferences(prefs) : Promise.resolve(),
    getPreferences: (): Promise<Record<string, any>> =>
      isAvailable ? QyKey.getPreferences() : Promise.resolve({}),

    setDictionaryWords: (words: string[]): Promise<void> =>
      isAvailable ? QyKey.setDictionaryWords(words) : Promise.resolve(),
    getDictionaryWords: (): Promise<string[]> =>
      isAvailable ? QyKey.getDictionaryWords() : Promise.resolve([]),
    removeDictionaryWord: (word: string): Promise<void> =>
      isAvailable ? QyKey.removeDictionaryWord(word) : Promise.resolve(),

    setCustomDictionary: (enWords: string[] = [], bnWords: string[] = []): Promise<void> => {
      // A native build older than this JS bundle has no setCustomDictionary, and
      // calling through would throw "undefined is not a function" from the effect
      // that calls this, so check the method itself instead of the module.
      if (typeof QyKey?.setCustomDictionary !== 'function') return Promise.resolve();
      return QyKey.setCustomDictionary(
        Array.isArray(enWords) ? enWords : [],
        Array.isArray(bnWords) ? bnWords : []
      );
    },
    getCustomDictionary: (lang: string): Promise<string[]> =>
      typeof QyKey?.getCustomDictionary === 'function'
        ? QyKey.getCustomDictionary(lang)
        : Promise.resolve([]),

    isOverlayGranted: (): Promise<boolean> =>
      isAvailable ? QyKey.isOverlayGranted() : Promise.resolve(false),
    openOverlaySettings: (): void => {
      if (isAvailable) QyKey.openOverlaySettings();
    },
  };
}
