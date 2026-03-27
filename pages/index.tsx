import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import styles from "../styles/Home.module.css";

interface ApiKey {
  id: number;
  name: string;
  key: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

function maskKey(key: string) {
  if (key.length <= 10) return key;
  return key.slice(0, 7) + "••••••••••••" + key.slice(-6);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR");
}

export default function Home() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [validateInput, setValidateInput] = useState("");
  const [validateResult, setValidateResult] = useState<{ valid: boolean; name?: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    const data = await res.json();
    setKeys(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim(), expiresAt: newKeyExpiry || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setCreatedKey(data);
      setShowModal(true);
      setNewKeyName("");
      setNewKeyExpiry("");
      await fetchKeys();
    } else {
      alert(data.error || "Erro ao criar chave");
    }
    setCreating(false);
  }

  async function deleteKey(id: number) {
    if (!confirm("Tem certeza que deseja remover esta chave?")) return;
    setDeletingId(id);
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    await fetchKeys();
    setDeletingId(null);
  }

  async function toggleKey(id: number) {
    await fetch(`/api/keys/${id}`, { method: "PATCH" });
    await fetchKeys();
  }

  async function copyToClipboard(text: string, id: number) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function validateKey() {
    if (!validateInput.trim()) return;
    const res = await fetch("/api/keys/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: validateInput.trim() }),
    });
    const data = await res.json();
    setValidateResult(data);
  }

  return (
    <>
      <Head>
        <title>API Key Manager</title>
        <meta name="description" content="Gerenciador de chaves de API com banco de dados persistente" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <h1>🔑 API Key Manager</h1>
          <p>Suas chaves ficam salvas no banco de dados e nunca somem</p>
        </header>

        <section className={styles.card}>
          <h2>Criar nova chave</h2>
          <div className={styles.form}>
            <input
              type="text"
              placeholder="Nome da chave (ex: Minha API, Bot Telegram...)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className={styles.input}
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
            <input
              type="datetime-local"
              value={newKeyExpiry}
              onChange={(e) => setNewKeyExpiry(e.target.value)}
              className={styles.input}
              title="Data de expiração (opcional)"
            />
            <button
              onClick={createKey}
              disabled={creating || !newKeyName.trim()}
              className={styles.btnPrimary}
            >
              {creating ? "Criando..." : "+ Criar Chave"}
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Suas chaves ({keys.length})</h2>
          {loading ? (
            <p className={styles.muted}>Carregando...</p>
          ) : keys.length === 0 ? (
            <p className={styles.muted}>Nenhuma chave criada ainda.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Chave</th>
                    <th>Status</th>
                    <th>Criada em</th>
                    <th>Último uso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td><strong>{k.name}</strong></td>
                      <td>
                        <code className={styles.keyCode}>{maskKey(k.key)}</code>
                        <button
                          onClick={() => copyToClipboard(k.key, k.id)}
                          className={styles.btnIcon}
                          title="Copiar chave completa"
                        >
                          {copiedId === k.id ? "✅" : "📋"}
                        </button>
                      </td>
                      <td>
                        <span className={k.active ? styles.badgeActive : styles.badgeInactive}>
                          {k.active ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td>{formatDate(k.created_at)}</td>
                      <td>{formatDate(k.last_used_at)}</td>
                      <td>
                        <button
                          onClick={() => toggleKey(k.id)}
                          className={styles.btnSecondary}
                          title={k.active ? "Desativar" : "Ativar"}
                        >
                          {k.active ? "⏸ Desativar" : "▶ Ativar"}
                        </button>
                        <button
                          onClick={() => deleteKey(k.id)}
                          disabled={deletingId === k.id}
                          className={styles.btnDanger}
                          title="Remover chave"
                        >
                          🗑 Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2>Validar uma chave</h2>
          <div className={styles.form}>
            <input
              type="text"
              placeholder="Cole aqui a chave para testar (sk_...)"
              value={validateInput}
              onChange={(e) => { setValidateInput(e.target.value); setValidateResult(null); }}
              className={styles.input}
            />
            <button onClick={validateKey} className={styles.btnPrimary}>
              Validar
            </button>
          </div>
          {validateResult !== null && (
            <div className={validateResult.valid ? styles.alertSuccess : styles.alertError}>
              {validateResult.valid
                ? `✅ Chave válida! Nome: ${validateResult.name}`
                : "❌ Chave inválida ou inativa"}
            </div>
          )}
        </section>
      </div>

      {showModal && createdKey && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>✅ Chave criada com sucesso!</h2>
            <p className={styles.warning}>
              ⚠️ Copie agora! Esta chave não será exibida novamente completa na lista.
            </p>
            <code className={styles.fullKey}>{createdKey.key}</code>
            <div className={styles.modalActions}>
              <button
                onClick={() => copyToClipboard(createdKey.key, -1)}
                className={styles.btnPrimary}
              >
                {copiedId === -1 ? "✅ Copiado!" : "📋 Copiar Chave"}
              </button>
              <button onClick={() => setShowModal(false)} className={styles.btnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
