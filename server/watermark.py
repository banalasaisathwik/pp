# watermark.py
from flask import Flask, request, jsonify
from blind_watermark import WaterMark
import hashlib
import requests
import tempfile
import os
import json
from datetime import datetime, timezone
import base64
import traceback
import cv2
import numpy as np

app = Flask(__name__)

# File to store image metadata
DB_FILE = "image_db.json"

# Load or initialize DB
if os.path.exists(DB_FILE):
    with open(DB_FILE, "r") as f:
        image_db = json.load(f)
else:
    image_db = {}  # {sha256: {firstAppeared, reused, sourceId}}

def save_db():
    with open(DB_FILE, "w") as f:
        json.dump(image_db, f, indent=2)

def download_image(url):
    resp = requests.get(url)
    resp.raise_for_status()
    return resp.content

def download_image_or_decode(url_or_base64):
    try:
        if isinstance(url_or_base64, str) and url_or_base64.startswith("data:image/"):
            header, encoded = url_or_base64.split(",", 1)
            return base64.b64decode(encoded)
        else:
            resp = requests.get(url_or_base64, timeout=15)
            resp.raise_for_status()
            return resp.content
    except Exception as e:
        raise ValueError(f"Failed to download or decode image: {str(e)}")

def compute_sha256(image_bytes):
    return hashlib.sha256(image_bytes).hexdigest()

@app.route("/", methods=["POST"])
def watermark_image():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        image_url = data.get("url")
        payload = data.get("payload", {})

        if not image_url:
            return jsonify({"error": "No URL provided"}), 400

        # Download or decode image
        img_bytes = download_image_or_decode(image_url)
        sha256 = compute_sha256(img_bytes)

        reused = False
        first_appeared = datetime.now(timezone.utc).isoformat()

        # Check if image already exists
        if sha256 in image_db:
            reused = True
            first_appeared = image_db[sha256]["firstAppeared"]
        else:
            # Save metadata to DB
            image_db[sha256] = {
                "firstAppeared": first_appeared,
                "reused": False,
                "sourceId": payload.get("sourceId")
            }
            save_db()

        # Embed watermark
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_in:
            temp_in.write(img_bytes)
            temp_in_path = temp_in.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_out:
            temp_out_path = temp_out.name

        bwm = WaterMark(password_wm=1, password_img=1)
        bwm.read_img(temp_in_path)
        bwm.read_wm(json.dumps(payload), mode="str")
        bwm.embed(temp_out_path)  # Original embed

        # --- Fix OpenCV depth warning ---
        img = cv2.imread(temp_out_path, cv2.IMREAD_UNCHANGED)
        if img is not None and img.dtype != np.uint8:
            img = cv2.convertScaleAbs(img)
            cv2.imwrite(temp_out_path, img)
        # --- Warning fixed ---

        # Read watermarked image as Base64
        with open(temp_out_path, "rb") as f:
            wm_b64_str = base64.b64encode(f.read()).decode()

        # Clean up temp files
        try:
            os.remove(temp_in_path)
        except Exception:
            pass
        try:
            os.remove(temp_out_path)
        except Exception:
            pass

        return jsonify({
            "image": wm_b64_str,  # Base64 string
            "sha256": sha256,
            "firstAppeared": first_appeared,
            "reused": reused
        })

    except Exception as e:
        print("Flask error:\n", traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=6000, debug=False, threaded=True)
