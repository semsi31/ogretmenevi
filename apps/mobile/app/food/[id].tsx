import { useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useRestaurantDetail } from '../../src/api/queries';
import { captureException } from '../../src/lib/errors';
import { buildDeepLink, shareLink } from '../../src/lib/share';

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rid = Array.isArray(id) ? id[0] : id;
  const { data, error } = useRestaurantDetail(rid!);
  if (error) captureException(error);
  if (!error && !data) return <View style={{ padding: 16 }}><Text>Yükleniyor…</Text></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {data && (
        <>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>{data.name}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginVertical: 8 }}>
            <TouchableOpacity onPress={async()=> shareLink(data.name, buildDeepLink('restaurants', data.id))}>
              <Text style={{ color: '#2563eb' }}>Paylaş</Text>
            </TouchableOpacity>
            {!!data.phone && (
              <TouchableOpacity onPress={()=> Linking.openURL(`tel:${data.phone}`)}><Text style={{ color: '#2563eb' }}>Ara</Text></TouchableOpacity>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}


