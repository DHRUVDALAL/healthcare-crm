'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const { fail } = require('../utils/response');
const SettingsModel = require('../models/settingsModel');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const RESUME_DIR = path.join(__dirname, '..', 'uploads', 'resumes');
const FALLBACK_MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(RESUME_DIR, { recursive: true });

function isPdfFile(file) {
  const name = String(file?.originalname || '').toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase();
  const hasPdfExt = name.endsWith('.pdf');
  const pdfMime = mime === 'application/pdf';
  return hasPdfExt && pdfMime;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, RESUME_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = crypto.randomBytes(8).toString('hex');
    cb(null, `resume_${ts}_${rand}.pdf`);
  }
});

// Configure multer with a generous parsing limit, we will enforce the specific DB setting dynamically
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB parsing cap to protect server resources
  },
  fileFilter: (req, file, cb) => {
    if (!isPdfFile(file)) {
      return cb(new Error('Only PDF resumes are allowed'));
    }
    return cb(null, true);
  }
});

async function getLimitSettings() {
  try {
    const rows = await SettingsModel.getAll();
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });
    const maxMb = Number(settings.max_upload_size_mb || 5);
    return { maxMb, maxBytes: maxMb * 1024 * 1024 };
  } catch (err) {
    return { maxMb: 5, maxBytes: FALLBACK_MAX_RESUME_SIZE };
  }
}

function uploadResume(req, res, next) {
  const handler = upload.single('resume');

  handler(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 413, 'Resume is too large (maximum system limit is 50MB)');
      }
      return fail(res, 400, err.message || 'Invalid resume upload');
    }

    if (req.file) {
      const { maxMb, maxBytes } = await getLimitSettings();
      if (req.file.size > maxBytes) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return fail(res, 413, `Resume is too large (max ${maxMb}MB)`);
      }
    }

    return next();
  });
}

function optionalUploadResume(req, res, next) {
  const handler = upload.single('resume');

  handler(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return fail(res, 413, 'Resume is too large (maximum system limit is 50MB)');
      }
      return fail(res, 400, err.message || 'Invalid resume upload');
    }

    if (req.file) {
      const { maxMb, maxBytes } = await getLimitSettings();
      if (req.file.size > maxBytes) {
        if (fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return fail(res, 413, `Resume is too large (max ${maxMb}MB)`);
      }
    }

    return next();
  });
}

const DOCS_DIR = path.join(__dirname, '..', 'uploads', 'documents');
fs.mkdirSync(DOCS_DIR, { recursive: true });

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOCS_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc_${ts}_${rand}${ext}`);
  }
});

const uploadDocsParser = multer({
  storage: docStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Invalid document format. Allowed: ' + allowed.join(', ')));
    }
    return cb(null, true);
  }
});

const optionalUploadDocuments = (req, res, next) => {
  const handler = uploadDocsParser.array('documents', 10);
  handler(req, res, (err) => {
    if (err) {
      return fail(res, 400, err.message || 'File upload error');
    }
    next();
  });
};

const TASKS_DIR = path.join(__dirname, '..', 'uploads', 'tasks');
fs.mkdirSync(TASKS_DIR, { recursive: true });

const taskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TASKS_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `task_${ts}_${rand}${ext}`);
  }
});

const uploadTasksParser = multer({
  storage: taskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const optionalUploadTaskAttachments = (req, res, next) => {
  const handler = uploadTasksParser.array('attachments', 5);
  handler(req, res, (err) => {
    if (err) {
      return fail(res, 400, err.message || 'File upload error');
    }
    next();
  });
};

const AVATARS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rand = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${ts}_${rand}${ext}`);
  }
});

const uploadAvatarParser = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only images (JPG, JPEG, PNG) are allowed'));
    }
    return cb(null, true);
  }
});

const uploadAvatar = (req, res, next) => {
  const handler = uploadAvatarParser.single('photo');
  handler(req, res, (err) => {
    if (err) {
      return fail(res, 400, err.message || 'File upload error');
    }
    next();
  });
};

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `system_logo_${Date.now()}${ext}`);
  }
});

const uploadLogoParser = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only logo images (JPG, PNG, SVG, WEBP) are allowed'));
    }
    return cb(null, true);
  }
});

const uploadLogo = (req, res, next) => {
  const handler = uploadLogoParser.single('logo');
  handler(req, res, (err) => {
    if (err) {
      return fail(res, 400, err.message || 'Logo upload error');
    }
    next();
  });
};

module.exports = {
  uploadResume,
  optionalUploadResume,
  optionalUploadDocuments,
  optionalUploadTaskAttachments,
  uploadAvatar,
  uploadLogo,
  RESUME_DIR,
  DOCS_DIR,
  TASKS_DIR,
  AVATARS_DIR
};
