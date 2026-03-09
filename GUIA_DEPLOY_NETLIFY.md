# Guia de Deploy Online (Netlify) 🚀

Para colocar o T-FIT online e fazer o login do Google funcionar "de verdade", siga estes passos:

## 1. Deploy no Netlify
1.  Acesse [netlify.com](https://www.netlify.com/).
2.  Arraste a pasta do seu projeto (`tfit nova versao`) para a área de upload do Netlify.
3.  Aguarde o deploy terminar. Você receberá um link como `https://seu-app.netlify.app`.

## 2. Configurar Supabase (Essencial para Google Auth)
Para que o login funcione fora do seu computador, você precisa autorizar o novo domínio:
1.  Vá no **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
2.  No campo **Site URL**, coloque o link do Netlify (ex: `https://seu-app.netlify.app`).
3.  Em **Redirect URLs**, adicione:
    *   `https://seu-app.netlify.app/**`
    *   `http://localhost:8080/**` (para continuar testando localmente).

## 3. Configurar Google Cloud Console
Se você criou suas próprias chaves do Google:
1.  Vá no [Google Cloud Console](https://console.cloud.google.com/).
2.  Em **APIs e Serviços** -> **Credenciais**.
3.  Edite seu **ID do cliente OAuth 2.0**.
4.  Em **Origens JavaScript autorizadas**, adicione `https://seu-app.netlify.app`.
5.  Em **URIs de redirecionamento autorizados**, adicione a URL que o Supabase te fornece (fica em Authentication -> Providers -> Google -> Callback URL). Geralmente é algo como `https://sua-id.supabase.co/auth/v1/callback`.

## 4. Ajustes no Código
O código que escrevemos já detecta automaticamente se você está no Netlify ou Localhost, então não precisa mudar as URLs manualmente em `auth-manager.js`.

---
> [!IMPORTANT]
> Assim que você tiver o link do Netlify, os erros de "file://" sumirão e o Google Auth passará a funcionar inclusive no celular!
