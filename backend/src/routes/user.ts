import { Router } from "express";
import { requireAuth } from "../middleware/auth";  //ur custom
import { createServerSupabase } from "../lib/supabase";

export const userRouter = Router();

// POST /user/profile
userRouter.post("/profile", requireAuth, async (req, res) => {  //requireAuth è middleware che quindi devi essere ok auth e poi puoi eseguire questa function
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db
    .from("user_profiles")
    .upsert(   //se non esiste lo crea, altrimenti fa update
      { user_id: userId },
      { onConflict: "user_id", ignoreDuplicates: true },  //onConflict è la colonna che deve essere unica, ignoreDuplicates evita errori se c'è già un record con lo stesso user_id
    );
  if (error) return void res.status(500).json({ detail: error.message });  //setta status 
  res.json({ ok: true });  //risposta easy json
});

// DELETE /user/account
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db.auth.admin.deleteUser(userId);  
  if (error) return void res.status(500).json({ detail: error.message });  //setta status
  res.status(204).send();
});


