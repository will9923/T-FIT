-- ==========================================
-- SQL DE MIGRAÇÃO: SISTEMA DE MÍDIAS (GIFS/VIDEOS/YOUTUBE)
-- Execute este comando no painel do Supabase, aba SQL Editor.
-- ==========================================

-- 1. Adicionar as novas colunas à tabela exercise_videos se elas não existirem
ALTER TABLE public.exercise_videos ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.exercise_videos ADD COLUMN IF NOT EXISTS media_type TEXT;

-- 2. Migrar os dados antigos para a nova estrutura
-- Todos que têm um youtube_url cadastrado passam a usar a coluna media_url com media_type = 'youtube'
UPDATE public.exercise_videos
SET media_url = youtube_url,
    media_type = 'youtube'
WHERE youtube_url IS NOT NULL 
  AND youtube_url != ''
  AND (media_url IS NULL OR media_url = '');

-- Nota: não excluiremos a youtube_url imediatamente para garantir 100% de retrocompatibilidade com versões em cache nos navegadores dos alunos antigos.
-- A coluna será apenas ignorada em futuras atualizações se media_url existir. 

-- ==========================================
-- SUCESSO! SEU BANCO ESTÁ ATUALIZADO
-- ==========================================
