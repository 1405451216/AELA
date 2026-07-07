/**
 * 图标生成脚本 — 将紫色小猫 SVG 设计渲染为 PNG + ICO
 * 用法: node scripts/generate-icon.mjs
 * 依赖: sharp (临时安装)
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ===== 紫色小猫图标 SVG（256×256，带圆角背景，适配桌面图标） =====
const iconSVG = `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- 圆角背景 -->
  <rect width="256" height="256" rx="56" fill="url(#bg)"/>
  <!-- 顶部紫色光晕 -->
  <rect width="256" height="128" rx="56" fill="url(#glow)"/>

  <!-- 小猫头像（缩放至 256 画布，居中） -->
  <g transform="translate(28, 28) scale(2)">
    <!-- 耳朵 - 左 -->
    <path d="M22 28 L14 6 L38 20 Z" fill="#9f7aea"/>
    <path d="M23 26 L17 10 L35 21 Z" fill="#fbb6ce"/>
    <!-- 耳朵 - 右 -->
    <path d="M78 28 L86 6 L62 20 Z" fill="#9f7aea"/>
    <path d="M77 26 L83 10 L65 21 Z" fill="#fbb6ce"/>

    <!-- 头部外圈 -->
    <ellipse cx="50" cy="52" rx="34" ry="30" fill="#9f7aea"/>
    <!-- 头部浅色内圈 -->
    <ellipse cx="50" cy="56" rx="26" ry="22" fill="#c4b5fd"/>
    <!-- 头顶花纹 -->
    <path d="M50 24 L44 34 L56 34 Z" fill="#7c3aed"/>

    <!-- 眼睛 - 左 -->
    <ellipse cx="38" cy="50" rx="7" ry="8" fill="#fff"/>
    <ellipse cx="38.5" cy="50.5" rx="4.5" ry="5.5" fill="#4c1d95"/>
    <ellipse cx="38.5" cy="50.5" rx="2.5" ry="3" fill="#1e1b4b"/>
    <circle cx="40" cy="48" r="1.5" fill="#fff"/>
    <!-- 眼睛 - 右 -->
    <ellipse cx="62" cy="50" rx="7" ry="8" fill="#fff"/>
    <ellipse cx="62.5" cy="50.5" rx="4.5" ry="5.5" fill="#4c1d95"/>
    <ellipse cx="62.5" cy="50.5" rx="2.5" ry="3" fill="#1e1b4b"/>
    <circle cx="64" cy="48" r="1.5" fill="#fff"/>

    <!-- 腮红 -->
    <ellipse cx="28" cy="60" rx="5.5" ry="3.5" fill="#f9a8d4" opacity="0.35"/>
    <ellipse cx="72" cy="60" rx="5.5" ry="3.5" fill="#f9a8d4" opacity="0.35"/>

    <!-- 鼻子 -->
    <path d="M50 58 C47 57 46.5 61 50 61.5 C53.5 61 53 57 50 58 Z" fill="#f472b6"/>
    <circle cx="49.5" cy="59.5" r="0.8" fill="#fff" opacity="0.3"/>

    <!-- 嘴 (ω 形) -->
    <path d="M50 61.5 L50 64 M50 64 Q46 64 43 67 M50 64 Q54 64 57 67"
          stroke="#6d28d9" stroke-width="1.5" stroke-linecap="round" fill="none"/>

    <!-- 胡须 - 左 -->
    <path d="M30 58 L12 55" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
    <path d="M30 61 L12 62" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
    <path d="M30 64 L12 70" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
    <!-- 胡须 - 右 -->
    <path d="M70 58 L88 55" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
    <path d="M70 61 L88 62" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
    <path d="M70 64 L88 70" stroke="#6d28d9" stroke-width="0.8" stroke-linecap="round" opacity="0.5"/>
  </g>
</svg>`

/**
 * 手工构建 ICO 文件（PNG 嵌入格式，Windows Vista+ 兼容）
 * ICO 结构: ICONDIR(6B) + ICONDIRENTRY×N(16B) + PNG data×N
 */
function buildICO(images) {
  const count = images.length
  const headerSize = 6
  const dirEntrySize = 16
  let offset = headerSize + dirEntrySize * count

  // ICONDIR
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // type = ICO
  header.writeUInt16LE(count, 4)  // image count

  const dirEntries = []
  for (const { size, data } of images) {
    const entry = Buffer.alloc(dirEntrySize)
    // 256 用 0 表示
    entry.writeUInt8(size >= 256 ? 0 : size, 0)  // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1)  // height
    entry.writeUInt8(0, 2)                        // color count (0 = no palette)
    entry.writeUInt8(0, 3)                        // reserved
    entry.writeUInt16LE(1, 4)                     // color planes
    entry.writeUInt16LE(32, 6)                    // bits per pixel
    entry.writeUInt32LE(data.length, 8)           // image size
    entry.writeUInt32LE(offset, 12)               // image offset
    dirEntries.push(entry)
    offset += data.length
  }

  return Buffer.concat([header, ...dirEntries, ...images.map(i => i.data)])
}

async function main() {
  const sharp = (await import('sharp')).default
  const svgBuffer = Buffer.from(iconSVG)
  const outDir = join(process.cwd(), 'resources')

  // ICO 需要的尺寸
  const icoSizes = [256, 128, 64, 48, 32, 16]
  const images = []

  for (const size of icoSizes) {
    const png = await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    images.push({ size, data: png })
    console.log(`  ✓ PNG ${size}×${size} (${png.length} bytes)`)
  }

  // 生成 ICO
  const ico = buildICO(images)
  const icoPath = join(outDir, 'icon.ico')
  writeFileSync(icoPath, ico)
  console.log(`✅ ICO saved: ${icoPath} (${ico.length} bytes)`)

  // 生成 PNG (256×256，用于通用场景)
  const png256 = await sharp(svgBuffer).resize(256, 256).png().toBuffer()
  const pngPath = join(outDir, 'icon.png')
  writeFileSync(pngPath, png256)
  console.log(`✅ PNG saved: ${pngPath} (${png256.length} bytes)`)

  console.log('\nDone! 图标已更新。')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
