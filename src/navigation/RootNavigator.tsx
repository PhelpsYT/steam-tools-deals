import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import GamesScreen from '../screens/GamesScreen';
import GameDetailScreen from '../screens/GameDetailScreen';

export type RootStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  Games: { filter?: 'all' | 'games' | 'wishlist' } | undefined;
  GameDetail: { appid: number; gameName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          gestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="Games"
        component={GamesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="GameDetail"
        component={GameDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;
