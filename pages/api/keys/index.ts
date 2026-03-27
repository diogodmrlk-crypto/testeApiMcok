import type { NextApiRequest, NextApiResponse } from "next";
import { query, initDB } from "../../../lib/db";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await initDB();

  if (req.method === "GET") {
    try {
      const result = await query(
        "SELECT id, name, key, active, created_at, last_used_at, expires_at FROM api_keys ORDER BY created_at DESC"
      );
      return res.status(200).json(result.rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  }

  if (req.method === "POST") {
    try {
      const { name, expiresAt } = req.body as { name: string; expiresAt?: string };
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const key = "sk_" + crypto.randomBytes(32).toString("hex");
      const result = await query(
        `INSERT INTO api_keys (name, key, active, expires_at)
         VALUES ($1, $2, true, $3)
         RETURNING *`,
        [name.trim(), key, expiresAt || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao criar chave" });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
