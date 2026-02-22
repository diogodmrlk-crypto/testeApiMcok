const express = require("express");
const app = express();
app.use(express.json());

/* ── CORS ────────────────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});
app.options("*", (req, res) => res.sendStatus(200));

/* ── BANCO ───────────────────────────────────────────────── */
let keys = [];

/* ── HELPERS ─────────────────────────────────────────────── */

/**
 * Calcula expiresAt (timestamp Unix em segundos) com base no tipo e duração.
 * Tipos aceitos: hour | day | weekly | monthly | lifetime
 */
function calcExpiresAt(type, expire = 1) {
  const now = Math.floor(Date.now() / 1000);
  const dur = parseInt(expire) || 1;

  switch (type) {
    case "hour":     return now + dur * 3600;
    case "day":      return now + dur * 86400;
    case "weekly":   return now + dur * 7 * 86400;
    case "monthly":  return now + dur * 30 * 86400;
    case "lifetime": return 0; // 0 = nunca expira
    default:         return now + dur * 86400; // fallback: trata como dia
  }
}

/** Verifica se a key expirou */
function isExpired(k) {
  if (k.expiresAt === 0) return false; // lifetime
  return k.expiresAt > 0 && k.expiresAt < Math.floor(Date.now() / 1000);
}

/** Roda a cada minuto e marca keys expiradas */
function autoExpireLoop() {
  const now = Math.floor(Date.now() / 1000);
  keys.forEach(k => {
    if (!k.expired && k.expiresAt > 0 && k.expiresAt < now) {
      k.expired  = true;
      k.revoked  = true; // bloqueia validação automaticamente
    }
  });
}
setInterval(autoExpireLoop, 60 * 1000); // a cada 1 minuto

/* ── STATUS CALCULADO ────────────────────────────────────── */
function buildStatus(k) {
  if (k.revoked || isExpired(k)) return "expired";
  if (k.used)                     return "active";
  return "pending";
}

/* ───────────────────────────────────────────────────────────
   ROTAS
──────────────────────────────────────────────────────────── */

/* GET /keys  — lista todas (com status atualizado) */
app.get("/keys", (req, res) => {
  autoExpireLoop(); // checa antes de retornar
  const result = keys.map(k => ({ ...k, status: buildStatus(k) }));
  res.json(result);
});

/* GET /keys/:key  — detalhe de uma key */
app.get("/keys/:key", (req, res) => {
  const k = keys.find(x => x.key === req.params.key);
  if (!k) return res.status(404).json({ error: "Key não encontrada" });
  autoExpireLoop();
  res.json({ ...k, status: buildStatus(k) });
});

/* POST /keys  — criar key (chamado pelo dashboard HTML) */
app.post("/keys", (req, res) => {
  if (!req.body.key) {
    return res.status(400).json({ error: "Campo 'key' obrigatório" });
  }

  const exists = keys.find(k => k.key === req.body.key);
  if (exists) {
    return res.status(400).json({ error: "Key já existe" });
  }

  const type    = req.body.type    || "day";
  const expire  = req.body.expire  ?? 1;           // duração numérica
  const createdAt = req.body.createdAt || Math.floor(Date.now() / 1000);
  const expiresAt = req.body.expiresAt !== undefined
    ? req.body.expiresAt                            // aceita valor do client
    : calcExpiresAt(type, expire);                  // ou calcula aqui

  const newKey = {
    id:          req.body.id    || String(Date.now()),
    key:         req.body.key,
    type,
    expire,
    username:    req.body.username   || null,
    used:        req.body.used       || false,
    revoked:     false,
    expired:     false,
    device:      req.body.device     || null,
    createdAt,
    activatedAt: req.body.activatedAt || 0,
    expiresAt,
    _pkg:        req.body._pkg       || null,
    _pkgId:      req.body._pkgId     || null,
  };

  keys.push(newKey);
  res.json({ ...newKey, status: buildStatus(newKey) });
});

/* POST /keys/validate  — valida e vincula device */
app.post("/keys/validate", (req, res) => {
  const { key, device } = req.body;

  if (!key)    return res.status(400).json({ valid: false, reason: "key_required" });
  if (!device) return res.status(400).json({ valid: false, reason: "device_required" });

  const k = keys.find(x => x.key === key);
  if (!k) return res.json({ valid: false, reason: "not_found" });

  // Checar expiração em tempo real
  if (isExpired(k)) {
    k.expired = true;
    k.revoked = true;
    return res.json({ valid: false, reason: "expired" });
  }

  if (k.revoked) return res.json({ valid: false, reason: "revoked" });

  /* Primeira ativação */
  if (!k.used) {
    k.used        = true;
    k.device      = device;
    k.activatedAt = Math.floor(Date.now() / 1000);
    // Se expiresAt ainda não foi calculado (lifetime = 0, ok)
    if (k.expiresAt === undefined || k.expiresAt === null) {
      k.expiresAt = calcExpiresAt(k.type, k.expire);
    }
    return res.json({ valid: true, data: { ...k, status: "active" } });
  }

  /* Device diferente */
  if (k.device !== device) {
    return res.json({ valid: false, reason: "device_mismatch" });
  }

  res.json({ valid: true, data: { ...k, status: buildStatus(k) } });
});

/* PUT /keys/:key  — editar/revogar/resetar device */
app.put("/keys/:key", (req, res) => {
  const k = keys.find(x => x.key === req.params.key);
  if (!k) return res.status(404).json({ error: "Key não encontrada" });

  // Se recalcular tipo/duração, atualiza expiresAt
  if (req.body.type || req.body.expire) {
    const newType   = req.body.type   || k.type;
    const newExpire = req.body.expire ?? k.expire;
    req.body.expiresAt = calcExpiresAt(newType, newExpire);
    req.body.expired   = false; // reativa
    req.body.revoked   = false;
  }

  // Reset device (ex.: suporte resetar bind)
  if (req.body.resetDevice) {
    k.used        = false;
    k.device      = null;
    k.activatedAt = 0;
    delete req.body.resetDevice;
  }

  Object.assign(k, req.body);
  res.json({ success: true, key: { ...k, status: buildStatus(k) } });
});

/* DELETE /keys/:key  — deletar */
app.delete("/keys/:key", (req, res) => {
  const before = keys.length;
  keys = keys.filter(k => k.key !== req.params.key);
  if (keys.length === before) return res.status(404).json({ error: "Key não encontrada" });
  res.json({ success: true });
});

/* DELETE /keys  — limpar todas */
app.delete("/keys", (req, res) => {
  keys = [];
  res.json({ success: true, message: "Todas as keys removidas" });
});

/* GET /stats  — estatísticas rápidas */
app.get("/stats", (req, res) => {
  autoExpireLoop();
  res.json({
    total:    keys.length,
    pending:  keys.filter(k => !k.used && !k.revoked && !isExpired(k)).length,
    active:   keys.filter(k => k.used  && !k.revoked && !isExpired(k)).length,
    expired:  keys.filter(k => isExpired(k)).length,
    revoked:  keys.filter(k => k.revoked && !isExpired(k)).length,
  });
});

module.exports = app;
