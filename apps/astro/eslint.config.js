import antfu from '@antfu/eslint-config'

/** @type {import('eslint').Linter.Config[]} */
const config = antfu({
  astro: true,
})

export default config
