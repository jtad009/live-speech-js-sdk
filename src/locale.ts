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
 * The translation is `text` when the speaker's primary language differs from
 * the viewer's. The original is `text` when those languages match, or when
 * `translation` is empty. `secondary` is the other wording when it exists and
 * is not the same string as `text`. Nothing is translated here. An empty
 * translation stays empty.
 *
 * @param original - Spoken wording.
 * @param translation - Worker translation, or `''`.
 * @param utteranceLang - Packet `language`.
 * @param viewerLocale - Locale passed to `createTranscript` or `attach`.
 * @returns The line to emphasise, and the other line when it adds something.
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
