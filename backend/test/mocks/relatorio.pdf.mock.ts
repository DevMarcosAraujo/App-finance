// Mock de `relatorio.pdf` para os testes e2e.
//
// `renderRelatorioPdf` real depende de `@react-pdf/renderer` (via
// `yoga-layout`), um pacote ESM puro que só carrega em runtime via o
// `require(esm)` nativo do Node (>=22.12) quando o processo é iniciado
// normalmente. O `ts-jest` compila o AppModule inteiro para CommonJS antes de
// executar, e a ponte de módulos do Jest não interopera com esse `require`
// nativo — então qualquer boot do `AppModule` (como os testes e2e fazem, via
// `Test.createTestingModule`) quebra ao importar a cadeia
// controller -> service -> relatorio.pdf.
//
// A renderização real do PDF já é coberta por `relatorio.pdf.spec.ts` (via
// subprocesso `node -r ts-node/register`, fora do runtime do Jest) e pelos
// testes unitários do controller/service, que fazem o mesmo mock. Os testes
// e2e do módulo `relatorio` verificam status HTTP e isolamento por
// workspace — não o conteúdo do PDF — então esse mock não reduz a cobertura
// real de nada.
export function renderRelatorioPdf(): Promise<Buffer> {
  return Promise.resolve(Buffer.from('%PDF-1.4 fake'));
}
