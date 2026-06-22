import { Theme } from '@/constants/Theme';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  // Redirection is handled by AuthStateListener in _layout.tsx
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background }}>
      <ActivityIndicator size="large" color={Theme.colors.primary} />
    </View>
  );
}
