// AELA 首页 Hero Logo 组件 - 带呼吸发光 + 微浮动动画
// 使用内联 SVG（透明背景，适配暗色/亮色主题）
import { AelaLogo } from './AelaLogo'

interface AelaHeroLogoProps {
  size?: number
  className?: string
}

export const AelaHeroLogo = ({ size = 120, className = '' }: AelaHeroLogoProps) => (
  <div className={`aela-hero-logo ${className}`}>
    {/* 外层光晕 */}
    <div className="aela-hero-logo__glow" />
    {/* 图标本体 */}
    <AelaLogo size={size} className="aela-hero-logo__img" />
  </div>
)

export default AelaHeroLogo
