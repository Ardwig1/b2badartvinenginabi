import os
import boto3
import urllib.request
from io import BytesIO
from PIL import Image
from supabase import create_client, Client

# Load env variables (simple parsing)
env = {}
try:
    with open('.env.local', 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.strip().startswith('#'):
                key, val = line.strip().split('=', 1)
                env[key] = val.strip('"\'')
except Exception as e:
    print(f"Error reading .env.local: {e}")
    exit(1)

SUPABASE_URL = env.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqa2FzZ2VsYXV3bnNmb3FlY292Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI5MjcwNywiZXhwIjoyMDg3ODY4NzA3fQ.Tsv47P-HFZoVaIwcW2QSJ5hOOafryBVWl5zfiVvytUI'
R2_ACCOUNT_ID = env.get('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = env.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = env.get('R2_SECRET_ACCESS_KEY')
R2_BUCKET_NAME = env.get('R2_BUCKET_NAME')
R2_PUBLIC_URL = env.get('R2_PUBLIC_URL')

# Initialize clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

from botocore.client import Config

s3 = boto3.client(
    's3',
    endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name='auto',
    verify=False,
    config=Config(signature_version='s3v4', connect_timeout=10, read_timeout=10)
)

def migrate():
    print('--- Resim Göçü Başlıyor (Supabase -> Cloudflare R2) [PYTHON] ---')
    
    response = supabase.table('products').select('*').neq('image_url', '').execute()
    products = [p for p in response.data if p.get('image_url') is not None]
    
    print(f"Toplam {len(products)} adet resimli ürün bulundu.")
    
    success = 0
    fail = 0
    
    import time
    
    for product in products:
        try:
            old_url = product['image_url']
            
            if 'r2.dev' in old_url or 'cloudflarestorage' in old_url:
                continue
                
            code = product.get('code', 'product')
            print(f"\nİşleniyor: {code} ({old_url})")
            
            # Download
            req = urllib.request.Request(old_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                img_data = response.read()
                
            print(f"  --> Resim İndirildi: {len(img_data)/1024:.1f} KB")
            
            # Process with PIL (convert to webp)
            img = Image.open(BytesIO(img_data))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            img.thumbnail((1080, 1080))
            
            output = BytesIO()
            img.save(output, format="WEBP", quality=80)
            webp_data = output.getvalue()
            
            print(f"  --> PIL ile sıkıştırıldı: {len(webp_data)/1024:.1f} KB")
            
            # Upload to R2
            clean_name = "".join(c if c.isalnum() else '-' for c in code).lower()
            new_filename = f"products/migrated-{int(time.time()*1000)}-{clean_name}.webp"
            
            s3.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=new_filename,
                Body=webp_data,
                ContentType='image/webp'
            )
            
            new_url = f"{R2_PUBLIC_URL}/{new_filename}"
            print(f"  --> R2'ye Yüklendi: {new_url}")
            
            # Update DB
            supabase.table('products').update({'image_url': new_url}).eq('id', product['id']).execute()
            print(f"  --> [BAŞARILI] Ürün güncellendi.")
            success += 1
            
        except Exception as e:
            print(f"  --> [HATA] {product.get('code')} taşınırken hata: {e}")
            fail += 1
            
    print(f"\n--- Göç Tamamlandı ---")
    print(f"Başarılı: {success}")
    print(f"Başarısız: {fail}")

if __name__ == '__main__':
    migrate()
