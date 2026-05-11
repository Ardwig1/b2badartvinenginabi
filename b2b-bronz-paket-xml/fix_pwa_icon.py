from PIL import Image
import os

def make_square_icon(source_path, target_path, size=512):
    # Ensure source exists
    if not os.path.exists(source_path):
        print(f"Error: {source_path} not found")
        return

    # Open the image
    img = Image.open(source_path).convert("RGBA")
    width, height = img.size
    
    # Calculate scale to fit within the box
    scale = min(size / width, size / height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # Resize keeping aspect ratio
    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Create a new square image with transparent background
    new_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # Center the resized image
    offset = ((size - new_width) // 2, (size - new_height) // 2)
    new_img.paste(img, offset)
    
    # Save the result
    new_img.save(target_path, "PNG")
    print(f"Success: Created square icon at {target_path}")

if __name__ == "__main__":
    src = "app/icon.png"
    dst = "public/pwa-icon.png"
    make_square_icon(src, dst)
