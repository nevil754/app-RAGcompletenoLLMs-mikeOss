/**
 * Cloudflare R2 storage utilities for Mike document management.
 * R2 is S3-compatible — uses @aws-sdk/client-s3.
 *
 * Required env vars:
 *   R2_ENDPOINT_URL     — https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID    — R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY — R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME      — bucket name (default: "mike")
 */

import {
  S3Client,
  PutObjectCommand,  //comando per caricare un file su R2, usi PutObjectCommand
  GetObjectCommand,  //per scaricare un file da R2, usi GetObjectCommand
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";  //client S3 ufficiale AWS SDK v3
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = process.env.R2_BUCKET_NAME ?? "mikeoss-docs";

export const storageEnabled = Boolean(
  process.env.R2_ENDPOINT_URL &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY,
);

//Upload
export async function uploadFile(
  key: string,
  content: ArrayBuffer,  //array di byte del file da caricare
  contentType: string,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({   //per caricare su r2
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(content),  //🔥Buffer.from() converte un ArrayBuffer in un Buffer, che è il formato richiesto da PutObjectCommand per il corpo del file
      ContentType: contentType,
    }),
  );
}

//download
export async function downloadFile(key: string): Promise<ArrayBuffer | null> {
  if (!storageEnabled) return null;
  try {
    const client = getClient();
    const response = await client.send(  //per scaricare file da r2
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    );
    if(!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();  //transformToByteArray() trasforma in array di bytes, piu facile x js da gestire
    return bytes.buffer as ArrayBuffer;  //ritorna solo la parte di ArrayBuffer dell'oggetto bytes, che è un Uint8Array (un tipo di array di byte), e lo casta come ArrayBuffer
  } catch {
    return null;
  }
}

//delete
export async function deleteFile(key: string): Promise<void> {
  if (!storageEnabled) return;
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

//Signed URL (🔥 pre-signed  technique for temporary direct access)
export async function getSignedUrl(
  key: string,
  expiresIn = 3600,
  downloadFilename?: string,
): Promise<string | null> {
  if (!storageEnabled) return null;
  try {
    const client = getClient();
    //Override the response Content-Disposition so the browser uses this
    //filename on download, instead of the last path segment of the R2 key
    //(which includes the document UUID). The `download` attribute on <a>
    //is ignored for cross-origin URLs, so we have to set it server-side.
    const responseContentDisposition = downloadFilename
      ? buildContentDisposition("attachment", downloadFilename)
      : undefined;
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: responseContentDisposition,
    });
    return await awsGetSignedUrl(client, command, { expiresIn });
  } catch {
    return null;
  }
}



export function buildContentDisposition(
  kind: "inline" | "attachment",
  filename: string,
): string {
  const normalized = normalizeDownloadFilename(filename);
  return `${kind}; filename="${sanitizeDispositionFilename(normalized)}"; filename*=UTF-8''${encodeRFC5987(normalized)}`;
}

export function encodeRFC5987(str: string): string {
  return encodeURIComponent(str).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );  //encodeURIComponent() codifica la stringa in base64, replace() sostituisce i caratteri speciali con la loro rappresentazione percentuale in esadecimale (RFC 5987 richiede di codificare anche questi caratteri)
}

export function sanitizeDispositionFilename(name: string): string {
  return normalizeDownloadFilename(name).replace(/["\\]/g, "_");
}

export function normalizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  const base = trimmed || "download";
  return base.replace(/[\x00-\x1F\x7F]/g, "_").replace(/[\\/]/g, "_");  //sostituisce caratteri non validi con underscore
}



//Storage key helpers

function storageExtension(filename: string, fallback: string): string {
  const lastDot = filename.lastIndexOf(".");   //trova l'ultima occorrenza del punto per estrarre l'estensione del file, SE NON LO TROVA RETURN always -1
  if (lastDot < 0) return fallback;  
  const ext = filename.slice(lastDot).toLowerCase();  //prende dal punto in poi, il punto è incluso
  return /^\.[a-z0-9]{1,16}$/.test(ext) ? ext : fallback;  //se l'estensione è valida (punto seguito da 1-16 caratteri alfanumerici), allora la restituisce; altrimenti restituisce l'estensione di fallback
}

export function storageKey(
  userId: string,
  docId: string,
  filename: string,
): string {
  return `documents/${userId}/${docId}/source${storageExtension(filename, ".bin")}`;
}

export function pdfStorageKey(
  userId: string,
  docId: string,
  stem: string,
): string {
  return `documents/${userId}/${docId}/${stem}.pdf`;
}

export function generatedDocKey(
  userId: string,
  docId: string,
  filename: string,
): string {
  return `generated/${userId}/${docId}/generated${storageExtension(filename, ".docx")}`;
}

export function versionStorageKey(
  userId: string,
  docId: string,
  versionSlug: string,
  filename: string,
): string {
  return `documents/${userId}/${docId}/versions/${versionSlug}${storageExtension(filename, ".bin")}`;
}

