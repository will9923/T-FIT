# 🚀 Quick Start - T-FIT Supabase

## ✅ O QUE FOI FEITO

- ✅ Supabase configurado e conectado
- ✅ Database refatorado para usar PostgreSQL
- ✅ Sistema de login simplificado (modo demo - sem senha)  
- ✅ Todas as páginas de autenticação atualizadas

---

## 🔴 O QUE VOCÊ PRECISA FAZER AGORA

### 1. **Execute o Script SQL no Supabase**

1. Acesse: https://supabase.com/dashboard/project/vniguzlgaqgqdvbitdzt
2. No menu lateral, clique em **SQL Editor**
3. Clique em **"+ New query"**
4. Abra o arquivo `supabase-schema.sql` da pasta do projeto
5. **Copie TODO o conteúdo**
6. **Cole** no editor SQL
7. Clique em **"RUN"** (canto inferior direito)
8. Aguarde a mensagem "Success"

✅ **Resultado**: Isso vai criar todas as tabelas + 3 usuários demo:
- **Admin**: admin@tfit.com  
- **Personal**: personal@tfit.com (Thays Fit)
- **Aluno**: aluno@tfit.com

---

### 2. **Teste o App**

1. Abra o `index.html` no navegador
2. Aguarde carregar (deve aparecer "Supabase inicializado!")
3. Clique em qualquer botão:
   - **Entrar como Admin**
   - **Entrar como Personal**
   - **Entrar como Aluno**

✅ **Deve entrar direto** sem pedir senha!

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### ❌ Erro: "Usuário não existe"
**Causa**: Script SQL não foi executado  
**Solução**: Execute o script SQL (Passo 1)

### ❌ Erro: "relation 'profiles' does not exist"  
**Causa**: Tabelas não foram criadas  
**Solução**: Execute o script SQL novamente

### ❌ Erro: "Supabase não inicializado"
**Causa**: CDN do Supabase não carregou  
**Solução**: Verifique sua conexão com a internet e recarregue a página

### ❌ Console mostra "❌ Supabase não inicializado!"
**Causa**: Credenciais erradas ou CDN não carregou  
**Solução**: 
1. Verifique se `supabase-config.js`  tem as credenciais corretas
2. Recarregue a página com Ctrl+F5

---

## 📋 PRÓXIMOS PASSOS (DEPOIS QUE FUNCIONAR)

Agora que a base está funcionando, você precisa ajustar o código que ainda usa as coleções antigas:

### Referências que precisam ser atualizadas:
```javascript
// ❌ ANTIGO (Firebase):
db.getAll('admins')
db.getAll('personals')
db.getAll('students')

// ✅ NOVO (Supabase):
db.query('profiles', p => p.role === 'admin')
db.query('profiles', p => p.role === 'personal')
db.query('profiles', p => p.role === 'student')
```

### Arquivos que precisam ser ajustados:
- `admin-pages.js` - trocar `getAll('personals')` e `getAll('students')`
- `personal-pages.js` - trocar `getAll('students')`
- `personal-features.js` - trocar `getAll('students')`
- `student-pages.js` - verificar referências
- `t-feed.js` - verificar se busca usuários corretamente

**MAS ISSO É SÓ DEPOIS QUE O SISTEMA ESTIVER RODANDO!**

---

## 🎯 RESUMO

1. Execute o SQL no Supabase ✅
2. Abra o app e clique em "Entrar como Aluno/Personal/Admin" ✅  
3. Deve funcionar! 🎉

**Se der erro, mande o print do Console (F12)**
