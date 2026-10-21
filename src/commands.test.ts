import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state'
import { cycleHeading, insertBlock, insertLink, toggleInline, toggleLinePrefix, wrapCodeBlock } from './commands'

/** `|` をカーソル、`«` `»` を選択範囲として書いた文書にコマンドを実行し、同じ書き方で結果を返す */
function run(command: StateCommand, doc: string, options: { readOnly?: boolean } = {}): string {
  let selection: EditorSelection
  if (doc.includes('«')) {
    const anchor = doc.indexOf('«')
    const head = doc.indexOf('»') - 1
    doc = doc.replace('«', '').replace('»', '')
    selection = EditorSelection.single(anchor, head)
  } else {
    const cursor = doc.indexOf('|')
    doc = doc.replace('|', '')
    selection = EditorSelection.single(cursor)
  }
  let state = EditorState.create({ doc, selection, extensions: EditorState.readOnly.of(options.readOnly ?? false) })
  command({ state, dispatch: (tr) => (state = tr.state) })
  const { from, to } = state.selection.main
  const text = state.doc.toString()
  return from === to ? text.slice(0, from) + '|' + text.slice(from) : text.slice(0, from) + '«' + text.slice(from, to) + '»' + text.slice(to)
}

describe('toggleInline', () => {
  const bold = toggleInline('**')

  it('選択範囲を囲み、選択は中身に保つ', () => {
    expect(run(bold, 'a «word» b')).toBe('a **«word»** b')
  })

  it('囲まれた中身を選んでいれば外す。記号ごと選んでいても外す', () => {
    expect(run(bold, 'a **«word»** b')).toBe('a «word» b')
    expect(run(bold, 'a «**word**» b')).toBe('a «word» b')
  })

  it('選択がなければ記号を 2 つ入れ、間にカーソルを置く', () => {
    expect(run(bold, 'a | b')).toBe('a **|** b')
    expect(run(toggleInline('`'), 'a | b')).toBe('a `|` b')
  })

  it('斜体の _ は太字の ** と混ざらない', () => {
    expect(run(toggleInline('_'), '**«word»**')).toBe('**_«word»_**')
  })

  it('ロック中は何もしない', () => {
    expect(run(bold, 'a «word» b', { readOnly: true })).toBe('a «word» b')
  })
})

describe('toggleLinePrefix', () => {
  it('選んだ行に記号を付け、空行は飛ばす。すべて付いていれば外す', () => {
    expect(run(toggleLinePrefix('bullet'), '«one\n\ntwo»')).toBe('- «one\n\n- two»')
    expect(run(toggleLinePrefix('bullet'), '«- one\n\n- two»')).toBe('«one\n\ntwo»')
  })

  it('番号付きは 1 から順に振る', () => {
    expect(run(toggleLinePrefix('ordered'), '«a\nb\nc»')).toBe('1. «a\n2. b\n3. c»')
  })

  it('ほかのリストの記号は付け替え、インデントは保つ', () => {
    expect(run(toggleLinePrefix('task'), '  - ite|m')).toBe('  - [ ] ite|m')
    expect(run(toggleLinePrefix('bullet'), '1. ite|m')).toBe('- ite|m')
    expect(run(toggleLinePrefix('task'), '- [ ] ite|m')).toBe('ite|m')
  })

  it('タスクの行は箇条書きとしては扱わない', () => {
    expect(run(toggleLinePrefix('bullet'), '- [x] ite|m')).toBe('- ite|m')
  })

  it('引用はリストの前に付け、外すときは引用だけを外す', () => {
    expect(run(toggleLinePrefix('quote'), '- ite|m')).toBe('> - ite|m')
    expect(run(toggleLinePrefix('quote'), '> - ite|m')).toBe('- ite|m')
  })

  it('空の行 1 つなら記号を付ける（そこから書き始められる）', () => {
    expect(run(toggleLinePrefix('bullet'), 'a\n|\nb')).toBe('a\n- |\nb')
  })

  it('行頭で終わる選択は、その行を含めない', () => {
    expect(run(toggleLinePrefix('bullet'), '«one\n»two')).toBe('- «one\n»two')
  })
})

describe('cycleHeading', () => {
  it('なし → # → ## → ### → なし の順に変える', () => {
    expect(run(cycleHeading, 'Ti|tle')).toBe('# Ti|tle')
    expect(run(cycleHeading, '# Ti|tle')).toBe('## Ti|tle')
    expect(run(cycleHeading, '### Ti|tle')).toBe('Ti|tle')
    expect(run(cycleHeading, '###### Ti|tle')).toBe('Ti|tle')
  })
})

describe('insertLink', () => {
  it('文字を選んでいれば [文字]() にして、URL を入れる位置にカーソルを置く', () => {
    expect(run(insertLink, 'see «docs» now')).toBe('see [docs](|) now')
  })

  it('URL を選んでいれば [](URL) にして、文字を入れる位置にカーソルを置く', () => {
    expect(run(insertLink, '«https://example.com»')).toBe('[|](https://example.com)')
  })

  it('選択がなければ []() を入れる', () => {
    expect(run(insertLink, 'a |')).toBe('a [|]()')
  })
})

describe('insertBlock', () => {
  const rule = insertBlock('---')

  it('前後に空行を確保して入れる（--- が見出しの下線にならないように）', () => {
    expect(run(rule, 'para|')).toBe('para\n\n---|')
    expect(run(rule, 'para\n|')).toBe('para\n\n---|')
    expect(run(rule, 'a|b')).toBe('a\n\n---|\n\nb')
    expect(run(rule, '|')).toBe('---|')
  })

  it('次の行に文字があれば、後ろにも空行を入れる', () => {
    expect(run(rule, 'para\n|\nnext')).toBe('para\n\n---|\n\nnext')
  })

  it('選択範囲は消さず、その後ろに入れる', () => {
    expect(run(rule, '«keep this»')).toBe('keep this\n\n---|')
    expect(run(rule, 'a «keep» b')).toBe('a keep\n\n---|\n\n b')
  })

  it('指定した範囲を選ぶ', () => {
    expect(run(insertBlock('| Column |', { from: 2, to: 8 }), '|')).toBe('| «Column» |')
  })
})

describe('wrapCodeBlock', () => {
  it('選んだ行を ``` で囲む', () => {
    expect(run(wrapCodeBlock(), 'text\n«const a = 1»\nmore')).toBe('text\n\n```\nconst a = 1\n```|\n\nmore')
  })

  it('選択がなければ空のコードブロックを入れ、中にカーソルを置く', () => {
    expect(run(wrapCodeBlock(), '|')).toBe('```\n|\n```')
    expect(run(wrapCodeBlock('mermaid'), 'a\n|')).toBe('a\n\n```mermaid\n|\n```')
  })
})
