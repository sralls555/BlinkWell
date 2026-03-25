import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { analyticsService } from './src/services/AnalyticsService';
import { notificationService } from './src/services/NotificationService';
import { useAppStore } from './src/store/useAppStore';
import HomeScreen from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#111827',
    card: '#1f2937',
    border: '#374151',
    text: '#f9fafb',
    primary: '#6366f1',
    notification: '#ef4444',
  },
};

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

export default function App() {
  const setTwentyTwenty = useAppStore((s) => s.setTwentyTwenty);

  useEffect(() => {
    analyticsService.load();

    // Request notification permissions and schedule first reminders
    notificationService.requestPermissions().then((granted) => {
      if (granted) notificationService.scheduleBreakReminders(20);
    });

    // When user taps a notification, trigger 20-20-20 in-app
    const responseSub = notificationService.addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'blink_reminder') {
        setTwentyTwenty(true);
        // Reschedule next batch from now
        notificationService.rescheduleFromNow(20);
      }
    });

    // When notification arrives while app is open, reschedule (in-app overlay handles it)
    const receivedSub = notificationService.addNotificationReceivedListener(() => {
      notificationService.rescheduleFromNow(20);
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
      notificationService.cancelAll();
    };
  }, []);

  return (
    <NavigationContainer theme={NavTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1f2937',
            borderTopColor: '#374151',
            borderTopWidth: 1,
            height: 70,
            paddingBottom: 10,
          },
          tabBarActiveTintColor: '#818cf8',
          tabBarInactiveTintColor: '#6b7280',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👁️" focused={focused} /> }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} /> }}
        />
        <Tab.Screen
          name="Exercises"
          component={ExercisesScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏋️" focused={focused} /> }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
