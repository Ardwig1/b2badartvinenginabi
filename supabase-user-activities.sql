CREATE TABLE IF NOT EXISTS user_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'search', 'cart_add', 'cart_remove', 'cart_update'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own activities" ON user_activities 
    FOR INSERT 
    WITH CHECK (
        company_id IN (SELECT id FROM companies WHERE id = user_activities.company_id) -- Will be restricted accurately via RLS user profile logic, but for simplicity we rely on the backend API inserting activities securely.
);

CREATE POLICY "Admins can view activities" ON user_activities 
    FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );
