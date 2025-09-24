import { useLocalSearchParams } from 'expo-router';
import { useExploreDetail } from '../../src/api/queries';
import { View, Text, ScrollView, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { CachedImage } from '../../src/components/CachedImage';
import { buildDeepLink, shareLink } from '../../src/lib/share';
import { captureException } from '../../src/lib/errors';
import { useLastUpdatedLabel } from '../../src/lib/lastUpdated';

export default function ExploreDetail() {
  const { id } = useLocalSearchParams();
  // id hem string hem de string[] olabileceği için, string[] ise ilk elemanı alıyoruz
  const resolvedId = Array.isArray(id) ? id[0] : id;
  const { data, error } = useExploreDetail(resolvedId!);
  const last = useLastUpdatedLabel([["explore", "detail", resolvedId!]]);
  if (error) captureException(error);
  // Yükleniyor durumu
  if (!error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <Text>Yükleniyor…</Text>
      </View>
    );
  }
  // Hata + veri yok durumu
  if (error && !data) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>
      </View>
    );
  }
  // Bu noktada data kesinlikle mevcut
  const safeData = data as any;
  const gallery = Array.isArray(safeData?.gallery)
    ? (safeData.gallery as { id: string; image_url: string }[])
    : [];
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {!!last && <Text style={{ color: '#6b7280' }}>{last}</Text>}
      <Text style={{ fontSize: 18, fontWeight: '600' }}>{safeData.name}</Text>
      <TouchableOpacity onPress={async()=> shareLink(safeData.name, buildDeepLink('explore', resolvedId!))}><Text style={{ color: '#2563eb', marginTop: 4 }}>Paylaş</Text></TouchableOpacity>
      {(() => {
        const images = [
          ...(safeData?.cover_url ? [{ id: 'cover', image_url: safeData.cover_url }] : []),
          ...gallery,
        ];
        if (!images.length) return null;
        const width = Dimensions.get('window').width;
        return (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ marginVertical: 12 }}
          >
            {images.map((g) => (
              <CachedImage key={g.id} uri={g.image_url} style={{ width, height: 220 }} />
            ))}
          </ScrollView>
        );
      })()}
      {!!safeData?.lat && !!safeData?.lng && (
        <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${safeData.lat},${safeData.lng}`)}>
          <Text style={{ color: '#059669', marginTop: 8 }}>Yol Tarifi</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}


