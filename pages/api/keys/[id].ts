import type { NextApiRequest, NextApiResponse } from "next";
import { query, initDB } from "../../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await initDB();

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  if (req.method === "DELETE") {
    try {
      const result = await query(
        "DELETE FROM api_keys WHERE id = $1 RETURNING id",
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Chave não encontrada" });
      }
      return res.status(200).json({ success: true, message: "Chave removida" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao remover chave" });
    }
  }

  if (req.method === "PATCH") {
    try {
      const existing = await query(
        "SELECT * FROM api_keys WHERE id = $1 LIMIT 1",
        [id]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Chave não encontrada" });
      }
      const newActive = !existing.rows[0].active;
      const result = await query(
        "UPDATE api_keys SET active = $1 WHERE id = $2 RETURNING *",
        [newActive, id]
      );
      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erro ao atualizar chave" });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
