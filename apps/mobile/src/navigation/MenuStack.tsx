import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MenuScreen } from '../screens/MenuScreen';
import { MyTerritoriesScreen } from '../screens/MyTerritoriesScreen';

export type MenuStackParamList = {
  MenuHome: undefined;
  MyTerritories: undefined;
};

const Stack = createStackNavigator<MenuStackParamList>();

export default function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MenuHome" component={MenuScreen} />
      <Stack.Screen name="MyTerritories" component={MyTerritoriesScreen} />
    </Stack.Navigator>
  );
}
