const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PDF_BACKEND_AUTO = "auto";
const PDF_BACKEND_LOCAL = "local";
const PDF_BACKEND_R2 = "r2";
const PDF_BACKEND_SET = new Set([PDF_BACKEND_AUTO, PDF_BACKEND_LOCAL, PDF_BACKEND_R2]);

let r2PdfState = null;

function getUploadDir() {
  const configured = String(process.env.BOOK_UPLOAD_DIR || "").trim();
  if (configured) return path.resolve(configured);
  return path.resolve(__dirname, "..", "..", "uploads");
}

function getLegacyUploadDir() {
  return path.resolve(__dirname, "..", "..", "..", "uploads");
}

function candidateUploadDirs() {
  const out = [];
  out.push(getUploadDir());
  out.push(getLegacyUploadDir());
  return Array.from(new Set(out));
}

function getBookPdfPath(bookId) {
  return path.join(getUploadDir(), `${bookId}.pdf`);
}

async function ensureUploadDir() {
  await fs.promises.mkdir(getUploadDir(), { recursive: true });
}

function normalizePdfBackend(value) {
  const normalized = String(value || PDF_BACKEND_AUTO)
    .trim()
    .toLowerCase();
  return PDF_BACKEND_SET.has(normalized) ? normalized : PDF_BACKEND_AUTO;
}

function getRequestedPdfBackend() {
  return normalizePdfBackend(process.env.BOOK_PDF_BACKEND);
}

function getR2PdfConfig() {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const endpointFromEnv = String(process.env.R2_ENDPOINT || "").trim();
  const endpoint =
    endpointFromEnv || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket =
    String(process.env.R2_PDF_BUCKET || "").trim() || String(process.env.R2_BUCKET || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const prefix = String(process.env.R2_PDF_PREFIX || "").trim() || "books/pdfs";
  return {
    accessKeyId,
    bucket,
    endpoint,
    prefix,
    secretAccessKey,
  };
}

function getR2PdfChunkSizeBytes() {
  const mbRaw = Number(process.env.R2_PDF_CHUNK_MB || 5);
  if (!Number.isFinite(mbRaw) || mbRaw <= 0) return 5 * 1024 * 1024;
  return Math.max(256 * 1024, Math.trunc(mbRaw * 1024 * 1024));
}

function useChunkedR2Storage() {
  const raw = String(process.env.R2_PDF_CHUNKED || "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function hasR2PdfConfig(config = getR2PdfConfig()) {
  return Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey);
}

function resolvePdfBackend() {
  const requested = getRequestedPdfBackend();
  if (requested === PDF_BACKEND_LOCAL || requested === PDF_BACKEND_R2) return requested;
  return hasR2PdfConfig() ? PDF_BACKEND_R2 : PDF_BACKEND_LOCAL;
}

function getS3ClientApi() {
  try {
    return require("@aws-sdk/client-s3");
  } catch (error) {
    throw new Error(
      "Cloudflare R2 PDF storage ашиглахын тулд @aws-sdk/client-s3 package шаардлагатай. " +
        "`cd backend && npm install` ажиллуулна уу.",
    );
  }
}

function getR2PdfState() {
  if (r2PdfState) return r2PdfState;

  const config = getR2PdfConfig();
  if (!hasR2PdfConfig(config)) {
    throw new Error(
      "Cloudflare R2 PDF тохиргоо дутуу байна. R2_ACCOUNT_ID, R2_PDF_BUCKET (эсвэл R2_BUCKET), " +
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (эсвэл R2_ENDPOINT)-ийг тохируулна уу.",
    );
  }

  const { S3Client, GetObjectCommand, PutObjectCommand } = getS3ClientApi();
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  r2PdfState = {
    bucket: config.bucket,
    client,
    getCommand: GetObjectCommand,
    prefix: config.prefix,
    putCommand: PutObjectCommand,
  };
  return r2PdfState;
}

async function readStreamAsBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function normalizePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function buildR2PdfObjectKey(bookId) {
  const state = getR2PdfState();
  const prefix = normalizePrefix(state.prefix);
  return prefix ? `${prefix}/${bookId}.pdf` : `${bookId}.pdf`;
}

function buildR2PdfManifestKey(bookId) {
  const state = getR2PdfState();
  const prefix = normalizePrefix(state.prefix);
  return prefix ? `${prefix}/${bookId}/manifest.json` : `${bookId}/manifest.json`;
}

function buildR2PdfPartKey(bookId, index) {
  const state = getR2PdfState();
  const prefix = normalizePrefix(state.prefix);
  const safeIndex = String(index + 1).padStart(5, "0");
  return prefix
    ? `${prefix}/${bookId}/parts/${safeIndex}.part`
    : `${bookId}/parts/${safeIndex}.part`;
}

function isChunkManifestKey(key) {
  return /\/manifest\.json$/i.test(String(key || "").trim());
}

function buildR2PdfPath(bucket, objectKey) {
  const safeBucket = String(bucket || "").trim();
  const safeKey = String(objectKey || "").trim().replace(/^\/+/, "");
  if (!safeBucket || !safeKey) return "";
  return `r2://${safeBucket}/${safeKey}`;
}

function isR2PdfPath(pdfPath) {
  return /^r2:\/\//i.test(String(pdfPath || "").trim());
}

function parseR2PdfPath(pdfPath) {
  const raw = String(pdfPath || "").trim();
  if (!isR2PdfPath(raw)) return null;
  const withoutScheme = raw.replace(/^r2:\/\//i, "");
  const slashIdx = withoutScheme.indexOf("/");
  if (slashIdx <= 0) return null;
  const bucket = withoutScheme.slice(0, slashIdx).trim();
  const key = withoutScheme.slice(slashIdx + 1).trim();
  if (!bucket || !key) return null;
  return { bucket, key };
}

function shouldWriteLocalCache() {
  const raw = String(process.env.BOOK_PDF_CACHE_LOCAL || "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function getLocalExistingBookPdfPath(bookId) {
  for (const dir of candidateUploadDirs()) {
    const candidate = path.join(dir, `${bookId}.pdf`);
    if (pdfExists(candidate)) return candidate;
  }
  return "";
}

async function downloadR2ObjectBuffer({ bucket, key }) {
  const state = getR2PdfState();
  const response = await state.client.send(
    new state.getCommand({
      Bucket: bucket || state.bucket,
      Key: key,
    }),
  );
  return readStreamAsBuffer(response?.Body);
}

async function uploadChunkedPdfToR2({ bookId, buffer }) {
  const state = getR2PdfState();
  const chunkSize = getR2PdfChunkSizeBytes();
  const manifestKey = buildR2PdfManifestKey(bookId);
  const total = Number(buffer?.length || 0);
  const partCount = Math.max(1, Math.ceil(total / chunkSize));
  const parts = [];

  for (let idx = 0; idx < partCount; idx += 1) {
    const start = idx * chunkSize;
    const end = Math.min(total, start + chunkSize);
    const partBuffer = buffer.subarray(start, end);
    const key = buildR2PdfPartKey(bookId, idx);
    await state.client.send(
      new state.putCommand({
        Bucket: state.bucket,
        Key: key,
        Body: partBuffer,
        ContentType: "application/octet-stream",
      }),
    );
    parts.push({
      index: idx,
      key,
      size: partBuffer.length,
    });
  }

  const digest = crypto.createHash("sha256").update(buffer).digest("hex");
  const manifest = {
    version: 1,
    kind: "chunked-pdf",
    bookId,
    contentType: "application/pdf",
    chunkSize,
    size: total,
    sha256: digest,
    partCount,
    parts,
  };

  await state.client.send(
    new state.putCommand({
      Bucket: state.bucket,
      Key: manifestKey,
      Body: JSON.stringify(manifest),
      ContentType: "application/json",
    }),
  );

  return buildR2PdfPath(state.bucket, manifestKey);
}

async function uploadPdfToR2({ bookId, buffer }) {
  if (useChunkedR2Storage()) {
    return uploadChunkedPdfToR2({ bookId, buffer });
  }
  const state = getR2PdfState();
  const key = buildR2PdfObjectKey(bookId);
  await state.client.send(
    new state.putCommand({
      Bucket: state.bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    }),
  );
  return buildR2PdfPath(state.bucket, key);
}

async function downloadPdfFromR2ToLocal({ bookId, r2Path }) {
  const info = parseR2PdfPath(r2Path);
  if (!info) return "";

  const localPath = getBookPdfPath(bookId);
  if (pdfExists(localPath)) return localPath;

  await ensureUploadDir();
  let content = Buffer.alloc(0);
  if (isChunkManifestKey(info.key)) {
    const manifestBuffer = await downloadR2ObjectBuffer({
      bucket: info.bucket,
      key: info.key,
    });
    const manifestRaw = manifestBuffer.toString("utf8").trim();
    const manifest = JSON.parse(manifestRaw || "{}");
    const parts = Array.isArray(manifest?.parts) ? manifest.parts : [];
    const chunks = [];
    for (const part of parts) {
      const partKey = String(part?.key || "").trim();
      if (!partKey) continue;
      const partBuffer = await downloadR2ObjectBuffer({
        bucket: info.bucket,
        key: partKey,
      });
      chunks.push(partBuffer);
    }
    content = Buffer.concat(chunks);
  } else {
    content = await downloadR2ObjectBuffer({
      bucket: info.bucket,
      key: info.key,
    });
  }
  if (!content.length) return "";
  await fs.promises.writeFile(localPath, content);
  return localPath;
}

async function saveBookPdf({ bookId, buffer }) {
  const backend = resolvePdfBackend();

  if (backend === PDF_BACKEND_R2) {
    const r2Path = await uploadPdfToR2({ bookId, buffer });
    if (shouldWriteLocalCache()) {
      await ensureUploadDir();
      await fs.promises.writeFile(getBookPdfPath(bookId), buffer);
    }
    return r2Path;
  }

  await ensureUploadDir();
  const pdfPath = getBookPdfPath(bookId);
  await fs.promises.writeFile(pdfPath, buffer);
  return pdfPath;
}

function findExistingBookPdfPath(bookId) {
  const localPath = getLocalExistingBookPdfPath(bookId);
  if (localPath) return localPath;

  if (resolvePdfBackend() === PDF_BACKEND_R2 && hasR2PdfConfig()) {
    try {
      const state = getR2PdfState();
      const defaultKey = useChunkedR2Storage()
        ? buildR2PdfManifestKey(bookId)
        : buildR2PdfObjectKey(bookId);
      return buildR2PdfPath(state.bucket, defaultKey);
    } catch {
      return "";
    }
  }
  return "";
}

function pdfExists(pdfPath) {
  if (!pdfPath) return false;
  if (isR2PdfPath(pdfPath)) return true;
  try {
    return fs.existsSync(pdfPath);
  } catch {
    return false;
  }
}

async function resolveBookPdfPath({ bookId, pdfPath = "" }) {
  const preferred = String(pdfPath || "").trim();
  if (preferred && !isR2PdfPath(preferred) && pdfExists(preferred)) {
    return preferred;
  }
  if (preferred && isR2PdfPath(preferred)) {
    try {
      return await downloadPdfFromR2ToLocal({ bookId, r2Path: preferred });
    } catch {
      // fall through
    }
  }

  const localPath = getLocalExistingBookPdfPath(bookId);
  if (localPath) return localPath;

  if (resolvePdfBackend() === PDF_BACKEND_R2 && hasR2PdfConfig()) {
    try {
      const state = getR2PdfState();
      const fallbackKey = useChunkedR2Storage()
        ? buildR2PdfManifestKey(bookId)
        : buildR2PdfObjectKey(bookId);
      const fallbackR2Path = buildR2PdfPath(state.bucket, fallbackKey);
      return await downloadPdfFromR2ToLocal({ bookId, r2Path: fallbackR2Path });
    } catch {
      return "";
    }
  }

  return "";
}

module.exports = {
  candidateUploadDirs,
  findExistingBookPdfPath,
  getBookPdfPath,
  getUploadDir,
  getLegacyUploadDir,
  pdfExists,
  resolveBookPdfPath,
  saveBookPdf,
};
