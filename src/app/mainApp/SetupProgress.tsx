import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppColors } from '@/hooks/useAppColors';

interface SetupProgressProps {
  currentStep: 1 | 2 | 3 | 4;
}

export default function SetupProgress({ currentStep }: SetupProgressProps) {
  const colors = useAppColors();

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((step) => (
        <View
          key={step}
          style={[
            styles.dot,
            {
              backgroundColor: step === currentStep || step < currentStep
                ? colors.accent
                : colors.inputBg,
              borderTopColor: colors.cardBorderTL,
              borderLeftColor: colors.cardBorderTL,
              borderBottomColor: colors.cardBorderBR,
              borderRightColor: colors.cardBorderBR,
            },
            step === currentStep && styles.dotActive,
            step < currentStep && styles.dotComplete,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // Inset neumorphic effect
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  dotActive: {
    width: 24,
  },
  dotComplete: {
    opacity: 0.6,
  },
});
