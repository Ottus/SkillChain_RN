import { Theme } from '@/constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface TabBarIconProps {
  focused: boolean;
  name: React.ComponentProps<typeof Ionicons>['name'];
}

function TabIcon({ focused, name }: TabBarIconProps) {
  return (
    <View style={focused ? styles.activePill : styles.inactiveIconContainer}>
      <Ionicons
        name={(focused ? (name as string).replace('-outline', '') : name) as any}
        size={22}
        color={focused ? '#1F2937' : '#4B5563'}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#F3F4F6', // light gray bottom bar matching standard light themes
          borderTopWidth: 0,
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#4B5563',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="search-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="briefcase-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="chatbubble-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} name="person-outline" />
          ),
        }}
      />
      </Tabs>

  );
}

const styles = StyleSheet.create({
  activePill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.activeTabBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveIconContainer: {
    width: 64,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
