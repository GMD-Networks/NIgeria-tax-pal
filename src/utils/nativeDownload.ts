import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';

/**
 * Download a file - handles both web and native platforms
 * @param data - Base64 data or blob
 * @param filename - The filename to save as
 * @param mimeType - The MIME type of the file
 */
export async function downloadFile(
  data: string | Blob,
  filename: string,
  mimeType: string = 'application/pdf'
): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Native platform - use Filesystem API
      let base64Data: string;
      
      if (data instanceof Blob) {
        // Convert blob to base64
        base64Data = await blobToBase64(data);
      } else if (data.startsWith('data:')) {
        // Extract base64 from data URL
        base64Data = data.split(',')[1];
      } else {
        // Already base64
        base64Data = data;
      }

      // Save to device Documents directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
      });

      console.log('File saved to:', result.uri);
      toast.success(`Saved to Documents: ${filename}`);
      return true;
    } else {
      // Web platform - use traditional download
      let blob: Blob;
      
      if (data instanceof Blob) {
        blob = data;
      } else if (data.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(data);
        blob = await response.blob();
      } else {
        // Convert base64 to blob
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    }
  } catch (error) {
    console.error('Download error:', error);
    toast.error('Failed to download file');
    return false;
  }
}

/**
 * Download a PDF from jsPDF document
 * @param doc - jsPDF document instance
 * @param filename - The filename to save as
 */
export async function downloadPDF(
  doc: { output: (type: string) => string },
  filename: string
): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      // Get base64 data from jsPDF
      const base64 = doc.output('datauristring').split(',')[1];
      return await downloadFile(base64, filename, 'application/pdf');
    } else {
      // Web - jsPDF handles this natively, but we'll do it manually for consistency
      const base64 = doc.output('datauristring');
      return await downloadFile(base64, filename, 'application/pdf');
    }
  } catch (error) {
    console.error('PDF download error:', error);
    toast.error('Failed to download PDF');
    return false;
  }
}

/**
 * Convert a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
