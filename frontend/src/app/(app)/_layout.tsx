import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AppLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="nova-transacao"
          options={{ presentation: 'modal', headerShown: true, title: 'Transação' }}
        />
        <Stack.Screen
          name="lancar-rendimento"
          options={{ presentation: 'modal', headerShown: true, title: 'Rendimento' }}
        />
        <Stack.Screen
          name="lancar-deducao"
          options={{ presentation: 'modal', headerShown: true, title: 'Dedução' }}
        />
        <Stack.Screen
          name="lancar-livro-caixa"
          options={{ presentation: 'modal', headerShown: true, title: 'Livro-caixa' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
