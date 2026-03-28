import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue, withSpring, useAnimatedStyle,
} from 'react-native-reanimated';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';

import { ThemeProvider, Colors } from './src/theme';
import { analyticsService } from './src/services/AnalyticsService';
import { notificationService } from './src/services/NotificationService';
import EyeHealthProvider from './src/providers/EyeHealthProvider';
import { breakManager } from './src/interventions/BreakManager';
import HomeScreen from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ExercisesScreen from './src/screens/ExercisesScreen';
import EyeHealthSettings from './src/screens/EyeHealthSettings';

// ─── Navigation setup ─────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background:   Colors.background,
    card:         'transparent',   // custom tab bar handles its own bg
    border:       'transparent',
    text:         Colors.textPrimary,
    primary:      Colors.accent,
    notification: Colors.danger,
  },
};

// ─── Custom blur tab bar ──────────────────────────────────────────────────────

const TAB_CONFIG = [
  { name: 'Home',      icon: '👁️',  label: 'Monitor'   },
  { name: 'Dashboard', icon: '📊',  label: 'Analytics' },
  { name: 'Exercises', icon: '🏋️', label: 'Exercises'  },
  { name: 'Settings',  icon: '⚙️',  label: 'Settings'  },
];

function TabItem({
  icon, label, focused, onPress,
}: { icon: string; label: string; focused: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.88, { damping: 12, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    });
    onPress();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} style={tabStyles.item}>
      <Animated.View style={[tabStyles.itemInner, animStyle]}>
        {/* Active indicator dot */}
        {focused && (
          <View style={[tabStyles.activeDot, { backgroundColor: Colors.accent }]} />
        )}
        <Text style={[tabStyles.icon, { opacity: focused ? 1 : 0.4 }]}>{icon}</Text>
        <Text style={[
          tabStyles.label,
          { color: focused ? Colors.accent : Colors.textTertiary },
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={tabStyles.container} pointerEvents="box-none">
      <BlurView intensity={72} tint="dark" style={tabStyles.blur}>
        <View style={tabStyles.inner}>
          {state.routes.map((route, index) => {
            const cfg     = TAB_CONFIG[index];
            const focused = state.index === index;

            return (
              <TabItem
                key={route.key}
                icon={cfg?.icon ?? '•'}
                label={cfg?.label ?? route.name}
                focused={focused}
                onPress={() => navigation.navigate(route.name)}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  blur: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  inner: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  itemInner: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  activeDot: {
    position: 'absolute',
    top: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  icon:  { fontSize: 22 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
});

// ─── Navigator ────────────────────────────────────────────────────────────────

function Navigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"      component={HomeScreen}       />
      <Tab.Screen name="Dashboard" component={DashboardScreen}  />
      <Tab.Screen name="Exercises" component={ExercisesScreen}  />
      <Tab.Screen name="Settings"  component={EyeHealthSettings} />
    </Tab.Navigator>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceMono_400Regular,
  });

  useEffect(() => {
    analyticsService.load();

    notificationService.requestPermissions().then((granted) => {
      if (granted) notificationService.scheduleBreakReminders(20);
    });

    const responseSub = notificationService.addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'blink_reminder') {
        breakManager.triggerTwentyTwenty();
        notificationService.rescheduleFromNow(20);
      }
    });

    const receivedSub = notificationService.addNotificationReceivedListener(() => {
      notificationService.rescheduleFromNow(20);
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
      notificationService.cancelAll();
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <ThemeProvider>
      <EyeHealthProvider>
        <NavigationContainer theme={NavTheme}>
          <StatusBar style="light" />
          <Navigator />
        </NavigationContainer>
      </EyeHealthProvider>
    </ThemeProvider>
  );
}
