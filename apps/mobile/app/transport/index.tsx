import { useRoutes } from '../../src/api/queries';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { CachedImage } from '../../src/components/CachedImage';
import { Link } from 'expo-router';
import { captureException } from '../../src/lib/errors';
import { useLastUpdatedLabel } from '../../src/lib/lastUpdated';

export default function TransportList() {
  const { data, error } = useRoutes();
  const last = useLastUpdatedLabel([["routes", { series: "" }]]);

  if (error) {
    captureException(error);
  }

  if (!error && (!data || data.length === 0)) {
    return (
      <View style={{ padding: 16 }}>
        <Text>İçerik yok</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {!!error && <Text style={{ color: '#b91c1c' }}>Veri alınamadı. Lütfen daha sonra tekrar deneyin.</Text>}
      {!!last && <Text style={{ color: '#6b7280', marginBottom: 8 }}>{last}</Text>}
      {(data ?? []).map((r) => (
        <Link key={r.id} href={`/transport/${r.code}`} asChild>
          <TouchableOpacity style={{ padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>{r.code} - {r.title}</Text>
            {!!r.image_url && <CachedImage uri={r.image_url} style={{ height: 120, marginTop: 8 }} />}
          </TouchableOpacity>
        </Link>
      ))}
    </ScrollView>
  );
}


