import assert from 'node:assert/strict'
import test from 'node:test'
import { importTypeScript } from './load-typescript.mjs'

const { compareVersions, pickApkRelease } = await importTypeScript('../src/shared/app-version.ts')

const apk = (version) => ({
  tag_name: `v${version}`,
  draft: false,
  assets: [{ name: `Openfy-${version}-android.apk`, browser_download_url: `https://github.com/x/${version}.apk` }]
})

test('compareVersions ordena beta, número da beta e versão estável', () => {
  assert.equal(compareVersions('0.2.0-beta.5', '0.2.0-beta.5'), 0)
  assert.ok(compareVersions('0.2.0-beta.5', '0.2.0-beta.4') > 0)
  assert.ok(compareVersions('0.2.0-beta.10', '0.2.0-beta.9') > 0)
  assert.ok(compareVersions('0.2.0', '0.2.0-beta.9') > 0)
  assert.ok(compareVersions('0.3.0', '0.2.9') > 0)
})

test('pickApkRelease escolhe o APK mais novo que o instalado', () => {
  const releases = [apk('0.2.0-beta.4'), apk('0.2.0-beta.6'), apk('0.2.0-beta.5')]
  assert.equal(pickApkRelease(releases, '0.2.0-beta.5')?.version, '0.2.0-beta.6')
  assert.equal(pickApkRelease(releases, '0.2.0-beta.6'), null)
})

test('pickApkRelease ignora rascunhos, releases sem APK e links inseguros', () => {
  const releases = [
    { ...apk('0.2.0-beta.9'), draft: true },
    { tag_name: 'v0.2.0-beta.8', assets: [{ name: 'Openfy.tar.gz', browser_download_url: 'https://github.com/x/a.tar.gz' }] },
    { tag_name: 'v0.2.0-beta.7', assets: [{ name: 'openfy.apk', browser_download_url: 'http://insecure/apk' }] },
    apk('0.2.0-beta.6')
  ]
  assert.equal(pickApkRelease(releases, '0.2.0-beta.5')?.version, '0.2.0-beta.6')
  assert.equal(pickApkRelease('lixo', '0.2.0-beta.5'), null)
})
