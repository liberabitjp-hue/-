// 別紙5.2「正解データを用いた回帰テスト」対応。
//
// ../../test-fixtures/ には、実際にお預かりした5種類のサンプルファイルから、
// 作成者名などの識別情報（Excelのファイルプロパティ）だけを取り除いたものを
// 保存している。セルの内容（学級名・教科名・時数等）は実データのまま。
// 学級・教科単位の資料であり、児童個人の情報は含まれていない。

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FileKind, ParsedWorkbook } from '../../src/types'
import { parseWorkbookRaw, withFileKind } from '../../src/excel/workbookReader'

const FIXTURES_DIR = join(__dirname, '..', '..', 'test-fixtures')

export async function loadFixture(fileName: string, fileKind: FileKind): Promise<ParsedWorkbook> {
  const buf = readFileSync(join(FIXTURES_DIR, fileName))
  const file = new File([buf], fileName)
  const raw = await parseWorkbookRaw(file)
  return withFileKind(raw, fileKind)
}
