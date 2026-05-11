-- Banners tablosuna sıralama sütunu ekle
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Mevcut bannerlara varsayılan bir sıra ver (oluşturulma tarihine göre)
WITH ordered_banners AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.banners
)
UPDATE public.banners
SET display_order = ordered_banners.row_num
FROM ordered_banners
WHERE public.banners.id = ordered_banners.id;
