# 🔐 Master Backup de Credenciais - T-FIT

Este documento centraliza todas as chaves de API, senhas e configurações críticas do ecossistema T-FIT. 
**ESTE ARQUIVO É ALTAMENTE CONFIDENCIAL.** Guarde-o em um local seguro fora do servidor.

---

## 1. Supabase (Banco de Dados & Auth)
- **URL do Projeto:** `https://kyxsjdpwvmaewwxtdnxm.supabase.co`
- **Chave Anônima (Public):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU`
- **Project Ref (ID):** `kyxsjdpwvmaewwxtdnxm`
- **Senha da Edge Function (ENCRYPTION_KEY):** `TFIT_7723_SAFE_CRYPT_MASTER_2026`
  - *Comando para restaurar:* `npx supabase secrets set ENCRYPTION_KEY=TFIT_7723_SAFE_CRYPT_MASTER_2026`

---

## 2. Inteligência Artificial (Treinos & Dietas)
- **Google Gemini API Key:** `AIzaSyDMkN0bJAvBQ5kEUeyEOKsegYsJotWnFZs`
- **DeepSeek API Key:** `sk-c2fbc71f1a244b15a92aa0bbae48f6d4`
- **Modelos em uso:** `gemini-1.5-flash` / `deepseek-chat`

---

## 3. Mapas & Localização (Academias Próximas)
- **Mapbox Access Token:** `pk.eyJ1Ijoid2lsbGNhcmRvc28iLCJhIjoiY21sbGszcWw2MDlkNTNocTBndjdvbnhteCJ9.-cqbPhB7Xir-LpDteY191Q`
- **Estilo Ativo:** `mapbox://styles/mapbox/dark-v11`

---

## 4. Pagamentos (Mercado Pago)
- **WhatsApp Suporte T-Ponto:** `11911917087`
- *Nota: Os Access Tokens dos Personais e Admin são salvos de forma criptografada no banco de dados usando a ENCRYPTION_KEY acima.*

---

## 5. Acessos Administrativos (Padrão)
- **Link do Admin:** `/admin`
- **Usuário Admin Inicial:** `admin@tfit.com` / `senha: 123456` (Recomendado alterar após o primeiro acesso)

---

### 📥 Como Restaurar do Zero (Checklist)
1. Criar projeto no Supabase com o ID `kyxsjdpwvmaewwxtdnxm`.
2. Rodar os scripts SQL na ordem: `supabase-schema.sql` -> `fix-storage-and-payments.sql`.
3. Configurar os Buckets no Storage: `avatars`, `t-feed-media`, `assessment-photos`, `payment-proofs`.
4. Fazer deploy da Edge Function: `npx supabase functions deploy mp-webhook`.
5. Definir o Secret da `ENCRYPTION_KEY` conforme o item 1 acima.

---
*Atualizado em 01/03/2026 para consolidar todas as APIs.*
