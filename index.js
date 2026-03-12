const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(express.json());

/* ── CONFIGURAÇÃO DE PERSISTÊNCIA ────────────────────────── */
const DB_FILE = path.join(__dirname, "keys.json");
console.log(`[DEBUG] Caminho do arquivo de chaves: ${DB_FILE}`);

/** Carrega as chaves do arquivo JSON */
function loadKeys() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      const loadedKeys = JSON.parse(data);
      console.log(`[DEBUG] Chaves carregadas do arquivo: ${loadedKeys.length} chaves.`);
      return loadedKeys;
    } else {
      console.log(`[DEBUG] Arquivo keys.json não encontrado em ${DB_FILE}. Iniciando com array vazio.`);
    }
  } catch (err) {
    console.error("[DEBUG] Erro ao carregar keys.json:", err);
  }
  return [];
}

/** Salva as chaves no arquivo JSON */
function saveKeys(keysArray) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(keysArray, null, 2), "utf8");
    console.log(`[DEBUG] Chaves salvas no arquivo: ${keysArray.length} chaves.`);
  } catch (err) {
    console.error("[DEBUG] Erro ao salvar keys.json:", err);
  }
}

// Inicializa a variável 'keys' carregando do arquivo
let keys = loadKeys();

/* ── CORS ────────────────────────────────────────────────── */
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});
app.options("*", (req, res) => res.sendStatus(200));

/* ── HELPERS ─────────────────────────────────────────────── */

/**
 * Calcula expiresAt (timestamp Unix em segundos) com base no tipo e duração.
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

/** Roda a cada minuto e marca keys expiradas e salva se houver mudanças */
function autoExpireLoop() {
  const now = Math.floor(Date.now() / 1000);
  let changed = false;
  keys.forEach(k => {
    if (!k.expired && k.expiresAt > 0 && k.expiresAt < now) {
      k.expired  = true;
      k.revoked  = true; // bloqueia validação automaticamente
      changed = true;
    }
  });
  if (changed) {
    saveKeys(keys);
    console.log("[DEBUG] autoExpireLoop: Chaves expiradas atualizadas e salvas.");
  }
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
  console.log(`[DEBUG] GET /keys: Retornando ${result.length} chaves.`);
  res.json(result);
});

/* GET /keys/:key  — detalhe de uma key */
app.get("/keys/:key", (req, res) => {
  const k = keys.find(x => x.key === req.params.key);
  if (!k) {
    console.log(`[DEBUG] GET /keys/:key: Chave '${req.params.key}' não encontrada.`);
    return res.status(404).json({ error: "Key não encontrada" });
  }
  autoExpireLoop();
  console.log(`[DEBUG] GET /keys/:key: Retornando detalhes da chave '${req.params.key}'.`);
  res.json({ ...k, status: buildStatus(k) });
});

/* POST /keys  — criar key (chamado pelo dashboard HTML) */
app.post("/keys", (req, res) => {
  if (!req.body.key) {
    console.log("[DEBUG] POST /keys: Campo 'key' obrigatório ausente.");
    return res.status(400).json({ error: "Campo 'key' obrigatório" });
  }

  const exists = keys.find(k => k.key === req.body.key);
  if (exists) {
    console.log(`[DEBUG] POST /keys: Chave '${req.body.key}' já existe.`);
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
  saveKeys(keys); // Salva no arquivo JSON
  console.log(`[DEBUG] POST /keys: Nova chave '${newKey.key}' criada e salva.`);
  res.json({ ...newKey, status: buildStatus(newKey) });
});

/* POST /keys/validate  — valida e vincula device */
app.post("/keys/validate", (req, res) => {
  const { key, device } = req.body;

  if (!key) {
    console.log("[DEBUG] POST /keys/validate: Campo 'key' obrigatório ausente.");
    return res.status(400).json({ valid: false, reason: "key_required" });
  }
  if (!device) {
    console.log("[DEBUG] POST /keys/validate: Campo 'device' obrigatório ausente.");
    return res.status(400).json({ valid: false, reason: "device_required" });
  }

  const k = keys.find(x => x.key === key);
  if (!k) {
    console.log(`[DEBUG] POST /keys/validate: Chave '${key}' não encontrada.`);
    return res.json({ valid: false, reason: "not_found" });
  }

  // Checar expiração em tempo real
  if (isExpired(k)) {
    k.expired = true;
    k.revoked = true;
    saveKeys(keys); // Salva a mudança de status
    console.log(`[DEBUG] POST /keys/validate: Chave '${key}' expirada e status salvo.`);
    return res.json({ valid: false, reason: "expired" });
  }

  if (k.revoked) {
    console.log(`[DEBUG] POST /keys/validate: Chave '${key}' revogada.`);
    return res.json({ valid: false, reason: "revoked" });
  }

  /* Primeira ativação */
  if (!k.used) {
    k.used        = true;
    k.device      = device;
    k.activatedAt = Math.floor(Date.now() / 1000);
    // Se expiresAt ainda não foi calculado (lifetime = 0, ok)
    if (k.expiresAt === undefined || k.expiresAt === null) {
      k.expiresAt = calcExpiresAt(k.type, k.expire);
    }
    saveKeys(keys); // Salva a ativação
    console.log(`[DEBUG] POST /keys/validate: Chave '${key}' ativada e salva.`);
    return res.json({ valid: true, data: { ...k, status: "active" } });
  }

  /* Device diferente */
  if (k.device !== device) {
    console.log(`[DEBUG] POST /keys/validate: Chave '${key}' com device mismatch.`);
    return res.json({ valid: false, reason: "device_mismatch" });
  }

  console.log(`[DEBUG] POST /keys/validate: Chave '${key}' validada.`);
  res.json({ valid: true, data: { ...k, status: buildStatus(k) } });
});

/* PUT /keys/:key  — editar/revogar/resetar device */
app.put("/keys/:key", (req, res) => {
  const k = keys.find(x => x.key === req.params.key);
  if (!k) {
    console.log(`[DEBUG] PUT /keys/:key: Chave '${req.params.key}' não encontrada.`);
    return res.status(404).json({ error: "Key não encontrada" });
  }

  // Se recalcular tipo/duração, atualiza expiresAt
  if (req.body.type || req.body.expire) {
    const newType   = req.body.type   || k.type;
    const newExpire = req.body.expire ?? k.expire;
    req.body.expiresAt = calcExpiresAt(newType, newExpire);
    req.body.expired   = false; // reativa
    req.body.revoked   = false;
    console.log(`[DEBUG] PUT /keys/:key: Recalculando expiresAt para chave '${req.params.key}'.`);
  }

  // Reset device (ex.: suporte resetar bind)
  if (req.body.resetDevice) {
    k.used        = false;
    k.device      = null;
    k.activatedAt = 0;
    delete req.body.resetDevice;
    console.log(`[DEBUG] PUT /keys/:key: Resetando device para chave '${req.params.key}'.`);
  }

  Object.assign(k, req.body);
  saveKeys(keys); // Salva as alterações
  console.log(`[DEBUG] PUT /keys/:key: Chave '${req.params.key}' atualizada e salva.`);
  res.json({ success: true, key: { ...k, status: buildStatus(k) } });
});

/* DELETE /keys/:key  — deletar */
app.delete("/keys/:key", (req, res) => {
  const before = keys.length;
  keys = keys.filter(k => k.key !== req.params.key);
  if (keys.length === before) {
    console.log(`[DEBUG] DELETE /keys/:key: Chave '${req.params.key}' não encontrada para exclusão.`);
    return res.status(404).json({ error: "Key não encontrada" });
  }
  saveKeys(keys); // Salva a remoção
  console.log(`[DEBUG] DELETE /keys/:key: Chave '${req.params.key}' excluída e salva.`);
  res.json({ success: true });
});

/* DELETE /keys  — limpar todas */
app.delete("/keys", (req, res) => {
  keys = [];
  saveKeys(keys); // Limpa o arquivo JSON
  console.log("[DEBUG] DELETE /keys: Todas as chaves removidas e salvas.");
  res.json({ success: true, message: "Todas as keys removidas" });
});

/* GET /stats  — estatísticas rápidas */
app.get("/stats", (req, res) => {
  autoExpireLoop();
  console.log("[DEBUG] GET /stats: Retornando estatísticas.");
  res.json({
    total:    keys.length,
    pending:  keys.filter(k => !k.used && !k.revoked && !isExpired(k)).length,
    active:   keys.filter(k => k.used  && !k.revoked && !isExpired(k)).length,
    expired:  keys.filter(k => isExpired(k)).length,
    revoked:  keys.filter(k => k.revoked && !isExpired(k)).length,
  });
});

module.exports = app;
