import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { resolveAbsoluteUrl } from '../api/client';

type Props = {
  uri?: string | null;
  style?: any;
  testID?: string;
};

function isValidHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function CachedImage(props: Props) {
  const { uri, style, testID } = props;
  const [failed, setFailed] = useState<boolean>(false);
  const absolute = useMemo(() => resolveAbsoluteUrl(uri || undefined), [uri]);
  const ok = useMemo(() => isValidHttpUrl(absolute), [absolute]);

  if (!ok || failed) {
    return (
      <View style={[{ backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }, style]} testID={testID ? `${testID}-placeholder` : undefined}>
        <Text style={{ color: '#6b7280', fontSize: 12 }}>Görsel yüklenemedi</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: absolute as string }}
      cachePolicy="disk"
      style={style}
      onError={() => {
        try { console.warn('[CachedImage] onError', { uri, absolute }); } catch {}
        setFailed(true);
      }}
      transition={200}
      testID={testID}
    />
  );
}


