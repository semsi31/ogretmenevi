import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import Constants from 'expo-constants';

export default function Contact(): React.ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const API_BASE = ((Constants?.expoConfig?.extra as any)?.API_BASE as string) || 'http://10.0.2.2:4000';

  const submit = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error('Gönderilemedi');
      Alert.alert('Teşekkürler', 'Mesajınız iletildi.');
      setName(''); setEmail(''); setMessage('');
    } catch (e: any) {
      Alert.alert('Hata', e?.message || 'Bir hata oluştu');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          width: '92%',
          maxWidth: 560,
          backgroundColor: 'white',
          borderRadius: 16,
          padding: 16,
          // iOS shadow
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          // Android elevation
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#111827' }}>Bize Ulaşın</Text>
        <TextInput
          placeholder="Ad"
          value={name}
          onChangeText={setName}
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            backgroundColor: '#f9fafb',
            padding: 12,
            borderRadius: 10,
            marginBottom: 10,
          }}
        />
        <TextInput
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            backgroundColor: '#f9fafb',
            padding: 12,
            borderRadius: 10,
            marginBottom: 10,
          }}
        />
        <TextInput
          placeholder="Mesajınız"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            backgroundColor: '#f9fafb',
            padding: 12,
            borderRadius: 10,
            marginBottom: 14,
            minHeight: 120,
            textAlignVertical: 'top',
          }}
        />
        <TouchableOpacity onPress={submit} style={{ backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-end' }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


