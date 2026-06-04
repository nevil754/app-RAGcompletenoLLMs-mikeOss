import type { RequestHandler } from "express";   //RequestHandler è middleware, cmnq qua importiamo solo il type NON l'esecuzione vera e propria 
import multer from "multer";  //middleware for handling multipart/form-data 

export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;  //104.857.600 byte
export const MAX_UPLOAD_SIZE_MB = Math.round(
  MAX_UPLOAD_SIZE_BYTES / (1024 * 1024),
);  //only x render x user il 100 MB limit

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
    files: 1,
  },
});

export function singleFileUpload(fieldName: string): RequestHandler {
  return (req, res, next) => {
    memoryUpload.single(fieldName)(req, res, (err) => {  //single() per un singolo file
      if (!err) return next();  //continua con la pipeline di middlewares. multer ha processato il file correttamente senza errori
      if (err instanceof multer.MulterError) {  //error condition
        if (err.code === "LIMIT_FILE_SIZE") {
          return void res.status(413).json({
            detail: `File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB} MB.`,
          });
        }
        return void res.status(400).json({
          detail: `Upload failed: ${err.message}`,
        });
      }
      return next(err);  //passa l'error catturato al next della pipeline
    });
  };
}
