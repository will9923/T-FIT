# 🔐 GUIA: Ativando Login com Google e Triggers

Para a autenticação funcionar 100%, você precisa fazer 3 coisas no Supabase.

## 1. Executar os Triggers (Automação)
Isso garante que quando alguém criar conta (por Email ou Google), o perfil seja criado automaticamente.

1. Vá no **Supabase SQL Editor**.
2. Cole o conteúdo do arquivo `supabase-auth-triggers.sql`.
3. Clique em **RUN**.

---

## 2. Configurar o Google Auth 🌍
Para o botão "Entrar com Google" funcionar, você precisa configurar Chaves de API.

### Passo A: Pegar as Chaves no Google Cloud
1. Acesse: [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie um novo projeto (ex: `TFIT App`).
3. Vá em **APIs e Serviços** -> **Tela de permissão OAuth**.
   - Escolha **Externo**.
   - Preencha Nome ("TFIT"), Email de suporte e Desenvolvedor.
   - Salve.
4. Vá em **Credenciais** -> **Criar Credenciais** -> **ID do cliente OAuth**.
   - Tipo: **Aplicativo da Web**.
   - **Origens JavaScript autorizadas**: 
     - Adicione: `https://vniguzlgaqgqdvbitdzt.supabase.co`  (Sua URL do Supabase)
   - **URIs de redirecionamento autorizados**:
     - Adicione: `https://vniguzlgaqgqdvbitdzt.supabase.co/auth/v1/callback`
   - Clique em **Criar**.
5. Copie o **ID de Cliente** e a **Chave Secreta**.

### Passo B: Colocar no Supabase
1. Vá no Painel do Supabase -> **Authentication** -> **Providers**.
2. Clique em **Google**.
3. Ative a opção **Enable Google provider**.
4. Cole o **Client ID** e **Client Secret** que você pegou no Google.
5. Clique em **Save**.

---

## 3. Desativar Confirmação de Email (Opcional - Recomendado para Testes)
Se você não quer ter que clicar no email para confirmar a conta durante os testes:

1. Vá em **Authentication** -> **Providers** -> **Email**.
2. Desmarque **Confirm email**.
3. Salve.

---

## 🚀 Como Testar
1. Abra o App.
2. Vá em **Entrar como Aluno**.
3. Clique em **Entrar com Google** OU Crie uma conta com e-mail e senha.

---

## 🛠️ Solução para "Não é possível acessar esse site" (ERR_CONNECTION_REFUSED)

Se você vir esta mensagem ao clicar em entrar com Google, verifique estes 3 pontos:

1. **Servidor Local Ativo**: Você **DEVE** rodar o servidor local. 
   - Abra o terminal na pasta do projeto e digite: `node simple-server.js`
   - Acesse o app por: `http://localhost:8080` (não abra o arquivo index.html direto).

2. **Configuração no Supabase**:
   - Vá em **Authentication** -> **URL Configuration**.
   - **Site URL**: `http://localhost:8080`
   - **Redirect URLs**: Adicione `http://localhost:8080/**`

3. **Porta Correta**: Se o seu `simple-server.js` estiver usando uma porta diferente de 8080, você precisa atualizar as URLs no Supabase para a porta correta.
