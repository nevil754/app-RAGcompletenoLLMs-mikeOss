import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing or invalid Authorization header" });  //setta error 401
    return;  //back to the caller function
  }
  const token = auth.slice(7).trim();  //rimuove 'Bearer' cioe 7 chars. ma in realta è meglio suddividere con .split(" ") e quindi prendere solo il [1]
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ detail: "Server auth is not configured" });  //setta status
    return;
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });  //create client SUPABASE, ! non salva sessioni (persistSession: false)
  const { data } = await admin.auth.getUser(token);  //da supabase passa il token e vuole il user come return
  if (!data.user) {
    res.status(401).json({ detail: "Invalid or expired token" });  //setta status
    return;
  }
  res.locals.userId = data.user.id;  //update
  res.locals.userEmail = data.user.email?.toLowerCase() ?? "";  //update
  res.locals.token = token;   //update
  next();  //continue la chain
}
