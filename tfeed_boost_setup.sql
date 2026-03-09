-- Create t_boosts table for highlighted posts
CREATE TABLE IF NOT EXISTS public.t_boosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type TEXT DEFAULT 'post', -- post, reel, etc
    points_spent INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for t_boosts
ALTER TABLE public.t_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all boosts" ON public.t_boosts FOR SELECT USING (true);
CREATE POLICY "Users can insert their own boosts" ON public.t_boosts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure add_tpoints RPC function exists
CREATE OR REPLACE FUNCTION public.add_tpoints(user_id_param UUID, amount_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET t_points = COALESCE(t_points, 0) + amount_param
    WHERE id = user_id_param;
    
    INSERT INTO public.t_points_history (user_id, amount, action_type)
    VALUES (user_id_param, amount_param, CASE WHEN amount_param > 0 THEN 'earn' ELSE 'spend' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
