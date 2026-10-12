import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useSettingsStore } from "@/store/settingsStore";
import { useQyKeyBridge } from "@/hooks/useQyKeyBridge";
import { useAppColors } from "@/hooks/useAppColors";
import { useTranslation } from "@/hooks/useTranslation";

type DictLang = "en" | "bn";

export default function DictionaryScreen() {
  const customWordsEn = useSettingsStore((s) => s.customWordsEn) || [];
  const customWordsBn = useSettingsStore((s) => s.customWordsBn) || [];
  const addCustomWord = useSettingsStore((s) => s.addCustomWord);
  const removeCustomWord = useSettingsStore((s) => s.removeCustomWord);
  const { setCustomDictionary } = useQyKeyBridge();
  const colors = useAppColors();
  const t = useTranslation();

  const [dictLang, setDictLang] = useState<DictLang>("en");
  const [input, setInput] = useState("");

  // Sync both dictionaries to native whenever either changes
  useEffect(() => {
    const en = Array.isArray(customWordsEn) ? customWordsEn : [];
    const bn = Array.isArray(customWordsBn) ? customWordsBn : [];
    setCustomDictionary(en, bn).catch(() => {});
  }, [customWordsEn, customWordsBn]);

  const activeWords = dictLang === "bn" ? (customWordsBn || []) : (customWordsEn || []);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    addCustomWord(trimmed, dictLang);
    setInput("");
  };

  const handleRemove = (word: string) => {
    removeCustomWord(word, dictLang);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t.dictionaryTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t.dictionaryDescription}
          </Text>
        </View>

        {/* Language toggle */}
        <View style={styles.toggleRow}>
          {(["en", "bn"] as DictLang[]).map((lang) => {
            const active = dictLang === lang;
            const label = lang === "bn" ? t.dictionaryBn : t.dictionaryEn;
            return (
              <Pressable
                key={lang}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: active ? colors.accent : colors.card,
                    borderTopColor: colors.cardBorderTL,
                    borderLeftColor: colors.cardBorderTL,
                    borderBottomColor: colors.cardBorderBR,
                    borderRightColor: colors.cardBorderBR,
                    shadowColor: colors.cardShadow,
                  },
                ]}
                onPress={() => setDictLang(lang)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: active ? colors.buttonText : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                borderTopColor: colors.cardBorderTL,
                borderLeftColor: colors.cardBorderTL,
                borderBottomColor: colors.cardBorderBR,
                borderRightColor: colors.cardBorderBR,
              },
            ]}
            placeholder={t.addWordPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleAdd}
            autoCapitalize="none"
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: colors.accent,
                borderTopColor: colors.cardBorderTL,
                borderLeftColor: colors.cardBorderTL,
                borderBottomColor: colors.cardBorderBR,
                borderRightColor: colors.cardBorderBR,
                shadowColor: colors.cardShadow,
              },
              pressed && styles.addButtonPressed,
            ]}
            onPress={handleAdd}
          >
            <Text style={[styles.addButtonText, { color: colors.buttonText }]}>
              {t.add}
            </Text>
          </Pressable>
        </View>

        <FlatList
          data={activeWords}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {t.emptyDictionary}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.wordRow,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.cardBorderTL,
                  borderLeftColor: colors.cardBorderTL,
                  borderBottomColor: colors.cardBorderBR,
                  borderRightColor: colors.cardBorderBR,
                  shadowColor: colors.cardShadow,
                },
              ]}
            >
              <Text style={[styles.wordText, { color: colors.textSecondary }]}>
                {item}
              </Text>
              <TouchableOpacity onPress={() => handleRemove(item)}>
                <Svg width={18} height={18} viewBox="0 0 24 24">
                  <Path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    fill={colors.textMuted}
                  />
                </Svg>
              </TouchableOpacity>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 6 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  toggleRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  toggleText: { fontWeight: "700", fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  addButton: {
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  addButtonPressed: {
    transform: [{ translateY: 1 }],
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  addButtonText: { fontWeight: "700", fontSize: 14 },
  list: { paddingHorizontal: 20 },
  wordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  wordText: { fontSize: 15 },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
