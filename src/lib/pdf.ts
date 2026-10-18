import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type PdfResult = 'shared' | 'failed';

// A4 in Punkten (72 dpi)
const A4 = { width: 595, height: 842 };

/** HTML als PDF-Datei erzeugen und über die Freigabe des Geräts teilen oder speichern. */
export async function sharePdf(html: string, title: string): Promise<PdfResult> {
  try {
    const { uri } = await Print.printToFileAsync({ html, ...A4 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: title,
      });
      return 'shared';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
