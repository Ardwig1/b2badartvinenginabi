-- Create a public bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the products bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Allow authenticated users (admins) to insert/upload images
CREATE POLICY "Auth Insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

-- Allow authenticated users to update/overwrite images
CREATE POLICY "Auth Update"
ON storage.objects FOR UPDATE
WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');
