const express = require("express");
const app = express();

app.use(express.json());

// ================= CORS =================
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  next();
});

app.options("*", (req, res) => res.sendStatus(200));

// ================= DATABASE =================
let db = {};

// ================= RAIZ =================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    resources: db
  });
});

// ================= LISTAR RESOURCE =================
app.get("/:resource", (req, res) => {
  const r = req.params.resource;
  res.json(db[r] || []);
});

// ================= CRIAR KEY =================
app.post("/:resource", (req, res) => {
  const r = req.params.resource;

  if (!db[r]) db[r] = [];

  if (db[r].length >= 5000) {
    return res.status(400).json({
      error: "Limite de 5000 keys atingido"
    });
  }

  const prefix = req.body.prefix || "KEY";
  const type = req.body.type || "default";

  const key =
    prefix +
    "-" +
    Math.random().toString(36).substring(2, 10);

  const obj = {
    id: Date.now(),
    key: key,
    type: type,
    used: false,
    device: null,
    createdAt: new Date().toISOString()
  };

  db[r].push(obj);

  res.json(obj);
});

// ================= VALIDAR KEY =================
app.post("/:resource/validate", (req, res) => {
  const r = req.params.resource;
  const { key, device } = req.body;

  if (!db[r]) return res.json({ valid: false });

  const k = db[r].find(x => x.key === key);

  if (!k) return res.json({ valid: false });

  // Primeira ativação
  if (!k.used) {
    k.used = true;
    k.device = device;
  }

  // Proteção device
  if (k.device !== device) {
    return res.json({
      valid: false,
      reason: "device mismatch"
    });
  }

  res.json({
    valid: true,
    data: k
  });
});

module.exports = app;
