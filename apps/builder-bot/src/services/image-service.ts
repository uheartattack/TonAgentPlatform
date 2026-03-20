import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const TMP_DIR = '/tmp/agent-images';

// Ensure tmp dir exists
async function ensureTmpDir() {
  await fs.mkdir(TMP_DIR, { recursive: true });
}

function tmpPath(ext = 'png'): string {
  return path.join(TMP_DIR, `${crypto.randomBytes(8).toString('hex')}.${ext}`);
}

// Download image from URL to tmp file
export async function downloadImage(url: string): Promise<string> {
  await ensureTmpDir();
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const ext = url.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[1] || 'png';
  const outPath = tmpPath(ext);
  await fs.writeFile(outPath, buf);
  return outPath;
}

// Resize image
export async function resizeImage(inputPath: string, width?: number, height?: number): Promise<string> {
  await ensureTmpDir();
  const outPath = tmpPath('png');
  await sharp(inputPath)
    .resize(width || undefined, height || undefined, { fit: 'inside', withoutEnlargement: true })
    .toFile(outPath);
  return outPath;
}

// Crop image
export async function cropImage(inputPath: string, left: number, top: number, width: number, height: number): Promise<string> {
  await ensureTmpDir();
  const outPath = tmpPath('png');
  await sharp(inputPath)
    .extract({ left, top, width, height })
    .toFile(outPath);
  return outPath;
}

// Validate color parameter for SVG safety
function validateSvgColor(color: string): string {
  if (!/^[a-zA-Z0-9#(),.\s]+$/.test(color)) {
    throw new Error('Invalid color value');
  }
  return color;
}

// Add text overlay (watermark) using SVG overlay
export async function addTextOverlay(inputPath: string, text: string, position: 'top' | 'bottom' | 'center' = 'bottom', fontSize: number = 32, color: string = 'white'): Promise<string> {
  await ensureTmpDir();
  validateSvgColor(color);
  const meta = await sharp(inputPath).metadata();
  const w = meta.width || 800;
  const h = meta.height || 600;

  const yPos = position === 'top' ? fontSize + 10 : position === 'center' ? h / 2 : h - 20;

  // Escape XML special chars (including quotes)
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const svgOverlay = Buffer.from(`
    <svg width="${w}" height="${h}">
      <style>
        .text { fill: ${color}; font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; }
      </style>
      <text x="50%" y="${yPos}" text-anchor="middle" class="text"
            stroke="black" stroke-width="2" paint-order="stroke">${safeText}</text>
    </svg>
  `);

  const outPath = tmpPath('png');
  await sharp(inputPath)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .toFile(outPath);
  return outPath;
}

// Convert format
export async function convertImage(inputPath: string, format: 'png' | 'jpg' | 'webp' | 'gif'): Promise<string> {
  await ensureTmpDir();
  const outPath = tmpPath(format);
  let pipeline = sharp(inputPath);
  if (format === 'jpg') pipeline = pipeline.jpeg({ quality: 85 });
  else if (format === 'png') pipeline = pipeline.png();
  else if (format === 'webp') pipeline = pipeline.webp({ quality: 85 });
  else if (format === 'gif') pipeline = pipeline.gif();
  await pipeline.toFile(outPath);
  return outPath;
}

// Get image info
export async function getImageInfo(inputPath: string): Promise<{ width: number; height: number; format: string; size: number; channels: number }> {
  const meta = await sharp(inputPath).metadata();
  const stat = await fs.stat(inputPath);
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || 'unknown',
    size: stat.size,
    channels: meta.channels || 0,
  };
}

// Apply filters
export async function applyFilter(inputPath: string, filter: 'blur' | 'sharpen' | 'grayscale' | 'negate' | 'flip' | 'flop' | 'rotate90' | 'rotate180'): Promise<string> {
  await ensureTmpDir();
  const outPath = tmpPath('png');
  let pipeline = sharp(inputPath);
  switch (filter) {
    case 'blur': pipeline = pipeline.blur(5); break;
    case 'sharpen': pipeline = pipeline.sharpen(); break;
    case 'grayscale': pipeline = pipeline.grayscale(); break;
    case 'negate': pipeline = pipeline.negate(); break;
    case 'flip': pipeline = pipeline.flip(); break;
    case 'flop': pipeline = pipeline.flop(); break;
    case 'rotate90': pipeline = pipeline.rotate(90); break;
    case 'rotate180': pipeline = pipeline.rotate(180); break;
  }
  await pipeline.toFile(outPath);
  return outPath;
}

// Composite: overlay one image on another
export async function compositeImages(basePath: string, overlayPath: string, x: number = 0, y: number = 0, opacity: number = 1): Promise<string> {
  await ensureTmpDir();
  const outPath = tmpPath('png');

  let overlay = sharp(overlayPath);
  if (opacity < 1) {
    // Apply opacity by adding alpha channel
    overlay = overlay.ensureAlpha(opacity);
  }
  const overlayBuf = await overlay.toBuffer();

  await sharp(basePath)
    .composite([{ input: overlayBuf, left: x, top: y }])
    .toFile(outPath);
  return outPath;
}

// Create solid color image with text (for memes, banners, etc.)
export async function createTextImage(text: string, width: number = 800, height: number = 400, bgColor: string = '#1a1a2e', textColor: string = 'white', fontSize: number = 48): Promise<string> {
  await ensureTmpDir();
  validateSvgColor(bgColor);
  validateSvgColor(textColor);
  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  // Split text into lines
  const maxCharsPerLine = Math.floor(width / (fontSize * 0.6));
  const words = safeText.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += ' ' + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const lineHeight = fontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (height - totalTextHeight) / 2 + fontSize;

  const textElements = lines.map((line, i) =>
    `<text x="50%" y="${startY + i * lineHeight}" text-anchor="middle" class="text">${line}</text>`
  ).join('\n');

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}">
      <style>
        .text { fill: ${textColor}; font-size: ${fontSize}px; font-family: Arial, sans-serif; font-weight: bold; }
      </style>
      ${textElements}
    </svg>
  `);

  const outPath = tmpPath('png');
  await sharp({ create: { width, height, channels: 4, background: bgColor } })
    .composite([{ input: svg }])
    .png()
    .toFile(outPath);
  return outPath;
}

// Cleanup old tmp files (call periodically)
export async function cleanupTmpImages(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
  try {
    const files = await fs.readdir(TMP_DIR);
    let removed = 0;
    for (const f of files) {
      const fp = path.join(TMP_DIR, f);
      const stat = await fs.stat(fp);
      if (Date.now() - stat.mtimeMs > maxAgeMs) {
        await fs.unlink(fp);
        removed++;
      }
    }
    return removed;
  } catch { return 0; }
}
