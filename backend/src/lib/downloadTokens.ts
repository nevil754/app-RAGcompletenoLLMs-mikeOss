import crypto from "crypto";  //modulo built-in di Node.js per operazioni crittografiche, come HMAC e hashing
/**
 * HMAC-signed, non-expiring download tokens.
 *
 * The token encodes the R2 storage path + filename; the backend route
 * `/download/:token` validates the signature and streams the file. This
 * gives persistent links safe to store in chat history without signed-URL
 * expiry or R2 CORS headaches.
 */

function getSecret(): string {
    return (
        process.env.DOWNLOAD_SIGNING_SECRET ??
        process.env.SUPABASE_SECRET_KEY ??
        "dev-secret"  //last fallback
    );
}

function b64urlEncode(buf: Buffer): string {  
    return buf
        .toString("base64")   //🔥converte buffer -> stringa base64
        .replace(/\+/g, "-")  //replace x safe
        .replace(/\//g, "_")  //replace x safe
        .replace(/=+$/g, ""); //replace x safe (rimuove padding)
}

function b64urlDecode(s: string): Buffer {  //decodifica stringa base64 "URL safe" -> buffer
    let t = s.replace(/-/g, "+").replace(/_/g, "/");  //ripristina base64 standard
    while (t.length % 4) t += "=";   //aggiunge padding mancante
    return Buffer.from(t, "base64");  //torna Buffer original
}

function timingSafeEqStr(a: string, b: string): boolean {  //confronto sicuro nel tempo tra stringhe
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));  //confronta in modo sicuro nel tempo, prevenendo attacchi di tipo timing attack 🔥
}  //return true/false

export function signDownload(path: string, filename: string): string {
    const payload = JSON.stringify({ p: path, f: filename });  //🔥 json.stringify CONVERTE obj js -> stringa json
    const enc = b64urlEncode(Buffer.from(payload, "utf8"));  //converte la stringa json in un Buffer usando codifica utf8, poi la codifica in base64 "URL safe" usando b64urlEncode
    const sig = crypto
        .createHmac("sha256", getSecret())
        .update(enc)
        .digest();  //calcola HMAC-SHA256 del payload codificato usando la chiave segreta
    return `${enc}.${b64urlEncode(sig)}`;  //ritorna token formato da payload codificato + punto + firma codificata 
}

export function verifyDownload(
    token: string,
): { path: string; filename: string } | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [enc, sigEnc] = parts;
    const expected = crypto
        .createHmac("sha256", getSecret())
        .update(enc)
        .digest();  //calcola HMAC-SHA256 del payload codificato usando la chiave segreta
    if (!timingSafeEqStr(sigEnc, b64urlEncode(expected))) return null;  //confronta la firma fornita con quella attesa in modo sicuro nel tempo; se non corrispondono, ritorna null
    try {
        const parsed = JSON.parse(b64urlDecode(enc).toString("utf8")) as {
            p: string;
            f: string;
        };  //decodifica il payload, lo converte in stringa utf8 e poi lo parsea da json in obj js; se c'è un errore durante la decodifica o il parsing, ritorna null
        if (!parsed?.p || !parsed?.f) return null;  
        return { path: parsed.p, filename: parsed.f };  
    } catch {
        return null;
    }
}

/**
 * Returns a relative download URL (e.g. "/download/abc.def"). The frontend
 * prefixes it with NEXT_PUBLIC_API_BASE_URL when rendering `<a href=…>`.
 */
export function buildDownloadUrl(path: string, filename: string): string {
    return `/download/${signDownload(path, filename)}`;
}
