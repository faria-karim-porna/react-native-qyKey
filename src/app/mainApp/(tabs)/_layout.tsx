import React from 'react';
import { Tabs } from 'expo-router';
import { AppTabBar } from '@/app/mainApp/AppTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
      <Tabs.Screen
        name="themes"
        options={{
          title: 'Themes',
        }}
      />
      <Tabs.Screen
        name="language"
        options={{
          title: 'Language',
        }}
      />
      <Tabs.Screen
        name="dictionary"
        options={{
          title: 'Dictionary',
        }}
      />
    </Tabs>
  );
}
