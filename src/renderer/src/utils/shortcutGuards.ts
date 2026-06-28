const MONACO_SELECTOR = [
  '.monaco-editor',
  '.monaco-menu-container',
  '.suggest-widget',
  '.monaco-hover',
  '.monaco-list',
  '.monaco-inputbox'
].join(', ')

const APP_BLOCKING_OVERLAY_SELECTOR = ['[role="dialog"]', '.ant-drawer'].join(', ')

const CHAT_INTERACTIVE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="button"]',
  '[role="textbox"]',
  '.ant-btn',
  '.ant-dropdown',
  '.ant-menu',
  '.ant-picker',
  '.ant-picker-dropdown',
  '.ant-popover',
  '.ant-select',
  '.ant-select-dropdown',
  '.search-bar'
].join(', ')

function getTargetElement(event?: KeyboardEvent | null): HTMLElement | null {
  return event?.target instanceof HTMLElement ? event.target : null
}

function getActiveElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null
}

function getContextElement(event?: KeyboardEvent | null): HTMLElement | null {
  return getTargetElement(event) ?? getActiveElement()
}

export function isMonacoFocused(event?: KeyboardEvent | null): boolean {
  const contextElement = getContextElement(event)
  return Boolean(contextElement?.closest(MONACO_SELECTOR))
}

export function isBlockingOverlayActive(event?: KeyboardEvent | null): boolean {
  const contextElement = getContextElement(event)
  return (
    Boolean(contextElement?.closest(APP_BLOCKING_OVERLAY_SELECTOR)) ||
    document.querySelector('[data-shortcut-blocking-overlay="true"]') !== null
  )
}

export function shouldIgnoreAppShortcuts(event?: KeyboardEvent | null): boolean {
  return isMonacoFocused(event) || isBlockingOverlayActive(event)
}

export function shouldIgnoreChatReadingShortcuts(event?: KeyboardEvent | null): boolean {
  const contextElement = getContextElement(event)
  return (
    shouldIgnoreAppShortcuts(event) || Boolean(contextElement?.closest(CHAT_INTERACTIVE_SELECTOR))
  )
}
