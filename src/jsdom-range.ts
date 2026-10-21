// jsdom の Range には、getClientRects / getBoundingClientRect がない（レイアウトがない）。CodeMirror は、
// 補完の一覧の位置や、カーソルまでスクロールする量を測るときに使うので、空の値を返すものを用意する。テストからだけ読み込む
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()
