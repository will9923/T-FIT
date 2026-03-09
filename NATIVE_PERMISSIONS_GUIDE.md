# Guia de Permissões para Apps Nativos (Cordova/Capacitor/React Native)

Caso você transforme este web app em um aplicativo nativo no futuro, precisará configurar as seguintes permissões para que a geolocalização funcione e a loja de aplicativos aceite seu app.

## Android (AndroidManifest.xml)

Adicione as seguintes linhas dentro da tag `<manifest>`:

```xml
<!-- Permissões de Localização -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Permissões de Internet (geralmente já incluída) -->
<uses-permission android:name="android.permission.INTERNET" />
```

## iOS (Info.plist)

Adicione as chaves abaixo para explicar ao usuário por que você precisa da localização. O iOS exige essas mensagens personalizadas.

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Precisamos da sua localização para mostrar academias e locais de treino próximos a você no mapa.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>Precisamos da sua localização para rastrear seus treinos outdoor mesmo com o app em segundo plano.</string>
```

> **Nota**: Para a funcionalidade atual de apenas mostrar o mapa enquanto o usuário o utiliza, `NSLocationWhenInUseUsageDescription` é a mais importante.
