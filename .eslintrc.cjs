/**
 * ESLint 配置 — AELA 项目
 *
 * 覆盖: TypeScript / React / Electron (main/preload/renderer)
 * 规则: 严格模式 + 最佳实践，但允许合理的 any 类型（与 SDK 交互时）
 */

module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  ignorePatterns: [
    'out/**',
    'release/**',
    'node_modules/**',
    'dist/**',
    '*.config.js',
    '*.config.cjs',
    'scripts/**',
  ],
  rules: {
    // ===== TypeScript =====
    '@typescript-eslint/no-explicit-any': 'off',        // SDK 交互需要 any
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',   // 非空断言是 TS 合法特性，项目大量使用
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      { prefer: 'type-imports' },
    ],

    // ===== React =====
    'react/react-in-jsx-scope': 'off',                  // React 17+ 不需要
    'react/prop-types': 'off',                          // 使用 TypeScript 类型
    'react/display-name': 'off',
    'react/jsx-key': 'error',
    'react/jsx-no-duplicate-props': 'error',
    'react/jsx-no-undef': 'error',
    'react/no-unknown-property': 'warn',

    // ===== React Hooks =====
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // ===== 通用 =====
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-unused-vars': 'off',                            // 交给 @typescript-eslint
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'no-throw-literal': 'error',
  },
  overrides: [
    // ===== Main / Preload 进程 =====
    {
      files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
      env: { node: true, browser: false },
      rules: {
        'no-console': 'off',  // 主进程需要 console 日志
      },
    },
    // ===== Renderer 进程 =====
    {
      files: ['src/renderer/**/*.tsx', 'src/renderer/**/*.ts'],
      env: { browser: true, node: false },
    },
    // ===== Shared =====
    {
      files: ['src/shared/**/*.ts'],
      env: { node: true, browser: true },
    },
    // ===== 测试文件 =====
    {
      files: ['test/**/*.ts'],
      env: { node: true },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}
