import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { auth } from './src/api/firebase';
import useAuthStore from './src/store/authStore';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';

export default function App() {
  const { isLoading, isLoggedIn, restoreSession } = useAuthStore();

  useEffect(() => {
    // Firebase 인증 상태 변화 감지 → 세션 복원
    const unsubscribe = auth.onAuthStateChanged(() => {
      restoreSession();
    });

    return unsubscribe;
  }, [restoreSession]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
