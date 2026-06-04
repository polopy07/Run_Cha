import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/api/firebase';
import useAuthStore from './src/store/authStore';
import useThemeStore from './src/store/themeStore';
import { connectSocket, disconnectSocket } from './src/api/socket';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { LoginScreen } from './src/screens/LoginScreen';

function AppContent() {
  const { isLoading, isLoggedIn, restoreSession } = useAuthStore();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let isFirst = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isFirst) {
        isFirst = false;
        restoreSession();
        return;
      }
      if (!firebaseUser || useAuthStore.getState().isLoggedIn) {
        return;
      }
      restoreSession();
    });

    return unsubscribe;
  }, [restoreSession]);

  useEffect(() => {
    if (isLoggedIn) {
      void connectSocket();
    } else {
      disconnectSocket();
    }
    return () => disconnectSocket();
  }, [isLoggedIn]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NavigationContainer>
        {isLoggedIn ? <BottomTabNavigator /> : <LoginScreen />}
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const loadTheme = useThemeStore(s => s.load);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
