# 🚀 Guia de Configuração - Supabase

## Passo 1: Criar Projeto no Supabase

1. Acesse: https://supabase.com
2. Clique em **"Start your project"** ou **"New Project"**
3. Preencha:
   - **Name**: `tfit-app` (ou qualquer nome)
   - **Database Password**: Crie uma senha forte (anote!)
   - **Region**: Escolha **South America (São Paulo)** para melhor performance
4. Clique em **"Create new project"**
5. Aguarde ~2 minutos enquanto o Supabase provisiona o banco

---

## Passo 2: Obter Credenciais

1. No painel do projeto, clique em **⚙️ Settings** (ícone de engrenagem no menu lateral)
2. Clique em **API** no submenu
3. Anote as seguintes informações:

### URL do Projeto
```
https://xxxxxxxxxxxxx.supabase.co
```

### Chave Anônima (anon/public)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6......
```

---

## Passo 3: Executar Script SQL

1. No menu lateral, clique em **🗄️ SQL Editor**
2. Clique em **"+ New query"**
3. Abra o arquivo `supabase-schema.sql` que está na pasta do projeto
4. **Copie TODO o conteúdo** do arquivo
5. **Cole** no editor SQL do Supabase
6. Clique em **"RUN"** (botão no canto inferior direito)
7. Aguarde a execução (deve aparecer "Success. No rows returned")

### ✅ O que esse script faz:
- Cria todas as tabelas (profiles, workouts, diets, posts, etc.)
- Insere os planos de assinatura
- Cria 3 usuários de demonstração:
  - **Admin**: admin@tfit.com
  - **Personal**: personal@tfit.com (Thays Fit)
  - **Aluno**: aluno@tfit.com

---

## Passo 4: Configurar Storage (Imagens)

1. No menu lateral, clique em **📦 Storage**
2. Clique em **"Create a new bucket"**
3. Crie os seguintes buckets:

### Bucket 1: `avatars`
- **Name**: `avatars`
- **Public bucket**: ✅ Marcar (público)
- Clique em **"Create bucket"**

### Bucket 2: `t-feed-media`
- **Name**: `t-feed-media`
- **Public bucket**: ✅ Marcar (público)
- Clique em **"Create bucket"**

### Bucket 3: `assessment-photos`
- **Name**: `assessment-photos`
- **Public bucket**: ❌ NÃO marcar (privado)
- Clique em **"Create bucket"**

### Bucket 4: `payment-proofs`
- **Name**: `payment-proofs`
- **Public bucket**: ✅ Marcar (público)
- Clique em **"Create bucket"**

---

## 🛠️ Correção de Erros Comuns

Se você encontrar erros como **"Não foi possível salvar os dados"** ou **"Não foi possível enviar o comprovante"**, execute o script de correção:

1. Vá no **🗄️ SQL Editor**
2. Crie uma nova query
3. Cole o conteúdo do arquivo `fix-storage-and-payments.sql`
4. Clique em **"RUN"**

## Passo 5: Configurar o Código

1. Abra o arquivo `supabase-config.js`
2. Substitua as credenciais:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co'; // Sua URL do Passo 2
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Sua chave do Passo 2
```

3. Salve o arquivo

---

## Passo 6: Atualizar index.html

Abra o arquivo `index.html` e **substitua** as linhas do Firebase CDN por:

### ❌ REMOVER (Firebase):
```html
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-functions-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging-compat.js"></script>
<script src="firebase-config.js"></script>
```

### ✅ ADICIONAR (Supabase):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
```

---

## Passo 7: Testar Conexão

1. Abra o app no navegador
2. Abra o **Console** (F12 → Console)
3. Deve aparecer:
   ```
   🚀 Iniciando Supabase...
   ✅ Supabase inicializado com sucesso!
   🛰️ Conectado ao Supabase! Dados disponíveis.
   ```

Se aparecer erro, verifique:
- URL e Anon Key estão corretas
- Script SQL foi executado com sucesso
- CDN do Supabase foi adicionado ao index.html

---

---
+
+## Passo 8: Configurar Pagamentos (Mercado Pago)
+
+Para que o sistema de pagamentos automático funcione, você precisa publicar a **Edge Function** no seu Supabase.
+
+### 1. Instalar o Supabase CLI (No seu computador)
+Abra o terminal (PowerShell ou CMD) e digite:
+```bash
+npm install -g supabase
+```
+
+### 2. Login e Conexão
+Ainda no terminal, dentro da pasta do projeto:
+```bash
+supabase login
+supabase link --project-ref seu-project-id
+```
+> [!TIP]
+> O `project-ref` é o código de letras e números que aparece na URL do seu painel do Supabase (ex: `kyxsjdpwvmaewwxtdnxm`).
+
+### 3. Configurar Chave de Segurança (Criptografia)
+Isso protege os tokens do Mercado Pago no banco de dados. Escolha uma senha de 32 caracteres:
+```bash
+supabase secrets set ENCRYPTION_KEY=uma-senha-de-exatamente-32-letras
+```
+
+### 4. Publicar a Função de Pagamentos
+Execute o comando final para enviar o código para a nuvem:
+```bash
+supabase functions deploy mp-webhook
+```
+
+---
+
+## 🎉 Próximos Passos
+
+Agora o sistema de pagamentos está pronto para ser usado! Os próximos passos são:
+- Configurar as credenciais do Mercado Pago na Área do Personal.
+- Realizar testes de checkout como Aluno.
+
