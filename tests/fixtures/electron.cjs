const { app, BrowserWindow } = require('electron')
const { basename, dirname, resolve } = require('node:path')
const { tmpdir } = require('node:os')

const data = resolve(process.env.POINTER_TEST_DATA || '')
if (dirname(data) !== resolve(tmpdir()) || !basename(data).startsWith('pointer-test-')) {
  throw new Error('Electron 测试必须提供独立临时数据目录')
}
app.setPath('userData', data)
app.commandLine.appendSwitch('disable-gpu')
app.on('browser-window-created', (_event, window) => {
  window.webContents.setBackgroundThrottling(false)
})
// 后台执行真实窗口，不抢占用户桌面；生产窗口配置及 preload 保持原样。
BrowserWindow.prototype.show = function () {
  /* 后台测试保持窗口隐藏 */
}
BrowserWindow.prototype.showInactive = function () {
  /* 后台测试保持窗口隐藏 */
}
require('../../out/main/index.js')
/* eslint @typescript-eslint/no-require-imports: "off" */
