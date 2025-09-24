import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { CachedImage } from '../src/components/CachedImage';
import { useSliders } from '../src/api/queries';
import { captureException } from '../src/lib/errors';
import { useLastUpdatedLabel } from '../src/lib/lastUpdated';

export default function Home(): React.ReactElement {
  const { data, error } = useSliders();
  const last = useLastUpdatedLabel([["sliders"]]);
  if (error) captureException(error);
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Anasayfa</Text>
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {!!last && <Text style={{ color: '#6b7280', marginBottom: 8 }}>{last}</Text>}
      {data?.map((s) => (
        <CachedImage key={s.id} uri={s.image_url} style={{ height: 160, marginBottom: 8, borderRadius: 8 }} />
      ))}
      {/* Alt tab barda navigasyon olduğu için ana ekrandaki butonları kaldırdık */}
    </ScrollView>
  );
}


