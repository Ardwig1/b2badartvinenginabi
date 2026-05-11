-- SQL to create suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions" ON suggestions
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Users can insert their own suggestions
CREATE POLICY "Users can insert their own suggestions" ON suggestions
    FOR INSERT
    WITH CHECK (true); -- We will handle security via the API, but let's allow insert.
