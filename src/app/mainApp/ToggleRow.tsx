import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useAppColors } from '@/hooks/useAppColors';

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default function ToggleRow({ label, description, value, onValueChange }: ToggleRowProps) {
  const colors = useAppColors();

  return (
    <View style={[styles.row, { borderBottomColor: colors.separator }]}>
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        {description && <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.inputBg, true: colors.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  textContainer: { flex: 1, marginRight: 12 },
  label: { fontSize: 15, fontWeight: '500' },
  description: { fontSize: 12, marginTop: 2 },
});
