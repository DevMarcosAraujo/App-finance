import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('renderRelatorioPdf', () => {
  jest.setTimeout(15000);

  function renderViaFixture(cenario: 'com-dados' | 'vazio'): Buffer {
    const outputPath = path.join(os.tmpdir(), `relatorio-pdf-test-${cenario}-${Date.now()}.pdf`);
    const fixtureScript = path.join(__dirname, 'relatorio.pdf.render-fixture.ts');
    try {
      execFileSync(
        'node',
        ['-r', 'ts-node/register', fixtureScript, outputPath, cenario],
        { cwd: path.join(__dirname, '..', '..'), stdio: ['ignore', 'ignore', 'inherit'] },
      );
      return fs.readFileSync(outputPath);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  }

  it('gera um buffer de PDF válido para uma agregação com dados', () => {
    const buffer = renderViaFixture('com-dados');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('gera um buffer de PDF válido para agregação vazia', () => {
    const buffer = renderViaFixture('vazio');
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
