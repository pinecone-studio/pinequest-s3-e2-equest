# Book Question Backend

PDF (scan байж болно) upload хийгээд OCR-аар текст уншиж, Chapter → Section бүтэцтэй интерактив уншигч + visible content-оос тест үүсгэнэ.

## 1) Setup (Backend)

```bash
cd backend
cp .env.example .env
npm install
```

## 2) Run Backend

```bash
npm run dev
```

Server default: `http://localhost:4000`
Хэрэв `4000` port завгүй байвал backend автоматаар дараагийн port дээр (4001, 4002, ...) асна.
Асаасан port нь `backend/.backend-port` файл дээр бичигдэнэ.

## 3) React Frontend (backend дотор)

React app path: `backend/frontend-react`

```bash
cd backend
npm run frontend:install
npm run frontend:dev
```

Frontend default: `http://127.0.0.1:5173`

Backend дээр build-ээ serve хийх бол:

```bash
cd backend
npm run frontend:build
```

дараа нь `http://127.0.0.1:4000/app` нээж үзнэ.

Хэрэв backend URL өөр бол:

```bash
cd backend/frontend-react
echo 'VITE_BOOK_API_URL=http://127.0.0.1:4000' > .env
```

## 4) Endpoints

- `GET /` (backend ажиллаж байгааг харуулах энгийн хуудас)
- `GET /health`
- `GET /api/books`
- `GET /api/books/:bookId` (номын meta + page preview)
- `GET /api/books/:bookId/structure` (chapter/section бүтэц)
- `GET /api/books/:bookId/sections/:sectionId?offset=0&windowSize=2|3` (section-ийн visible 2-3 pages)
- `GET /api/books/:bookId/pages?startPage=1&endPage=5` (page text буцаана)
- `GET /api/books/:bookId/file` (PDF inline)
- `GET /api/books/:bookId/file?download=1` (PDF татах)
- `POST /api/books/:bookId/reparse` (PDF-ээ дахин уншиж OCR/text-ээ шинэчилнэ)
- `POST /api/books/upload` (`multipart/form-data`, field: `file`)
- `POST /api/books/:bookId/generate-test` (visible content дээрээс тест үүсгэнэ)
- `POST /api/books/generate-questions`

`generate-questions` body:

```json
{
  "bookId": "uuid",
  "startPage": 1,
  "endPage": 5,
  "questionCount": 20
}
```

Нэмэлт сонголтууд:

- `pageNumbers`: page-үүдийг шууд зааж болно. Жишээ: `"pageNumbers": [2, 5, 9]` (энэ үед `startPage/endPage` хэрэггүй)
- `pageText`: өөрийн сонгосон/хуулсан текстээ шууд явуулж болно (энэ үед `bookId` заавал биш)
- `answerKeyText`: хариу түлхүүрийн хуудсуудын текстийг тусад нь явуулбал зөв хариу олох магадлал нэмэгдэнэ
- `extraText`: нэмэлт тайлбар/тэмдэглэл текст (сонголттой) — `pageText`/номын текстийн араас залгаж боловсруулна

`POST /api/books/:bookId/generate-test` body:

```json
{
  "sectionId": "sec-5",
  "visiblePageNumbers": [23, 24, 25],
  "questionCount": 10,
  "difficulty": "medium"
}
```

- `questionCount`: 10–30
- `difficulty`: `easy | medium | hard`
- `visiblePageNumbers`: UI дээр харагдаж байгаа 2-3 page

Response format:

```json
{
  "questions": [
    {
      "question": "...",
      "choices": ["A ...", "B ...", "C ...", "D ..."],
      "correctAnswer": "A",
      "explanation": "..."
    }
  ]
}
```

## Notes

- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`-оо `.env`-д тохируулна.
- `HOST` default нь `127.0.0.1`. Хэрэв LAN-аас нээх бол `HOST=0.0.0.0` тавина.
- `generate-questions` endpoint нь одоогийнхоор `extract` горимд ажиллана (хуучин compatibility).
- `generate-test` endpoint нь visible content дээр тулгуурлан AI-аар шинэ MCQ тест үүсгэнэ.
- Book store default нь local `backend/data/books.json`.
- Cloudflare R2 дээр хадгалах бол `.env` дээр:
  - `BOOK_STORE_BACKEND=r2`
  - `R2_ACCOUNT_ID=...` (эсвэл `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com`)
  - `R2_BUCKET=...`
  - `R2_ACCESS_KEY_ID=...`
  - `R2_SECRET_ACCESS_KEY=...`
  - `R2_BOOK_STORE_KEY=books/books.json` (optional)
- `BOOK_STORE_BACKEND=auto` үед дээрх R2 config бүрэн байвал R2, үгүй бол local store ашиглана.
- PDF файлуудыг R2 дээр хадгалах бол `.env` дээр:
  - `BOOK_PDF_BACKEND=r2` (`auto` үед R2 config байвал автоматаар R2 ашиглана)
  - `R2_PDF_BUCKET=...` (optional, байхгүй бол `R2_BUCKET` ашиглана)
  - `R2_PDF_PREFIX=books/pdfs` (optional)
  - `R2_PDF_CHUNKED=1` (default) -> PDF-ийг chunk + manifest хэлбэрээр R2-д хадгална
  - `R2_PDF_CHUNK_MB=4` (optional) -> part бүрийн хэмжээ
  - `BOOK_PDF_CACHE_LOCAL=1` (optional, R2-оос татсан PDF-ийг local cache-д хадгална)
- Checked section-уудыг тест үүсгэх үед PDF-ээс дахин уншуулах:
  - `TEST_READ_FROM_PDF_EACH_TIME=1`
  - `TEST_MAX_SECTION_PAGES=0` (`0` бол checked section-ийн бүх page-ийг уншина)
- Хурдтай/тогтвортой generate тохиргоо:
  - `TEST_FAST_MODE=1` (AI top-up алгасч local fallback-аар хурдан нөхнө)
  - `TEST_GENERATE_TIMEOUT_MS=90000` (AI response-г хурдан cut-off)
  - `TEST_READ_FROM_PDF_EACH_TIME=0` (тест бүрт PDF-ийг дахин OCR хийхгүй)
- OCR priority: `PDF_OCR_PREFERRED=auto|gemini|local-only|gemini-only` (default `auto`: Gemini key байвал Gemini OCR-ийг түрүүлж оролдоно).
- Local OCR хэл: `LOCAL_OCR_LANG=auto` (default) үед `tesseract --list-langs`-аас боломжтой бол `mon+eng` автоматаар сонгоно.
- OCR quality-д асуудал байвал:
  - `PDF_OCR_PREFERRED=local-only`
  - `LOCAL_OCR_LANG=mon+eng`
  - `LOCAL_OCR_PSM=6` (backend олон PSM туршиж хамгийн зөвийг нь сонгоно)
  - Upload хийсний дараа `POST /api/books/:bookId/reparse` ажиллуулж OCR-оо шинэчил.

## Troubleshooting (`/generate-questions` 500/502)

1. Ollama асаалттай эсэх:

```bash
ollama serve
```

2. Model татагдсан эсэх:

```bash
ollama pull llama3.1:8b
```

3. Backend `.env`-д model/base URL зөв эсэх:

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```
