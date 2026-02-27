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
from PIL import Image
import imagehash
import io

app = Flask(__name__)


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

def compute_phash(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    phash = imagehash.phash(img)
    return str(phash)

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

        # 1️⃣ Download image
        img_bytes = download_image_or_decode(image_url)

        # 2️⃣ Compute SHA256
        sha256 = compute_sha256(img_bytes)

        phash = compute_phash(img_bytes)

        # 3️⃣ Embed watermark
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_in:
            temp_in.write(img_bytes)
            temp_in_path = temp_in.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_out:
            temp_out_path = temp_out.name

        bwm = WaterMark(password_wm=1, password_img=1)
        bwm.read_img(temp_in_path)
        bwm.read_wm(json.dumps(payload), mode="str")
        bwm.embed(temp_out_path)

        # Fix OpenCV depth issue
        img = cv2.imread(temp_out_path, cv2.IMREAD_UNCHANGED)
        if img is not None and img.dtype != np.uint8:
            img = cv2.convertScaleAbs(img)
            cv2.imwrite(temp_out_path, img)

        # Convert to base64
        with open(temp_out_path, "rb") as f:
            wm_b64_str = base64.b64encode(f.read()).decode()

        # Cleanup
        try:
            os.remove(temp_in_path)
        except:
            pass
        try:
            os.remove(temp_out_path)
        except:
            pass

        return jsonify({
    "image": wm_b64_str,
    "sha256": sha256,
    "phash": phash,
    "processedAt": datetime.now(timezone.utc).isoformat()
})

    except Exception as e:
        print("Flask error:\n", traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=6000, debug=False, threaded=True)