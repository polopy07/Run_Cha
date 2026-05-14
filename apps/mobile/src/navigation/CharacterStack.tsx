import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { StorageScreen } from '../screens/StorageScreen';
import { GachaScreen } from '../screens/GachaScreen';

export type CharacterStackParamList = {
  Storage: undefined;
  Gacha: undefined;
};

const Stack = createStackNavigator<CharacterStackParamList>();

export default function CharacterStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="Gacha" component={GachaScreen} />
    </Stack.Navigator>
  );
}
