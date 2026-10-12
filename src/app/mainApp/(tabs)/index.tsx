import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useSetupStatus } from "@/hooks/useSetupStatus";
import { useSettingsStore } from "@/store/settingsStore";
import { useAppColors } from "@/hooks/useAppColors";
import { useTranslation } from "@/hooks/useTranslation";

export default function HomeScreen() {
  const { isEnabled, isDefault, isFullySetUp } = useSetupStatus();
  const language = useSettingsStore((s) => s.language);
  const [testText, setTestText] = React.useState("");
  const colors = useAppColors();
  const t = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.homeTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t.homeSubtitle}</Text>

          <View style={[styles.statusCard, {
            backgroundColor: colors.card,
            borderTopColor: colors.cardBorderTL,
            borderLeftColor: colors.cardBorderTL,
            borderBottomColor: colors.cardBorderBR,
            borderRightColor: colors.cardBorderBR,
            shadowColor: colors.cardShadow,
          }]}>
            <StatusRow label={t.keyboardEnabled} value={isEnabled} colors={colors} />
            <StatusRow label={t.setAsDefault} value={isDefault} colors={colors} />
            <StatusRow
              label={t.activeLanguage}
              value={language === "en" ? "English" : "বাংলা"}
              isText
              colors={colors}
            />
          </View>

          {isFullySetUp && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>{t.tryItOut}</Text>
              <TextInput
                style={[styles.testInput, {
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                  borderTopColor: colors.cardBorderTL,
                  borderLeftColor: colors.cardBorderTL,
                  borderBottomColor: colors.cardBorderBR,
                  borderRightColor: colors.cardBorderBR,
                }]}
                placeholder={t.testInputPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={testText}
                onChangeText={setTestText}
                multiline
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
  );
}

function StatusRow({
  label,
  value,
  isText = false,
  colors,
}: {
  label: string;
  value: boolean | string;
  isText?: boolean;
  colors: ReturnType<typeof useAppColors>;
}) {
  const t = useTranslation();
  return (
    <View style={[styles.statusRow, { borderBottomColor: colors.separator }]}>
      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{label}</Text>
      {isText ? (
        <Text style={[styles.statusTextValue, { color: colors.accent }]}>{value as string}</Text>
      ) : (
        <View style={styles.statusValueRow}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            {value ? (
              <Path
                d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                fill={colors.accent}
              />
            ) : (
              <Path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill={colors.textMuted}
              />
            )}
          </Svg>
          <Text
            style={[
              styles.statusValue,
              { color: value ? colors.accent : colors.textMuted },
            ]}
          >
            {value ? t.yes : t.no}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  scroll: { padding: 20, paddingTop: 12 },
  title: { fontSize: 32, fontWeight: "bold" },
  subtitle: { fontSize: 14, marginBottom: 24 },
  statusCard: {
    borderRadius: 12,
    padding: 18,
    marginBottom: 28,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    shadowOffset: { width: -3, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statusLabel: { fontSize: 14 },
  statusValueRow: { flexDirection: "row", alignItems: "center" },
  statusValue: { fontSize: 14, fontWeight: "600", marginLeft: 6 },
  statusTextValue: { fontSize: 14, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  testInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
});
