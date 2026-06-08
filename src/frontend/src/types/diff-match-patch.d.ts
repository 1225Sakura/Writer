declare module 'diff-match-patch' {
  export const DIFF_DELETE: -1
  export const DIFF_INSERT: 1
  export const DIFF_EQUAL: 0

  export type Diff = [number, string]

  export class diff_match_patch {
    diff_main(text1: string, text2: string, opt_checklines?: boolean, opt_deadline?: number): Diff[]
    diff_cleanupSemantic(diffs: Diff[]): void
    diff_cleanupEfficiency(diffs: Diff[]): void
    diff_levenshtein(diffs: Diff[]): number
    diff_prettyHtml(diffs: Diff[]): string
    diff_toDelta(diffs: Diff[]): string
    patch_make(text1: string, diffs: Diff[]): Patch[]
    patch_apply(patches: Patch[], text: string): [string, boolean[]]
  }

  export class Patch {
    diffs: Diff[]
    start1: number | null
    start2: number | null
    length1: number
    length2: number
  }
}
