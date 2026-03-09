-- Disable RLS for stories table to allow uploads while debugging policies
ALTER TABLE stories DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated and anon users for now (MVP mode)
GRANT ALL ON TABLE stories TO authenticated;
GRANT ALL ON TABLE stories TO anon;
GRANT ALL ON TABLE stories TO service_role;

-- Ensure t-feed-media bucket is also accessible
INSERT INTO storage.buckets (id, name, public) 
VALUES ('t-feed-media', 't-feed-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Full public access to bucket objects
CREATE POLICY "Public Access" ON storage.objects FOR ALL USING ( bucket_id = 't-feed-media' );
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
