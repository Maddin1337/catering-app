export type PdfResult = 'shared' | 'failed';

/** Im Browser: Dokument in einem eigenen Fenster öffnen und den Druckdialog starten („Als PDF speichern“). */
export async function sharePdf(html: string, title: string): Promise<PdfResult> {
  try {
    const w = window.open('', '_blank');
    if (!w) return 'failed';
    w.document.open();
    w.document.write(html);
    w.document.title = title;
    w.document.close();
    w.focus();
    // kurz warten, bis Schriften und Layout stehen
    setTimeout(() => w.print(), 300);
    return 'shared';
  } catch {
    return 'failed';
  }
}
