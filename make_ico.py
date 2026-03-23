from PIL import Image
import os

def create_ico(source_path, target_path):
    if not os.path.exists(source_path):
        print(f"Error: {source_path} not found")
        return

    img = Image.open(source_path).convert("RGBA")
    
    # Standard ICO sizes
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    # Generate resized versions
    icons = []
    for size in sizes:
        icon = img.resize(size, Image.Resampling.LANCZOS)
        icons.append(icon)
    
    # Save as ICO (Pillow handles multi-size ICO)
    img.save(target_path, format="ICO", sizes=sizes)
    print(f"Success: Created multi-size ICO at {target_path}")

if __name__ == "__main__":
    src = "app/icon.png"
    dst = "public/favicon.ico"
    create_ico(src, dst)
