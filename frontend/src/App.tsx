import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:5000";

type Article = {
  _id: string;
  title: string;
  source: string;
  text: string;
  M: number;
  F: number;
  C: number;
  f: number;
  textHash: string;
  blockchain?: {
    txHash?: string;
    anchored?: boolean;
    anchoredAt?: string;
  };
  image?: {
    reused?: boolean;
    similarityPercentage?: string;
    matchedWith?: string;
  };
};

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    title: "",
    text: "",
    source: "",
    authorEmail: ""
  });

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    const res = await axios.get(`${API}/api/trust/all`);
    setArticles(res.data);
  };

  const handleSubmit = async () => {
    try {
      await axios.post(`${API}/api/analyze`, form);
      setForm({ title: "", text: "", source: "", authorEmail: "" });
      setShowForm(false);
      fetchArticles();
    } catch {
      alert("Failed to add article");
    }
  };

  const verifyArticle = async (hash: string) => {
    const res = await axios.get(`${API}/api/verify/${hash}`);
    setVerification(res.data);
  };

  return (
    <div style={styles.container}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ marginBottom: "1rem" }}>TrustChain</h2>

        <button
          style={styles.primaryButton}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Close Form" : "+ Add Article"}
        </button>

        {showForm && (
          <div style={styles.formCard}>
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={styles.input}
            />
            <textarea
              placeholder="Text"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              style={styles.textarea}
            />
            <input
              placeholder="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Author Email"
              value={form.authorEmail}
              onChange={(e) =>
                setForm({ ...form, authorEmail: e.target.value })
              }
              style={styles.input}
            />
            <button style={styles.primaryButton} onClick={handleSubmit}>
              Submit
            </button>
          </div>
        )}

        <hr style={{ margin: "1rem 0" }} />

        <div style={{ overflowY: "auto", flex: 1 }}>
          {articles.map((article) => (
            <div
              key={article._id}
              style={{
                ...styles.articleCard,
                backgroundColor:
                  selected?._id === article._id ? "#e8f0ff" : "#fff"
              }}
              onClick={() => {
                setSelected(article);
                setVerification(null);
              }}
            >
              <h4>{article.title}</h4>
              <p style={{ fontSize: "0.8rem", color: "#666" }}>
                Trust Score: {article.f.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        {selected ? (
          <div style={styles.detailCard}>
            <h2>{selected.title}</h2>
            <p><strong>Source:</strong> {selected.source}</p>
            <p style={{ marginTop: "1rem" }}>{selected.text}</p>

            <hr />

            <h3>AI Scores</h3>
            <div style={styles.scoreGrid}>
              <Score label="Message" value={selected.M} />
              <Score label="Fact" value={selected.F} />
              <Score label="Context" value={selected.C} />
              <Score label="Final Trust" value={selected.f} highlight />
            </div>

            <hr />

            <h3>Blockchain</h3>
            {selected.blockchain?.anchored ? (
              <>
                <p style={{ color: "green" }}>✅ Anchored</p>
                <p style={styles.hash}>
                  Tx: {selected.blockchain.txHash}
                </p>

                <button
                  style={styles.primaryButton}
                  onClick={() => verifyArticle(selected.textHash)}
                >
                  Verify On Chain
                </button>
              </>
            ) : (
              <p style={{ color: "red" }}>❌ Not Anchored</p>
            )}

            <hr />

<h3>Image Analysis</h3>

{selected.image ? (
  <>
    {selected.image.reused ? (
      <p style={{ color: "red", fontWeight: "bold" }}>
        ⚠ Similar Image Found
      </p>
    ) : (
      <p style={{ color: "green" }}>
        ✅ Image Appears Original
      </p>
    )}

    <p>
      Similarity:{" "}
      <strong>{parseFloat(selected.image.similarityPercentage || "0").toFixed(2)}%</strong>
    </p>

    {selected.image.similarityPercentage &&
      parseFloat(selected.image.similarityPercentage) > 85 && (
        <p style={{ color: "darkred" }}>
          ⚠ High similarity — likely reused image
        </p>
      )}

    {selected.image.matchedWith && (
      <>
        <h4>Matched Image</h4>
        <img
          src={selected.image.matchedWith}
          style={{
            maxWidth: "300px",
            borderRadius: "8px",
            marginTop: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
          }}
        />
      </>
    )}
  </>
) : (
  <p>No image analysis available</p>
)}

            {verification && (
              <div style={styles.verificationBox}>
                <h4>Verification Result</h4>
                <pre>{JSON.stringify(verification, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.placeholder}>
            <h2>Select an article from the left</h2>
          </div>
        )}
      </div>
    </div>
  );
}

/* COMPONENTS */

const Score = ({
  label,
  value,
  highlight
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) => (
  <div
    style={{
      padding: "1rem",
      borderRadius: "12px",
      background: highlight ? "#2563eb" : "#f4f6f8",
      color: highlight ? "white" : "#333",
      textAlign: "center"
    }}
  >
    <div style={{ fontSize: "0.8rem" }}>{label}</div>
    <div style={{ fontSize: "1.4rem", fontWeight: "bold" }}>
      {value.toFixed(2)}
    </div>
  </div>
);

/* STYLES */

const styles: any = {
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "Inter, sans-serif",
    backgroundColor: "#f4f6f8"
  },
  sidebar: {
    width: "320px",
    padding: "1.5rem",
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    boxShadow: "2px 0 8px rgba(0,0,0,0.05)"
  },
  main: {
    flex: 1,
    padding: "2rem",
    overflowY: "auto"
  },
  articleCard: {
    padding: "1rem",
    borderRadius: "12px",
    marginBottom: "0.8rem",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
  },
  formCard: {
    marginTop: "1rem",
    padding: "1rem",
    borderRadius: "12px",
    backgroundColor: "#f9fafb",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
  },
  input: {
    width: "100%",
    padding: "0.6rem",
    marginBottom: "0.6rem",
    borderRadius: "8px",
    border: "1px solid #ddd"
  },
  textarea: {
    width: "100%",
    height: "80px",
    padding: "0.6rem",
    marginBottom: "0.6rem",
    borderRadius: "8px",
    border: "1px solid #ddd"
  },
  primaryButton: {
    padding: "0.6rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "0.5rem"
  },
  detailCard: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "16px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    marginTop: "1rem"
  },
  verificationBox: {
    marginTop: "1rem",
    padding: "1rem",
    borderRadius: "8px",
    backgroundColor: "#f4f6f8"
  },
  placeholder: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: "#888"
  },
  hash: {
    fontSize: "0.8rem",
    wordBreak: "break-all"
  }
};