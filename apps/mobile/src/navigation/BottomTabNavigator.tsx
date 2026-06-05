import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapScreen } from '../screens/MapScreen';
import CharacterStack from './CharacterStack';
import { RunningScreen } from '../screens/RunningScreen';
import { RankingScreen } from '../screens/RankingScreen';
import MenuStack from './MenuStack';
import { useTheme } from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: focused ? colors.primary : 'transparent',
      }} />
      <Text style={{
        fontSize: 11, fontWeight: '600',
        color: focused ? colors.primary : colors.textMuted,
      }}>
        {label}
      </Text>
    </View>
  );
}

export default function BottomTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="홈"
        component={MapScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="홈" focused={focused} /> }}
      />
      <Tab.Screen
        name="캐릭터"
        component={CharacterStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="캐릭터" focused={focused} /> }}
      />
      <Tab.Screen
        name="러닝"
        component={RunningScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="러닝" focused={focused} /> }}
      />
      <Tab.Screen
        name="랭킹"
        component={RankingScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="랭킹" focused={focused} /> }}
      />
      <Tab.Screen
        name="메뉴"
        component={MenuStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="메뉴" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}
