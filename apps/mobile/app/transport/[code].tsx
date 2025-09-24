import { useLocalSearchParams } from 'expo-router';
import { useRouteDetail } from '../../src/api/queries';
import { View, Text, Linking, TouchableOpacity, ScrollView } from 'react-native';
import { CachedImage } from '../../src/components/CachedImage';
import { buildDeepLink, shareLink } from '../../src/lib/share';
import { captureException } from '../../src/lib/errors';
import { useFilters } from '../../src/store/filters';
import { useLastUpdatedLabel } from '../../src/lib/lastUpdated';

export default function TransportDetail() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { favoriteRouteCodes, toggleFavoriteRoute } = useFilters();
  const { data, error } = useRouteDetail(code!);
  const last = useLastUpdatedLabel([["routes", "detail", code!]]);
  if (error) captureException(error);
  if (!error && !data) return <View style={{ padding: 16 }}><Text>Yükleniyor…</Text></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {!!last && <Text style={{ color: '#6b7280' }}>{last}</Text>}
      {data && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 18, fontWeight: '600' }}>{data.code} - {data.title}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={async()=> shareLink(data.title || `Hat ${data.code}`, buildDeepLink('routes', data.code))}>
                <Text style={{ color: '#2563eb', marginRight: 12 }}>Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => toggleFavoriteRoute(data.code)}>
                <Text style={{ color: favoriteRouteCodes.includes(data.code) ? '#eab308' : '#6b7280' }}>
                  {favoriteRouteCodes.includes(data.code) ? '★ Favori' : '☆ Favorilere ekle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {!!data.image_url && <CachedImage uri={data.image_url} style={{ height: 200, marginVertical: 12 }} />}
          {!!data.pdf_url && (
        <TouchableOpacity onPress={() => Linking.openURL(data.pdf_url!)}>
          <Text style={{ color: '#2563eb' }}>PDF’i aç</Text>
        </TouchableOpacity>
      )}
        </>
      )}
    </ScrollView>
  );
}


