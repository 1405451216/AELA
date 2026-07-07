// 模式图标 - inline SVG 版本
// 这些图标是图片的 SVG 重绘版，可在 React 中直接引用

// 办公模式图标：书本 + "Work" 文字
export const WorkIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size * 2.2} height={size} viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 书本图标 */}
    <g transform="translate(0, 8)">
      <path
        d="M2 4C2 2.9 2.9 2 4 2H17C18.1 2 19 2.9 19 4V26C19 27.1 18.1 28 17 28H4C2.9 28 2 27.1 2 26V4Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M19 4C19 2.9 19.9 2 21 2H34C35.1 2 36 2.9 36 4V26C36 27.1 35.1 28 34 28H21C19.9 28 19 27.1 19 26V4Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
      />
      {/* 书脊分隔线 */}
      <line x1="19" y1="2" x2="19" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </g>
    {/* Work 文字 */}
    <text
      x="46"
      y="30"
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="20"
      fontWeight="500"
      fill="currentColor"
    >
      Work
    </text>
  </svg>
)

// 代码模式图标：</> + "Code" 文字
export const CodeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size * 2.2} height={size} viewBox="0 0 100 45" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* </> 图标 */}
    <g transform="translate(8, 10)" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9,4 2,12 9,20" />
      <polyline points="18,4 25,12 18,20" />
      <line x1="15" y1="2" x2="11" y2="22" />
    </g>
    {/* Code 文字 */}
    <text
      x="44"
      y="30"
      fontFamily="Inter, system-ui, sans-serif"
      fontSize="20"
      fontWeight="500"
      fill="currentColor"
    >
      Code
    </text>
  </svg>
)
