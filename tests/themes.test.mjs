import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { builtInThemes, themeBackgroundPattern, themeColorKeys, themeEffects, validateTheme } =
  await importTypeScript('../src/renderer/src/theme-model.ts')

test('legacy themes remain valid and resolve to neutral optional effects', () => {
  const legacy = {
    id: 'legacy-theme',
    name: 'Legacy',
    author: 'Openfy',
    description: 'Tema antigo',
    colors: Object.fromEntries(themeColorKeys.map(key => [key, '#123456'])),
    radius: 12,
    density: 'comfortable'
  }

  assert.equal(validateTheme(legacy), true)
  assert.equal(themeEffects(legacy).glass.enabled, false)
  assert.equal(themeEffects(legacy).neon.enabled, false)
  assert.equal(themeEffects(legacy).background.mode, 'solid')
  assert.equal(themeEffects(legacy).animations.transitions, true)
})

test('new built-in theme presets are valid and demonstrate separate visual effects', () => {
  assert.deepEqual(builtInThemes.slice(-3).map(theme => theme.name), [
    'Openfy Glass',
    'Openfy Neon Pulse',
    'Openfy Ambient'
  ])
  assert.equal(builtInThemes.find(theme => theme.id === 'openfy-glass').glass.enabled, true)
  assert.equal(builtInThemes.find(theme => theme.id === 'openfy-neon-pulse').neon.enabled, true)
  assert.equal(builtInThemes.find(theme => theme.id === 'openfy-ambient').background.mode, 'album')
  assert.ok(builtInThemes.every(validateTheme))
})

test('theme validation rejects unsafe values, unexpected fields, and invalid effect ranges', () => {
  const valid = structuredClone(builtInThemes[0])
  assert.equal(validateTheme(valid), true)

  assert.equal(validateTheme({ ...valid, unexpected: 'value' }), false)
  assert.equal(validateTheme({ ...valid, colors: { ...valid.colors, accent: 'url(javascript:alert(1))' } }), false)
  assert.equal(validateTheme({ ...valid, radius: 80 }), false)
  assert.equal(validateTheme({ ...valid, glass: { ...valid.glass, blur: 41 } }), false)
  assert.equal(validateTheme({ ...valid, neon: { ...valid.neon, elements: ['progress', 'unknown'] } }), false)
  assert.equal(validateTheme({ ...valid, background: { ...valid.background, image: 'https://example.test/image.png' } }), false)
  assert.equal(validateTheme({ ...valid, animations: { ...valid.animations, pulse: 'yes' } }), false)
})

test('custom background references only match the private content-addressed image scheme', () => {
  const safe = `openfy-theme://background/${'a'.repeat(64)}.webp`
  assert.equal(themeBackgroundPattern.test(safe), true)
  assert.equal(themeBackgroundPattern.test('file:///C:/Users/user/image.png'), false)
  assert.equal(themeBackgroundPattern.test('https://example.test/image.png'), false)
  assert.equal(themeBackgroundPattern.test(`openfy-theme://background/${'a'.repeat(63)}.png`), false)
})
