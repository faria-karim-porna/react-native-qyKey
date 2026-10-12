import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary for the keyboard bundle.
 * Catches JS render errors and displays them on-screen so issues
 * are visible instead of showing a blank/transparent keyboard.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for logcat debugging
    console.error('[QyKey ErrorBoundary]', error.message, error.stack, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>⚠ Keyboard Error</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'Unknown error'}
          </Text>
          <Text style={styles.hint}>
            Check logcat for details: adb logcat | grep QyKey
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    minHeight: 200,
    backgroundColor: '#e0e5ec',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#FF5252',
  },
  message: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
    color: '#444',
  },
  hint: {
    fontSize: 9,
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#888',
  },
});
