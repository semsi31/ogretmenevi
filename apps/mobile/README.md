## Sentry & Metro (Monorepo)

- Sentry entegrasyonu managed Expo için `sentry-expo` ile yapılır. Kodda tüm importlar `sentry-expo` üzerinden olmalıdır.
- `app.json` içinde `plugins` altına `sentry-expo` eklendi. DSN `EXPO_PUBLIC_SENTRY_DSN` ile sağlanır; DSN yoksa Sentry sessizce devre dışı kalır.
- Monorepo + pnpm için `metro.config.js` watchFolders ve nodeModulesPaths ile workspace kökünü de izler; symlink çözümleme açıktır.
- Geliştirme dev client ile yapılır; Metro cache temizliği gerektiğinde `--clear` ile başlatılabilir.


