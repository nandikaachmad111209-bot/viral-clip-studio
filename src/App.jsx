import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Film,
  Scissors,
  Sparkles,
  Key,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  Youtube,
  FileText,
  Sliders,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  RefreshCw,
  Star,
  Trash2,
  History,
  Settings,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  Edit3,
  Save,
  X,
  RotateCcw,
  AlertCircle,
  CheckSquare
} from 'lucide-react';

/**
 * ============================================================================
 * VIRAL CLIP STUDIO — ARCHITECTURE & CONFIGURATION CONSTANTS
 * ============================================================================
 */

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';
const SESSION_API_KEY_STORAGE = 'vcs_gemini_session_key_v1';

const CLIPPING_STYLES = {
  'atmospheric-cinematic': {
    id: 'atmospheric-cinematic',
    name: 'Atmospheric Cinematic',
    badge: 'Default Preset',
    aspectRatio: '9:16',
    description:
      'Vertical 9:16 composition with a resizable sharp foreground overlay, enlarged soft-blurred top sky extension, and a deep dark-teal cinematic gradient atmosphere below.'
  }
};

const DEFAULT_EDIT_TRANSFORM = {
  offsetX: 0, // Sumbu X (-100% to +100%, default 0%)
  offsetY: 0, // Sumbu Y (-100% to +100%, default 0%)
  zoom: 100, // Zoom ukuran overlay tidak diblur (30% to 320%, default 100%)
  blur: 100 // Efek Blur background (0% to 200%, default 100%)
};

const RESOLUTIONS = {
  '720p': { id: '720p', label: '720p Vertical', width: 720, height: 1280, tag: '720 × 1280' },
  '1080p': { id: '1080p', label: '1080p Full HD Vertical', width: 1080, height: 1920, tag: '1080 × 1920' }
};

const DURATIONS = [
  { value: 30, label: '30 seconds', hint: 'Target max ~30s (natural sentence boundaries)' },
  { value: 60, label: '60 seconds', hint: 'Target max ~60s (storytelling arc preserved)' }
];

const QUANTITIES = [
  { value: 5, label: '5 clips' },
  { value: 8, label: '8 clips' },
  { value: 10, label: '10 clips' },
  { value: 15, label: '15 clips' },
  { value: 'max', label: 'Maximum available clips' }
];

const PIPELINE_STEPS = [
  { id: 1, key: 'validating', title: 'Validating Video', desc: 'Verifying source stream, dimensions, and timeline integrity' },
  { id: 2, key: 'brief', title: 'Reading Campaign Brief', desc: 'Extracting campaign objectives, rules, tone, and restrictions' },
  { id: 3, key: 'analyzing', title: 'Analyzing Video Content', desc: 'Sampling visual keyframes and timeline context across segments' },
  { id: 4, key: 'detecting', title: 'Detecting High-Potential Moments', desc: 'Running Gemini multimodal viral & storytelling analysis' },
  { id: 5, key: 'ranking', title: 'Ranking Candidate Clips', desc: 'Validating boundaries, removing overlaps, and scoring retention' },
  { id: 6, key: 'content', title: 'Generating Hooks & Content', desc: 'Crafting Indonesian hooks, headlines, captions, CTAs & compliance audit' },
  { id: 7, key: 'rendering', title: 'Rendering Videos', desc: 'Compositing 9:16 Atmospheric Cinematic clips & thumbnails' },
  { id: 8, key: 'qa', title: 'Final Quality Check', desc: 'Verifying rendered output streams and brief compliance scores' },
  { id: 9, key: 'saving', title: 'Saving Project', desc: 'Persisting project, metadata, and media assets to database' }
];

/**
 * ============================================================================
 * UTILITY HELPERS (FORMATTING, VALIDATION, SANITIZATION)
 * ============================================================================
 */

function formatTimecode(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function formatDurationBadge(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0.0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function sanitizeFilename(name) {
  return (
    (name || 'clip')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'viral_clip'
  );
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseYouTubeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Please enter a YouTube video URL.' };
  }
  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please paste a valid YouTube link.' };
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = null;

  if (host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.split('/')[2] || null;
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/')[2] || null;
    } else if (parsed.pathname.startsWith('/live/')) {
      videoId = parsed.pathname.split('/')[2] || null;
    }
  } else {
    return {
      valid: false,
      error: 'Unsupported domain. Supported formats: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...'
    };
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      valid: false,
      error: 'Could not extract a valid 11-character YouTube Video ID from this link.'
    };
  }

  return {
    valid: true,
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  };
}

async function verifyYouTubeMetadata(rawUrl) {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed.valid) {
    throw new Error(parsed.error);
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error('This YouTube video has embedding disabled or restricted access.');
      }
      if (res.status === 404) {
        throw new Error('YouTube video not found, private, or deleted.');
      }
      throw new Error(`YouTube verification failed (HTTP ${res.status}).`);
    }
    const data = await res.json();
    return {
      videoId: parsed.videoId,
      canonicalUrl: parsed.canonicalUrl,
      title: data.title || `YouTube Video (${parsed.videoId})`,
      channelName: data.author_name || 'Unknown Channel',
      channelUrl: data.author_url || '',
      thumbnailUrl: parsed.thumbnailUrl,
      oembedThumbnailUrl: data.thumbnail_url || parsed.thumbnailUrl,
      width: data.width || 1280,
      height: data.height || 720,
      verifiedAt: new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('YouTube verification timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

/**
 * ============================================================================
 * CAMPAIGN BRIEF FILE PARSER (.TXT, .DOCX, .PDF)
 * ============================================================================
 */

async function extractDocxText(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  let offset = 0;

  while (offset + 30 < bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraFieldLen = view.getUint16(offset + 28, true);

    const nameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLen);
    const fileName = decoder.decode(nameBytes);
    const dataStart = offset + 30 + fileNameLen + extraFieldLen;
    const dataEnd = dataStart + compressedSize;

    if (fileName === 'word/document.xml' && compressedSize > 0 && dataEnd <= bytes.length) {
      const compressedSlice = bytes.slice(dataStart, dataEnd);
      let xmlText = '';
      if (compression === 0) {
        xmlText = decoder.decode(compressedSlice);
      } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressedSlice);
        writer.close();
        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
        xmlText = decoder.decode(decompressedBuf);
      } else {
        throw new Error('Browser does not support deflate decompression for DOCX files.');
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
      const lines = paragraphs
        .map((p) =>
          Array.from(p.getElementsByTagName('w:t'))
            .map((t) => t.textContent || '')
            .join('')
        )
        .filter((line) => line.trim().length > 0);
      return lines.join('\n');
    }

    if (compressedSize === 0) break;
    offset = dataEnd;
  }

  throw new Error('Could not locate readable document content inside the DOCX archive.');
}

async function parseCampaignBriefFile(file) {
  const MAX_SIZE = 15 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('Campaign brief file exceeds the 15MB size limit.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
    throw new Error('Unsupported brief format. Please upload a PDF, DOCX, or TXT file.');
  }

  if (ext === 'txt' || ext === 'md') {
    const text = await file.text();
    return {
      fileName: file.name,
      fileType: ext.toUpperCase(),
      textContent: text.trim(),
      pdfBase64: null
    };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const text = await extractDocxText(buffer);
    return {
      fileName: file.name,
      fileType: 'DOCX',
      textContent: text.trim(),
      pdfBase64: null
    };
  }

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return {
      fileName: file.name,
      fileType: 'PDF',
      textContent: `[PDF Document Attached: ${file.name} (${formatBytes(file.size)}) — Analyzed natively by Gemini Multimodal Engine]`,
      pdfBase64: base64
    };
  }

  throw new Error('Unable to parse brief file.');
}

/**
 * ============================================================================
 * PERSISTENT DATABASE LAYER (INDEXEDDB + IN-MEMORY BLOB CACHE)
 * ============================================================================
 */

const DB_NAME = 'ViralClipStudioDB_v1';
const DB_VERSION = 1;
const MEMORY_BLOB_CACHE = new Map();

function openStudioDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('createdAt', 'createdAt', { unique: false });
        projectStore.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('clips')) {
        const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
        clipStore.createIndex('projectId', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open persistent database.'));
  });
}

const StudioDB = {
  async saveProjectWithClips(project, clips, clipBlobsMap = {}) {
    const serializedRecords = [];
    for (const clip of clips) {
      const blob = clipBlobsMap[clip.id];
      if (blob instanceof Blob && blob.size > 0) {
        MEMORY_BLOB_CACHE.set(clip.id, blob);
        try {
          const buffer = await blob.arrayBuffer();
          serializedRecords.push({
            id: clip.id,
            projectId: project.id,
            buffer,
            size: blob.size,
            mimeType: blob.type || 'video/webm'
          });
        } catch {
          // Keep in memory cache if ArrayBuffer serialization is restricted
        }
      }
    }

    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'clips', 'blobs'], 'readwrite');
      tx.objectStore('projects').put(project);
      const clipStore = tx.objectStore('clips');
      const blobStore = tx.objectStore('blobs');

      for (const clip of clips) {
        clipStore.put(clip);
      }
      for (const rec of serializedRecords) {
        blobStore.put(rec);
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Failed to save project to IndexedDB.'));
    });
  },

  async saveSingleClipBlob(clipId, projectId, blob) {
    if (!(blob instanceof Blob) || blob.size === 0) return;
    MEMORY_BLOB_CACHE.set(clipId, blob);
    const buffer = await blob.arrayBuffer();
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['blobs'], 'readwrite');
      tx.objectStore('blobs').put({
        id: clipId,
        projectId,
        buffer,
        size: blob.size,
        mimeType: blob.type || 'video/webm'
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllProjects() {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects'], 'readonly');
      const req = tx.objectStore('projects').getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getProjectById(projectId) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'clips'], 'readonly');
      const projReq = tx.objectStore('projects').get(projectId);
      const clipIndex = tx.objectStore('clips').index('projectId');
      const clipsReq = clipIndex.getAll(projectId);

      tx.oncomplete = () => {
        if (!projReq.result) {
          resolve(null);
          return;
        }
        const clips = (clipsReq.result || []).sort((a, b) => b.overallScore - a.overallScore);
        resolve({ project: projReq.result, clips });
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  async getClipBlob(clipId) {
    if (MEMORY_BLOB_CACHE.has(clipId)) {
      const cached = MEMORY_BLOB_CACHE.get(clipId);
      if (cached instanceof Blob && cached.size > 0) return cached;
    }
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['blobs'], 'readonly');
      const req = tx.objectStore('blobs').get(clipId);
      req.onsuccess = () => {
        const res = req.result;
        if (!res) {
          resolve(null);
          return;
        }
        if (res.blob instanceof Blob && res.blob.size > 0) {
          MEMORY_BLOB_CACHE.set(clipId, res.blob);
          resolve(res.blob);
          return;
        }
        if (res.buffer) {
          const reconstructed = new Blob([res.buffer], { type: res.mimeType || 'video/webm' });
          MEMORY_BLOB_CACHE.set(clipId, reconstructed);
          resolve(reconstructed);
          return;
        }
        resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async updateClip(clip) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['clips'], 'readwrite');
      tx.objectStore('clips').put(clip);
      tx.oncomplete = () => resolve(clip);
      tx.onerror = () => reject(tx.error);
    });
  },

  async updateProject(project) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects'], 'readwrite');
      tx.objectStore('projects').put(project);
      tx.oncomplete = () => resolve(project);
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteClip(clipId) {
    MEMORY_BLOB_CACHE.delete(clipId);
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['clips', 'blobs'], 'readwrite');
      tx.objectStore('clips').delete(clipId);
      tx.objectStore('blobs').delete(clipId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteProject(projectId) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'clips', 'blobs'], 'readwrite');
      tx.objectStore('projects').delete(projectId);
      const clipStore = tx.objectStore('clips');
      const blobStore = tx.objectStore('blobs');
      const idx = clipStore.index('projectId');
      const req = idx.getAllKeys(projectId);
      req.onsuccess = () => {
        for (const key of req.result || []) {
          MEMORY_BLOB_CACHE.delete(key);
          clipStore.delete(key);
          blobStore.delete(key);
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSettings() {
    const db = await openStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(['settings'], 'readonly');
      const req = tx.objectStore('settings').get('app_defaults');
      req.onsuccess = () =>
        resolve(
          req.result || {
            id: 'app_defaults',
            defaultResolution: '720p',
            defaultDuration: 30,
            defaultQuantity: 5,
            geminiModel: DEFAULT_GEMINI_MODEL,
            renderSpeedMode: 'fast'
          }
        );
      req.onerror = () =>
        resolve({
          id: 'app_defaults',
          defaultResolution: '720p',
          defaultDuration: 30,
          defaultQuantity: 5,
          geminiModel: DEFAULT_GEMINI_MODEL,
          renderSpeedMode: 'fast'
        });
    });
  },

  async saveSettings(settings) {
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['settings'], 'readwrite');
      tx.objectStore('settings').put({ ...settings, id: 'app_defaults' });
      tx.oncomplete = () => resolve(settings);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getStorageStats() {
    const db = await openStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(['projects', 'clips', 'blobs'], 'readonly');
      const pReq = tx.objectStore('projects').count();
      const cReq = tx.objectStore('clips').count();
      const bReq = tx.objectStore('blobs').getAll();
      tx.oncomplete = () => {
        const blobs = bReq.result || [];
        const totalBytes = blobs.reduce((acc, b) => acc + (b.size || b.blob?.size || 0), 0);
        resolve({
          projectCount: pReq.result || 0,
          clipCount: cReq.result || 0,
          blobCount: blobs.length,
          totalBytes
        });
      };
      tx.onerror = () => resolve({ projectCount: 0, clipCount: 0, blobCount: 0, totalBytes: 0 });
    });
  },

  async clearAllData() {
    MEMORY_BLOB_CACHE.clear();
    const db = await openStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['projects', 'clips', 'blobs'], 'readwrite');
      tx.objectStore('projects').clear();
      tx.objectStore('clips').clear();
      tx.objectStore('blobs').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
};

/**
 * ============================================================================
 * GOOGLE GEMINI AI SERVICE (STRUCTURED SCHEMAS, RETRY BACKOFF, VALIDATION)
 * ============================================================================
 */

async function fetchGeminiWithBackoff(apiKey, model, payload, maxRetries = 3, timeoutMs = 45000) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API key is required.');
  }
  const cleanModel = (model || DEFAULT_GEMINI_MODEL).trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const status = response.status;
        if (status === 400 || status === 401 || status === 403) {
          const msg = errBody?.error?.message || 'Invalid or unauthorized Gemini API key.';
          throw new Error(msg.replace(/key=[^&\s]+/gi, 'key=[REDACTED]'));
        }
        if ((status === 429 || status >= 500) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1200;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Gemini API request failed (HTTP ${status}).`);
      }

      const json = await response.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty or blocked response.');
      }
      return text;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        lastError = new Error('AI request timed out. Please retry.');
      } else {
        lastError = new Error((err.message || 'AI connection error').replace(/key=[^&\s]+/gi, 'key=[REDACTED]'));
      }
      if (attempt < maxRetries && !lastError.message.toLowerCase().includes('api key')) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1200));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('Gemini API request failed.');
}

const GeminiService = {
  async validateApiKey(apiKey, model = DEFAULT_GEMINI_MODEL) {
    const payload = {
      contents: [{ parts: [{ text: 'Respond with OK.' }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 }
    };
    await fetchGeminiWithBackoff(apiKey, model, payload, 1, 15000);
    return true;
  },

  async summarizeCampaignBrief(apiKey, model, briefText, pdfBase64 = null) {
    const parts = [];
    if (pdfBase64) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      });
    }
    parts.push({
      text: `Analyze this Campaign Brief & Clipping Instructions carefully and extract structured requirements.
If no brief text is provided, infer sensible creator-focused defaults while marking fields as unspecified.

Campaign Brief Input:
${briefText || '(See attached PDF document)'}`
    });

    const payload = {
      contents: [{ parts }],
      systemInstruction: {
        parts: [
          {
            text: 'You are a Senior Creative Strategist and Brand Compliance Officer. Extract accurate, non-fabricated requirements from the campaign brief.'
          }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            summary: { type: 'STRING' },
            targetAudience: { type: 'STRING' },
            campaignObjective: { type: 'STRING' },
            preferredTone: { type: 'STRING' },
            requiredTopics: { type: 'ARRAY', items: { type: 'STRING' } },
            restrictedTopics: { type: 'ARRAY', items: { type: 'STRING' } },
            requiredCta: { type: 'STRING' },
            requiredHashtags: { type: 'ARRAY', items: { type: 'STRING' } },
            requiredKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
            durationOverrideSeconds: { type: 'NUMBER' }
          },
          required: [
            'summary',
            'targetAudience',
            'campaignObjective',
            'preferredTone',
            'requiredTopics',
            'restrictedTopics',
            'requiredCta',
            'requiredHashtags',
            'requiredKeywords'
          ]
        }
      }
    };

    const raw = await fetchGeminiWithBackoff(apiKey, model, payload, 2, 30000);
    return JSON.parse(raw);
  },

  async detectMomentsAndGenerateContent({
    apiKey,
    model,
    videoTitle,
    videoDuration,
    keyframes,
    briefRules,
    rawBriefText,
    pdfBase64,
    targetDuration,
    requestedQuantity,
    transcriptOrNotes
  }) {
    const desiredCount = requestedQuantity === 'max' ? 12 : Number(requestedQuantity) || 5;
    const parts = [];

    if (pdfBase64) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      });
    }

    if (Array.isArray(keyframes) && keyframes.length > 0) {
      parts.push({
        text: `Here are ${keyframes.length} chronological visual frames sampled from the video "${videoTitle}" (total duration: ${videoDuration.toFixed(1)}s):`
      });
      for (const kf of keyframes) {
        parts.push({ text: `[Timestamp: ${kf.time.toFixed(1)}s]` });
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: kf.base64
          }
        });
      }
    }

    const promptText = `Analyze the video "${videoTitle}" (duration: ${videoDuration.toFixed(1)} seconds) and identify up to ${desiredCount} distinct, high-potential short-form viral moments.

TARGET CLIP DURATION: Max ~${targetDuration} seconds (allow shorter clips if natural storytelling boundaries end earlier; NEVER pad weak moments; NEVER cut off sentences/actions abruptly; NEVER create overlapping or duplicate moments).
REQUESTED QUANTITY: ${requestedQuantity === 'max' ? 'Maximum high-quality non-overlapping moments supported by the footage' : `${desiredCount} clips (return fewer if the video does not contain ${desiredCount} genuinely distinct high-quality moments, and explain in quantityNote)`}.

CAMPAIGN BRIEF (PRIMARY SOURCE OF TRUTH):
${JSON.stringify(briefRules, null, 2)}
Raw Brief Notes: ${rawBriefText || 'None'}
Additional Video Context / Transcript Notes: ${transcriptOrNotes || 'Analyze directly from visual frames and video metadata.'}

MANDATORY RULES FOR EVERY CLIP:
1. Timestamps: startTime >= 0, endTime <= ${videoDuration.toFixed(1)}, endTime - startTime >= 6 seconds and <= ${Math.max(targetDuration + 5, 65)} seconds.
2. HOOKS (Generate 3 distinct options in NATURAL INDONESIAN):
   Each hook MUST combine:
   - Pattern Interrupt (unexpected, surprising, or scroll-stopping opening)
   - Psychological Engagement (curiosity, emotional connection, or relatable tension without clickbait lies)
   - Curiosity Gap (makes viewer want to watch until the end)
   - Power Word (include one of: Ternyata, Rahasia, Terbukti, Gila, Berbeda, Kesalahan, Mengejutkan, Jangan, Faktanya, Unik, Fatal)
   Each of the 3 hooks must use a different angle.
3. HEADLINES (2-3 short, punchy, factual options for TikTok/Reels/Shorts).
4. SUBHEADLINES (2-3 concise complementary context lines that do not repeat the headline).
5. CTAs (2-3 natural, non-salesy Call-To-Action recommendations aligned with the brief).
6. CAPTIONS (2-3 natural Indonesian social captions with curiosity and engagement).
7. HASHTAGS (2-3 relevant hashtag sets combining topic, niche, audience, and brief-required hashtags).
8. MENTIONS (Only entities/brands/people genuinely detected in the video or brief. Set verified=true ONLY if explicitly named in the brief or source metadata. NEVER invent @usernames. Return empty array if none apply).
9. CAMPAIGN COMPLIANCE: Audit each clip against every brief rule. Flag any violation clearly in failedRequirements or warnings.`;

    parts.push({ text: promptText });

    const payload = {
      contents: [{ parts }],
      systemInstruction: {
        parts: [
          {
            text: 'You are an elite Viral Video Producer, Retention Analyst, and Indonesian Content Strategist. Return strictly valid JSON matching the schema. Never fabricate claims or usernames.'
          }
        ]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.45,
        responseSchema: {
          type: 'OBJECT',
          properties: {
            quantityNote: { type: 'STRING' },
            moments: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  startTime: { type: 'NUMBER' },
                  endTime: { type: 'NUMBER' },
                  title: { type: 'STRING' },
                  summary: { type: 'STRING' },
                  reason: { type: 'STRING' },
                  targetAudience: { type: 'STRING' },
                  emotionalAppeal: { type: 'STRING' },
                  hookOptions: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        text: { type: 'STRING' },
                        angle: { type: 'STRING' },
                        powerWord: { type: 'STRING' }
                      },
                      required: ['text', 'angle', 'powerWord']
                    }
                  },
                  headlineOptions: { type: 'ARRAY', items: { type: 'STRING' } },
                  subheadlineOptions: { type: 'ARRAY', items: { type: 'STRING' } },
                  ctaOptions: { type: 'ARRAY', items: { type: 'STRING' } },
                  captionOptions: { type: 'ARRAY', items: { type: 'STRING' } },
                  hashtagOptions: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        label: { type: 'STRING' },
                        tags: { type: 'ARRAY', items: { type: 'STRING' } }
                      },
                      required: ['label', 'tags']
                    }
                  },
                  mentions: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING' },
                        context: { type: 'STRING' },
                        verified: { type: 'BOOLEAN' }
                      },
                      required: ['name', 'context', 'verified']
                    }
                  },
                  viralScore: { type: 'NUMBER' },
                  retentionScore: { type: 'NUMBER' },
                  contentQualityScore: { type: 'NUMBER' },
                  campaignRelevanceScore: { type: 'NUMBER' },
                  complianceScore: { type: 'NUMBER' },
                  scoreExplanation: { type: 'STRING' },
                  passedRequirements: { type: 'ARRAY', items: { type: 'STRING' } },
                  warnings: { type: 'ARRAY', items: { type: 'STRING' } },
                  failedRequirements: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: [
                  'startTime',
                  'endTime',
                  'title',
                  'summary',
                  'reason',
                  'hookOptions',
                  'headlineOptions',
                  'subheadlineOptions',
                  'ctaOptions',
                  'captionOptions',
                  'hashtagOptions',
                  'mentions',
                  'viralScore',
                  'retentionScore',
                  'contentQualityScore',
                  'campaignRelevanceScore',
                  'complianceScore',
                  'scoreExplanation',
                  'passedRequirements',
                  'warnings',
                  'failedRequirements'
                ]
              }
            }
          },
          required: ['quantityNote', 'moments']
        }
      }
    };

    const raw = await fetchGeminiWithBackoff(apiKey, model, payload, 2, 60000);
    return JSON.parse(raw);
  },

  async regenerateField(apiKey, model, clip, fieldType, briefRules) {
    const fieldPrompts = {
      hooks: `Generate 3 fresh, distinct Indonesian viral hook options for this clip using Pattern Interrupt + Psychological Engagement + Curiosity Gap + Power Word (Ternyata, Rahasia, Terbukti, Gila, Berbeda, Kesalahan, Mengejutkan, Jangan, Faktanya, Unik, Fatal).`,
      headlines: `Generate 3 fresh, short, punchy, factual headline options suitable for TikTok, Reels, and YouTube Shorts.`,
      captions: `Generate 3 fresh, natural Indonesian social media captions that spark curiosity and meaningful comments.`,
      hashtags: `Generate 3 fresh, relevant hashtag sets (each containing 5-8 relevant tags combining topic, niche, audience, and brief hashtags).`
    };

    const schemaByField = {
      hooks: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                text: { type: 'STRING' },
                angle: { type: 'STRING' },
                powerWord: { type: 'STRING' }
              },
              required: ['text', 'angle', 'powerWord']
            }
          }
        },
        required: ['items']
      },
      headlines: {
        type: 'OBJECT',
        properties: { items: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['items']
      },
      captions: {
        type: 'OBJECT',
        properties: { items: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['items']
      },
      hashtags: {
        type: 'OBJECT',
        properties: {
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING' },
                tags: { type: 'ARRAY', items: { type: 'STRING' } }
              },
              required: ['label', 'tags']
            }
          }
        },
        required: ['items']
      }
    };

    const payload = {
      contents: [
        {
          parts: [
            {
              text: `${fieldPrompts[fieldType]}

Clip Title: ${clip.title}
Clip Summary: ${clip.summary}
Why Interesting: ${clip.reason}
Campaign Brief Rules: ${JSON.stringify(briefRules || {})}
Avoid repeating previous options.`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        responseSchema: schemaByField[fieldType]
      }
    };

    const raw = await fetchGeminiWithBackoff(apiKey, model, payload, 2, 25000);
    const parsed = JSON.parse(raw);
    return parsed.items || [];
  }
};

/**
 * ============================================================================
 * MOMENT VALIDATION, DEDUPLICATION & RANKING ENGINE
 * ============================================================================
 */

function clampScore(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 75;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateAndRankMoments(rawMoments, videoDuration, targetDuration, requestedQuantity) {
  const safeDuration = Math.max(10, Number(videoDuration) || 60);
  const maxClipLen = Math.max(12, Number(targetDuration) || 30);
  const maxCount = requestedQuantity === 'max' ? 15 : Number(requestedQuantity) || 5;

  const cleaned = [];

  for (const m of rawMoments || []) {
    let start = Math.max(0, Number(m.startTime) || 0);
    let end = Math.min(safeDuration, Number(m.endTime) || start + Math.min(maxClipLen, safeDuration));

    if (end <= start) {
      end = Math.min(safeDuration, start + Math.min(maxClipLen, 15));
    }
    if (end - start > maxClipLen + 4) {
      end = start + maxClipLen;
    }
    if (end - start < 4) {
      if (start + 6 <= safeDuration) end = start + 6;
      else start = Math.max(0, end - 6);
    }
    if (end - start < 3) continue;

    const hasHeavyOverlap = cleaned.some((existing) => {
      const overlapStart = Math.max(existing.startTime, start);
      const overlapEnd = Math.min(existing.endTime, end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const minLen = Math.min(existing.endTime - existing.startTime, end - start);
      return minLen > 0 && overlap / minLen > 0.35;
    });
    if (hasHeavyOverlap) continue;

    const viralScore = clampScore(m.viralScore);
    const retentionScore = clampScore(m.retentionScore);
    const contentQualityScore = clampScore(m.contentQualityScore);
    const campaignRelevanceScore = clampScore(m.campaignRelevanceScore);
    const complianceScore = clampScore(m.complianceScore);

    const overallScore = Math.round(
      viralScore * 0.3 +
        retentionScore * 0.25 +
        campaignRelevanceScore * 0.25 +
        contentQualityScore * 0.2
    );

    const failedRequirements = Array.isArray(m.failedRequirements) ? m.failedRequirements.filter(Boolean) : [];
    const warnings = Array.isArray(m.warnings) ? m.warnings.filter(Boolean) : [];
    const passedRequirements = Array.isArray(m.passedRequirements) ? m.passedRequirements.filter(Boolean) : [];

    const complianceStatus =
      failedRequirements.length > 0 || complianceScore < 65
        ? 'REVIEW_REQUIRED'
        : warnings.length > 0 || complianceScore < 85
          ? 'PASS_WITH_WARNINGS'
          : 'PASSED';

    const hooks =
      Array.isArray(m.hookOptions) && m.hookOptions.length > 0
        ? m.hookOptions
        : [
            {
              text: 'Ternyata bagian ini menyimpan detail yang jarang diperhatikan orang!',
              angle: 'Curiosity & Surprise',
              powerWord: 'Ternyata'
            }
          ];

    const headlines =
      Array.isArray(m.headlineOptions) && m.headlineOptions.length > 0
        ? m.headlineOptions
        : [m.title || 'Momen Penting yang Wajib Kamu Simak'];

    const subheadlines =
      Array.isArray(m.subheadlineOptions) && m.subheadlineOptions.length > 0
        ? m.subheadlineOptions
        : [m.summary || 'Cuplikan inti dengan konteks lengkap dan insight langsung.'];

    const ctas =
      Array.isArray(m.ctaOptions) && m.ctaOptions.length > 0
        ? m.ctaOptions
        : ['Simpan video ini supaya tidak lupa, dan tulis pendapatmu di komentar!'];

    const captions =
      Array.isArray(m.captionOptions) && m.captionOptions.length > 0
        ? m.captionOptions
        : [`${m.summary || m.title} — Bagaimana menurut kamu?`];

    const hashtags =
      Array.isArray(m.hashtagOptions) && m.hashtagOptions.length > 0
        ? m.hashtagOptions
        : [{ label: 'Topik Utama', tags: ['#KontenKreator', '#ShortsIndonesia', '#Insight'] }];

    cleaned.push({
      startTime: Number(start.toFixed(1)),
      endTime: Number(end.toFixed(1)),
      duration: Number((end - start).toFixed(1)),
      title: m.title || 'Untitled Moment',
      summary: m.summary || '',
      reason: m.reason || '',
      targetAudience: m.targetAudience || 'General Audience',
      emotionalAppeal: m.emotionalAppeal || 'Curiosity & Insight',
      hookOptions: hooks,
      selectedHookIndex: 0,
      headlineOptions: headlines,
      selectedHeadlineIndex: 0,
      subheadlineOptions: subheadlines,
      selectedSubheadlineIndex: 0,
      ctaOptions: ctas,
      selectedCtaIndex: 0,
      captionOptions: captions,
      selectedCaptionIndex: 0,
      hashtagOptions: hashtags,
      selectedHashtagIndex: 0,
      mentions: Array.isArray(m.mentions) ? m.mentions : [],
      viralScore,
      retentionScore,
      contentQualityScore,
      campaignRelevanceScore,
      complianceScore,
      overallScore,
      scoreExplanation: m.scoreExplanation || 'Evaluated based on hook strength, narrative clarity, and brief alignment.',
      passedRequirements,
      warnings,
      failedRequirements,
      complianceStatus,
      isFavorite: false
    });
  }

  cleaned.sort((a, b) => b.overallScore - a.overallScore);
  return cleaned.slice(0, maxCount);
}

/**
 * ============================================================================
 * VIDEO PROCESSING & ATMOSPHERIC CINEMATIC 9:16 COMPOSITING ENGINE
 * ============================================================================
 */

function inspectVideoFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Unable to read valid duration from the uploaded video file.'));
        return;
      }
      resolve({
        duration,
        width,
        height,
        aspectRatio: Number((width / height).toFixed(3)),
        size: file.size,
        name: file.name,
        type: file.type || 'video/mp4'
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Unsupported or corrupted video file. Please upload a valid MP4, MOV, or WebM file.'));
    };

    video.src = url;
  });
}

async function extractTimelineKeyframes(file, duration, desiredFrameCount = 12) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('Failed to decode video frames for AI analysis.'));
  });

  const count = Math.min(desiredFrameCount, Math.max(4, Math.floor(duration / 2.5)));
  const canvas = document.createElement('canvas');
  const scaleW = 448;
  const scaleH = Math.round((scaleW * (video.videoHeight || 720)) / (video.videoWidth || 1280));
  canvas.width = scaleW;
  canvas.height = Math.max(200, scaleH);
  const ctx = canvas.getContext('2d');

  const keyframes = [];
  for (let i = 0; i < count; i++) {
    const targetTime = Math.min(duration - 0.2, Math.max(0.1, ((i + 0.5) / count) * duration));
    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = targetTime;
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    keyframes.push({
      time: targetTime,
      base64: dataUrl.split(',')[1]
    });
  }

  URL.revokeObjectURL(url);
  video.remove();
  return keyframes;
}

/**
 * Draws a single frame in the 9:16 composition:
 * - Full-bleed blurred background across the entire 9:16 canvas (adjustable via Efek Blur 0%..200%)
 * - Unblurred foreground OVERLAY whose actual bounding box (overlayW × overlayH)
 *   grows larger or shrinks with Zoom (30%..320%) and moves with Sumbu X / Sumbu Y.
 */
function drawAtmosphericCinematicFrame(
  ctx,
  mediaSource,
  W,
  H,
  transform = DEFAULT_EDIT_TRANSFORM,
  options = {}
) {
  const { showOverlayGuide = false } = options;

  const vw =
    mediaSource?.videoWidth ||
    mediaSource?.naturalWidth ||
    mediaSource?.width ||
    1280;
  const vh =
    mediaSource?.videoHeight ||
    mediaSource?.naturalHeight ||
    mediaSource?.height ||
    720;
  const srcAspect = vw > 0 && vh > 0 ? vw / vh : 16 / 9;

  const offsetX = Number.isFinite(transform?.offsetX) ? transform.offsetX : 0;
  const offsetY = Number.isFinite(transform?.offsetY) ? transform.offsetY : 0;
  const zoomPct = Number.isFinite(transform?.zoom) ? transform.zoom : 100;
  const blurPct = Number.isFinite(transform?.blur) ? transform.blur : 100;

  const zoomFactor = Math.max(0.3, Math.min(3.5, zoomPct / 100));
  const blurPx = Math.max(0, Math.round(34 * (blurPct / 100)));

  // 1. Background layer: enlarged cover scale with adjustable atmospheric blur across full 9:16 canvas
  ctx.save();
  const coverScale = Math.max(W / vw, H / vh) * 1.24;
  const bgW = vw * coverScale;
  const bgH = vh * coverScale;
  const bgX = (W - bgW) / 2;
  const bgY = (H - bgH) / 2;

  ctx.fillStyle = '#07222b';
  ctx.fillRect(0, 0, W, H);
  if (mediaSource) {
    ctx.filter =
      blurPx > 0
        ? `blur(${blurPx}px) saturate(1.12) brightness(0.94)`
        : 'saturate(1.08) brightness(0.94)';
    ctx.drawImage(mediaSource, bgX, bgY, bgW, bgH);
  }
  ctx.restore();

  // 2. Calculate base overlay box at 100% zoom, then scale BOTH width & height by zoomFactor
  let baseW, baseH;
  if (srcAspect >= 1.0) {
    baseW = W;
    baseH = Math.round(W / srcAspect);
  } else {
    baseH = Math.min(H, Math.round(W / srcAspect));
    baseW = Math.round(baseH * srcAspect);
  }

  const overlayW = Math.round(baseW * zoomFactor);
  const overlayH = Math.round(baseH * zoomFactor);
  const panX = (offsetX / 100) * (W * 0.5);
  const panY = (offsetY / 100) * (H * 0.5);
  const overlayX = Math.round((W - overlayW) / 2 + panX);
  const overlayY = Math.round((H - overlayH) / 2 + panY);

  // 3. Sharp, unblurred foreground OVERLAY (expands & shrinks cleanly with Zoom + Sumbu X / Sumbu Y)
  if (mediaSource) {
    ctx.save();
    ctx.filter = 'contrast(1.04) saturate(1.05) brightness(1.01)';
    ctx.drawImage(mediaSource, overlayX, overlayY, overlayW, overlayH);
    ctx.restore();
  }

  // 4. Interactive overlay bounding guide (shown only in the live style preview editor)
  if (showOverlayGuide) {
    ctx.save();
    const gx = Math.max(1, overlayX);
    const gy = Math.max(1, overlayY);
    const gw = Math.min(W - 2, overlayW);
    const gh = Math.min(H - 2, overlayH);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.78)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx, gy, gw, gh);

    // Corner handles to visually indicate the resizable unblurred overlay layer
    const handleLen = 10;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(gx, gy + handleLen);
    ctx.lineTo(gx, gy);
    ctx.lineTo(gx + handleLen, gy);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(gx + gw - handleLen, gy);
    ctx.lineTo(gx + gw, gy);
    ctx.lineTo(gx + gw, gy + handleLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh - handleLen);
    ctx.lineTo(gx, gy + gh);
    ctx.lineTo(gx + handleLen, gy + gh);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(gx + gw - handleLen, gy + gh);
    ctx.lineTo(gx + gw, gy + gh);
    ctx.lineTo(gx + gw, gy + gh - handleLen);
    ctx.stroke();

    ctx.restore();
  }
}

async function renderAtmosphericCinematicClip({
  file,
  startTime,
  endTime,
  resolutionKey = '720p',
  speedMode = 'fast',
  transform = DEFAULT_EDIT_TRANSFORM,
  onFrameProgress
}) {
  const res = RESOLUTIONS[resolutionKey] || RESOLUTIONS['720p'];
  const W = res.width;
  const H = res.height;

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('Failed to load video stream for clip rendering.'));
  });

  const safeStart = Math.max(0, Math.min(startTime, Math.max(0, video.duration - 1)));
  const safeEnd = Math.max(safeStart + 1, Math.min(endTime, video.duration));

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = safeStart;
    setTimeout(done, 1200);
  });

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  drawAtmosphericCinematicFrame(ctx, video, W, H, transform, { showOverlayGuide: false });
  const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.86);

  const canvasStream = canvas.captureStream(30);
  let combinedStream = canvasStream;
  let audioCtx = null;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      const sourceNode = audioCtx.createMediaElementSource(video);
      const destNode = audioCtx.createMediaStreamDestination();
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;
      sourceNode.connect(destNode);
      sourceNode.connect(muteGain);
      muteGain.connect(audioCtx.destination);
      const audioTracks = destNode.stream.getAudioTracks();
      if (audioTracks.length > 0 && audioCtx.state === 'running') {
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      }
    }
  } catch {
    combinedStream = canvasStream;
  }

  const preferredMimes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  const supportedMime =
    preferredMimes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';

  const chunks = [];
  const recorder = supportedMime
    ? new MediaRecorder(combinedStream, {
        mimeType: supportedMime,
        videoBitsPerSecond: resolutionKey === '1080p' ? 5000000 : 3000000
      })
    : new MediaRecorder(combinedStream);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const clipSpan = Math.max(1, safeEnd - safeStart);
  video.playbackRate = speedMode === 'fast' ? 1.5 : 1.0;

  return new Promise((resolve, reject) => {
    let timerId = null;
    let finished = false;

    const cleanup = () => {
      if (timerId) clearInterval(timerId);
      URL.revokeObjectURL(url);
      if (audioCtx) audioCtx.close().catch(() => {});
      video.remove();
    };

    const finishRender = () => {
      if (finished) return;
      finished = true;
      if (timerId) clearInterval(timerId);
      video.pause();
      if (recorder.state !== 'inactive') {
        try {
          recorder.requestData();
        } catch {}
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      const mime = recorder.mimeType || supportedMime || 'video/webm';
      const blob = new Blob(chunks, { type: mime });
      cleanup();
      if (!blob || blob.size === 0) {
        reject(
          new Error(
            'Rendered video buffer was empty. Please try switching Render Encoding Speed to 1x Realtime in Settings.'
          )
        );
        return;
      }
      resolve({
        blob,
        thumbnailDataUrl,
        mimeType: mime,
        width: W,
        height: H
      });
    };

    recorder.onerror = (err) => {
      finished = true;
      cleanup();
      reject(new Error(err?.error?.message || 'Video encoding error during clip render.'));
    };

    const pumpFrame = () => {
      if (finished) return;
      drawAtmosphericCinematicFrame(ctx, video, W, H, transform, { showOverlayGuide: false });
      const pct = Math.min(100, Math.max(0, ((video.currentTime - safeStart) / clipSpan) * 100));
      if (onFrameProgress) onFrameProgress(pct);

      if (video.currentTime >= safeEnd || video.ended) {
        finishRender();
      }
    };

    recorder.start(200);
    video
      .play()
      .then(() => {
        pumpFrame();
        timerId = setInterval(pumpFrame, 1000 / 30);
      })
      .catch((err) => {
        finished = true;
        cleanup();
        reject(new Error(`Playback blocked during render: ${err.message}`));
      });
  });
}

/**
 * Generates a real 32-second multi-scene 16:9 sample video file in-browser
 * so users can test full end-to-end AI analysis + 9:16 rendering immediately.
 */
async function generateBuiltInSampleVideo(onProgress) {
  const W = 960;
  const H = 540;
  const durationSec = 32;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let audioCtx = null;
  let stream = canvas.captureStream(30);
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220;
      gain.gain.value = 0.03;
      const dest = audioCtx.createMediaStreamDestination();
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    }
  } catch {}

  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const scenes = [
    { start: 0, end: 8, title: 'CHAPTER 1: THE 3AM CREATOR MISTAKE', skyTop: '#1e3a8a', skyBot: '#93c5fd', mountain: '#0f2942', badge: '01 / HOOK' },
    { start: 8, end: 16, title: 'CHAPTER 2: ALPINE DAWN EXPEDITION', skyTop: '#0c4a6e', skyBot: '#bae6fd', mountain: '#063740', badge: '02 / STORY' },
    { start: 16, end: 24, title: 'CHAPTER 3: THE RETENTION SECRET', skyTop: '#164e63', skyBot: '#67e8f9', mountain: '#083344', badge: '03 / INSIGHT' },
    { start: 24, end: 32, title: 'CHAPTER 4: FINAL TAKEAWAY & CHALLENGE', skyTop: '#0f172a', skyBot: '#38bdf8', mountain: '#042f2e', badge: '04 / CTA' }
  ];

  recorder.start(250);
  const startWall = performance.now();

  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - startWall) / 1000;
      if (elapsed >= durationSec) {
        recorder.stop();
        resolve();
        return;
      }
      if (onProgress) onProgress(Math.min(100, Math.round((elapsed / durationSec) * 100)));

      const scene = scenes.find((s) => elapsed >= s.start && elapsed < s.end) || scenes[0];

      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.68);
      sky.addColorStop(0, scene.skyTop);
      sky.addColorStop(1, scene.skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 230 + elapsed * 28) % (W + 200)) - 100;
        const cy = 70 + (i % 3) * 38;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 95, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = scene.mountain;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, H * 0.58);
      ctx.lineTo(W * 0.25, H * 0.42);
      ctx.lineTo(W * 0.52, H * 0.55);
      ctx.lineTo(W * 0.76, H * 0.36);
      ctx.lineTo(W, H * 0.52);
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(6, 24, 32, 0.76)';
      ctx.fillRect(42, H - 145, W - 84, 102);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, H - 145, W - 84, 102);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${scene.badge}  •  TIME ${elapsed.toFixed(1)}s`, 64, H - 112);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(scene.title, 64, H - 74);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await new Promise((r) => {
    recorder.onstop = r;
  });
  if (audioCtx) audioCtx.close().catch(() => {});

  const blob = new Blob(chunks, { type: 'video/webm' });
  return new File([blob], 'Alpine_Creator_Expedition_Sample.webm', { type: 'video/webm' });
}

/**
 * ============================================================================
 * REACT ERROR BOUNDARY
 * ============================================================================
 */

class StudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.'
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090B0E] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#11151C] border border-rose-500/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Studio Workspace Recovery</h2>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{this.state.errorMessage}</p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition"
            >
              Reload Studio View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * ============================================================================
 * REUSABLE UI COMPONENTS (COPY BUTTON, SCORE BAR, PRESET PREVIEW)
 * ============================================================================
 */

function CopyActionButton({ text, label = 'Copy', size = 'sm' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text || '';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : label}
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
        size === 'xs' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs'
      } ${
        copied
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

function ScoreMetricBar({ label, score, accent = 'cyan' }) {
  const colorMap = {
    cyan: 'bg-cyan-400',
    teal: 'bg-teal-400',
    emerald: 'bg-emerald-400',
    sky: 'bg-sky-400'
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-200">{score}/100</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[accent] || colorMap.cyan}`}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Precision Ruler Tick-Mark Slider matching the uploaded reference UI
 */
function PrecisionTickSlider({ label, value, min, max, step = 1, unit = '%', onChange }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    },
    [min, max, step, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      updateFromClientX(clientX);
    };
    const onUp = () => setDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updateFromClientX]);

  const ratio = (value - min) / (max - min || 1);
  const tickCount = 41;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 select-none">
      <span className="text-xs font-medium text-slate-300 w-20 shrink-0">{label}</span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChange(Math.max(min, value - step));
          if (e.key === 'ArrowRight') onChange(Math.min(max, value + step));
        }}
        onMouseDown={(e) => {
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
        onTouchStart={(e) => {
          setDragging(true);
          updateFromClientX(e.touches[0].clientX);
        }}
        className="relative flex-1 h-9 rounded-lg bg-[#161920] border border-slate-800/90 overflow-hidden cursor-ew-resize flex items-center px-2 touch-none"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#161920] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#161920] to-transparent z-10" />

        <div className="w-full flex items-center justify-between">
          {Array.from({ length: tickCount }).map((_, idx) => {
            const isMajor = idx % 5 === 0;
            const isCenter = idx === Math.floor(tickCount / 2);
            return (
              <span
                key={idx}
                className={`w-[1.5px] rounded-full transition-colors ${
                  isCenter
                    ? 'h-4 bg-slate-400'
                    : isMajor
                      ? 'h-3.5 bg-slate-500/80'
                      : 'h-2.5 bg-slate-700/80'
                }`}
              />
            );
          })}
        </div>

        <div
          className="pointer-events-none absolute top-1.5 bottom-1.5 w-[2.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)] rounded-full z-20 transition-[left] duration-75"
          style={{ left: `calc(${ratio * 100}% - 1px)` }}
        />
      </div>

      <span className="text-xs font-mono font-semibold text-slate-200 w-12 text-right shrink-0">
        {value}
        {unit}
      </span>
    </div>
  );
}

/**
 * Live 9:16 Style & Overlay Framing Preview Canvas + Precision Tick Sliders
 * Uses the verified YouTube video thumbnail as the style reference so you can
 * adjust Sumbu X, Sumbu Y, Zoom (overlay scale), and Efek Blur before rendering.
 */
function LiveStylePreviewEditor({ youtubeMeta, transform, onChangeTransform }) {
  const previewCanvasRef = useRef(null);
  const ytThumbImgRef = useRef(null);
  const [ytThumbReady, setYtThumbReady] = useState(false);

  // Load verified YouTube video thumbnail cleanly (tries maxresdefault 16:9 first, falls back to mqdefault 16:9)
  useEffect(() => {
    setYtThumbReady(false);
    ytThumbImgRef.current = null;
    if (!youtubeMeta?.videoId && !youtubeMeta?.thumbnailUrl) return;

    let cancelled = false;
    const img = new Image();
    const fallbackUrl = youtubeMeta?.videoId
      ? `https://i.ytimg.com/vi/${youtubeMeta.videoId}/mqdefault.jpg`
      : youtubeMeta.thumbnailUrl;

    img.onload = () => {
      if (cancelled) return;
      // YouTube returns a 120x90 gray placeholder if maxresdefault does not exist
      if (img.naturalWidth <= 120 && img.src !== fallbackUrl) {
        img.src = fallbackUrl;
        return;
      }
      ytThumbImgRef.current = img;
      setYtThumbReady(true);
    };

    img.onerror = () => {
      if (cancelled) return;
      if (img.src !== fallbackUrl) {
        img.src = fallbackUrl;
      } else if (youtubeMeta?.oembedThumbnailUrl && img.src !== youtubeMeta.oembedThumbnailUrl) {
        img.src = youtubeMeta.oembedThumbnailUrl;
      }
    };

    img.src = youtubeMeta?.videoId
      ? `https://i.ytimg.com/vi/${youtubeMeta.videoId}/maxresdefault.jpg`
      : youtubeMeta.thumbnailUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [youtubeMeta?.videoId, youtubeMeta?.thumbnailUrl, youtubeMeta?.oembedThumbnailUrl]);

  // Redraw the 9:16 preview whenever thumbnail loads or X/Y/Zoom/Blur changes
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sourceImg = ytThumbReady ? ytThumbImgRef.current : null;
    drawAtmosphericCinematicFrame(ctx, sourceImg, canvas.width, canvas.height, transform, {
      showOverlayGuide: Boolean(sourceImg)
    });
  }, [ytThumbReady, transform]);

  const isModified =
    transform.offsetX !== 0 || transform.offsetY !== 0 || transform.zoom !== 100 || transform.blur !== 100;

  return (
    <div className="rounded-xl bg-[#0A0D12] border border-slate-800/90 p-3.5 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-white block">Live 9:16 Style & Overlay Preview</span>
          <span className="text-[11px] text-slate-400 block truncate">
            {ytThumbReady
              ? `YouTube Reference: ${youtubeMeta?.title || 'Verified Video'}`
              : 'Verify a YouTube URL in Section B to preview thumbnail style'}
          </span>
        </div>
        {isModified && (
          <button
            type="button"
            onClick={() => onChangeTransform({ ...DEFAULT_EDIT_TRANSFORM })}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 border border-slate-700 shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      {/* 9:16 Style Reference Canvas (Strictly uses YouTube Thumbnail) */}
      <div className="relative mx-auto w-full max-w-[225px] aspect-[9/16] rounded-xl overflow-hidden border border-cyan-500/35 shadow-2xl bg-[#051820]">
        <canvas ref={previewCanvasRef} width={360} height={640} className="w-full h-full object-contain block" />

        {!ytThumbReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
            <div className="w-full aspect-video rounded-lg border border-dashed border-cyan-400/50 bg-slate-900/55 flex flex-col items-center justify-center p-3">
              <Youtube className="w-6 h-6 text-cyan-400 mb-1.5" />
              <p className="text-[11px] font-medium text-slate-200">YouTube Thumbnail Reference</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                Paste a YouTube link & click “Verify Video” in Section B to load its thumbnail here
              </p>
            </div>
          </div>
        )}

        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-black/65 text-[9px] font-mono text-cyan-300 border border-white/10">
            9:16 OVERLAY
          </span>
          <span className="px-1.5 py-0.5 rounded bg-black/65 text-[9px] font-mono text-slate-200 border border-white/10">
            Z:{transform.zoom}% B:{transform.blur}%
          </span>
        </div>
      </div>

      {/* Precision Tick Sliders: Sumbu X, Sumbu Y, Zoom (Overlay Scale), Efek Blur */}
      <div className="pt-2 border-t border-slate-800/80 space-y-1">
        <PrecisionTickSlider
          label="Sumbu x"
          value={transform.offsetX}
          min={-100}
          max={100}
          step={1}
          unit="%"
          onChange={(val) => onChangeTransform((prev) => ({ ...prev, offsetX: val }))}
        />
        <PrecisionTickSlider
          label="Sumbu y"
          value={transform.offsetY}
          min={-100}
          max={100}
          step={1}
          unit="%"
          onChange={(val) => onChangeTransform((prev) => ({ ...prev, offsetY: val }))}
        />
        <PrecisionTickSlider
          label="Zoom"
          value={transform.zoom}
          min={30}
          max={320}
          step={1}
          unit="%"
          onChange={(val) => onChangeTransform((prev) => ({ ...prev, zoom: val }))}
        />
        <PrecisionTickSlider
          label="Efek Blur"
          value={transform.blur}
          min={0}
          max={200}
          step={1}
          unit="%"
          onChange={(val) => onChangeTransform((prev) => ({ ...prev, blur: val }))}
        />
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * INDIVIDUAL CLIP RESULT CARD & INTERACTIVE EDITOR
 * ============================================================================
 */

function ClipResultCard({
  clip,
  rank,
  apiKey,
  geminiModel,
  briefRules,
  hasVideoFile,
  sourceVideoFile,
  onUpdateClip,
  onDeleteClip,
  onNotify
}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoBlobSize, setVideoBlobSize] = useState(0);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTransformEditor, setShowTransformEditor] = useState(false);
  const [clipTransform, setClipTransform] = useState(clip.transform || { ...DEFAULT_EDIT_TRANSFORM });
  const [rerenderingClip, setRerenderingClip] = useState(false);
  const [activeTab, setActiveTab] = useState('hooks');
  const [editingField, setEditingField] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    StudioDB.getClipBlob(clip.id)
      .then((blob) => {
        if (active && blob && blob.size > 0) {
          objectUrl = URL.createObjectURL(blob);
          setVideoUrl(objectUrl);
          setVideoBlobSize(blob.size);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip.id, clip.renderedVersion]);

  const handleDownloadClip = async () => {
    try {
      const blob = await StudioDB.getClipBlob(clip.id);
      if (!blob || blob.size === 0) {
        onNotify('Video file is not available yet. Upload a source video file to render downloadable clips.', 'error');
        return;
      }
      const ext = (blob.type || '').includes('mp4') ? 'mp4' : 'webm';
      const filename = `Rank${rank}_${sanitizeFilename(clip.title)}_${clip.resolution}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 4000);
      onNotify(`Downloading ${filename} (${formatBytes(blob.size)})`, 'success');
    } catch {
      onNotify('Failed to export video clip.', 'error');
    }
  };

  const handleRerenderWithTransform = async () => {
    if (!sourceVideoFile) {
      onNotify('Original source video file is needed in memory to re-render framing.', 'error');
      return;
    }
    setRerenderingClip(true);
    try {
      const rendered = await renderAtmosphericCinematicClip({
        file: sourceVideoFile,
        startTime: clip.startTime,
        endTime: clip.endTime,
        resolutionKey: clip.resolution || '720p',
        speedMode: 'fast',
        transform: clipTransform
      });
      await StudioDB.saveSingleClipBlob(clip.id, clip.projectId, rendered.blob);
      const updated = {
        ...clip,
        transform: { ...clipTransform },
        thumbnailDataUrl: rendered.thumbnailDataUrl,
        renderedMimeType: rendered.mimeType,
        renderedVersion: (clip.renderedVersion || 1) + 1
      };
      await onUpdateClip(updated);
      setShowTransformEditor(false);
      onNotify('Clip re-rendered with updated X/Y, Zoom & Blur settings!', 'success');
    } catch (err) {
      onNotify(err.message || 'Failed to re-render clip.', 'error');
    } finally {
      setRerenderingClip(false);
    }
  };

  const handleRegenerate = async (field) => {
    if (!apiKey) {
      onNotify('Please enter and validate your Gemini API key first to regenerate AI copy.', 'error');
      return;
    }
    setRegeneratingField(field);
    try {
      const newItems = await GeminiService.regenerateField(apiKey, geminiModel, clip, field, briefRules);
      if (!newItems || newItems.length === 0) {
        throw new Error('No alternatives returned.');
      }
      const updated = { ...clip };
      if (field === 'hooks') {
        updated.hookOptions = newItems;
        updated.selectedHookIndex = 0;
      } else if (field === 'headlines') {
        updated.headlineOptions = newItems;
        updated.selectedHeadlineIndex = 0;
      } else if (field === 'captions') {
        updated.captionOptions = newItems;
        updated.selectedCaptionIndex = 0;
      } else if (field === 'hashtags') {
        updated.hashtagOptions = newItems;
        updated.selectedHashtagIndex = 0;
      }
      await onUpdateClip(updated);
      onNotify(`Regenerated ${field} with Gemini AI.`, 'success');
    } catch (err) {
      onNotify(err.message || `Failed to regenerate ${field}.`, 'error');
    } finally {
      setRegeneratingField(null);
    }
  };

  const startEditing = (fieldKey, currentText) => {
    setEditingField(fieldKey);
    setEditDraft(currentText);
  };

  const saveEdit = async (fieldKey, index) => {
    const updated = { ...clip };
    if (fieldKey === 'hook') {
      const arr = [...updated.hookOptions];
      arr[index] = { ...arr[index], text: editDraft };
      updated.hookOptions = arr;
    } else if (fieldKey === 'headline') {
      const arr = [...updated.headlineOptions];
      arr[index] = editDraft;
      updated.headlineOptions = arr;
    } else if (fieldKey === 'subheadline') {
      const arr = [...updated.subheadlineOptions];
      arr[index] = editDraft;
      updated.subheadlineOptions = arr;
    } else if (fieldKey === 'cta') {
      const arr = [...updated.ctaOptions];
      arr[index] = editDraft;
      updated.ctaOptions = arr;
    } else if (fieldKey === 'caption') {
      const arr = [...updated.captionOptions];
      arr[index] = editDraft;
      updated.captionOptions = arr;
    } else if (fieldKey === 'hashtag') {
      const arr = [...updated.hashtagOptions];
      const tags = editDraft
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));
      arr[index] = { ...arr[index], tags };
      updated.hashtagOptions = arr;
    }
    await onUpdateClip(updated);
    setEditingField(null);
    onNotify('Saved edit to persistent database.', 'success');
  };

  const selectedHook = clip.hookOptions?.[clip.selectedHookIndex || 0];
  const selectedHeadline = clip.headlineOptions?.[clip.selectedHeadlineIndex || 0] || '';
  const selectedSubheadline = clip.subheadlineOptions?.[clip.selectedSubheadlineIndex || 0] || '';
  const selectedCta = clip.ctaOptions?.[clip.selectedCtaIndex || 0] || '';
  const selectedCaption = clip.captionOptions?.[clip.selectedCaptionIndex || 0] || '';
  const selectedHashtagSet = clip.hashtagOptions?.[clip.selectedHashtagIndex || 0];

  const fullPackageText = [
    `HOOK: ${selectedHook?.text || ''}`,
    `HEADLINE: ${selectedHeadline}`,
    `SUBHEADLINE: ${selectedSubheadline}`,
    `CAPTION: ${selectedCaption}`,
    `CTA: ${selectedCta}`,
    `HASHTAGS: ${(selectedHashtagSet?.tags || []).join(' ')}`
  ].join('\n\n');

  const complianceBadge =
    clip.complianceStatus === 'PASSED'
      ? {
          label: `Compliant (${clip.complianceScore}/100)`,
          cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: ShieldCheck
        }
      : clip.complianceStatus === 'PASS_WITH_WARNINGS'
        ? {
            label: `Review Notes (${clip.complianceScore}/100)`,
            cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
            icon: ShieldAlert
          }
        : {
            label: `Flagged for Review (${clip.complianceScore}/100)`,
            cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
            icon: AlertTriangle
          };
  const ComplianceIcon = complianceBadge.icon;

  const tabs = [
    { id: 'hooks', label: `Hooks (${clip.hookOptions?.length || 0})` },
    { id: 'headlines', label: 'Headlines & Sub' },
    { id: 'captions', label: 'Captions & CTA' },
    { id: 'hashtags', label: 'Hashtags & Tags' },
    { id: 'compliance', label: 'Brief Audit' }
  ];

  return (
    <article className="bg-[#11151C] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl transition hover:border-slate-700/90">
      {/* Top Bar */}
      <div className="px-5 py-3.5 bg-[#151A23] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shrink-0">
            #{rank}
          </span>
          <h3 className="text-base font-semibold text-white truncate">{clip.title}</h3>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs shrink-0">
            <Clock className="w-3 h-3 text-cyan-400" />
            {formatTimecode(clip.startTime)} → {formatTimecode(clip.endTime)} ({formatDurationBadge(clip.duration)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${complianceBadge.cls}`}>
            <ComplianceIcon className="w-3.5 h-3.5" />
            {complianceBadge.label}
          </span>

          <CopyActionButton text={fullPackageText} label="Copy All Copy" />

          <button
            type="button"
            onClick={() => onUpdateClip({ ...clip, isFavorite: !clip.isFavorite })}
            aria-label={clip.isFavorite ? 'Remove from favorites' : 'Mark clip as favorite'}
            className={`p-2 rounded-lg border transition ${
              clip.isFavorite
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Star className={`w-4 h-4 ${clip.isFavorite ? 'fill-amber-400' : ''}`} />
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete clip"
              className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-500/40 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => onDeleteClip(clip.id)}
                className="text-xs font-semibold text-rose-300 hover:text-white px-1.5"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-slate-400 hover:text-white px-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Split: Left 9:16 Video Player + Scores | Right Interactive Copy Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: 9:16 Player & Viral Score Breakdown */}
        <div className="lg:col-span-4 p-5 border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-[#0D1016] flex flex-col justify-between gap-5">
          <div>
            {/* 9:16 Vertical Video Frame */}
            <div className="relative mx-auto w-full max-w-[250px] aspect-[9/16] rounded-xl overflow-hidden bg-[#06181f] border border-slate-700/80 shadow-2xl group">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={clip.thumbnailDataUrl || undefined}
                  playsInline
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                />
              ) : clip.thumbnailDataUrl ? (
                <img src={clip.thumbnailDataUrl} alt={clip.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-800/70 via-[#0d424c]/60 to-[#04181f]">
                  <Film className="w-8 h-8 text-cyan-400 mb-2" />
                  <p className="text-xs font-medium text-slate-200">Timestamped Clip Segment</p>
                  <p className="text-[11px] font-mono text-cyan-300 mt-1">
                    {formatTimecode(clip.startTime)} – {formatTimecode(clip.endTime)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    {hasVideoFile
                      ? 'Video file unavailable in browser storage.'
                      : 'Upload an authorized video file on Create Clips to render downloadable 9:16 video.'}
                  </p>
                </div>
              )}

              {/* Resolution & Style Overlay Pill */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-cyan-300 border border-white/10">
                  {clip.resolution === '1080p' ? '1080×1920' : '720×1280'}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-slate-200 border border-white/10">
                  {formatDurationBadge(clip.duration)}
                </span>
              </div>
            </div>

            {/* Player Controls, Preview Modal & Download */}
            <div className="mt-4 space-y-2 max-w-[260px] mx-auto">
              <div className="flex items-center gap-2">
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium border border-slate-700 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    Preview
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadClip}
                  disabled={!videoUrl}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-semibold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  {videoBlobSize > 0 ? `Download (${formatBytes(videoBlobSize)})` : 'Download'}
                </button>
              </div>

              {sourceVideoFile && (
                <button
                  type="button"
                  onClick={() => setShowTransformEditor((v) => !v)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 transition"
                >
                  <Sliders className="w-3 h-3 text-cyan-400" />
                  {showTransformEditor ? 'Close Framing & Blur Editor' : 'Adjust X/Y, Zoom & Blur'}
                </button>
              )}

              {showTransformEditor && sourceVideoFile && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <PrecisionTickSlider
                    label="Sumbu x"
                    value={clipTransform.offsetX}
                    min={-100}
                    max={100}
                    onChange={(v) => setClipTransform((p) => ({ ...p, offsetX: v }))}
                  />
                  <PrecisionTickSlider
                    label="Sumbu y"
                    value={clipTransform.offsetY}
                    min={-100}
                    max={100}
                    onChange={(v) => setClipTransform((p) => ({ ...p, offsetY: v }))}
                  />
                  <PrecisionTickSlider
                    label="Zoom"
                    value={clipTransform.zoom}
                    min={30}
                    max={320}
                    onChange={(v) => setClipTransform((p) => ({ ...p, zoom: v }))}
                  />
                  <PrecisionTickSlider
                    label="Efek Blur"
                    value={clipTransform.blur}
                    min={0}
                    max={200}
                    onChange={(v) => setClipTransform((p) => ({ ...p, blur: v }))}
                  />
                  <button
                    type="button"
                    onClick={handleRerenderWithTransform}
                    disabled={rerenderingClip}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    {rerenderingClip ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Re-rendering Clip...
                      </>
                    ) : (
                      'Apply & Re-render Video'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pre-Download Video Preview Modal */}
          {showPreviewModal && videoUrl && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Preview ${clip.title}`}
              onClick={() => setShowPreviewModal(false)}
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#11151C] border border-slate-700 rounded-2xl max-w-md w-full p-4 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-cyan-400">
                      PREVIEW • {clip.resolution === '1080p' ? '1080×1920' : '720×1280'}
                    </span>
                    <h4 className="text-sm font-semibold text-white truncate">{clip.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                    aria-label="Close preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mx-auto w-full max-w-[290px] aspect-[9/16] rounded-xl overflow-hidden bg-black border border-slate-700">
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    loop
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadClip}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Video
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Viral Score Card */}
          <div className="bg-[#131822] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Potential</span>
              <span className="text-lg font-mono font-bold text-cyan-400">{clip.overallScore}/100</span>
            </div>

            <div className="space-y-2.5">
              <ScoreMetricBar label="Viral Potential" score={clip.viralScore} accent="cyan" />
              <ScoreMetricBar label="Retention Potential" score={clip.retentionScore} accent="teal" />
              <ScoreMetricBar label="Campaign Relevance" score={clip.campaignRelevanceScore} accent="emerald" />
              <ScoreMetricBar label="Content Quality" score={clip.contentQualityScore} accent="sky" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-slate-800/80">
              {clip.scoreExplanation}
            </p>
            <p className="text-[11px] text-slate-500 italic">
              Note: AI scores estimate engagement alignment and are not guarantees of viral reach.
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Copy & Compliance Workbench */}
        <div className="lg:col-span-8 p-5 flex flex-col justify-between gap-4">
          <div>
            {/* Context Summary Box */}
            <div className="mb-4 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-cyan-400">
                  {formatTimecode(clip.startTime)} – {formatTimecode(clip.endTime)}
                </span>
                <span>•</span>
                <span>Audience: {clip.targetAudience}</span>
                <span>•</span>
                <span>Appeal: {clip.emotionalAppeal}</span>
              </div>
              <p className="text-sm text-slate-200">{clip.summary}</p>
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Why it works:</strong> {clip.reason}
              </p>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-3 mb-4" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === tab.id
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: INDONESIAN VIRAL HOOKS */}
            {activeTab === 'hooks' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Viral Hook Recommendations (Bahasa Indonesia)</h4>
                    <p className="text-xs text-slate-400">
                      Built with Pattern Interrupt + Psychological Engagement + Curiosity Gap + Power Word
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegenerate('hooks')}
                    disabled={regeneratingField === 'hooks'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingField === 'hooks' ? 'animate-spin' : ''}`} />
                    Regenerate Hooks
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(clip.hookOptions || []).map((hook, idx) => {
                    const isSelected = (clip.selectedHookIndex || 0) === idx;
                    const editKey = `hook-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedHookIndex: idx })}
                        className={`p-3.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              Option {idx + 1}
                            </span>
                            {hook.powerWord && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-teal-300">
                                Power Word: {hook.powerWord}
                              </span>
                            )}
                            {hook.angle && <span className="text-[11px] text-slate-400">{hook.angle}</span>}
                          </div>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => startEditing(editKey, hook.text)}
                              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              title="Edit hook"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <CopyActionButton text={hook.text} size="xs" />
                          </div>
                        </div>

                        {editingField === editKey ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={2}
                              className="w-full rounded-lg bg-slate-950 border border-cyan-500/50 p-2 text-sm text-white focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingField(null)}
                                className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit('hook', idx)}
                                className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-semibold text-xs"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-white leading-relaxed">“{hook.text}”</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: HEADLINES & SUBHEADLINES */}
            {activeTab === 'headlines' && (
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Headlines (TikTok / Reels / Shorts)</h4>
                    <button
                      type="button"
                      onClick={() => handleRegenerate('headlines')}
                      disabled={regeneratingField === 'headlines'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 disabled:opacity-50 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regeneratingField === 'headlines' ? 'animate-spin' : ''}`} />
                      Regenerate Headlines
                    </button>
                  </div>
                  {(clip.headlineOptions || []).map((hl, idx) => {
                    const isSelected = (clip.selectedHeadlineIndex || 0) === idx;
                    const editKey = `headline-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedHeadlineIndex: idx })}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {editingField === editKey ? (
                          <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="flex-1 rounded-lg bg-slate-950 border border-cyan-500/50 px-2.5 py-1 text-sm text-white"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit('headline', idx)}
                              className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-white">{hl}</p>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEditing(editKey, hl)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <CopyActionButton text={hl} size="xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-sm font-semibold text-white">Subheadlines (Context & Value)</h4>
                  {(clip.subheadlineOptions || []).map((sub, idx) => {
                    const isSelected = (clip.selectedSubheadlineIndex || 0) === idx;
                    const editKey = `subheadline-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedSubheadlineIndex: idx })}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {editingField === editKey ? (
                          <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="flex-1 rounded-lg bg-slate-950 border border-cyan-500/50 px-2.5 py-1 text-sm text-white"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit('subheadline', idx)}
                              className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-200">{sub}</p>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEditing(editKey, sub)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <CopyActionButton text={sub} size="xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: CAPTIONS & CTAs */}
            {activeTab === 'captions' && (
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Social Captions (Natural Indonesian)</h4>
                    <button
                      type="button"
                      onClick={() => handleRegenerate('captions')}
                      disabled={regeneratingField === 'captions'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 disabled:opacity-50 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regeneratingField === 'captions' ? 'animate-spin' : ''}`} />
                      Regenerate Captions
                    </button>
                  </div>
                  {(clip.captionOptions || []).map((cap, idx) => {
                    const isSelected = (clip.selectedCaptionIndex || 0) === idx;
                    const editKey = `caption-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedCaptionIndex: idx })}
                        className={`p-3.5 rounded-xl border space-y-2 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-400">Caption Option {idx + 1}</span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => startEditing(editKey, cap)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <CopyActionButton text={cap} size="xs" />
                          </div>
                        </div>
                        {editingField === editKey ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              className="w-full rounded-lg bg-slate-950 border border-cyan-500/50 p-2 text-sm text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingField(null)}
                                className="text-xs text-slate-400 px-2 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit('caption', idx)}
                                className="px-3 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{cap}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-sm font-semibold text-white">Call-To-Action (CTA) Recommendations</h4>
                  {(clip.ctaOptions || []).map((cta, idx) => {
                    const isSelected = (clip.selectedCtaIndex || 0) === idx;
                    const editKey = `cta-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedCtaIndex: idx })}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {editingField === editKey ? (
                          <div className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="flex-1 rounded-lg bg-slate-950 border border-cyan-500/50 px-2.5 py-1 text-sm text-white"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit('cta', idx)}
                              className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-200">{cta}</p>
                        )}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => startEditing(editKey, cta)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <CopyActionButton text={cta} size="xs" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: HASHTAGS & MENTIONS */}
            {activeTab === 'hashtags' && (
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Hashtag Sets</h4>
                    <button
                      type="button"
                      onClick={() => handleRegenerate('hashtags')}
                      disabled={regeneratingField === 'hashtags'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-cyan-300 disabled:opacity-50 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${regeneratingField === 'hashtags' ? 'animate-spin' : ''}`} />
                      Regenerate Hashtags
                    </button>
                  </div>
                  {(clip.hashtagOptions || []).map((set, idx) => {
                    const isSelected = (clip.selectedHashtagIndex || 0) === idx;
                    const joined = (set.tags || []).join(' ');
                    const editKey = `hashtag-${idx}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onUpdateClip({ ...clip, selectedHashtagIndex: idx })}
                        className={`p-3.5 rounded-xl border space-y-2 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/20 border-cyan-500/50'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-teal-300">{set.label || `Set ${idx + 1}`}</span>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => startEditing(editKey, joined)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <CopyActionButton text={joined} size="xs" />
                          </div>
                        </div>
                        {editingField === editKey ? (
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="flex-1 rounded-lg bg-slate-950 border border-cyan-500/50 px-2.5 py-1 text-xs text-cyan-300 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit('hashtag', idx)}
                              className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {(set.tags || []).map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-2 py-0.5 rounded bg-slate-800/90 text-cyan-300 font-mono text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Tags & Mentions</h4>
                  {!clip.mentions || clip.mentions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                      No relevant tags or mentions detected.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {clip.mentions.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">{m.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  m.verified
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {m.verified ? 'Verified Source' : 'Suggested Entity'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{m.context}</p>
                          </div>
                          <CopyActionButton text={m.name} size="xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: CAMPAIGN BRIEF COMPLIANCE AUDIT */}
            {activeTab === 'compliance' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Campaign Brief Compliance Evaluation</h4>
                    <p className="text-xs text-slate-400">
                      Audited against campaign objectives, required keywords, tone, and restricted topics.
                    </p>
                  </div>
                  <span className="text-base font-mono font-bold text-cyan-400">{clip.complianceScore}/100</span>
                </div>

                {clip.failedRequirements?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/40 space-y-1.5">
                    <p className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Flagged Requirements (Manual Review Required)
                    </p>
                    <ul className="list-disc list-inside text-xs text-rose-200 space-y-1">
                      {clip.failedRequirements.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {clip.warnings?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/30 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Info className="w-4 h-4" />
                      Advisory Warnings
                    </p>
                    <ul className="list-disc list-inside text-xs text-amber-200 space-y-1">
                      {clip.warnings.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Passed Checklist Items
                  </p>
                  {clip.passedRequirements?.length > 0 ? (
                    <ul className="list-disc list-inside text-xs text-emerald-200/90 space-y-1">
                      {clip.passedRequirements.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">Standard editorial & context preservation checks passed.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * ============================================================================
 * MAIN APPLICATION COMPONENT — VIRAL CLIP STUDIO
 * ============================================================================
 */

export default function App() {
  const [activePage, setActivePage] = useState('create');

  const [toast, setToast] = useState(null);
  const notify = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const [appSettings, setAppSettings] = useState({
    defaultResolution: '720p',
    defaultDuration: 30,
    defaultQuantity: 5,
    geminiModel: DEFAULT_GEMINI_MODEL,
    renderSpeedMode: 'fast'
  });

  const [apiKey, setApiKey] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_API_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [apiStatusMessage, setApiStatusMessage] = useState('');

  const [projectName, setProjectName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeStatus, setYoutubeStatus] = useState('idle');
  const [youtubeMeta, setYoutubeMeta] = useState(null);
  const [youtubeError, setYoutubeError] = useState('');

  const [videoFile, setVideoFile] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [generatingSample, setGeneratingSample] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const [transcriptNotes, setTranscriptNotes] = useState('');

  const [briefFileMeta, setBriefFileMeta] = useState(null);
  const [briefManualText, setBriefManualText] = useState('');
  const [briefRules, setBriefRules] = useState(null);
  const [analyzingBrief, setAnalyzingBrief] = useState(false);
  const [briefError, setBriefError] = useState('');

  const [clippingStyle, setClippingStyle] = useState('atmospheric-cinematic');
  const [editTransform, setEditTransform] = useState({ ...DEFAULT_EDIT_TRANSFORM });
  const [resolution, setResolution] = useState('720p');
  const [targetDuration, setTargetDuration] = useState(30);
  const [clipQuantity, setClipQuantity] = useState(5);

  const [jobState, setJobState] = useState({
    active: false,
    failed: false,
    cancelled: false,
    error: '',
    failedStep: null,
    currentStep: 1,
    overallPercent: 0,
    statusText: 'Ready',
    momentsDetected: 0,
    clipsCompleted: 0,
    clipsTotal: 0,
    quantityNote: ''
  });
  const cancelJobRef = useRef(false);
  const pipelineSnapshotRef = useRef(null);

  const [activeProject, setActiveProject] = useState(null);
  const [activeClips, setActiveClips] = useState([]);

  const [historyProjects, setHistoryProjects] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('newest');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [deleteProjectConfirmId, setDeleteProjectConfirmId] = useState(null);
  const [storageStats, setStorageStats] = useState({ projectCount: 0, clipCount: 0, totalBytes: 0 });
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const refreshHistoryAndStats = useCallback(async () => {
    try {
      const [projects, stats] = await Promise.all([StudioDB.getAllProjects(), StudioDB.getStorageStats()]);
      setHistoryProjects(projects);
      setStorageStats(stats);
    } catch {}
  }, []);

  useEffect(() => {
    StudioDB.getSettings().then((saved) => {
      setAppSettings(saved);
      setResolution(saved.defaultResolution || '720p');
      setTargetDuration(saved.defaultDuration || 30);
      setClipQuantity(saved.defaultQuantity || 5);
    });
    refreshHistoryAndStats();
  }, [refreshHistoryAndStats]);

  const handleApiKeyChange = (val) => {
    setApiKey(val);
    setApiStatus('idle');
    setApiStatusMessage('');
    try {
      if (val.trim()) sessionStorage.setItem(SESSION_API_KEY_STORAGE, val.trim());
      else sessionStorage.removeItem(SESSION_API_KEY_STORAGE);
    } catch {}
  };

  const handleValidateApiKey = async () => {
    if (!apiKey.trim()) {
      setApiStatus('invalid');
      setApiStatusMessage('Please enter your Google Gemini API key.');
      return;
    }
    setApiStatus('validating');
    setApiStatusMessage('Verifying connection with Google Gemini API...');
    try {
      await GeminiService.validateApiKey(apiKey, appSettings.geminiModel);
      setApiStatus('valid');
      setApiStatusMessage(`Connected (${appSettings.geminiModel})`);
      notify('Gemini API key verified successfully.', 'success');
    } catch (err) {
      setApiStatus('invalid');
      setApiStatusMessage(err.message || 'Invalid Gemini API key.');
    }
  };

  const handleVerifyYouTube = async () => {
    setYoutubeError('');
    setYoutubeMeta(null);
    setYoutubeStatus('verifying');
    try {
      const meta = await verifyYouTubeMetadata(youtubeUrl);
      setYoutubeMeta(meta);
      setYoutubeStatus('verified');
      if (!projectName.trim()) {
        setProjectName(meta.title);
      }
      notify('YouTube video metadata verified.', 'success');
    } catch (err) {
      setYoutubeStatus('error');
      setYoutubeError(err.message || 'Failed to verify YouTube video.');
    }
  };

  const handleVideoFileSelect = async (file) => {
    if (!file) return;
    setVideoError('');
    const maxBytes = 1024 * 1024 * 1024;
    if (file.size > maxBytes) {
      setVideoError('Video file exceeds 1GB browser processing limit.');
      return;
    }
    try {
      const meta = await inspectVideoFile(file);
      setVideoFile(file);
      setVideoMeta(meta);
      if (!projectName.trim()) {
        setProjectName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '));
      }
      notify(`Loaded video "${file.name}" (${formatDurationBadge(meta.duration)}).`, 'success');
    } catch (err) {
      setVideoError(err.message || 'Invalid video file.');
      setVideoFile(null);
      setVideoMeta(null);
    }
  };

  const handleLoadBuiltInSample = async () => {
    setGeneratingSample(true);
    setSampleProgress(0);
    setVideoError('');
    try {
      const sampleFile = await generateBuiltInSampleVideo((pct) => setSampleProgress(pct));
      const meta = await inspectVideoFile(sampleFile);
      setVideoFile(sampleFile);
      setVideoMeta(meta);
      if (!projectName.trim()) {
        setProjectName('Alpine Creator Expedition — Sample Campaign');
      }
      if (!briefManualText.trim()) {
        setBriefManualText(
          'Target Audience: Indonesian content creators & digital entrepreneurs (20-35).\nObjective: Highlight creator mistakes, retention secrets, and actionable storytelling insights.\nTone: Authentic, insightful, high-energy Indonesian.\nRequired CTA: Ajak penonton simpan video dan tulis pengalaman mereka di kolom komentar.\nRequired Hashtags: #KreatorIndonesia #TipsKonten #Storytelling\nRestrictions: Hindari janji penghasilan instan atau klaim berlebihan.'
        );
      }
      notify('Built-in 32s landscape sample video ready for processing!', 'success');
    } catch (err) {
      setVideoError(err.message || 'Could not generate sample video.');
    } finally {
      setGeneratingSample(false);
    }
  };

  const handleBriefFileUpload = async (file) => {
    if (!file) return;
    setBriefError('');
    try {
      const parsed = await parseCampaignBriefFile(file);
      setBriefFileMeta(parsed);
      setBriefRules(null);
      notify(`Campaign brief "${file.name}" loaded.`, 'success');
    } catch (err) {
      setBriefError(err.message || 'Failed to read campaign brief file.');
    }
  };

  const handlePreviewBrief = async () => {
    const combinedText = [briefFileMeta?.textContent || '', briefManualText.trim()].filter(Boolean).join('\n\n');
    if (!combinedText && !briefFileMeta?.pdfBase64) {
      setBriefError('Upload a brief file or enter campaign instructions first.');
      return;
    }
    if (!apiKey.trim()) {
      setBriefError('Enter your Gemini API key in Section A to analyze the brief.');
      return;
    }
    setBriefError('');
    setAnalyzingBrief(true);
    try {
      const extracted = await GeminiService.summarizeCampaignBrief(
        apiKey,
        appSettings.geminiModel,
        combinedText,
        briefFileMeta?.pdfBase64 || null
      );
      setBriefRules(extracted);
      notify('Campaign brief rules extracted and ready.', 'success');
    } catch (err) {
      setBriefError(err.message || 'Failed to analyze campaign brief.');
    } finally {
      setAnalyzingBrief(false);
    }
  };

  const hasValidSource = Boolean(videoFile && videoMeta) || youtubeStatus === 'verified';
  const canGenerate = Boolean(apiKey.trim()) && apiStatus !== 'invalid' && hasValidSource && !jobState.active;

  const runGenerationPipeline = async (resumeFromStep = 1) => {
    if (!apiKey.trim()) {
      notify('Please enter your Gemini API key first.', 'error');
      return;
    }
    if (!hasValidSource) {
      notify('Please upload an authorized video file or verify a YouTube URL.', 'error');
      return;
    }

    cancelJobRef.current = false;
    setActivePage('processing');

    const snapshot =
      resumeFromStep > 1 && pipelineSnapshotRef.current
        ? pipelineSnapshotRef.current
        : {
            projectId: generateId('proj'),
            createdAt: new Date().toISOString(),
            projectTitle:
              projectName.trim() || videoMeta?.name || youtubeMeta?.title || 'Untitled Viral Clip Project',
            sourceTitle: videoMeta?.name || youtubeMeta?.title || 'Video Source',
            sourceType: videoFile ? 'uploaded_video' : 'youtube_metadata',
            sourceUrl: youtubeMeta?.canonicalUrl || '',
            youtubeVideoId: youtubeMeta?.videoId || '',
            sourceDuration: videoMeta?.duration || 180,
            keyframes: [],
            extractedBriefRules: briefRules,
            rankedClips: [],
            renderedBlobs: {},
            quantityNote: ''
          };
    pipelineSnapshotRef.current = snapshot;

    const updateProgress = (step, percent, statusText, extra = {}) => {
      setJobState((prev) => ({
        ...prev,
        active: true,
        failed: false,
        cancelled: false,
        error: '',
        currentStep: step,
        overallPercent: Math.round(percent),
        statusText,
        ...extra
      }));
    };

    const checkCancelled = () => {
      if (cancelJobRef.current) {
        throw new Error('JOB_CANCELLED');
      }
    };

    try {
      // STEP 1 — Validating Video
      if (resumeFromStep <= 1) {
        updateProgress(1, 6, 'Validating video stream, resolution, and duration...');
        await new Promise((r) => setTimeout(r, 250));
        if (videoFile && (!videoMeta || videoMeta.duration <= 0)) {
          throw new Error('Source video file failed metadata validation.');
        }
        if (apiStatus !== 'valid') {
          await GeminiService.validateApiKey(apiKey, appSettings.geminiModel);
          setApiStatus('valid');
          setApiStatusMessage(`Connected (${appSettings.geminiModel})`);
        }
        checkCancelled();
      }

      // STEP 2 — Reading Campaign Brief
      if (resumeFromStep <= 2) {
        updateProgress(2, 14, 'Parsing and structuring Campaign Brief rules...');
        const combinedBrief = [briefFileMeta?.textContent || '', briefManualText.trim()].filter(Boolean).join('\n\n');
        if (!snapshot.extractedBriefRules) {
          if (combinedBrief || briefFileMeta?.pdfBase64) {
            snapshot.extractedBriefRules = await GeminiService.summarizeCampaignBrief(
              apiKey,
              appSettings.geminiModel,
              combinedBrief,
              briefFileMeta?.pdfBase64 || null
            );
            setBriefRules(snapshot.extractedBriefRules);
          } else {
            snapshot.extractedBriefRules = {
              summary: 'General viral engagement and high retention short-form clipping.',
              targetAudience: 'General Indonesian social media viewers',
              campaignObjective: 'Maximize watch time, saves, and meaningful discussion',
              preferredTone: 'Engaging, natural Indonesian, authentic',
              requiredTopics: [],
              restrictedTopics: ['Misleading clickbait', 'Fabricated claims'],
              requiredCta: 'Encourage comments and saves',
              requiredHashtags: [],
              requiredKeywords: []
            };
          }
        }
        checkCancelled();
      }

      // STEP 3 — Analyzing Video Content
      if (resumeFromStep <= 3) {
        updateProgress(3, 25, 'Extracting visual keyframes across video timeline...');
        if (videoFile) {
          const frameCount = videoMeta.duration > 300 ? 18 : videoMeta.duration > 90 ? 14 : 10;
          snapshot.keyframes = await extractTimelineKeyframes(videoFile, videoMeta.duration, frameCount);
        } else {
          snapshot.keyframes = [];
        }
        checkCancelled();
      }

      // STEP 4 — Detecting High-Potential Moments
      if (resumeFromStep <= 4) {
        updateProgress(4, 38, 'Analyzing scenes, storytelling arcs, and brief alignment with Gemini AI...');
        const combinedBrief = [briefFileMeta?.textContent || '', briefManualText.trim()].filter(Boolean).join('\n\n');
        const combinedContext = [
          youtubeMeta ? `Verified YouTube Video: "${youtubeMeta.title}" by channel "${youtubeMeta.channelName}"` : '',
          transcriptNotes.trim()
        ]
          .filter(Boolean)
          .join('\n\n');

        const aiResult = await GeminiService.detectMomentsAndGenerateContent({
          apiKey,
          model: appSettings.geminiModel,
          videoTitle: snapshot.sourceTitle,
          videoDuration: snapshot.sourceDuration,
          keyframes: snapshot.keyframes,
          briefRules: snapshot.extractedBriefRules,
          rawBriefText: combinedBrief,
          pdfBase64: briefFileMeta?.pdfBase64 || null,
          targetDuration,
          requestedQuantity: clipQuantity,
          transcriptOrNotes: combinedContext
        });

        snapshot.rawMoments = aiResult.moments || [];
        snapshot.quantityNote = aiResult.quantityNote || '';
        updateProgress(4, 48, `Detected ${snapshot.rawMoments.length} candidate viral moments`, {
          momentsDetected: snapshot.rawMoments.length,
          quantityNote: snapshot.quantityNote
        });
        checkCancelled();
      }

      // STEP 5 & 6 — Ranking Candidate Clips & Structuring Hooks/Content
      if (resumeFromStep <= 6) {
        updateProgress(5, 54, 'Validating timestamps, removing overlaps, and ranking candidates...');
        const ranked = validateAndRankMoments(
          snapshot.rawMoments,
          snapshot.sourceDuration,
          targetDuration,
          clipQuantity
        );

        if (ranked.length === 0) {
          throw new Error(
            'AI could not identify valid non-overlapping moments matching the video duration and brief. Try adjusting your instructions or video source.'
          );
        }

        snapshot.rankedClips = ranked.map((clip, idx) => ({
          ...clip,
          id: snapshot.rankedClips[idx]?.id || generateId('clip'),
          projectId: snapshot.projectId,
          rank: idx + 1,
          style: clippingStyle,
          transform: { ...editTransform },
          resolution,
          thumbnailDataUrl: snapshot.rankedClips[idx]?.thumbnailDataUrl || youtubeMeta?.thumbnailUrl || ''
        }));

        updateProgress(6, 62, 'Finalized Indonesian hooks, headlines, captions, CTAs, and compliance checks...', {
          momentsDetected: snapshot.rankedClips.length,
          clipsTotal: snapshot.rankedClips.length
        });
        checkCancelled();
      }

      // STEP 7 — Rendering Videos in 9:16 Atmospheric Cinematic Style
      if (resumeFromStep <= 7) {
        const total = snapshot.rankedClips.length;
        for (let i = 0; i < total; i++) {
          checkCancelled();
          const clip = snapshot.rankedClips[i];
          if (snapshot.renderedBlobs[clip.id]) {
            continue;
          }

          const basePct = 62 + Math.round((i / total) * 28);
          updateProgress(
            7,
            basePct,
            videoFile
              ? `Rendering Clip #${i + 1} of ${total} (${RESOLUTIONS[resolution].tag} Atmospheric Cinematic)...`
              : `Preparing Clip #${i + 1} of ${total} timeline package...`,
            { clipsCompleted: i, clipsTotal: total }
          );

          if (videoFile) {
            const rendered = await renderAtmosphericCinematicClip({
              file: videoFile,
              startTime: clip.startTime,
              endTime: clip.endTime,
              resolutionKey: resolution,
              speedMode: appSettings.renderSpeedMode,
              transform: editTransform,
              onFrameProgress: (clipPct) => {
                const subPct = basePct + Math.round((clipPct / 100) * (28 / total));
                setJobState((prev) => ({ ...prev, overallPercent: Math.min(90, subPct) }));
              }
            });
            snapshot.renderedBlobs[clip.id] = rendered.blob;
            clip.thumbnailDataUrl = rendered.thumbnailDataUrl;
            clip.renderedMimeType = rendered.mimeType;
            clip.renderedVersion = 1;
          }
        }
        updateProgress(7, 91, 'All candidate clips processed.', {
          clipsCompleted: total,
          clipsTotal: total
        });
        checkCancelled();
      }

      // STEP 8 — Final Quality Check
      if (resumeFromStep <= 8) {
        updateProgress(8, 95, 'Running final quality and compliance verification...');
        await new Promise((r) => setTimeout(r, 200));
        checkCancelled();
      }

      // STEP 9 — Saving Project to Persistent Database
      updateProgress(9, 98, 'Saving project, clips, and media files to persistent library...');
      const topScore = snapshot.rankedClips[0]?.overallScore || 0;
      const hasFlagged = snapshot.rankedClips.some((c) => c.complianceStatus === 'REVIEW_REQUIRED');

      const projectRecord = {
        id: snapshot.projectId,
        name: snapshot.projectTitle,
        sourceTitle: snapshot.sourceTitle,
        sourceType: snapshot.sourceType,
        sourceUrl: snapshot.sourceUrl,
        youtubeVideoId: snapshot.youtubeVideoId,
        sourceDuration: snapshot.sourceDuration,
        thumbnailDataUrl: snapshot.rankedClips[0]?.thumbnailDataUrl || youtubeMeta?.thumbnailUrl || '',
        createdAt: snapshot.createdAt,
        status: hasFlagged ? 'Needs Review' : 'Completed',
        briefSummary: snapshot.extractedBriefRules?.summary || '',
        briefRules: snapshot.extractedBriefRules,
        settings: {
          style: clippingStyle,
          transform: { ...editTransform },
          resolution,
          targetDuration,
          clipQuantity
        },
        clipCount: snapshot.rankedClips.length,
        topScore,
        quantityNote: snapshot.quantityNote,
        isFavorite: false
      };

      await StudioDB.saveProjectWithClips(projectRecord, snapshot.rankedClips, snapshot.renderedBlobs);
      await refreshHistoryAndStats();

      setActiveProject(projectRecord);
      setActiveClips(snapshot.rankedClips);
      setJobState((prev) => ({
        ...prev,
        active: false,
        failed: false,
        currentStep: 9,
        overallPercent: 100,
        statusText: 'Completed!'
      }));
      notify(`Generated ${snapshot.rankedClips.length} ranked viral clips!`, 'success');
      setActivePage('results');
    } catch (err) {
      if (err.message === 'JOB_CANCELLED') {
        setJobState((prev) => ({
          ...prev,
          active: false,
          cancelled: true,
          statusText: 'Processing cancelled by user.'
        }));
        notify('Processing job cancelled.', 'info');
        return;
      }

      setJobState((prev) => ({
        ...prev,
        active: false,
        failed: true,
        failedStep: prev.currentStep,
        error: err.message || 'An error occurred during video processing.',
        statusText: `Failed at Step ${prev.currentStep}`
      }));
      notify(err.message || 'Processing interrupted.', 'error');
    }
  };

  const handleUpdateClip = async (updatedClip) => {
    await StudioDB.updateClip(updatedClip);
    setActiveClips((prev) => prev.map((c) => (c.id === updatedClip.id ? updatedClip : c)));
  };

  const handleDeleteClip = async (clipId) => {
    await StudioDB.deleteClip(clipId);
    const remaining = activeClips.filter((c) => c.id !== clipId);
    setActiveClips(remaining);
    if (activeProject) {
      const updatedProj = {
        ...activeProject,
        clipCount: remaining.length,
        topScore: remaining[0]?.overallScore || 0
      };
      await StudioDB.updateProject(updatedProj);
      setActiveProject(updatedProj);
    }
    await refreshHistoryAndStats();
    notify('Clip removed from project.', 'info');
  };

  const handleOpenHistoryProject = async (projectId) => {
    try {
      const result = await StudioDB.getProjectById(projectId);
      if (!result) {
        notify('Project could not be found in storage.', 'error');
        return;
      }
      setActiveProject(result.project);
      setActiveClips(result.clips);
      setActivePage('results');
    } catch {
      notify('Failed to load project from database.', 'error');
    }
  };

  const filteredHistory = useMemo(() => {
    let list = [...historyProjects];
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.sourceTitle || '').toLowerCase().includes(q) ||
          (p.briefSummary || '').toLowerCase().includes(q)
      );
    }
    if (historyFilter === 'favorites') {
      list = list.filter((p) => p.isFavorite);
    } else if (historyFilter === 'completed') {
      list = list.filter((p) => p.status === 'Completed');
    } else if (historyFilter === 'review') {
      list = list.filter((p) => p.status === 'Needs Review');
    }

    list.sort((a, b) => {
      if (historySort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (historySort === 'score') return (b.topScore || 0) - (a.topScore || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
  }, [historyProjects, historySearch, historyFilter, historySort]);

  const navItems = [
    { id: 'create', label: 'Create Clips', icon: Scissors },
    {
      id: 'processing',
      label: 'Processing',
      icon: Sparkles,
      badge: jobState.active ? `${jobState.overallPercent}%` : jobState.failed ? '!' : null
    },
    {
      id: 'results',
      label: 'Clip Results',
      icon: Film,
      badge: activeClips.length > 0 ? String(activeClips.length) : null
    },
    {
      id: 'history',
      label: 'Clip History',
      icon: History,
      badge: historyProjects.length > 0 ? String(historyProjects.length) : null
    },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <StudioErrorBoundary>
      <div className="min-h-screen bg-[#090B0E] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-100">
        {/* TOP NAVIGATION HEADER */}
        <header className="sticky top-0 z-40 bg-[#0C0F14]/90 backdrop-blur-md border-b border-slate-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActivePage('create')}
              className="flex items-center gap-3 text-left focus:outline-none group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-white text-sm sm:text-base">
                    VIRAL CLIP STUDIO
                  </span>
                  <span className="hidden md:inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    PRO AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  AI Viral Moment Detection & 9:16 Atmospheric Compositor
                </p>
              </div>
            </button>

            <nav aria-label="Main Studio Navigation" className="flex items-center gap-1 overflow-x-auto py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePage(item.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          active ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="hidden xl:flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                  apiStatus === 'valid'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : apiKey.trim()
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiStatus === 'valid'
                      ? 'bg-emerald-400'
                      : apiKey.trim()
                        ? 'bg-cyan-400'
                        : 'bg-slate-500'
                  }`}
                />
                {apiStatus === 'valid' ? 'Gemini Connected' : apiKey.trim() ? 'Key Entered' : 'No API Key'}
              </span>
            </div>
          </div>
        </header>

        {/* TOAST NOTIFICATION */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#161B24] border border-slate-700 shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <p className="text-xs text-slate-100 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white ml-1"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MAIN CONTENT WORKSPACE */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* ================================================================
              PAGE 1: CREATE CLIPS WORKSPACE
             ================================================================ */}
          {activePage === 'create' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-800/80">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    Create Viral Clips Workspace
                  </h1>
                  <p className="text-sm text-slate-400 mt-1">
                    Configure your AI credentials, video source, campaign brief, and 9:16 Atmospheric Cinematic rendering settings.
                  </p>
                </div>
                <div className="w-full md:w-80">
                  <label htmlFor="project-name-input" className="block text-xs font-medium text-slate-400 mb-1">
                    Project Name
                  </label>
                  <input
                    id="project-name-input"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Q4 Creator Podcast Highlights"
                    className="w-full rounded-lg bg-[#11151C] border border-slate-800 focus:border-cyan-500 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: SECTION A + SECTION B + SECTION C */}
                <div className="lg:col-span-7 space-y-6">
                  {/* SECTION A — GEMINI API KEY */}
                  <section className="bg-[#11151C] border border-slate-800/90 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-white">Section A — Gemini API Key</h2>
                          <p className="text-xs text-slate-400">Session-scoped only; never saved in clip history.</p>
                        </div>
                      </div>

                      {apiStatus === 'valid' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      )}
                      {apiStatus === 'invalid' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Invalid
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="gemini-api-key" className="block text-xs font-medium text-slate-300">
                        Gemini API Key
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input
                            id="gemini-api-key"
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => handleApiKeyChange(e.target.value)}
                            placeholder="AIzaSy..."
                            autoComplete="off"
                            className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 focus:border-cyan-500 pl-3.5 pr-10 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleValidateApiKey}
                          disabled={apiStatus === 'validating' || !apiKey.trim()}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-xs font-semibold text-white transition shrink-0"
                        >
                          {apiStatus === 'validating' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                              Validating...
                            </>
                          ) : (
                            'Validate Key'
                          )}
                        </button>
                      </div>

                      {apiStatusMessage && (
                        <p
                          className={`text-xs ${
                            apiStatus === 'valid'
                              ? 'text-emerald-400'
                              : apiStatus === 'invalid'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {apiStatusMessage}
                        </p>
                      )}
                    </div>
                  </section>

                  {/* SECTION B — VIDEO SOURCE */}
                  <section className="bg-[#11151C] border border-slate-800/90 rounded-2xl p-5 space-y-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Section B — Video Source</h2>
                        <p className="text-xs text-slate-400">
                          Verify YouTube metadata (loads thumbnail preview) & upload an authorized video file for rendering.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="youtube-url-input" className="block text-xs font-medium text-slate-300">
                        YouTube Video URL
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id="youtube-url-input"
                          type="url"
                          value={youtubeUrl}
                          onChange={(e) => {
                            setYoutubeUrl(e.target.value);
                            if (youtubeStatus !== 'idle') setYoutubeStatus('idle');
                          }}
                          placeholder="Paste your YouTube video link here..."
                          className="flex-1 rounded-lg bg-[#0A0D12] border border-slate-800 focus:border-cyan-500 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyYouTube}
                          disabled={youtubeStatus === 'verifying' || !youtubeUrl.trim()}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-xs font-semibold text-white transition shrink-0"
                        >
                          {youtubeStatus === 'verifying' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                              Verifying...
                            </>
                          ) : (
                            'Verify Video'
                          )}
                        </button>
                      </div>

                      {youtubeError && (
                        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{youtubeError}</span>
                        </div>
                      )}

                      {youtubeMeta && (
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={youtubeMeta.thumbnailUrl}
                              alt={youtubeMeta.title}
                              className="w-28 h-16 rounded-lg object-cover border border-slate-700 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Verified YouTube Source
                              </div>
                              <p className="text-sm font-semibold text-white truncate mt-0.5">{youtubeMeta.title}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Channel: {youtubeMeta.channelName} • ID: <span className="font-mono">{youtubeMeta.videoId}</span>
                              </p>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/25 text-[11px] text-amber-200/90 leading-relaxed">
                            <strong>Terms of Service Notice:</strong> To respect YouTube copyright and platform restrictions, direct binary stream downloading is disabled. Upload your authorized local video file below to render downloadable 9:16 clips, or proceed to generate the AI viral moment & copy breakdown from verified metadata/transcript.
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-300">
                          Authorized Source Video File (Required for 9:16 Video Rendering)
                        </span>
                        <button
                          type="button"
                          onClick={handleLoadBuiltInSample}
                          disabled={generatingSample}
                          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          {generatingSample ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Synthesizing Sample ({sampleProgress}%)...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Load Built-in 32s Sample Video
                            </>
                          )}
                        </button>
                      </div>

                      <label
                        htmlFor="authorized-video-upload"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f) handleVideoFileSelect(f);
                        }}
                        className="block rounded-xl border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-[#0A0D12] p-5 text-center cursor-pointer transition"
                      >
                        <input
                          id="authorized-video-upload"
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          onChange={(e) => handleVideoFileSelect(e.target.files?.[0])}
                          className="sr-only"
                        />
                        {videoMeta ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                <Film className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{videoMeta.name}</p>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">
                                  {videoMeta.width}×{videoMeta.height} • {formatDurationBadge(videoMeta.duration)} •{' '}
                                  {formatBytes(videoMeta.size)}
                                </p>
                              </div>
                            </div>
                            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-cyan-300 shrink-0">
                              Replace Video
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Upload className="w-6 h-6 text-cyan-400 mx-auto" />
                            <p className="text-sm font-medium text-slate-200">
                              Drop your authorized video file here, or <span className="text-cyan-400">browse</span>
                            </p>
                            <p className="text-xs text-slate-500">Supports MP4, MOV, WebM (up to 1GB)</p>
                          </div>
                        )}
                      </label>

                      {videoError && (
                        <p className="text-xs text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {videoError}
                        </p>
                      )}

                      <div>
                        <label htmlFor="transcript-notes" className="block text-xs font-medium text-slate-400 mb-1">
                          Optional Transcript / Key Dialogue Notes (Enhances timestamp accuracy)
                        </label>
                        <textarea
                          id="transcript-notes"
                          rows={2}
                          value={transcriptNotes}
                          onChange={(e) => setTranscriptNotes(e.target.value)}
                          placeholder="Paste transcript snippets, speaker names, or topic timestamps if available..."
                          className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 focus:border-cyan-500 p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  {/* SECTION C — CAMPAIGN BRIEF */}
                  <section className="bg-[#11151C] border border-slate-800/90 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm font-semibold text-white">
                            Section C — Campaign Brief & Clipping Instructions
                          </h2>
                          <p className="text-xs text-slate-400">
                            Primary source of truth for moment selection, tone, CTAs, and restrictions.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        htmlFor="brief-file-upload"
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-700 hover:border-teal-500/50 bg-[#0A0D12] cursor-pointer text-center transition"
                      >
                        <input
                          id="brief-file-upload"
                          type="file"
                          accept=".pdf,.docx,.txt,.md"
                          onChange={(e) => handleBriefFileUpload(e.target.files?.[0])}
                          className="sr-only"
                        />
                        <Upload className="w-5 h-5 text-teal-400 mb-1.5" />
                        <span className="text-xs font-medium text-slate-200">
                          {briefFileMeta ? briefFileMeta.fileName : 'Upload Brief (PDF, DOCX, TXT)'}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-0.5">
                          {briefFileMeta ? `${briefFileMeta.fileType} parsed` : 'Click to attach campaign document'}
                        </span>
                      </label>

                      <div className="flex flex-col">
                        <label htmlFor="manual-brief-input" className="sr-only">
                          Manual Campaign Instructions
                        </label>
                        <textarea
                          id="manual-brief-input"
                          rows={4}
                          value={briefManualText}
                          onChange={(e) => {
                            setBriefManualText(e.target.value);
                            if (briefRules) setBriefRules(null);
                          }}
                          placeholder="Enter target audience, required topics, restricted topics, required CTA, or hashtags..."
                          className="flex-1 w-full rounded-xl bg-[#0A0D12] border border-slate-800 focus:border-teal-500 p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {briefError && <p className="text-xs text-rose-400">{briefError}</p>}

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500">
                        Every clip will be audited against your campaign rules before final ranking.
                      </span>
                      <button
                        type="button"
                        onClick={handlePreviewBrief}
                        disabled={analyzingBrief || (!briefFileMeta && !briefManualText.trim())}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-xs font-medium text-teal-300 transition shrink-0"
                      >
                        {analyzingBrief ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Extracting Rules...
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-3.5 h-3.5" />
                            Preview Brief Summary
                          </>
                        )}
                      </button>
                    </div>

                    {briefRules && (
                      <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4" />
                            Extracted Campaign Brief Rules
                          </span>
                          <span className="text-[11px] text-slate-400">Active Source of Truth</span>
                        </div>
                        <p className="text-slate-200">{briefRules.summary}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div>
                            <span className="text-slate-400">Audience:</span>{' '}
                            <span className="text-slate-200">{briefRules.targetAudience}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Tone:</span>{' '}
                            <span className="text-slate-200">{briefRules.preferredTone}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Required CTA:</span>{' '}
                            <span className="text-slate-200">{briefRules.requiredCta}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Restrictions:</span>{' '}
                            <span className="text-rose-300">
                              {briefRules.restrictedTopics?.length ? briefRules.restrictedTopics.join(', ') : 'None specified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>

                {/* RIGHT COLUMN: SECTION D — VIDEO EDITING & CLIPPING SETTINGS + GENERATE CTA */}
                <div className="lg:col-span-5 space-y-6">
                  <section className="bg-[#11151C] border border-slate-800/90 rounded-2xl p-5 space-y-6 sticky top-20">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">Section D — Video Editing & Clipping</h2>
                        <p className="text-xs text-slate-400">
                          Configure 9:16 overlay scale, position, blur & clip quantity.
                        </p>
                      </div>
                    </div>

                    {/* D1. CLIPPING STYLE + YOUTUBE THUMBNAIL PREVIEW + SUMBU X / Y / ZOOM / BLUR */}
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        D1. Clipping Style & Overlay Controls
                      </label>
                      {Object.values(CLIPPING_STYLES).map((style) => {
                        const selected = clippingStyle === style.id;
                        return (
                          <div
                            key={style.id}
                            onClick={() => setClippingStyle(style.id)}
                            className={`p-3.5 rounded-xl border cursor-pointer transition ${
                              selected
                                ? 'bg-cyan-950/20 border-cyan-500/50'
                                : 'bg-[#0A0D12] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-white">{style.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                                  {style.aspectRatio}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/15 text-teal-300">
                                  Default Style
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{style.description}</p>
                            </div>
                          </div>
                        );
                      })}

                      <LiveStylePreviewEditor
                        youtubeMeta={youtubeMeta}
                        transform={editTransform}
                        onChangeTransform={setEditTransform}
                      />
                    </div>

                    {/* D2. RESOLUTION */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        D2. Output Resolution (9:16 Vertical)
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {Object.values(RESOLUTIONS).map((res) => {
                          const active = resolution === res.id;
                          return (
                            <button
                              key={res.id}
                              type="button"
                              onClick={() => setResolution(res.id)}
                              className={`p-3 rounded-xl border text-left transition ${
                                active
                                  ? 'bg-cyan-500/15 border-cyan-500 text-white'
                                  : 'bg-[#0A0D12] border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-sm font-bold">{res.id}</div>
                              <div className="text-xs font-mono text-cyan-400 mt-0.5">{res.tag}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* D3. CLIP DURATION */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        D3. Target Clip Duration
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {DURATIONS.map((dur) => {
                          const active = targetDuration === dur.value;
                          return (
                            <button
                              key={dur.value}
                              type="button"
                              onClick={() => setTargetDuration(dur.value)}
                              className={`p-3 rounded-xl border text-left transition ${
                                active
                                  ? 'bg-cyan-500/15 border-cyan-500 text-white'
                                  : 'bg-[#0A0D12] border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <div className="text-sm font-bold">{dur.label}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{dur.hint}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* D4. NUMBER OF CLIPS */}
                    <div className="space-y-2">
                      <label
                        htmlFor="clip-quantity-select"
                        className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                      >
                        D4. Number of Clips to Generate
                      </label>
                      <select
                        id="clip-quantity-select"
                        value={clipQuantity}
                        onChange={(e) =>
                          setClipQuantity(e.target.value === 'max' ? 'max' : Number(e.target.value))
                        }
                        className="w-full rounded-xl bg-[#0A0D12] border border-slate-800 focus:border-cyan-500 px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      >
                        {QUANTITIES.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        AI prioritizes non-overlapping high-retention moments over filler duplicates.
                      </p>
                    </div>

                    {/* PRE-FLIGHT CHECKLIST & PRIMARY GENERATE BUTTON */}
                    <div className="pt-4 border-t border-slate-800 space-y-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Gemini API Key</span>
                          <span className={apiKey.trim() ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                            {apiKey.trim() ? 'Ready' : 'Required'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Video Source</span>
                          <span className={hasValidSource ? 'text-emerald-400 font-medium' : 'text-amber-400'}>
                            {videoFile
                              ? `File Ready (${formatDurationBadge(videoMeta?.duration)})`
                              : youtubeStatus === 'verified'
                                ? 'YouTube Metadata Verified'
                                : 'Required'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Output Format</span>
                          <span className="font-mono text-cyan-300">
                            {RESOLUTIONS[resolution].tag} • {CLIPPING_STYLES[clippingStyle].name}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => runGenerationPipeline(1)}
                        disabled={!canGenerate}
                        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/20 disabled:shadow-none transition flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        GENERATE VIRAL CLIPS
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              PAGE 2: CINEMATIC AI PROCESSING PIPELINE
             ================================================================ */}
          {activePage === 'processing' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                      Background Rendering & AI Pipeline
                    </span>
                    <h1 className="text-xl font-bold text-white mt-1">
                      {jobState.active
                        ? 'Processing Video & Generating Viral Clips...'
                        : jobState.failed
                          ? 'Processing Interrupted'
                          : jobState.cancelled
                            ? 'Processing Cancelled'
                            : jobState.overallPercent === 100
                              ? 'Processing Complete'
                              : 'No Active Job Running'}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">{jobState.statusText}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {jobState.active && (
                      <button
                        type="button"
                        onClick={() => {
                          cancelJobRef.current = true;
                        }}
                        className="px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-xs font-semibold transition"
                      >
                        Cancel Job
                      </button>
                    )}
                    {jobState.failed && (
                      <button
                        type="button"
                        onClick={() => runGenerationPipeline(jobState.failedStep || 1)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Failed Stage (Step {jobState.failedStep || 1})
                      </button>
                    )}
                    {!jobState.active && (
                      <button
                        type="button"
                        onClick={() => setActivePage('create')}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                      >
                        Back to Workspace
                      </button>
                    )}
                  </div>
                </div>

                {/* Overall Progress Bar & Live Metrics */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">
                      Step {jobState.currentStep} of {PIPELINE_STEPS.length}
                    </span>
                    <span className="font-mono font-bold text-cyan-400">{jobState.overallPercent}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        jobState.failed ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-teal-400'
                      }`}
                      style={{ width: `${jobState.overallPercent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[#0A0D12] border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Moments Detected</span>
                      <span className="text-lg font-mono font-bold text-white">{jobState.momentsDetected}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0D12] border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Clips Completed</span>
                      <span className="text-lg font-mono font-bold text-emerald-400">{jobState.clipsCompleted}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0A0D12] border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Clips Remaining</span>
                      <span className="text-lg font-mono font-bold text-cyan-400">
                        {Math.max(0, jobState.clipsTotal - jobState.clipsCompleted)}
                      </span>
                    </div>
                  </div>
                </div>

                {jobState.error && (
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-300">Stage Error Details</p>
                      <p className="mt-1">{jobState.error}</p>
                    </div>
                  </div>
                )}

                {/* 9-Step Pipeline List */}
                <div className="space-y-2">
                  {PIPELINE_STEPS.map((step) => {
                    const isDone =
                      jobState.overallPercent === 100 ||
                      (jobState.currentStep > step.id && !jobState.failed) ||
                      (jobState.failed && step.id < jobState.failedStep);
                    const isCurrent = jobState.active && jobState.currentStep === step.id;
                    const isErrorStep = jobState.failed && jobState.failedStep === step.id;

                    return (
                      <div
                        key={step.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                          isCurrent
                            ? 'bg-cyan-950/25 border-cyan-500/50'
                            : isErrorStep
                              ? 'bg-rose-950/25 border-rose-500/40'
                              : isDone
                                ? 'bg-slate-900/40 border-slate-800/80'
                                : 'bg-[#0A0D12]/60 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                            {isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : isCurrent ? (
                              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                            ) : isErrorStep ? (
                              <XCircle className="w-5 h-5 text-rose-400" />
                            ) : (
                              <span className="text-xs font-mono text-slate-500">{step.id}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-white">
                              STEP {step.id} — {step.title}
                            </p>
                            <p className="text-xs text-slate-400">{step.desc}</p>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono uppercase text-slate-400 shrink-0">
                          {isDone ? 'Done' : isCurrent ? 'Running' : isErrorStep ? 'Failed' : 'Queued'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              PAGE 3: CLIP RESULTS STUDIO
             ================================================================ */}
          {activePage === 'results' && (
            <div className="space-y-6">
              {!activeProject || activeClips.length === 0 ? (
                <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-12 text-center space-y-4">
                  <Film className="w-10 h-10 text-slate-500 mx-auto" />
                  <h2 className="text-lg font-semibold text-white">No Clips Loaded Yet</h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Start a new project in the Create Clips workspace or reopen a saved project from your Clip History.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActivePage('create')}
                      className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs"
                    >
                      Create New Project
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePage('history')}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 font-medium text-xs border border-slate-700"
                    >
                      Open Clip History
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
                          {activeClips.length} Ranked Clips
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                          {RESOLUTIONS[activeProject.settings?.resolution || '720p']?.tag}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 text-xs">
                          Atmospheric Cinematic
                        </span>
                      </div>
                      <h1 className="text-xl font-bold text-white">{activeProject.name}</h1>
                      <p className="text-xs text-slate-400">
                        Source: {activeProject.sourceTitle} • Created{' '}
                        {new Date(activeProject.createdAt).toLocaleString()}
                      </p>
                      {activeProject.quantityNote && (
                        <p className="text-xs text-amber-300/90 pt-1">
                          <strong>AI Selection Note:</strong> {activeProject.quantityNote}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActivePage('history')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
                      >
                        <History className="w-3.5 h-3.5" />
                        Clip History
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePage('create')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                        New Project
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {activeClips.map((clip, index) => (
                      <ClipResultCard
                        key={clip.id}
                        clip={clip}
                        rank={index + 1}
                        apiKey={apiKey}
                        geminiModel={appSettings.geminiModel}
                        briefRules={activeProject.briefRules}
                        hasVideoFile={activeProject.sourceType === 'uploaded_video'}
                        sourceVideoFile={videoFile}
                        onUpdateClip={handleUpdateClip}
                        onDeleteClip={handleDeleteClip}
                        onNotify={notify}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ================================================================
              PAGE 4: PERSISTENT CLIP HISTORY LIBRARY
             ================================================================ */}
          {activePage === 'history' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white">Persistent Clip History</h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Stored locally in IndexedDB — persists across page refreshes and browser restarts.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 bg-[#11151C] border border-slate-800 px-3.5 py-2 rounded-xl">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span>
                    {storageStats.projectCount} Projects • {storageStats.clipCount} Clips •{' '}
                    <strong className="text-slate-200">{formatBytes(storageStats.totalBytes)}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6 relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search projects, video titles, or campaign briefs..."
                    className="w-full rounded-xl bg-[#11151C] border border-slate-800 focus:border-cyan-500 pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <select
                    aria-label="Filter projects"
                    value={historyFilter}
                    onChange={(e) => setHistoryFilter(e.target.value)}
                    className="w-full rounded-xl bg-[#11151C] border border-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="review">Needs Review</option>
                    <option value="favorites">Favorites Only</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <select
                    aria-label="Sort projects"
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value)}
                    className="w-full rounded-xl bg-[#11151C] border border-slate-800 px-3 py-2.5 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="newest">Sort: Newest First</option>
                    <option value="oldest">Sort: Oldest First</option>
                    <option value="score">Sort: Highest Viral Score</option>
                  </select>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
                  <h2 className="text-base font-semibold text-white">No Saved Projects Found</h2>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {historyProjects.length === 0
                      ? 'Generate your first viral clip project and it will automatically persist here.'
                      : 'No projects match your current search or filter criteria.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredHistory.map((proj) => (
                    <div
                      key={proj.id}
                      className="bg-[#11151C] border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="relative h-40 bg-[#071e26] overflow-hidden">
                          {proj.thumbnailDataUrl ? (
                            <img
                              src={proj.thumbnailDataUrl}
                              alt={proj.name}
                              className="w-full h-full object-cover opacity-90"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-[#062830]">
                              <Film className="w-8 h-8 text-cyan-400/70" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#11151C] via-transparent to-black/30" />

                          <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                proj.status === 'Completed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {proj.status}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-black/70 text-cyan-300 font-mono text-[10px]">
                              {proj.clipCount} Clips
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              const updated = { ...proj, isFavorite: !proj.isFavorite };
                              await StudioDB.updateProject(updated);
                              refreshHistoryAndStats();
                            }}
                            aria-label="Toggle favorite project"
                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-amber-300"
                          >
                            <Star className={`w-4 h-4 ${proj.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>

                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-300">
                              {proj.settings?.resolution || '720p'} • {proj.settings?.targetDuration || 30}s
                            </span>
                            <span className="font-mono font-bold text-cyan-400">Top: {proj.topScore || 0}/100</span>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <h3 className="text-base font-semibold text-white line-clamp-1">{proj.name}</h3>
                          <p className="text-xs text-slate-400 line-clamp-1">Source: {proj.sourceTitle}</p>
                          {proj.briefSummary && (
                            <p className="text-xs text-slate-400 line-clamp-2 pt-1">{proj.briefSummary}</p>
                          )}
                          <p className="text-[11px] font-mono text-slate-500 pt-1">
                            {new Date(proj.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-[#0D1016] border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenHistoryProject(proj.id)}
                          className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                        >
                          Open Project
                        </button>

                        {deleteProjectConfirmId === proj.id ? (
                          <div className="flex items-center gap-1 bg-rose-950/70 border border-rose-500/40 rounded-lg px-2 py-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await StudioDB.deleteProject(proj.id);
                                if (activeProject?.id === proj.id) {
                                  setActiveProject(null);
                                  setActiveClips([]);
                                }
                                setDeleteProjectConfirmId(null);
                                await refreshHistoryAndStats();
                                notify('Project deleted permanently.', 'info');
                              }}
                              className="text-xs font-semibold text-rose-300 hover:text-white px-1"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteProjectConfirmId(null)}
                              className="text-xs text-slate-400 px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteProjectConfirmId(proj.id)}
                            aria-label="Delete project"
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              PAGE 5: APPLICATION & STUDIO SETTINGS
             ================================================================ */}
          {activePage === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Studio & Pipeline Settings</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Configure default rendering parameters, Gemini model selection, and persistent local storage.
                </p>
              </div>

              <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Video Output & AI Defaults</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Default Output Resolution</label>
                    <select
                      value={appSettings.defaultResolution}
                      onChange={(e) =>
                        setAppSettings({ ...appSettings, defaultResolution: e.target.value })
                      }
                      className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value="720p">720p (720 × 1280)</option>
                      <option value="1080p">1080p (1080 × 1920)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Default Clip Duration</label>
                    <select
                      value={appSettings.defaultDuration}
                      onChange={(e) =>
                        setAppSettings({ ...appSettings, defaultDuration: Number(e.target.value) })
                      }
                      className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Default Clip Quantity</label>
                    <select
                      value={appSettings.defaultQuantity}
                      onChange={(e) =>
                        setAppSettings({
                          ...appSettings,
                          defaultQuantity: e.target.value === 'max' ? 'max' : Number(e.target.value)
                        })
                      }
                      className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value={5}>5 clips</option>
                      <option value={8}>8 clips</option>
                      <option value={10}>10 clips</option>
                      <option value={15}>15 clips</option>
                      <option value="max">Maximum available clips</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Render Encoding Speed</label>
                    <select
                      value={appSettings.renderSpeedMode}
                      onChange={(e) =>
                        setAppSettings({ ...appSettings, renderSpeedMode: e.target.value })
                      }
                      className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 px-3 py-2 text-sm text-white"
                    >
                      <option value="fast">Balanced (1.5x Realtime)</option>
                      <option value="realtime">Studio Master (1x Realtime)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Configured Google Gemini Model</label>
                  <input
                    type="text"
                    value={appSettings.geminiModel}
                    onChange={(e) => setAppSettings({ ...appSettings, geminiModel: e.target.value })}
                    className="w-full rounded-lg bg-[#0A0D12] border border-slate-800 px-3 py-2 text-sm font-mono text-cyan-300"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recommended supported model: <code className="text-slate-300">gemini-3-flash-preview</code>
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await StudioDB.saveSettings(appSettings);
                      setResolution(appSettings.defaultResolution);
                      setTargetDuration(appSettings.defaultDuration);
                      setClipQuantity(appSettings.defaultQuantity);
                      notify('Studio defaults saved.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Settings
                  </button>
                </div>
              </div>

              <div className="bg-[#11151C] border border-slate-800 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">API Security & Persistent Storage</h2>

                <div className="p-3.5 rounded-xl bg-[#0A0D12] border border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-white">Session Gemini API Key</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {apiKey.trim()
                        ? `Active in current browser session (${apiStatus === 'valid' ? 'Verified' : 'Unverified'})`
                        : 'No API key stored in session'}
                    </p>
                  </div>
                  {apiKey.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        handleApiKeyChange('');
                        notify('Session API key cleared.', 'info');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
                    >
                      Clear Session Key
                    </button>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-[#0A0D12] border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-white">IndexedDB Media & History Storage</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {storageStats.projectCount} Projects • {storageStats.clipCount} Clips •{' '}
                      {formatBytes(storageStats.totalBytes)} used
                    </p>
                  </div>

                  {!confirmClearAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      disabled={storageStats.projectCount === 0}
                      className="px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 border border-rose-500/35 text-xs font-semibold text-rose-300"
                    >
                      Clear All History
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await StudioDB.clearAllData();
                          setActiveProject(null);
                          setActiveClips([]);
                          setConfirmClearAll(false);
                          await refreshHistoryAndStats();
                          notify('All saved projects and video blobs deleted.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                      >
                        Yes, Delete Everything
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </StudioErrorBoundary>
  );
}
