// AELA Logo 组件 - 内联 SVG 版本（透明背景，适配暗色/亮色主题）
// 紫色小猫头像，基于 aela-logo.png 的设计重绘

interface AelaLogoProps {
  size?: number
  className?: string
}

export const AelaLogo = ({ size = 48, className = '' }: AelaLogoProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`select-none ${className}`}
  >
    {/* 耳朵 - 左 */}
    <path d="M22 28 L14 6 L38 20 Z" fill="#9f7aea" />
    <path d="M23 26 L17 10 L35 21 Z" fill="#fbb6ce" />
    {/* 耳朵 - 右 */}
    <path d="M78 28 L86 6 L62 20 Z" fill="#9f7aea" />
    <path d="M77 26 L83 10 L65 21 Z" fill="#fbb6ce" />

    {/* 头部外圈 */}
    <ellipse cx="50" cy="52" rx="34" ry="30" fill="#9f7aea" />
    {/* 头部浅色内圈 */}
    <ellipse cx="50" cy="56" rx="26" ry="22" fill="#c4b5fd" />

    {/* 头顶花纹 */}
    <path d="M50 24 L44 34 L56 34 Z" fill="#7c3aed" />

    {/* 眼睛 - 左 */}
    <ellipse cx="38" cy="50" rx="7" ry="8" fill="#fff" />
    <ellipse cx="38.5" cy="50.5" rx="4.5" ry="5.5" fill="#4c1d95" />
    <ellipse cx="38.5" cy="50.5" rx="2.5" ry="3" fill="#1e1b4b" />
    <circle cx="40" cy="48" r="1.5" fill="#fff" />
    {/* 眼睛 - 右 */}
    <ellipse cx="62" cy="50" rx="7" ry="8" fill="#fff" />
    <ellipse cx="62.5" cy="50.5" rx="4.5" ry="5.5" fill="#4c1d95" />
    <ellipse cx="62.5" cy="50.5" rx="2.5" ry="3" fill="#1e1b4b" />
    <circle cx="64" cy="48" r="1.5" fill="#fff" />

    {/* 腮红 */}
    <ellipse cx="28" cy="60" rx="5.5" ry="3.5" fill="#f9a8d4" opacity="0.35" />
    <ellipse cx="72" cy="60" rx="5.5" ry="3.5" fill="#f9a8d4" opacity="0.35" />

    {/* 鼻子 */}
    <path
      d="M50 58 C47 57 46.5 61 50 61.5 C53.5 61 53 57 50 58 Z"
      fill="#f472b6"
    />
    <circle cx="49.5" cy="59.5" r="0.8" fill="#fff" opacity="0.3" />

    {/* 嘴 (ω 形) */}
    <path
      d="M50 61.5 L50 64 M50 64 Q46 64 43 67 M50 64 Q54 64 57 67"
      stroke="#6d28d9"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />

    {/* 胡须 - 左 */}
    <path d="M30 58 L12 55" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    <path d="M30 61 L12 62" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    <path d="M30 64 L12 70" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    {/* 胡须 - 右 */}
    <path d="M70 58 L88 55" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    <path d="M70 61 L88 62" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    <path d="M70 64 L88 70" stroke="#6d28d9" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
  </svg>
)

export default AelaLogo
