import sharp from "sharp";

export async function addWatermark(inputBuffer: Buffer, label = "PromptGallery.ai") {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const fontSize = Math.max(18, Math.floor(width * 0.018));
  const padding = Math.max(16, Math.floor(width * 0.015));
  const boxWidth = Math.floor(width * 0.3);
  const boxHeight = Math.floor(fontSize * 2.2);
  const x = width - boxWidth - padding;
  const y = height - boxHeight - padding;

  const svg = `
  <svg width="${width}" height="${height}">
    <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="10" ry="10" fill="rgba(0,0,0,0.45)" />
    <text x="${x + boxWidth / 2}" y="${y + boxHeight / 2 + fontSize / 3}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" font-weight="600">
      ${label}
    </text>
  </svg>
  `;

  return sharp(inputBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

