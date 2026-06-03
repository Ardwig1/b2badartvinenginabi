CREATE TABLE IF NOT EXISTS public.payment_sessions (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Eski oturumları otomatik temizle (1 günden eski)
CREATE INDEX IF NOT EXISTS payment_sessions_created_at_idx ON public.payment_sessions(created_at);
