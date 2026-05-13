import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function MenuScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>메뉴</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12121F' },
  text: { color: '#fff', fontSize: 18 },
});
