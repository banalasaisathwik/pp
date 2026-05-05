import { useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import {
  BadgeCheck,
  Blocks,
  CheckCircle2,
  ChevronRight,
  FilePlus2,
  Fingerprint,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle
} from "lucide-react";

const API = "http://localhost:5000";

type Article = {
  _id: string;
  url?: string;
  title: string;
  source: string;
  text: string;
  M: number;
  F: number;
  C: number;
  f: number;
  textHash: string;
  createdAt?: string;
  blockchain?: {
    txHash?: string;
    explorerUrl?: string;
    anchored?: boolean;
    anchoredAt?: string;
  };
  image?: {
    reused?: boolean;
    similarityPercentage?: number | string;
    matchedWith?: string;
    sha256?: string;
    phash?: string;
    matchType?: string;
    matchSignals?: string[];
    analyzedAt?: string;
  };
};

type ImageTrustResult = {
  error?: string;

  reused?: boolean;
  similarityPercentage?: number;

  watermarkedImage?: string;
  matchedImage?: string;


  info?: {
    sha256?: string;
    phash?: string;
    reused?: boolean;
    similarityPercentage?: number;
    matchedWith?: string;
    matchedImageId?: string;
    matchType?: string;
    matchSignals?: string[];
  };

  sourceId?: string;
  threshold?: number;
  regionThreshold?: number;
  processedAt?: string;
};

const emptyForm = {
  articleUrl: "",
  title: "",
  text: "",
  source: "",
  authorEmail: "",
  imageUrl: ""
};

function scoreTone(score = 0) {
  if (score >= 0.7) return "good";
  if (score >= 0.45) return "watch";
  return "risk";
}

function shortHash(value?: string, start = 12, end = 8) {
  if (!value) return "Unavailable";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatDate(value?: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function txExplorerUrl(txHash?: string, savedUrl?: string) {
  if (savedUrl) return savedUrl;
  if (!txHash) return "";
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function imageSrc(value?: string) {
  if (!value) return "";
  if (/^(https?:\/\/|data:image\/)/i.test(value)) return value;
  return `data:image/png;base64,${value}`;
}

export default function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verification, setVerification] = useState<any>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const selected = articles.find((article) => article._id === selectedId) || articles[0] || null;

  const stats = useMemo(() => {
    const anchored = articles.filter((article) => article.blockchain?.anchored).length;
    const imageChecked = articles.filter((article) => article.image).length;
    const imageRisks = articles.filter((article) => article.image?.reused).length;
    const averageTrust = articles.length
      ? articles.reduce((sum, article) => sum + (article.f || 0), 0) / articles.length
      : 0;

    return { anchored, imageChecked, imageRisks, averageTrust };
  }, [articles]);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    if (!selectedId && articles[0]?._id) {
      setSelectedId(articles[0]._id);
    }
  }, [articles, selectedId]);

  const fetchArticles = async () => {
    setLoadingArticles(true);
    try {
      const res = await axios.get(`${API}/api/trust/all`);
      setArticles(res.data);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError("");
    setSubmitMessage("");

    if (!form.articleUrl.trim() && !form.text.trim()) {
      setSubmitError("Paste an article URL or enter article text before analyzing.");
      return;
    }

    if (!form.authorEmail.trim()) {
      setSubmitError("Author email is required so the trust score can be attached to an author.");
      return;
    }

    setSubmitting(true);
    setSubmitMessage(form.articleUrl.trim() ? "Scraping article URL, extracting text and lead image..." : "Analyzing article text...");
    try {
      const articleRes = await axios.post(`${API}/api/analyze`, {
        url: form.articleUrl.trim(),
        title: form.title,
        text: form.text,
        source: form.source,
        authorEmail: form.authorEmail
      });
      const imageUrl = form.imageUrl.trim() || articleRes.data?.scraped?.imageUrl || "";

      if (imageUrl && articleRes.data?.articleId) {
        setSubmitMessage("Article analyzed. Checking extracted image for reuse...");
        await axios.post(`${API}/api/image`, {
          imageUrl,
          sourceId: form.source || form.authorEmail || "unknown",
          articleId: articleRes.data.articleId,
          payload: {
            articleId: articleRes.data.articleId,
            textHash: articleRes.data.textHash,
            source: form.source || articleRes.data?.scraped?.source
          }
        });
      }

      setForm(emptyForm);
      setShowForm(false);
      setSelectedId(articleRes.data?.articleId || null);
      setSubmitMessage("Article added successfully.");
      await fetchArticles();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.message || "Failed to add article");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyArticle = async (hash: string) => {
    setVerification(null);
    setVerificationError("");
    setVerificationLoading(true);

    try {
      const res = await axios.get(`${API}/api/verify/${hash}`, { timeout: 20000 });
      setVerification(res.data);
    } catch (err: any) {
      setVerificationError(
        err?.response?.data?.error ||
          err?.message ||
          "Blockchain verification failed. Check RPC_URL, CONTRACT_ADDRESS, and that the chain is running."
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <aside className="article-rail">
        <div className="brand-block">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="eyebrow">Guide:Mr.Harish Goud,cordinator:Mr.Sagar</p>
            <h1>Team IT-1/120</h1>
          </div>
        </div>

        <button className="primary-action" onClick={() => setShowForm((value) => !value)}>
          <FilePlus2 size={18} />
          {showForm ? "Close Article Intake" : "Add Article"}
        </button>

        {showForm && (
          <section className="intake-panel">
            <label>
              Article URL
              <input
                value={form.articleUrl}
                onChange={(event) => setForm({ ...form, articleUrl: event.target.value })}
                placeholder="Paste article URL to auto-scrape text and image"
              />
            </label>
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Optional override"
              />
            </label>
            <label>
              Article Text
              <textarea
                value={form.text}
                onChange={(event) => setForm({ ...form, text: event.target.value })}
                placeholder="Optional manual text if URL scraping is not available"
              />
            </label>
            <div className="field-row">
              <label>
                Source
                <input
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label>
                Author Email
                <input
                  value={form.authorEmail}
                  onChange={(event) => setForm({ ...form, authorEmail: event.target.value })}
                  placeholder="name@example.com"
                />
              </label>
            </div>
            <label>
              Image URL
              <input
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                placeholder="Optional override; scraped from article URL when empty"
              />
            </label>
            <button className="submit-action" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <RefreshCw className="spin" size={17} /> : <Sparkles size={17} />}
              {submitting ? "Analyzing" : "Analyze Article"}
            </button>
            {submitMessage && <div className="inline-status">{submitMessage}</div>}
            {submitError && <div className="inline-error">{submitError}</div>}
          </section>
        )}

        <div className="rail-section-title">Articles</div>
        <div className="article-list">
          {loadingArticles ? (
            <div className="empty-list">Loading articles...</div>
          ) : articles.length ? (
            articles.map((article) => (
              <button
                className={`article-list-item ${selected?._id === article._id ? "selected" : ""}`}
                key={article._id}
                onClick={() => {
                  setSelectedId(article._id);
                  setVerification(null);
                  setVerificationError("");
                }}
              >
                <span className={`score-dot ${scoreTone(article.f)}`} />
                <span className="article-list-copy">
                  <strong>{article.title || "Untitled article"}</strong>
                  <span>{article.source || "Unknown source"}</span>
                </span>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <div className="empty-list">No articles yet</div>
          )}
        </div>
      </aside>

      <section className="content-stage">
        <header className="top-bar">
          <div>
            {/* <p className="eyebrow">Operational Overview</p> */}
            <h2>Article credibility, image reuse, and chain proof in one place</h2>
          </div>
          <div className="top-actions">
            <button className="top-add-action" onClick={() => setShowForm(true)}>
              <FilePlus2 size={17} />
              Add Article
            </button>
            <button className="ghost-action" onClick={fetchArticles}>
              <RefreshCw size={17} />
              Refresh
            </button>
          </div>
        </header>

        <section className="metrics-row">
          <Metric label="Average Trust" value={stats.averageTrust.toFixed(2)} icon={<BadgeCheck />} tone={scoreTone(stats.averageTrust)} />
          <Metric label="Anchored" value={`${stats.anchored}/${articles.length}`} icon={<Blocks />} tone="good" />
          <Metric label="Images Checked" value={`${stats.imageChecked}`} icon={<ImageIcon />} tone="neutral" />
          <Metric label="Image Risks" value={`${stats.imageRisks}`} icon={<ShieldAlert />} tone={stats.imageRisks ? "risk" : "good"} />
        </section>

        {selected ? (
          <article className="article-workspace">
            <div className="article-header">
              <div>
                <p className="source-line">{selected.source || "Unknown source"}</p>
                <h2>{selected.title || "Untitled article"}</h2>
              </div>
              <span className={`trust-pill ${scoreTone(selected.f)}`}>
                Trust {selected.f.toFixed(2)}
              </span>
            </div>

            <div className="article-body">{selected.text}</div>
            {selected.url && (
              <a className="source-link" href={selected.url} target="_blank" rel="noreferrer">
                <Link2 size={15} />
                {selected.url}
              </a>
            )}

            <section className="score-board">
              <Score label="Message" value={selected.M} />
              <Score label="Fact" value={selected.F} />
              <Score label="Context" value={selected.C} />
              <Score label="Final Trust" value={selected.f} featured />
            </section>
          </article>
        ) : (
          <section className="empty-stage">
            <SearchCheck size={42} />
            <h2>Select or add an article</h2>
          </section>
        )}
      </section>

      <aside className="inspector">
        <Panel title="Image Trust" icon={<Fingerprint size={18} />}>
          {selected?.image ? (
            <div className="status-stack">
              <div className={`status-card ${selected.image.reused ? "risk" : "good"}`}>
                {selected.image.reused ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
                <div>
                  <strong>{selected.image.reused ? "Similar Image Found" : "Image Appears Original"}</strong>
                  <span>{Number(selected.image.similarityPercentage || 0).toFixed(2)}% similarity</span>
                </div>
              </div>
              <KeyValue label="Match Type" value={selected.image.matchType || "None"} />
              <KeyValue label="Signals" value={selected.image.matchSignals?.join(", ") || "No strong signal"} />
              <KeyValue label="Image Hash" value={shortHash(selected.image.sha256)} />
              {selected.image.matchedWith && (
                <div className="matched-image">
                  <span>Matched image</span>
                  <img src={selected.image.matchedWith} alt="Matched image evidence" />
                </div>
              )}
            </div>
          ) : (
            <div className="quiet-state">No image analysis attached to this article.</div>
          )}
        </Panel>

        <Panel title="Blockchain" icon={<Blocks size={18} />}>
          {selected?.blockchain?.anchored ? (
            <div className="status-stack">
              <div className="status-card good">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Anchored</strong>
                  <span>{formatDate(selected.blockchain.anchoredAt)}</span>
                </div>
              </div>
              <KeyValue label="Transaction" value={shortHash(selected.blockchain.txHash)} />
              {selected.blockchain.txHash && (
                <a className="source-link inspector-link" href={txExplorerUrl(selected.blockchain.txHash, selected.blockchain.explorerUrl)} target="_blank" rel="noreferrer">
                  <Link2 size={15} />
                  View on Etherscan
                </a>
              )}
              <button className="secondary-action" disabled={verificationLoading} onClick={() => verifyArticle(selected.textHash)}>
                {verificationLoading ? <RefreshCw className="spin" size={17} /> : <SearchCheck size={17} />}
                {verificationLoading ? "Verifying" : "Verify On Chain"}
              </button>
            </div>
          ) : (
            <div className="status-card risk">
              <XCircle size={20} />
              <div>
                <strong>Not Anchored</strong>
                <span>No chain proof recorded</span>
              </div>
            </div>
          )}
          {verificationLoading && <div className="inline-status">Checking proof on blockchain RPC...</div>}
          {verificationError && <div className="inline-error">{verificationError}</div>}
          {verification && (
            <>
              {verification.explorerUrl && (
                <a className="source-link inspector-link" href={verification.explorerUrl} target="_blank" rel="noreferrer">
                  <Link2 size={15} />
                  Open Verified Tx
                </a>
              )}
              <pre className="verification-output">{JSON.stringify(verification, null, 2)}</pre>
            </>
          )}
        </Panel>

        <ImageTrustTool />
      </aside>
    </main>
  );
}

function ImageTrustTool() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [result, setResult] = useState<ImageTrustResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file && !imageUrl.trim()) return;

    setLoading(true);
    try {
      const res = file
        ? await fetch(`${API}/api/image/upload`, {
            method: "POST",
            body: (() => {
              const formData = new FormData();
              formData.append("image", file);
              formData.append("sourceId", "manual_desktop_check");
              return formData;
            })()
          })
        : await fetch(`${API}/api/image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: imageUrl.trim(),
              sourceId: "manual_url_check"
            })
          });
      const data = await res.json();
      setResult(res.ok ? data : { error: data.error || "Image verification failed" });
    } catch {
      setResult({ error: "Upload failed" });
    } finally {
      setLoading(false);
    }
  };

  const processedImageSrc = imageSrc(result?.watermarkedImage);
  const matchedImageSrc = imageSrc(result?.matchedImage || result?.info?.matchedWith);

  return (
    <Panel title="Manual Image Check" icon={<Upload size={18} />}>
      <label className="upload-drop">
        <ImageIcon size={20} />
        <span>{file ? file.name : "Choose an image file"}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            if (event.target.files?.[0]) setImageUrl("");
          }}
        />
      </label>
      <label>
        Image URL
        <input
          value={imageUrl}
          onChange={(event) => {
            setImageUrl(event.target.value);
            if (event.target.value.trim()) setFile(null);
          }}
          placeholder="Or paste direct image URL"
        />
      </label>
      <button className="secondary-action" disabled={(!file && !imageUrl.trim()) || loading} onClick={handleUpload}>
        {loading ? <RefreshCw className="spin" size={17} /> : <Fingerprint size={17} />}
        {loading ? "Checking" : "Run Image Trust"}
      </button>
      {result?.error && <div className="inline-error">{result.error}</div>}
      {result && !result.error && (
        <div className="mini-result">
          <div className={`status-card ${result.reused ? "risk" : "good"}`}>
            {result.reused ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <strong>{result.reused ? "Reuse detected" : "No reuse detected"}</strong>
              <span>{Number(result.info?.similarityPercentage || result.similarityPercentage || 0).toFixed(2)}% similarity</span>
            </div>
          </div>
          <KeyValue label="Match Type" value={result.info?.matchType || "None"} />
          <KeyValue label="Signals" value={result.info?.matchSignals?.join(", ") || "No strong signal"} />
          {processedImageSrc && (
            <div className="matched-image">
              <span>Processed image</span>
              <img src={processedImageSrc} alt="Processed image evidence" />
            </div>
          )}
          {matchedImageSrc && (
            <div className="matched-image">
              <span>Matched image</span>
              <img src={matchedImageSrc} alt="Matched image evidence" />
            </div>
          )}
        </div>
      )}
      
    </Panel>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="inspector-panel">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: string }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Score({ label, value, featured }: { label: string; value: number; featured?: boolean }) {
  const tone = scoreTone(value);

  return (
    <div className={`score-card ${featured ? "featured" : ""} ${tone}`}>
      <span>{label}</span>
      <strong>{value.toFixed(2)}</strong>
      <div className="score-track">
        <span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
