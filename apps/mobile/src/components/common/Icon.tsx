import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type IconName =
  | 'home' | 'character' | 'running' | 'ranking' | 'menu'
  | 'attack' | 'defense' | 'buff' | 'gacha'
  | 'back' | 'plus' | 'bell' | 'target' | 'battle'
  | 'point' | 'zoomIn' | 'zoomOut' | 'myLocation';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

const ICON_MAP: Record<IconName, string> = {
  home: '⌂',
  character: '♟',
  running: '▶',
  ranking: '≡',
  menu: '···',
  attack: '↗',
  defense: '◈',
  buff: '★',
  gacha: '◎',
  back: '‹',
  plus: '+',
  bell: '•',
  target: '◉',
  battle: '⚡',
  point: 'P',
  zoomIn: '+',
  zoomOut: '−',
  myLocation: '◎',
};

export function Icon({ name, size = 18, color = '#fff' }: Props) {
  return (
    <Text style={{ fontSize: size, color, fontWeight: '700', textAlign: 'center' }}>
      {ICON_MAP[name]}
    </Text>
  );
}

export function TypeBadge({ type, size = 28 }: { type: string; size?: number }) {
  const config: Record<string, { bg: string; label: string }> = {
    attack: { bg: 'rgba(255,82,82,0.2)', label: 'ATK' },
    defense: { bg: 'rgba(74,158,255,0.2)', label: 'DEF' },
    buff: { bg: 'rgba(255,179,0,0.2)', label: 'BUF' },
  };
  const c = config[type] ?? config.attack;

  return (
    <View style={[iconStyles.typeBadge, { width: size * 2, height: size * 2, backgroundColor: c.bg, borderRadius: size }]}>
      <Text style={[iconStyles.typeBadgeText, { fontSize: size * 0.45 }]}>{c.label}</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  typeBadge: { justifyContent: 'center', alignItems: 'center' },
  typeBadgeText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
});
