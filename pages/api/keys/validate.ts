import type { NextApiRequest, NextApiResponse } from "next";
import { query, initDB } from "../../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await initDB();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { key } = req.body as { key: string };
    if (!key) {
      return res.status(200).json({ valid: false });
    }

    const result = await query(
      "SELECT * FROM api_keys WHERE key = $1 AND active = true LIMIT 1",
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ valid: false });
    }

    const record = result.rows[0];
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return res.status(200).json({ valid: false });
    }

    await query("UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", [record.id]);

    return res.status(200).json({ valid: true, keyId: record.id, name: record.name });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao validar chave" });
  }
}
