import { useState } from "react";

export default function ImageTrust() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("sourceId", "demo_source_1");

    try {
      const res = await fetch("http://localhost:5000/api/image/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Upload failed", err);
      setResult({ error: "Upload failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 mb-8">
      <h2 className="text-xl font-bold mb-4">🖼️ Image Trust Check</h2>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-3"
      />
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Upload & Verify"}
      </button>

      {result && (
        <div className="mt-4 bg-gray-50 border rounded-lg p-4">
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <>
              <p>
                <strong>Status:</strong>{" "}
                {result.reused ? "⚠️ Reused Image" : "✅ New Image"}
              </p>
              {result.info && (
                <div className="mt-2">
                  <p><strong>Source:</strong> {result.info.sourceId}</p>
                  <p><strong>Timestamp:</strong> {result.info.timestamp}</p>
                  <p><strong>SHA256:</strong> {result.info.sha256}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
