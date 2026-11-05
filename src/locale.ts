export function primaryLang(tag: string): string {
  return tag.split('-')[0]?.toLowerCase() || 'en'
}

/**
 * Prefer the translation when the utterance language differs from the viewer locale.
 * Show the original when they match, or when no translation was sent.
 */
export function pickDisplayText(
  original: string,
  translation: string,
  utteranceLang: string,
  viewerLocale: string,
): { text: string; secondary?: string } {
  const src = primaryLang(utteranceLang)
  const dest = primaryLang(viewerLocale)
  if (!translation || src === dest) {
    return {
      text: original,
      secondary: translation && translation !== original ? translation : undefined,
    }
  }
  return {
    text: translation,
    secondary: original,
  }
}
