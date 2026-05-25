import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import { ProfileProvider } from './src/context/ProfileContext';
import { SteamSyncProvider } from './src/context/SteamSyncContext';
import { SteamAuthProvider } from './src/auth/steam/SteamAuth';
import { colors } from './src/theme';

// Required by expo-web-browser: must be called once at module load so any
// in-flight auth session can be resumed if the app was relaunched while
// Custom Tabs was still alive. Mitigates the "first OAuth attempt after a
// fresh build doesn't finish" quirk on Android.
WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  const appContent = (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <StatusBar style="light" />
          <ProfileProvider>
            <SteamAuthProvider>
              <SteamSyncProvider>
                <NavigationContainer
                theme={{
                  dark: true,
                  colors: {
                    primary: colors.accent.primary,
                    background: colors.background.primary,
                    card: colors.background.primary,
                    text: colors.text.primary,
                    border: colors.border.default,
                    notification: colors.accent.error,
                  },
                  fonts: {
                    regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const },
                    medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const },
                    bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const },
                    heavy: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const },
                  },
                }}
              >
                <RootNavigator />
              </NavigationContainer>
              </SteamSyncProvider>
            </SteamAuthProvider>
          </ProfileProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webOuter}>
        <View style={styles.webPhone}>{appContent}</View>
      </View>
    );
  }

  return appContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webOuter: {
    flex: 1,
    backgroundColor: '#0e0f13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webPhone: {
    width: 430,
    height: '100%',
    maxHeight: 932,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.background.primary,
    // shadow for the phone frame
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 40px rgba(0,0,0,0.6)' }
      : {}),
  },
});
