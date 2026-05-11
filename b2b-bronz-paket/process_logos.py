import os
import glob
from PIL import Image

def process_image(img_path, out_path):
    print(f"Processing {img_path} -> {out_path}")
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # threshold for white
    for item in datas:
        if item[0] > 235 and item[1] > 235 and item[2] > 235:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(out_path, "PNG")

if __name__ == "__main__":
    brain_dir = r"C:\Users\Mustafa Yağız ÜNAL\.gemini\antigravity\brain\8ea6a952-2c57-431a-b89c-402ac2810d92"
    images = sorted(glob.glob(os.path.join(brain_dir, "media_*.png")))
    latest = images[-3:]
    
    if len(latest) == 3:
        process_image(latest[0], "public/user_logo1.png")
        process_image(latest[1], "public/user_logo2.png")
        process_image(latest[2], "public/user_logo3.png")
        print("Success")
    else:
        print(f"Only found {len(latest)} images.")
