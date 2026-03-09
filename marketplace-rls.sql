-- RLS SECURITY POLICIES FOR TFIT MARKETPLACE

-- 1. Enable RLS on new tables
ALTER TABLE public.planos_personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- 2. Policies for 'planos_personal'
-- SELECT: Everyone can view active plans
CREATE POLICY "Anyone can view active personal plans" 
ON public.planos_personal FOR SELECT 
USING (ativo = true);

-- ALL: Personal trainers can manage their own plans
CREATE POLICY "Personals can manage their own plans" 
ON public.planos_personal FOR ALL 
USING (auth.uid() = personal_id)
WITH CHECK (auth.uid() = personal_id);


-- 3. Policies for 'alunos_planos'
-- SELECT: Student can see their own hires, Personal can see their students
CREATE POLICY "Students can see their own hired plans" 
ON public.alunos_planos FOR SELECT 
USING (auth.uid() = aluno_id);

CREATE POLICY "Personals can see their own student relations" 
ON public.alunos_planos FOR SELECT 
USING (auth.uid() = personal_id);

-- INSERT/UPDATE: Usually handled by Service Role (Webhook), 
-- but we allow Personal to manually add students if needed (Legacy Support)
CREATE POLICY "Personals can manage their student relations" 
ON public.alunos_planos FOR ALL 
USING (auth.uid() = personal_id)
WITH CHECK (auth.uid() = personal_id);


-- 4. Policies for 'pagamentos'
-- SELECT: Student can see their receipts, Personal can see their sales
CREATE POLICY "Students can see their marketplace receipts" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = aluno_id);

CREATE POLICY "Personals can see their marketplace sales" 
ON public.pagamentos FOR SELECT 
USING (auth.uid() = personal_id);

-- INSERT: Only specific service roles or owners (usually Webhook)
-- We keep SELECT restricted and INSERT handled by service role 
-- (which bypasses RLS in Supabase Functions)

-- 5. Additional Security: profiles visibility
-- Ensure personals can only see profiles of their students in alunos_planos
-- This is a complex cross-table check, usually handled with views or specific SELECT policies.
-- For now, we prioritize the marketplace tables.
