import { useExplore } from '../../src/api/queries';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { CachedImage } from '../../src/components/CachedImage';
import { Link } from 'expo-router';
import { captureException } from '../../src/lib/errors';
import { useLastUpdatedLabel } from '../../src/lib/lastUpdated';

export default function ExploreList() {
  const { data, error } = useExplore();
  const last = useLastUpdatedLabel([["explore", { category: "", q: "" }]]);

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
    <FlatList
      data={data}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={{ gap: 8, paddingHorizontal: 16 }}
      contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
      ListHeaderComponent={last ? () => (
        <Text style={{ color: '#6b7280', paddingHorizontal: 16 }}>{last}</Text>
      ) : undefined}
      renderItem={({ item }) => (
        <Link href={`/explore/${item.id}`} asChild>
          <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderRadius: 8, overflow: 'hidden' }}>
            {!!error && <Text style={{ color: '#b91c1c', padding: 8 }}>Veri alınamadı.</Text>}
            {!!item.cover_url && <CachedImage uri={item.cover_url} style={{ height: 100 }} />}
            <Text style={{ padding: 8, fontWeight: '600' }}>{item.name}</Text>
          </TouchableOpacity>
        </Link>
      )}
    />
  );
}


