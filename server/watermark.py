from flask import Flask, request, jsonify
from blind_watermark import WaterMark
import hashlib, requests, tempfile, os, json, base64, traceback, io
from datetime import datetime, timezone

import cv2
import numpy as np
from PIL import Image, ImageOps
import imagehash

# --- ADVANCED ---
import torch
from transformers import CLIPProcessor, CLIPModel
from functools import lru_cache

app = Flask(__name__)

# =============================
# CONFIG
# =============================
SIMILARITY_THRESHOLD = 0.6   # tune this

# =============================
# IN-MEMORY DATABASE
# =============================
IMAGE_DB = []

# =============================
# LOAD MODEL (once)
# =============================
device = "cuda" if torch.cuda.is_available() else "cpu"

clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


# =============================
# HELPERS
# =============================
def download_image_or_decode(src):
    if isinstance(src, str) and src.startswith("data:image/"):
        return base64.b64decode(src.split(",")[1])
    resp = requests.get(src, timeout=15)
    resp.raise_for_status()
    return resp.content


def compute_sha256(b):
    return hashlib.sha256(b).hexdigest()


def load_img(b):
    img = Image.open(io.BytesIO(b))
    return ImageOps.exif_transpose(img).convert("RGB")


# =============================
# HASHES
# =============================
def get_hashes(img):
    return {
        "phash": str(imagehash.phash(img)),
        "dhash": str(imagehash.dhash(img)),
        "whash": str(imagehash.whash(img)),
    }


def hamming(a, b):
    return imagehash.hex_to_hash(a) - imagehash.hex_to_hash(b)


# =============================
# CLIP EMBEDDING
# =============================
@lru_cache(maxsize=256)
def _clip_cached(key, b):
    img = load_img(b)
    inputs = clip_processor(images=img, return_tensors="pt").to(device)

    with torch.no_grad():
        f = clip_model.get_image_features(**inputs)

    v = f[0].cpu().numpy()
    return (v / np.linalg.norm(v)).tolist()


def get_clip(b):
    return _clip_cached(compute_sha256(b), b)


# =============================
# FINGERPRINT
# =============================
def compute_fingerprint(b):
    img = load_img(b)
    hashes = get_hashes(img)
    clip_vec = get_clip(b)

    return {
        **hashes,
        "clip": clip_vec,
        "w": img.width,
        "h": img.height,
    }


# =============================
# SIMILARITY ENGINE
# =============================
def compare(fp1, fp2):
    ph = 1 - hamming(fp1["phash"], fp2["phash"]) / 64
    dh = 1 - hamming(fp1["dhash"], fp2["dhash"]) / 64

    v1 = np.array(fp1["clip"])
    v2 = np.array(fp2["clip"])
    clip_sim = float(np.dot(v1, v2))

    score = 0.4 * ph + 0.2 * dh + 0.4 * clip_sim

    if score > 0.9:
        label = "IDENTICAL"
    elif score > 0.75:
        label = "NEAR_DUPLICATE"
    elif score > SIMILARITY_THRESHOLD:
        label = "SIMILAR"
    else:
        label = "DIFFERENT"

    return score, label


# =============================
# FIND MATCH
# =============================
def find_best_match(fp):
    best = None
    best_score = 0

    for item in IMAGE_DB:
        score, label = compare(fp, item["fp"])

        if score > best_score:
            best_score = score
            best = {
                "score": score,
                "label": label,
                "image": item["image"],
                "sha256": item["sha256"]
            }

    if best and best["score"] >= SIMILARITY_THRESHOLD:
        return best

    return None


# =============================
# API
# =============================
@app.route("/", methods=["POST"])
def watermark_image():
    try:
        data = request.json
        image_url = data.get("url")
        payload = data.get("payload", {})

        if not image_url:
            return jsonify({"error": "No URL"}), 400

        # --- LOAD IMAGE ---
        img_bytes = download_image_or_decode(image_url)

        sha256 = compute_sha256(img_bytes)
        fp = compute_fingerprint(img_bytes)
        phash = fp["phash"]

        # --- FIND MATCH BEFORE INSERT ---
        match = find_best_match(fp)

        # --- WATERMARK ---
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tin:
            tin.write(img_bytes)
            in_path = tin.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tout:
            out_path = tout.name

        bwm = WaterMark(password_wm=1, password_img=1)
        bwm.read_img(in_path)
        bwm.read_wm(json.dumps(payload), mode="str")
        bwm.embed(out_path)

        with open(out_path, "rb") as f:
            wm_b64 = base64.b64encode(f.read()).decode()

        os.remove(in_path)
        os.remove(out_path)

        # --- STORE ---
        IMAGE_DB.append({
            "sha256": sha256,
            "fp": fp,
            "image": wm_b64
        })

        # --- RESPONSE (UNCHANGED + match) ---
        return jsonify({
            "image": wm_b64,
            "sha256": sha256,
            "phash": phash,
            "fingerprints": fp,
            "match": match,   # 🔥 MATCHED IMAGE
            "processedAt": datetime.now(timezone.utc).isoformat()
        })

    except Exception as e:
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


# =============================
# RUN
# =============================
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=6000, debug=False, threaded=True)