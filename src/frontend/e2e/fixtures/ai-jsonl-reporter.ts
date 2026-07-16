/**
 * e2e/fixtures/ai-jsonl-reporter.ts — US-020 (Playwright custom reporter).
 *
 * Reads `<WRITER_DATA_DIR>/ai-log.jsonl` (the Electron renderer writes one
 * JSON line per AI call via `aiLog:append` IPC; see electron/main.ts +
 * electron/preload.ts) at the end of the test run and prints a journey
 * summary to stdout. Output looks like:
 *
 *   [ai-jsonl] journeyId=default entries=12 ops={generate:4, fill-fields:3, ...}
 *   [ai-jsonl] sample entry: {"ts":...,"op":"ai/generate",...}
 *
 * Why a separate reporter?
 *   - Playwright's stock reporters (list, html) don't know about our
 *     `ai-log.jsonl` format.
 *   - Running this AFTER the html reporter keeps the html output intact
 *     while still surfacing AI-side activity in CI logs.
 *
 * File is written defensively: if the log doesn't exist (e.g. cold-start
 * journey with no AI calls yet), we just skip and print 0 entries.
 */
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter';
import { promises as fs } from 'fs';
import path from 'path';

interface JsonlEntry {
  ts?: string;
  op?: string;
  [k: string]: unknown;
}

class AIJsonlReporter implements Reporter {
  private journeyId: string;
  private perJourneyDataDir: string;
  private perJourneyElectronProfile: string;
  private logPath: string;

  constructor() {
    this.journeyId = process.env.JOURNEY_ID || 'default';
    this.perJourneyDataDir = path.resolve(
      process.env.WRITER_DATA_DIR || path.join(process.cwd(), 'data', 'e2e', 'default')
    );
    // Electron writes ai-log.jsonl under userData (= --user-data-dir).
    this.perJourneyElectronProfile = path.resolve(
      this.perJourneyDataDir,
      'electron-profile'
    );
    this.logPath = path.join(this.perJourneyElectronProfile, 'ai-log.jsonl');
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    process.stdout.write(
      `[ai-jsonl] tracking ${this.logPath} for journey=${this.journeyId}\n`
    );
  }

  async onEnd(result: FullResult): Promise<void> {
    let raw = '';
    try {
      raw = await fs.readFile(this.logPath, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        process.stdout.write(
          `[ai-jsonl] no ai-log.jsonl yet (cold-start journey, 0 AI calls). status=${result.status}\n`
        );
        return;
      }
      process.stderr.write(
        `[ai-jsonl] failed to read ${this.logPath}: ${err}\n`
      );
      return;
    }

    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const entries: JsonlEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as JsonlEntry);
      } catch {
        // skip malformed lines (defensive — never fail a test run on log noise)
      }
    }

    const opCounts: Record<string, number> = {};
    for (const e of entries) {
      const op = e.op ?? '<unknown>';
      opCounts[op] = (opCounts[op] ?? 0) + 1;
    }

    process.stdout.write(
      `[ai-jsonl] journeyId=${this.journeyId} entries=${entries.length} ` +
        `ops=${JSON.stringify(opCounts)} status=${result.status}\n`
    );
    if (entries.length > 0) {
      process.stdout.write(
        `[ai-jsonl] sample entry: ${JSON.stringify(entries[0])}\n`
      );
    }
  }

  // Required by Reporter interface but unused here. We deliberately don't
  // emit per-test output — the jsonl is journey-scoped, not test-scoped.
  onTestBegin(): void { /* noop */ }
  onTestEnd(): void { /* noop */ }
}

export default AIJsonlReporter;