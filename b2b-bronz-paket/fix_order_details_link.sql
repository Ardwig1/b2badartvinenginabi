-- 1. account_transactions tablosuna order_id sütunu ekle (Eğer yoksa)
ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id);

-- 2. Tetikleyici fonksiyonu (trigger) güncelle: 
-- Hem document_no'yu OMG formatına çevirsin, hem de eğer gelen değer bir UUID ise bunu order_id sütununa saklasın.
CREATE OR REPLACE FUNCTION trg_set_document_no()
RETURNS TRIGGER AS $$
BEGIN
    -- Eğer gelen document_no bir UUID formatındaysa (36 karakter ve tireler içeriyorsa)
    -- veya bu bir TOPTAN SATIŞ ise ve biz bunun bir UUID olduğunu tahmin ediyorsak
    IF NEW.transaction_type = 'TOPTAN SATIŞ' AND NEW.document_no IS NOT NULL AND length(NEW.document_no) = 36 THEN
        NEW.order_id := NEW.document_no::UUID;
    END IF;

    -- Şimdi document_no'yu OMG formatına çevir (Eğer zaten OMG değilse)
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR LEFT(NEW.document_no, 3) != 'OMG' THEN
        NEW.document_no := get_next_document_no();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Mevcut (24 Mart sonrası) OMG'li işlemleri geri kurtaralım (Backfill)
-- Bu sorgu, orders tablosundaki tutar, şirket ve tarih eşleşmesine bakarak kayıp UUID'leri bulur.
UPDATE public.account_transactions tx
SET order_id = o.id
FROM public.orders o
WHERE tx.order_id IS NULL 
  AND tx.transaction_type = 'TOPTAN SATIŞ'
  AND tx.company_id = o.company_id
  AND ABS(tx.debt - o.total_amount) < 0.01
  AND tx.created_at >= '2026-03-24'
  AND tx.created_at BETWEEN (o.created_at - interval '1 minute') AND (o.created_at + interval '1 minute');

-- 4. Eski (24 Mart öncesi) UUID'li document_no'ları da order_id'ye taşıyalim
UPDATE public.account_transactions
SET order_id = document_no::UUID,
    document_no = 'ESKI-SİP' -- Veya olduğu gibi kalsın, trigger sadece yeni kayıtlarda çalışır.
WHERE order_id IS NULL 
  AND transaction_type = 'TOPTAN SATIŞ' 
  AND length(document_no) = 36;
