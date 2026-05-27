import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/services/auth';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#0E0B1F' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="auth-callback" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="game" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="results" options={{ animation: 'fade' }} />
            <Stack.Screen name="daily" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="legal" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
