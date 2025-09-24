import { Stack, Tabs } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, prefetchInitialData } from '../src/api/queries';
import { asyncStoragePersister, setupOnlineManager, setupFocusManager, ONE_DAY_MS, CACHE_BUSTER, ensureVersionAndCleanup } from '../src/api/persist';
import { useEffect } from 'react';
import * as Sentry from 'sentry-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

function OfflineBanner() {
  const info = useNetInfo();
  const offline = !(info.isConnected && (info.isInternetReachable ?? true));
  if (!offline) return null;
  return (
    <View style={{ backgroundColor: '#f59e0b', paddingVertical: 6, alignItems: 'center' }}>
      <Text style={{ color: '#111827', fontWeight: '600' }}>Çevrimdışı</Text>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    try {
      const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined;
      if (dsn) {
        Sentry.init({ dsn, enableAutoPerformanceTracing: false, enableInExpoDevelopment: true, debug: false });
      }
    } catch {}
    // Wire NetInfo and AppState to React Query managers (guarded to single registration)
    setupOnlineManager();
    setupFocusManager();
    ensureVersionAndCleanup().finally(() => {
      prefetchInitialData().catch(() => {});
    });
  }, []);
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: ONE_DAY_MS,
        buster: CACHE_BUSTER,
        // Only persist completed queries: success or error — never pending
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const status = query.state.status;
            return status === 'success' || status === 'error';
          },
        },
      }}
      // After restore, invalidate everything to ensure fresh data on reconnect
      onSuccess={() => {
        try {
          // Invalidate all; pending/error will be refreshed upon reconnect/focus
          queryClient.invalidateQueries();
        } catch {}
      }}
    >
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <OfflineBanner />
            <Tabs
              screenOptions={{
                headerShown: false,
                tabBarShowLabel: true,
                tabBarActiveTintColor: '#111827',
                tabBarInactiveTintColor: '#6b7280',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
                tabBarStyle: {
                  // Docked bar: no bottom gap and no extra shadow that clips corners
                  backgroundColor: 'transparent',
                  borderTopWidth: 0,
                  height: 64,
                  shadowColor: 'transparent',
                  elevation: 0,
                },
                tabBarBackground: () => (
                  <View
                    style={{
                      flex: 1,
                      borderTopWidth: 1,
                      borderTopColor: '#e5e7eb',
                      backgroundColor: '#ffffff',
                    }}
                  />
                ),
                tabBarItemStyle: { marginHorizontal: 2 },
              }}
            >
              <Tabs.Screen
                name="index"
                options={{
                  title: 'Anasayfa',
                  tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={color} size={22} />,
                }}
              />
              <Tabs.Screen
                name="explore/index"
                options={{
                  title: 'Şehri Keşfet',
                  tabBarIcon: ({ color }) => <Ionicons name="map-outline" color={color} size={22} />,
                }}
              />
              <Tabs.Screen
                name="transport/index"
                options={{
                  title: 'Ulaşım',
                  tabBarIcon: ({ color }) => <Ionicons name="bus-outline" color={color} size={22} />,
                }}
              />
              <Tabs.Screen
                name="food/index"
                options={{
                  title: 'Yemek',
                  tabBarIcon: ({ color }) => <Ionicons name="restaurant-outline" color={color} size={22} />,
                }}
              />
              <Tabs.Screen
                name="contact"
                options={{
                  title: 'Bize Ulaşın',
                  tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={22} />,
                }}
              />
              {/* Detay ekranları tab barda görünmesin */}
              <Tabs.Screen name="explore/[id]" options={{ href: null }} />
              <Tabs.Screen name="transport/[code]" options={{ href: null }} />
              <Tabs.Screen name="food/[id]" options={{ href: null }} />
              <Tabs.Screen name="routes/[code]" options={{ href: null }} />
              <Tabs.Screen name="restaurants/[id]" options={{ href: null }} />
            </Tabs>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </PersistQueryClientProvider>
  );
}


