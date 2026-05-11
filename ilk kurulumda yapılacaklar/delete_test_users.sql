-- 1. Get the IDs of users who are NOT admins
DO $$
DECLARE
    non_admin_record RECORD;
BEGIN
    FOR non_admin_record IN 
        SELECT id FROM public.profiles WHERE is_admin = false OR is_admin IS NULL
    LOOP
        -- 2. Delete the user from auth.users (This will cascade delete profiles, companies if foreign keys allow, etc)
        -- Note: If companies don't cascade, we might need to delete companies manually first.
        DELETE FROM auth.users WHERE id = non_admin_record.id;
    END LOOP;
END $$;

-- 3. Delete any companies that don't have a linked admin profile (Or just clean out companies entirely)
-- Since a company could technically exist without a profile representing it, we just delete all companies
-- that do NOT belong to an admin.
DELETE FROM public.companies 
WHERE id NOT IN (
    SELECT company_id 
    FROM public.profiles 
    WHERE is_admin = true AND company_id IS NOT NULL
);
