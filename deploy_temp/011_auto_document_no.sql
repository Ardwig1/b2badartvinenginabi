-- 011_auto_document_no.sql
-- Otomatik evrak no (OMG0000001) sistemi

-- 1. Evrak no için sequence oluştur (Eğer varsa hata vermez)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'document_no_seq') THEN
        CREATE SEQUENCE document_no_seq START 1;
    END IF;
END $$;

-- 2. Bir sonraki evrak numarasını OMG formatında döndüren fonksiyon
CREATE OR REPLACE FUNCTION get_next_document_no()
RETURNS TEXT AS $$
DECLARE
    v_seq INTEGER;
BEGIN
    v_seq := nextval('document_no_seq');
    RETURN 'OMG' || LPAD(v_seq::text, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Tetikleyici fonksiyon: Eğer document_no OMG ile başlamıyorsa otomatik ata
CREATE OR REPLACE FUNCTION trg_set_document_no()
RETURNS TRIGGER AS $$
BEGIN
    -- Sipariş, iade, ödeme fark etmeksizin her işleme OMG formatında no verilir
    -- Eğer zaten OMG ile başlamıyorsa (manuel veya sistem UUID ise) sıradaki no atanır
    IF NEW.document_no IS NULL OR NEW.document_no = '' OR LEFT(NEW.document_no, 3) != 'OMG' THEN
        NEW.document_no := get_next_document_no();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. account_transactions tablosuna trigger ekle
DROP TRIGGER IF EXISTS set_document_no_trigger ON account_transactions;
CREATE TRIGGER set_document_no_trigger
BEFORE INSERT ON account_transactions
FOR EACH ROW
EXECUTE FUNCTION trg_set_document_no();

-- Not: Mevcut işlemleri etkilemez, sadece yenileri OMG formatında başlar.
