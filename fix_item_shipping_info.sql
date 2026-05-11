-- order_items tablosuna her bir ürün için kargo bilgilerini ekle
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS shipping_company TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS shipping_origin TEXT;

-- Mevcut veriler için (varsa) ana sipariş bilgilerini çekip doldurabiliriz (opsiyonel)
-- UPDATE public.order_items oi
-- SET shipping_company = o.shipping_company,
--     tracking_number = o.tracking_number,
--     shipping_origin = o.shipping_origin
-- FROM public.orders o
-- WHERE oi.order_id = o.id AND o.is_stock_reduced = true;
