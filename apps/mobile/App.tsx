import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/api/firebase';
import useAuthStore from './src/store/authStore';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { LoginScreen } from './src/screens/LoginScreen';

export default function App() {
  const { isLoading, isLoggedIn, restoreSession } = useAuthStore();

  useEffect(() => {
    let isFirst = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (isFirst) {
        isFirst = false;
        restoreSession();
        return;
      }
      if (!firebaseUser) {
        return;
      }
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
        {isLoggedIn ? <BottomTabNavigator /> : <LoginScreen />}
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
