import { v4 as uuid } from "uuid";

let db = {};
const MAX_KEYS = 5000;

export default async function handler(req, res) {

  res.setHeader("Content-Type", "application/json");

  const url = req.url.split("?")[0];
  const parts = url.split("/").filter(Boolean);

  // exemplo:
  // /meuprojeto/create
  const resource = parts[0];
  const action = parts[1];

  if(!resource){
    return res.end(JSON.stringify({ api:"Keys API Online" }));
  }

  if(!db[resource]) db[resource] = [];

  const body = req.body || {};

  // ======================
  // CREATE KEY
  // ======================
  if(req.method === "POST" && action === "create"){

    if(db[resource].length >= MAX_KEYS){
      return res.end(JSON.stringify({ error:"Limite 5000 keys atingido" }));
    }

    const newKey = {
      id: uuid(),
      key: body.key,
      used: false,
      device: "",
      expire: body.expire || 0,
      type: body.type || "hour",
      createdAt: Date.now(),
      activatedAt: 0,
      expiresAt: 0
    };

    db[resource].push
