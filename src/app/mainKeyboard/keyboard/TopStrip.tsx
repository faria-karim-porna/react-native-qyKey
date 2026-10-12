// ============================================================
// TopStrip.tsx — ported from qykey.
//   - Suggestion strip fed by the NATIVE suggestion engine.
//   - Mic key uses the real expo-speech-recognition module.
//   - Now accepts themeColors for dynamic styling.
// ============================================================

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createKeyboardStyles } from '../../../../assets/styles/dynamicStyles';
import { Key } from '../Key';
import MicrophoneIcon from './MicrophoneIcon';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from '../../../../src/hooks/useSpeechRecognition';
import type { AppLanguage } from '../../../types/keyboard';
import type { KeyboardThemeColors } from '../../../hooks/useKeyboardTheme';

type TopStripProps = {
  emojiModeHandler?: () => void;
  symHandler?: () => void;
  language: AppLanguage;
  suggestions?: string[];
  onSuggestionPress?: (word: string) => void;
  onTranscriptComplete?: (text: string) => void;
  themeColors: KeyboardThemeColors;
};

const TopStripComponent = (props: TopStripProps) => {
  const {
    emojiModeHandler,
    symHandler,
    language,
    suggestions = [],
    onSuggestionPress,
    onTranscriptComplete,
    themeColors,
  } = props;

  const styles = useMemo(() => createKeyboardStyles(themeColors), [themeColors]);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [dots, setDots] = useState('');
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBanglish = language === 'banglish';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (recognizing && !transcript) {
      interval = setInterval(() => {
        setDots((prev) => (prev.length < 3 ? prev + '.' : '.'));
      }, 400);
    } else {
      setDots('');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recognizing, transcript]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setRecognizing(true);
    setIsMicrophoneActive(true);
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    setTranscript(event?.results?.[0]?.transcript || '');
    setIsMicrophoneActive(false);
  });

  useSpeechRecognitionEvent('error', () => {
    setRecognizing(false);
    setIsMicrophoneActive(false);
  });

  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    setIsMicrophoneActive(false);
    if (transcript) {
      onTranscriptComplete?.(transcript);
      setTranscript('');
    }
  });

  const handleVoicePress = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      showNotice('Speech recognition is not available');
      return;
    }
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    let granted = false;
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      granted = !!result?.granted;
    } catch (e) {
      console.warn('[QyKey] Microphone permission request failed:', e);
      granted = false;
    }
    if (!granted) {
      showNotice(
        language === 'bn-BD'
          ? 'মাইক্রোফোন অনুমতি দিন — QyKey অ্যাপে'
          : 'Allow microphone in the QyKey app',
      );
      return;
    }
    setTranscript('');
    try {
      ExpoSpeechRecognitionModule.start({
        lang: isBanglish ? 'en-US' : language,
        interimResults: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      console.error('Speech recognition error:', e);
      setRecognizing(false);
      setIsMicrophoneActive(false);
    }
  }, [recognizing, language, isBanglish, showNotice]);

  const isListening = recognizing;
  const listeningText = transcript
    ? transcript
    : `${language === 'bn-BD' ? 'শুনছি' : 'Listening'}${dots}`;

  const renderSuggestionsBar = () => {
    if (notice) {
      return (
        <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">
          {notice}
        </Text>
      );
    }
    if (isListening) {
      return (
        <Text style={styles.suggestionText} numberOfLines={1}>
          {listeningText}
        </Text>
      );
    }
    if (suggestions.length > 0) {
      return (
        <View style={styles.suggestionRow}>
          {suggestions.slice(0, 3).map((word, index) => (
            <React.Fragment key={word + index}>
              {index > 0 && <View style={styles.suggestionSeparator} />}
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => onSuggestionPress?.(word)}
                activeOpacity={0.6}
              >
                <Text style={styles.suggestionText} numberOfLines={1} ellipsizeMode="tail">
                  {word}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      );
    }
    return (
      <Text style={styles.suggestionText}>
        {language === 'banglish' ? 'Type to see Bangla...' : 'Suggestions...'}
      </Text>
    );
  };

  return (
    <>
      <Key special style={{ width: 40 }} hasActiveState onPressHandler={() => emojiModeHandler?.()} themeColors={themeColors}>
        🙂
      </Key>
      <View style={styles.suggestionsContainer}>{renderSuggestionsBar()}</View>
      <Key special style={{ width: 48 }} hasActiveState onPressHandler={() => symHandler?.()} themeColors={themeColors}>
        SYM
      </Key>
      <Key
        special
        isIcon
        style={{ width: 40 }}
        hasActiveState
        isStatusActive={isMicrophoneActive}
        onPressHandler={handleVoicePress}
        themeColors={themeColors}
      >
        <MicrophoneIcon active={isMicrophoneActive} color={themeColors.keyText} />
      </Key>
    </>
  );
};

export const TopStrip = React.memo(TopStripComponent);
