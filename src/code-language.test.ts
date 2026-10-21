import { CompletionContext } from '@codemirror/autocomplete'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { completeCodeLanguage, languageOptions } from './code-language'

/** `|` の位置で補完を求め、候補で置き換える範囲の始まりを返す（候補を出さなければ null） */
function complete(doc: string, explicit = false): number | null {
  const pos = doc.indexOf('|')
  const state = EditorState.create({ doc: doc.replace('|', '') })
  return completeCodeLanguage(new CompletionContext(state, pos, explicit))?.from ?? null
}

describe('completeCodeLanguage', () => {
  it('開始フェンスの後ろで、入力中の言語名を補完する', () => {
    expect(complete('text\n\n```ja|')).toBe(9)
    expect(complete('  ~~~~py|')).toBe(6)
  })

  it('言語名をまだ打っていなければ、明示的に開いたときだけ候補を出す', () => {
    expect(complete('```|')).toBeNull()
    expect(complete('```|', true)).toBe(3)
  })

  it('開始フェンスの行でなければ、候補を出さない', () => {
    expect(complete('ja|', true)).toBeNull()
    expect(complete('see ```ja|', true)).toBeNull()
    expect(complete('``ja|', true)).toBeNull()
    expect(complete('    ```ja|', true)).toBeNull()
    expect(complete('```js title|', true)).toBeNull()
  })
})

describe('languageOptions', () => {
  it('どの候補も、ハイライトで同じ言語として見つかる', () => {
    for (const option of languageOptions.filter((option) => option.label !== 'mermaid')) {
      expect(LanguageDescription.matchLanguageName(languages, option.label, true)?.name, option.label).toBe(option.detail)
    }
  })

  it('Mermaid を含み、同じ名前は 1 つだけ', () => {
    const labels = languageOptions.map((option) => option.label)
    expect(labels).toContain('mermaid')
    expect(labels).toContain('js')
    expect(new Set(labels).size).toBe(labels.length)
  })
})
