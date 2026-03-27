import { useEffect, useState } from "react";

interface ApiKey {
  id: number;
  name: string;
  key: string;
  active: boolean;
  created_at: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    const res = await fetch("/api/keys");
    setKeys(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) { setName(""); load(); }
  }

  async function remove(id: number) {
    if (!confirm("Remover esta chave?")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
  }

  async function copy(key: string, id: number) {
    await navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>🔑 API Keys</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        JSON com todas as keys: <a href="/api/keys" target="_blank" style={{ color: "#6366f1" }}>/api/keys</a>
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && create()}
          placeholder="Nome da chave..."
          style={{ flex: 1, padding: "0.6rem 0.9rem", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontSize: "0.9rem" }}
        />
        <button
          onClick={create}
          disabled={!name.trim()}
          style={{ padding: "0.6rem 1.2rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          + Criar
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#64748b" }}>Carregando...</p>
      ) : keys.length === 0 ? (
        <p style={{ color: "#64748b" }}>Nenhuma key criada ainda.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ color: "#64748b", textAlign: "left" }}>
              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid #334155" }}>Nome</th>
              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid #334155" }}>Key</th>
              <th style={{ padding: "0.4rem 0.5rem", borderBottom: "1px solid #334155" }}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => (
              <tr key={k.id}>
                <td style={{ padding: "0.6rem 0.5rem", borderBottom: "1px solid #1e293b" }}>{k.name}</td>
                <td style={{ padding: "0.6rem 0.5rem", borderBottom: "1px solid #1e293b", color: "#a5b4fc" }}>
                  {k.key.slice(0, 12)}...{k.key.slice(-6)}
                  <button
                    onClick={() => copy(k.key, k.id)}
                    style={{ marginLeft: "0.5rem", background: "none", border: "none", cursor: "pointer", fontSize: "1rem" }}
                    title="Copiar key completa"
                  >
                    {copied === k.id ? "✅" : "📋"}
                  </button>
                </td>
                <td style={{ padding: "0.6rem 0.5rem", borderBottom: "1px solid #1e293b" }}>
                  <button
                    onClick={() => remove(k.id)}
                    style={{ background: "none", border: "1px solid #f87171", color: "#f87171", padding: "0.2rem 0.5rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    🗑 Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
