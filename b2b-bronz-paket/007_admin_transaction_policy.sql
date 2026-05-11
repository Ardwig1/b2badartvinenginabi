-- ================================================================
-- FIX: Allow Admins to view and manage all account transactions
-- ================================================================

-- This policy gives any user with 'is_admin = true' in the profiles table
-- the ability to perform ALL operations (SELECT, INSERT, UPDATE, DELETE)
-- on all records within the account_transactions table.

DROP POLICY IF EXISTS "Admins view all transactions" ON public.account_transactions;

CREATE POLICY "Admins view all transactions" ON public.account_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
        )
    );
