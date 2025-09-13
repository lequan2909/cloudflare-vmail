import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  typescript: true,
  react: true,
  ignores: [
    '**/dist/**',
    '**/node_modules/**',
    '**/.astro/**',
    '**/.wrangler/**',
    '**/drizzle/**'
  ],
  rules: {
    // 自定义规则
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn'
  }
})