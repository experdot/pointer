import { isMonacoFocused } from './shortcutGuards'

function getSelectedTextFromInput(activeElement: Element | null): string | null {
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const selectionStart = activeElement.selectionStart
    const selectionEnd = activeElement.selectionEnd

    if (selectionStart !== null && selectionEnd !== null && selectionEnd > selectionStart) {
      return activeElement.value.slice(selectionStart, selectionEnd)
    }
  }

  return null
}

export function getSearchPrefillSelection(): string | null {
  if (isMonacoFocused()) {
    return null
  }

  const activeElement = document.activeElement
  const inputSelection = getSelectedTextFromInput(activeElement)
  const rawSelection = inputSelection ?? window.getSelection()?.toString() ?? ''
  const trimmedSelection = rawSelection.trim()

  return trimmedSelection.length > 0 ? trimmedSelection : null
}
