import type { PropsWithChildren } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { AuthCardMaxWidth, AuthSplitBreakpoint, Spacing } from '@/constants/theme';

const HERO_TEXT = 'Organize as finanças da família em um só lugar';

export function AuthSplitLayout({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const isSplit = width >= AuthSplitBreakpoint;

  if (!isSplit) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeAreaMobile}>
          <ThemedView type="backgroundElement" style={styles.cardMobile}>
            {children}
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.splitRow}>
        <LinearGradient
          colors={[theme.accent, theme.accent, theme.accentSoft]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientPanel}>
          <ThemedText type="title" style={styles.heroText}>
            {HERO_TEXT}
          </ThemedText>
        </LinearGradient>
        <SafeAreaView style={styles.formPanel}>
          <ThemedView type="backgroundElement" style={styles.cardSplit}>
            {children}
          </ThemedView>
        </SafeAreaView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeAreaMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  cardMobile: {
    width: '100%',
    maxWidth: AuthCardMaxWidth,
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gradientPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.six,
  },
  heroText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  formPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  cardSplit: {
    width: '100%',
    borderRadius: Spacing.three,
    padding: Spacing.five,
    gap: Spacing.three,
  },
});
