'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, rgb } = require('pdf-lib');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const RESUMES_ROOT = path.join(UPLOADS_ROOT, 'resumes');

function safeRelPath(relPath) {
  const rel = String(relPath || '');
  const abs = path.resolve(UPLOADS_ROOT, rel);
  const allowedRoot = path.resolve(RESUMES_ROOT) + path.sep;
  if (!abs.startsWith(allowedRoot)) return null;
  return { abs, rel };
}

function buildTermsFromApplicant({ full_name, email, phone }) {
  const terms = [];

  const name = String(full_name || '').trim();
  if (name) {
    terms.push(name);
    name.split(/\s+/g).forEach((t) => {
      const tok = t.trim();
      if (tok.length >= 3) terms.push(tok);
    });
  }

  const em = String(email || '').trim();
  if (em) terms.push(em);

  const ph = String(phone || '').trim();
  if (ph) terms.push(ph);

  // de-dupe
  const seen = new Set();
  return terms
    .map((t) => String(t).trim())
    .filter((t) => t && t.length <= 200)
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function loadPdfJs() {
  // pdfjs-dist v4 ships ESM (.mjs). In a CommonJS backend we must use dynamic import.
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMatchers(terms) {
  const loweredTerms = terms.map((t) => t.toLowerCase());

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;

  return {
    matches(str) {
      const txt = normalizeText(str);
      if (!txt) return false;
      const low = txt.toLowerCase();

      if (emailRegex.test(txt) || phoneRegex.test(txt)) return true;

      for (const t of loweredTerms) {
        if (t.length >= 3 && low.includes(t)) return true;
      }
      return false;
    }
  };
}

function computeItemRect(item, viewport) {
  // pdf.js text items have a transform in text space. We apply viewport transform.
  const tx = viewport.transform;
  const m = item.transform;

  // Multiply matrices (2D affine). pdf.js has Util.transform, but avoid coupling.
  const a = m[0] * tx[0] + m[1] * tx[2];
  const b = m[0] * tx[1] + m[1] * tx[3];
  const c = m[2] * tx[0] + m[3] * tx[2];
  const d = m[2] * tx[1] + m[3] * tx[3];
  const e = m[4] * tx[0] + m[5] * tx[2] + tx[4];
  const f = m[4] * tx[1] + m[5] * tx[3] + tx[5];

  // Use width/height estimates from item.
  const w = Math.max(0, Number(item.width || 0));
  const h = Math.max(0, Number(item.height || 0));

  // In viewport space, e/f represent the text baseline origin.
  const x = e;
  const yBaseline = f;

  // Approx bounding box: from baseline go up by h.
  const yTop = yBaseline - h;

  return {
    x: Number.isFinite(x) ? x : 0,
    yTop: Number.isFinite(yTop) ? yTop : 0,
    width: Number.isFinite(w) ? w : 0,
    height: Number.isFinite(h) ? h : 0,
    // For mapping
    viewportW: viewport.width,
    viewportH: viewport.height
  };
}

async function extractRedactionRects(pdfBuffer, terms) {
  const pdfjs = await loadPdfJs();
  const { getDocument } = pdfjs;

  const matcher = buildMatchers(terms);

  const loadingTask = getDocument({ data: pdfBuffer, disableWorker: true });
  const pdf = await loadingTask.promise;

  const pages = pdf.numPages;
  const perPage = new Map();

  for (let pageNum = 1; pageNum <= pages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const tc = await page.getTextContent();

    const rects = [];

    for (const item of tc.items || []) {
      const str = item.str;
      if (!matcher.matches(str)) continue;

      const r = computeItemRect(item, viewport);
      if (r.width < 1 || r.height < 1) continue;

      // Add some padding so redaction looks clean.
      rects.push({
        x: Math.max(0, r.x - 1),
        yTop: Math.max(0, r.yTop - 1),
        width: r.width + 2,
        height: r.height + 2,
        viewportW: r.viewportW,
        viewportH: r.viewportH
      });
    }

    if (rects.length) perPage.set(pageNum, rects);
  }

  return perPage;
}

function ensureMaskedDir() {
  const dir = path.join(RESUMES_ROOT, 'masked');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeMaskedRelPath() {
  const ts = Date.now();
  const rand = crypto.randomBytes(8).toString('hex');
  return `resumes/masked/masked_${ts}_${rand}.pdf`;
}

async function maskPdfToFile({ originalResumeRelPath, applicant }, { outputRelPath } = {}) {
  const original = safeRelPath(originalResumeRelPath);
  if (!original) throw new Error('Invalid resume path');

  await fs.promises.access(original.abs, fs.constants.R_OK);

  const outRel = outputRelPath || makeMaskedRelPath();
  const out = safeRelPath(outRel);
  if (!out) throw new Error('Invalid output path');

  ensureMaskedDir();

  const input = await fs.promises.readFile(original.abs);
  const terms = buildTermsFromApplicant(applicant || {});

  // Extract redaction rectangles with pdf.js
  const rectsByPage = await extractRedactionRects(input, terms);

  // Apply redactions with pdf-lib
  const pdfDoc = await PDFDocument.load(input);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const rects = rectsByPage.get(pageNum) || [];
    if (!rects.length) continue;

    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();

    // Use viewport size from first rect (scale 1). Fallback to page size.
    const vw = rects[0]?.viewportW || pw;
    const vh = rects[0]?.viewportH || ph;
    const sx = pw / vw;
    const sy = ph / vh;

    rects.forEach((r) => {
      const x = r.x * sx;
      const w = r.width * sx;
      const h = r.height * sy;
      const y = ph - (r.yTop * sy) - h;

      page.drawRectangle({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(pw, w),
        height: Math.min(ph, h),
        color: rgb(0, 0, 0)
      });
    });
  }

  const outBytes = await pdfDoc.save();
  await fs.promises.writeFile(out.abs, outBytes);

  return {
    masked_resume_path: out.rel,
    redactions: Array.from(rectsByPage.values()).reduce((acc, arr) => acc + arr.length, 0)
  };
}

module.exports = {
  maskPdfToFile
};
