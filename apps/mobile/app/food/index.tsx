import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Linking } from 'react-native';
import { useRestaurants } from '../../src/api/queries';
import type { Restaurant } from '../../src/types';
import { captureException } from '../../src/lib/errors';
import * as Sentry from 'sentry-expo';
import { useFilters } from '../../src/store/filters';

export default function FoodList(): React.ReactElement {
  const { cuisine, setCuisine } = useFilters();
  const { data, error } = useRestaurants({ cuisine });
  if (error) captureException(error);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: '600' }}>Mutfak Filtresi</Text>
      <TextInput placeholder="örn. kebap" value={cuisine} onChangeText={setCuisine} style={{ borderWidth: 1, padding: 8, marginVertical: 8 }} />
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {!error && !data?.length && <Text>İçerik yok</Text>}
      <FlatList<Restaurant>
        data={data}
        keyExtractor={(i: Restaurant) => i.id}
        renderItem={({ item }: { item: Restaurant }) => (
          <View style={{ borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            {!!item.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)}><Text style={{ color: '#2563eb' }}>Ara</Text></TouchableOpacity>
            )}
            {!!item.lat && !!item.lng && (
              <TouchableOpacity onPress={() => {
                try { Sentry.captureMessage('map_directions_click', { level: 'info', extra: { screen: 'FoodList' } }); } catch {}
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`);
              }}><Text style={{ color: '#059669' }}>Yol Tarifi</Text></TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}


