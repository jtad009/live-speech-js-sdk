/**
 * Primary language of a BCP-47 tag.
 *
 * `en-GB` and `EN` both become `en`. The region is ignored so a British
 * viewer still matches an `en` utterance. An empty tag becomes `en`.
 *
 * @param tag - A language tag from the browser or from a packet.
 * @returns The lower-case primary subtag.
 */
export function primaryLang(tag: string): string {
  return tag.split('-')[0]?.toLowerCase() || 'en'
}

/**
 * Choose which wording the viewer reads, and which one is secondary.
 *
 * The translation is the main line only when it was written in the viewer's
 * language. `target_language` is that language. A Dutch utterance translated
 * into English stays in Dutch for a French reader. Showing the English as
 * their line would claim a translation they did not receive.
 *
 * The original is the main line when the viewer speaks it, when no translation
 * was sent, or when the translation is for someone else. `secondary` is the
 * other wording when it exists and is not the same string. Nothing is
 * translated here.
 *
 * @param original - Spoken wording.
 * @param translation - Worker translation, or `''`.
 * @param utteranceLang - Packet `language`, the language of `original`.
 * @param targetLanguage - Packet `target_language`, the language of `translation`.
 * @param viewerLocale - Locale passed to `createTranscript` or `attach`.
 * @returns The line to emphasise, and the other line when it adds something.
 */
export function pickDisplayText(
  original: string,
  translation: string,
  utteranceLang: string,
  targetLanguage: string,
  viewerLocale: string,
): { text: string; secondary?: string } {
  const spoken = primaryLang(utteranceLang)
  const viewer = primaryLang(viewerLocale)
  const translated = targetLanguage.split('-')[0]?.toLowerCase() ?? ''
  const translationForViewer = Boolean(translation && translated && viewer === translated && viewer !== spoken)
  if (translationForViewer) {
    return {
      text: translation,
      secondary: translation !== original ? original : undefined,
    }
  }
  return {
    text: original,
    secondary: translation && translation !== original ? translation : undefined,
  }
}
