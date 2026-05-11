-- Temsilcilerin kendi verilerini görmesine izin ver
DROP POLICY IF EXISTS "Representatives can view own record" ON public.customer_representatives;
CREATE POLICY "Representatives can view own record" 
ON public.customer_representatives 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Temsilcilerin kendilerine atanan firmaları görmesine izin ver
DROP POLICY IF EXISTS "Representatives can view own assignments" ON public.representative_assignments;
CREATE POLICY "Representatives can view own assignments" 
ON public.representative_assignments 
FOR SELECT 
TO authenticated 
USING (auth.uid() = representative_id);
