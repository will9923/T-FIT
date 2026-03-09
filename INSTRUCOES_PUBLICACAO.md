# Guia de Publicao TFIT - PWA para Native

Este projeto foi configurado para converter o PWA TFIT (https://tfit.com.br/) em um aplicativo nativo Android e iOS usando Capacitor.

## O que foi configurado:
1. **Configurao do Wrapper**: O app agora abre automaticamente o site live via WebView nativo (`capacitor.config.json`).
2. **Native Bridge**: Adicionada ponte para Push Notifications (OneSignal), Cmera e GPS (`native-bridge.js`).
3. **GitHub Actions**: Configurado workflow para build automtico do Android (APK e AAB) sem precisar de Android Studio.
4. **Identidade Visual**: Nome do app ajustado para **T-FIT** e Bundle ID para **com.tfit.app**.

## Como gerar o APK/AAB (Android):
1. Suba este projeto para um repositrio no **GitHub**.
2. V na aba **Actions**.
3. Selecione o workflow **Build Android App**.
4. Clique em **Run workflow**.
5. Ao finalizar, o APK (para teste) e o AAB (para Play Store) estaro disponveis para download nos artefatos.

## Prximos Passos Obrigatrios:
### 1. OneSignal (Notificaes)
Para as notificaes funcionarem:
- Crie uma conta em [OneSignal.com](https://onesignal.com).
- Crie um novo app type "Capacitor/Cordova".
- Pegue o **OneSignal App ID**.
- Substitua no arquivo `native-bridge.js` na linha:
  `const ONESIGNAL_APP_ID = "SEU-ID-AQUI";`

### 2. Gre de cones e Splash Screen
Embora o logotipo j esteja no projeto,  recomendvel gerar todos os tamanhos oficiais:
`npx @capacitor/assets generate`

### 3. Publicao na Play Store
- Utilize o arquivo `.aab` gerado pelo GitHub Actions.
- Voc precisar de uma **KeyStore** para assinar o app. Recomendo criar via Android Studio se possvel, ou via linha de comando se for expert. Se no puder criar, me avise que posso te guiar em como gerar uma via GitHub Secrets.

### 4. iOS (App Store)
- O projeto iOS est pronto na pasta `/ios`.
- Para compilar para iPhone, voc **obrigatoriamente** precisa de um Mac com Xcode ou usar um servio como **Codemagic** ou **EAS (Expo)** apontando para esta pasta.

### 5. Política de Privacidade (Integrada)
A política de privacidade solicitada foi integrada diretamente no aplicativo:
- **Página Dedicada**: Disponível na rota `/privacy` (renderiza o conteúdo de `privacy.html`).
- **Links Automáticos**: Adicionados ao rodapé da Landing Page e nos formulários de cadastro de Aluno e Personal.
- **Aceite Obrigatório**: Novos usuários agora precisam marcar o checkbox de aceite para prosseguir com o cadastro, garantindo conformidade com as exigências da Google Play Store e Apple App Store.

---

## 🛠 Como gerar sua Assinatura (Keystore) para a Play Store:
Para que o arquivo `.aab` seja aceito na Play Store, ele precisa ser "assinado". Se você não tiver uma Keystore, aqui está o comando para gerar uma (rode no terminal do seu computador):

```bash
keytool -genkey -v -keystore tfit-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias tfit-alias
```

**IMPORTANTE:**
1. Guarde este arquivo em um local seguro. Se perder, não poderá atualizar o app.
2. Anote a senha que você definiu.
3. Para o build automático do GitHub funcionar com assinatura, adicione as informações nos **Secrets** do seu repositório GitHub como:
   - `ANDROID_KEYSTORE_FILE` (o arquivo codificado em base64)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

---
**Objetivo Etapa 1 a 7: Concluído.**
O sistema está pronto para o build em nuvem e em total conformidade com as novas políticas das lojas.
