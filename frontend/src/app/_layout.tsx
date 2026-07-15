import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { WorkspaceProvider, useWorkspace } from '@/contexts/workspace-context';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading: authLoading, usuario } = useAuth();
  const { isLoading: workspaceLoading, workspace } = useWorkspace();

  if (authLoading) {
    return null;
  }

  if (usuario && workspaceLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!usuario && !!workspace}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!!usuario && !workspace}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
