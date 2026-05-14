import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapScreen } from '../screens/MapScreen';
import CharacterStack from './CharacterStack';
import { RunningScreen } from '../screens/RunningScreen';
import { RankingScreen } from '../screens/RankingScreen';
import { MenuScreen } from '../screens/MenuScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, color: focused ? '#2ECC71' : '#555' }}>
      {icon}
    </Text>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#12121F',
          borderTopWidth: 0,
          height: 60,
          paddingBottom: 6,
        },
        tabBarActiveTintColor: '#2ECC71',
        tabBarInactiveTintColor: '#555555',
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="홈"
        component={MapScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="캐릭터"
        component={CharacterStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} /> }}
      />
      <Tab.Screen
        name="러닝"
        component={RunningScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏃" focused={focused} /> }}
      />
      <Tab.Screen
        name="랭킹"
        component={RankingScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏆" focused={focused} /> }}
      />
      <Tab.Screen
        name="메뉴"
        component={MenuScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="☰" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
