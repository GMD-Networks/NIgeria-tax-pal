import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, FileText, Loader2, CheckCircle2, 
  X, Image as ImageIcon, Files, Download, Trash2, Plus, FileType, Sheet, FileSpreadsheet, RotateCcw, RotateCw, Sparkles
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { api as backendApi } from '@/services/api';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopPosition, TabStopType, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PHP_API_BASE } from '@/services/phpApiClient';
import { categorizeReceipt, ReceiptCategoryBadge, getTaxDeductionInfo, type ExpenseCategory } from '@/components/scanner/ReceiptCategoryBadge';


interface FormattedBlock {
  text: string;
  style: 'heading1' | 'heading2' | 'heading3' | 'body' | 'subtitle' | 'label' | 'list_item';
  bold?: boolean;
  italic?: boolean;
}

interface ExtractedData {
  document_type?: 'receipt' | 'invoice' | 'resume' | 'letter' | 'report' | 'form' | 'id_document' | 'other';
  title?: string;
  raw_text?: string;
  formatted_blocks?: FormattedBlock[];
  vendor_name?: string;
  date?: string;
  receipt_number?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    amount: number;
  }>;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  total_amount?: number;
  payment_method?: string;
  currency?: string;
  sections?: Array<{
    heading?: string;
    content: string;
  }>;
  key_details?: Record<string, string>;
  notes?: string;
}

type ScanFilter = 'color' | 'grayscale' | 'bw' | 'enhanced';

interface ScanAdjustments {
  filter: ScanFilter;
  rotation: number;
}

interface ScannedDocument {
  id: string;
  originalImage: string;
  image: string;
  fileName: string;
  extractedData?: ExtractedData;
  status: 'pending' | 'scanning' | 'done' | 'error';
  adjustments: ScanAdjustments;
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

const compressImageDataUrl = (dataUrl: string, maxWidth = 1400, quality = 0.72) =>
  new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }

      context.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const defaultAdjustments: ScanAdjustments = {
  filter: 'color',
  rotation: 0,
};

const scanFilters: Array<{ id: ScanFilter; label: string }> = [
  { id: 'color', label: 'Color' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'bw', label: 'B/W' },
  { id: 'enhanced', label: 'Enhance' },
];

GlobalWorkerOptions.workerSrc = workerSrc;

const docTools = [
  { id: 'pdf_word', title: 'PDF to Word', icon: FileType },
  { id: 'pdf_excel', title: 'PDF to Excel', icon: FileSpreadsheet },
  { id: 'pdf_ppt', title: 'PDF to PPT', icon: Sheet },
  { id: 'pdf_jpg', title: 'PDF to JPG', icon: ImageIcon },
  { id: 'word_pdf', title: 'Word to PDF', icon: FileType },
  { id: 'excel_pdf', title: 'Excel to PDF', icon: FileSpreadsheet },
  { id: 'ppt_pdf', title: 'PPT to PDF', icon: Sheet },
  { id: 'image_pdf', title: 'Image to PDF', icon: ImageIcon },
  { id: 'merge_pdf', title: 'Merge PDF', icon: Files },
  { id: 'split_pdf', title: 'Split PDF', icon: Files },
  { id: 'delete_pages', title: 'Delete PDF Pages', icon: Trash2 },
  { id: 'sort_pages', title: 'Sort PDF Pages', icon: Files },
  { id: 'rotate_pdf', title: 'Rotate PDF', icon: RotateCw },
  { id: 'signature', title: 'PDF Signature', icon: FileText },
  { id: 'watermark', title: 'PDF Watermark', icon: FileText },
  { id: 'smart_translation', title: 'Smart Translation', icon: FileText },
  { id: 'image_word', title: 'Image to Word', icon: FileType },
  { id: 'image_excel', title: 'Image to Excel', icon: FileSpreadsheet },
  { id: 'scan_books', title: 'Scan Books', icon: FileText },
  { id: 'scan_documents', title: 'Scan Documents', icon: FileText },
  { id: 'scan_id', title: 'Scan ID Card', icon: FileText },
  { id: 'image_text', title: 'Image to Text', icon: FileText },
  { id: 'id_photo', title: 'ID Photo Maker', icon: ImageIcon },
];

const applyImageAdjustments = (dataUrl: string, adjustments: ScanAdjustments, quality = 0.8) =>
  new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const rotation = ((adjustments.rotation % 360) + 360) % 360;
      const rotate90 = rotation === 90 || rotation === 270;
      const canvas = document.createElement('canvas');
      canvas.width = rotate90 ? img.height : img.width;
      canvas.height = rotate90 ? img.width : img.height;

      const context = canvas.getContext('2d');
      if (!context) {
        resolve(dataUrl);
        return;
      }

      const filterValue = adjustments.filter === 'grayscale'
        ? 'grayscale(1)'
        : adjustments.filter === 'bw'
          ? 'grayscale(1) contrast(1.6) brightness(1.1)'
          : adjustments.filter === 'enhanced'
            ? 'contrast(1.2) brightness(1.05) saturate(1.1)'
            : 'none';

      context.filter = filterValue;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const prepareImageForScan = async (file: File) => {
  const rawDataUrl = await readFileAsDataUrl(file);
  return compressImageDataUrl(rawDataUrl);
};

const readFileAsArrayBuffer = (file: File) => file.arrayBuffer();

const dataUrlToBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] || '';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return bytes;
};

const renderPdfPages = async (file: File, scale = 2) => {
  const pdf = await getDocument({ data: await readFileAsArrayBuffer(file) }).promise;
  const images: string[] = [];
  const texts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.92));
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .trim();
    texts.push(pageText);
  }
  return { images, texts };
};

const extractXmlText = (xml: string, tagName: string) => {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName(tagName));
  return nodes.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
};

const extractTextFromDocx = async (file: File) => {
  const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
  const xml = await zip.file('word/document.xml')?.async('text');
  if (!xml) return '';
  return extractXmlText(xml, 'w:t');
};

const extractTextFromPptx = async (file: File) => {
  const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
  const slideFiles = Object.keys(zip.files).filter((name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  slideFiles.sort();
  const parts: string[] = [];
  for (const slide of slideFiles) {
    const xml = await zip.file(slide)?.async('text');
    if (xml) {
      const text = extractXmlText(xml, 'a:t');
      if (text) parts.push(text);
    }
  }
  return parts.join('\n');
};

const extractTextFromXlsx = async (file: File) => {
  const zip = await JSZip.loadAsync(await readFileAsArrayBuffer(file));
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text');
  if (sharedStringsXml) {
    const text = extractXmlText(sharedStringsXml, 't');
    if (text) return text;
  }
  const sheetFiles = Object.keys(zip.files).filter((name) => name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml'));
  sheetFiles.sort();
  const parts: string[] = [];
  for (const sheet of sheetFiles) {
    const xml = await zip.file(sheet)?.async('text');
    if (xml) {
      const text = extractXmlText(xml, 'v');
      if (text) parts.push(text);
    }
  }
  return parts.join('\n');
};

const buildPdfFromText = (title: string, text: string) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;
  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, margin, y);
    y += 10;
  }
  pdf.setFontSize(11);
  const lines = pdf.splitTextToSize(text || 'No content found.', pageWidth - 2 * margin);
  lines.forEach((line: string) => {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, margin, y);
    y += 6;
  });
  return pdf;
};

const buildDocxFromImages = async (title: string, images: string[]) => {
  const children: Paragraph[] = [];
  if (title) {
    children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }));
    children.push(new Paragraph({ text: '' }));
  }
  images.forEach((img) => {
    const bytes = dataUrlToBytes(img);
    children.push(new Paragraph({
      children: [new ImageRun({ data: bytes, transformation: { width: 500, height: 700 }, type: 'jpg' })],
      spacing: { after: 300 },
    }));
  });
  return new Document({ sections: [{ properties: {}, children }] });
};

const saveZipFromEntries = async (entries: Array<{ name: string; data: Blob | Uint8Array }>, fileName: string) => {
  const zip = new JSZip();
  entries.forEach((entry) => {
    zip.file(entry.name, entry.data);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, fileName);
};

const parsePageSelection = (input: string, totalPages: number) => {
  const pages = new Set<number>();
  input.split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => {
    if (part.includes('-')) {
      const [startRaw, endRaw] = part.split('-');
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const min = Math.max(1, Math.min(start, end));
      const max = Math.min(totalPages, Math.max(start, end));
      for (let i = min; i <= max; i += 1) pages.add(i);
    } else {
      const num = Number(part);
      if (Number.isFinite(num) && num >= 1 && num <= totalPages) pages.add(num);
    }
  });
  return Array.from(pages).sort((a, b) => a - b);
};

const getAuthToken = () => localStorage.getItem('auth_token');

const parseFilenameFromDisposition = (header: string | null) => {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] || null;
};

const ReceiptScanner = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const toolInputRef = useRef<HTMLInputElement>(null);
  const toolSecondaryInputRef = useRef<HTMLInputElement>(null);
  const pendingPdfRef = useRef<File | null>(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ScannedDocument | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolAccept, setToolAccept] = useState('application/pdf');
  const [toolMultiple, setToolMultiple] = useState(false);
  const [toolBusy, setToolBusy] = useState(false);

  const scanMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      const { data, error } = await backendApi.functions.invoke('receipt-ocr', {
        body: { image: imageBase64 }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to scan document');
      return data.data as ExtractedData;
    },
  });

  const updateDocument = (updated: ScannedDocument) => {
    setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
    if (selectedDoc?.id === updated.id) {
      setSelectedDoc(updated);
    }
  };

  const applyAdjustmentsToDoc = async (doc: ScannedDocument, adjustments: ScanAdjustments) => {
    const processed = await applyImageAdjustments(doc.originalImage, adjustments);
    const nextStatus = doc.status === 'done' ? 'pending' : doc.status;
    const updated = { ...doc, image: processed, adjustments, status: nextStatus };
    updateDocument(updated);
    return updated;
  };

  const rescanDocument = async (doc: ScannedDocument) => {
    const scanning = { ...doc, status: 'scanning' as const };
    updateDocument(scanning);
    try {
      const data = await scanMutation.mutateAsync(scanning.image);
      const updated = { ...scanning, extractedData: data, status: 'done' as const };
      updateDocument(updated);
      toast.success('Document scanned successfully!');
    } catch (error) {
      const updated = { ...scanning, status: 'error' as const };
      updateDocument(updated);
      toast.error(error instanceof Error ? error.message : 'Failed to scan document');
    }
  };

  const isFinancialDoc = (data?: ExtractedData) => {
    return data?.document_type === 'receipt' || data?.document_type === 'invoice';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be less than 10MB'); return; }

    try {
      const base64 = await prepareImageForScan(file);
      const newDoc: ScannedDocument = {
        id: crypto.randomUUID(),
        originalImage: base64,
        image: base64,
        fileName: file.name,
        status: 'pending',
        adjustments: defaultAdjustments,
      };
      setDocuments(prev => [...prev, newDoc]);
      setSelectedDoc(newDoc);
      setActiveTab('scan');

      await rescanDocument(newDoc);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process image');
    }
    if (event.target) event.target.value = '';
  };

  const handleBatchSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
    if (validFiles.length === 0) { toast.error('No valid image files selected'); return; }

    toast.info(`Processing ${validFiles.length} document(s)...`);
    setActiveTab('batch');

    for (const file of validFiles) {
      try {
        const base64 = await prepareImageForScan(file);
        const newDoc: ScannedDocument = {
          id: crypto.randomUUID(),
          originalImage: base64,
          image: base64,
          fileName: file.name,
          status: 'pending',
          adjustments: defaultAdjustments,
        };
        setDocuments(prev => [...prev, newDoc]);

        await rescanDocument(newDoc);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to process ${file.name}`);
      }
    }
    if (event.target) event.target.value = '';
  };

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const handleGallerySelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const translateText = async (text: string, targetLanguage: string) => {
    const { data, error } = await backendApi.functions.invoke('smart-translate', {
      body: { text, target: targetLanguage }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Translation failed');
    return data.data?.translated_text || '';
  };

  const convertWithServer = async (file: File, target: 'pdf' | 'docx' | 'xlsx' | 'pptx') => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getAuthToken();
    const response = await fetch(`${PHP_API_BASE}/convert?target=${encodeURIComponent(target)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text();
      let message = 'Conversion failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error || message;
      } catch {
        message = text || message;
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const filename = parseFilenameFromDisposition(response.headers.get('content-disposition')) || `converted.${target}`;
    saveAs(blob, filename);
  };

  const handleToolClick = (toolId: string) => {
    if (toolBusy) return;
    if (toolId === 'scan_documents') {
      handleGallerySelect();
      return;
    }
    let accept = 'application/pdf';
    let multiple = false;
    if (['image_pdf', 'image_word', 'image_excel', 'image_text', 'scan_id', 'id_photo', 'scan_books'].includes(toolId)) {
      accept = 'image/*';
      multiple = ['image_pdf', 'image_word', 'image_excel', 'scan_books'].includes(toolId);
    } else if (toolId === 'word_pdf') {
      accept = '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (toolId === 'excel_pdf') {
      accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (toolId === 'ppt_pdf') {
      accept = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (toolId === 'smart_translation') {
      accept = '.txt,.pdf,.docx,.pptx,.xlsx,image/*';
    } else if (toolId === 'merge_pdf') {
      accept = 'application/pdf';
      multiple = true;
    } else if (toolId === 'scan_books') {
      accept = 'image/*';
      multiple = true;
    }
    setActiveTool(toolId);
    setToolAccept(accept);
    setToolMultiple(multiple);
    toolInputRef.current?.click();
  };

  const handleToolFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (!activeTool || files.length === 0) return;
    setToolBusy(true);
    try {
      if (activeTool === 'pdf_word') {
        await convertWithServer(files[0], 'docx');
        toast.success('PDF converted to Word');
      } else if (activeTool === 'pdf_excel') {
        await convertWithServer(files[0], 'xlsx');
        toast.success('PDF converted to Excel');
      } else if (activeTool === 'pdf_ppt') {
        await convertWithServer(files[0], 'pptx');
        toast.success('PDF converted to PPT');
      } else if (activeTool === 'pdf_jpg') {
        const { images } = await renderPdfPages(files[0], 2);
        const entries = images.map((img, idx) => ({ name: `page-${idx + 1}.jpg`, data: dataUrlToBytes(img) }));
        await saveZipFromEntries(entries, `${files[0].name.replace(/\.[^.]+$/, '')}-jpg.zip`);
        toast.success('PDF converted to JPG');
      } else if (activeTool === 'word_pdf') {
        await convertWithServer(files[0], 'pdf');
        toast.success('Word converted to PDF');
      } else if (activeTool === 'excel_pdf') {
        await convertWithServer(files[0], 'pdf');
        toast.success('Excel converted to PDF');
      } else if (activeTool === 'ppt_pdf') {
        await convertWithServer(files[0], 'pdf');
        toast.success('PPT converted to PDF');
      } else if (activeTool === 'image_pdf') {
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < files.length; i += 1) {
          const dataUrl = await readFileAsDataUrl(files[i]);
          if (i > 0) pdf.addPage();
          pdf.addImage(dataUrl, 'JPEG', 10, 10, pageWidth - 20, pageHeight - 20, undefined, 'FAST');
        }
        pdf.save('images.pdf');
        toast.success('Images converted to PDF');
      } else if (activeTool === 'scan_books') {
        const pdf = new jsPDF();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        for (let i = 0; i < files.length; i += 1) {
          const dataUrl = await readFileAsDataUrl(files[i]);
          if (i > 0) pdf.addPage();
          pdf.addImage(dataUrl, 'JPEG', 10, 10, pageWidth - 20, pageHeight - 20, undefined, 'FAST');
        }
        pdf.save('scan-books.pdf');
        toast.success('Book scan exported to PDF');
      } else if (activeTool === 'merge_pdf') {
        const merged = await PDFDocument.create();
        for (const file of files) {
          const doc = await PDFDocument.load(await readFileAsArrayBuffer(file));
          const pages = await merged.copyPages(doc, doc.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
        }
        const bytes = await merged.save();
        saveAs(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
        toast.success('PDFs merged');
      } else if (activeTool === 'split_pdf') {
        const doc = await PDFDocument.load(await readFileAsArrayBuffer(files[0]));
        const entries: Array<{ name: string; data: Uint8Array }> = [];
        for (let i = 0; i < doc.getPageCount(); i += 1) {
          const single = await PDFDocument.create();
          const [page] = await single.copyPages(doc, [i]);
          single.addPage(page);
          entries.push({ name: `page-${i + 1}.pdf`, data: await single.save() });
        }
        await saveZipFromEntries(entries, 'split-pages.zip');
        toast.success('PDF split into pages');
      } else if (activeTool === 'delete_pages') {
        const doc = await PDFDocument.load(await readFileAsArrayBuffer(files[0]));
        const input = window.prompt('Pages to delete (e.g., 1,3-5)') || '';
        const toDelete = parsePageSelection(input, doc.getPageCount());
        const keep = doc.getPageIndices().filter((idx) => !toDelete.includes(idx + 1));
        const output = await PDFDocument.create();
        const pages = await output.copyPages(doc, keep);
        pages.forEach((page) => output.addPage(page));
        saveAs(new Blob([await output.save()], { type: 'application/pdf' }), 'pages-deleted.pdf');
        toast.success('Pages deleted');
      } else if (activeTool === 'sort_pages') {
        const doc = await PDFDocument.load(await readFileAsArrayBuffer(files[0]));
        const input = window.prompt(`New page order (1-${doc.getPageCount()}), e.g., 2,1,3`) || '';
        const order = parsePageSelection(input, doc.getPageCount());
        if (order.length === 0) throw new Error('Invalid order');
        const output = await PDFDocument.create();
        const pages = await output.copyPages(doc, order.map((n) => n - 1));
        pages.forEach((page) => output.addPage(page));
        saveAs(new Blob([await output.save()], { type: 'application/pdf' }), 'sorted.pdf');
        toast.success('Pages reordered');
      } else if (activeTool === 'rotate_pdf') {
        const doc = await PDFDocument.load(await readFileAsArrayBuffer(files[0]));
        const rotation = Number(window.prompt('Rotation degrees (90, 180, 270)') || '90');
        doc.getPages().forEach((page) => page.setRotation(degrees(rotation)));
        saveAs(new Blob([await doc.save()], { type: 'application/pdf' }), 'rotated.pdf');
        toast.success('PDF rotated');
      } else if (activeTool === 'watermark') {
        const doc = await PDFDocument.load(await readFileAsArrayBuffer(files[0]));
        const watermark = window.prompt('Watermark text') || 'CONFIDENTIAL';
        const font = await doc.embedFont(StandardFonts.Helvetica);
        doc.getPages().forEach((page) => {
          const { width, height } = page.getSize();
          page.drawText(watermark, {
            x: width * 0.1,
            y: height * 0.5,
            size: 36,
            font,
            color: rgb(0.6, 0.6, 0.6),
            rotate: degrees(45),
            opacity: 0.25,
          });
        });
        saveAs(new Blob([await doc.save()], { type: 'application/pdf' }), 'watermarked.pdf');
        toast.success('Watermark added');
      } else if (activeTool === 'signature') {
        pendingPdfRef.current = files[0];
        toolSecondaryInputRef.current?.click();
        toast.info('Select signature image');
      } else if (activeTool === 'image_word') {
        const images = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
        const docx = await buildDocxFromImages('Image to Word', images);
        const blob = await Packer.toBlob(docx);
        saveAs(blob, 'images.docx');
        toast.success('Images converted to Word');
      } else if (activeTool === 'image_excel') {
        const rows: string[] = [];
        for (const file of files) {
          const base64 = await readFileAsDataUrl(file);
          const { data, error } = await backendApi.functions.invoke('receipt-ocr', { body: { image: base64 } });
          if (error) throw error;
          const rawText = data?.data?.raw_text || '';
          rows.push(`"${file.name.replace(/"/g, '""')}","${String(rawText).replace(/"/g, '""')}"`);
        }
        const csv = `File,Text\n${rows.join('\n')}`;
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'images.csv');
        toast.success('Images converted to Excel (CSV)');
      } else if (activeTool === 'image_text' || activeTool === 'scan_id') {
        const base64 = await readFileAsDataUrl(files[0]);
        const { data, error } = await backendApi.functions.invoke('receipt-ocr', { body: { image: base64 } });
        if (error) throw error;
        const rawText = data?.data?.raw_text || '';
        saveAs(new Blob([rawText], { type: 'text/plain;charset=utf-8' }), 'scan.txt');
        toast.success('Text extracted');
      } else if (activeTool === 'smart_translation') {
        let text = '';
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const base64 = await readFileAsDataUrl(file);
          const { data, error } = await backendApi.functions.invoke('receipt-ocr', { body: { image: base64 } });
          if (error) throw error;
          text = data?.data?.raw_text || '';
        } else if (file.name.endsWith('.pdf')) {
          const { texts } = await renderPdfPages(file, 1.6);
          text = texts.join('\n');
        } else if (file.name.endsWith('.docx')) {
          text = await extractTextFromDocx(file);
        } else if (file.name.endsWith('.pptx')) {
          text = await extractTextFromPptx(file);
        } else if (file.name.endsWith('.xlsx')) {
          text = await extractTextFromXlsx(file);
        } else if (file.name.endsWith('.txt')) {
          text = await file.text();
        }
        if (!text.trim()) throw new Error('No text found to translate');
        const target = window.prompt('Target language (e.g., French)') || 'French';
        const translated = await translateText(text, target);
        saveAs(new Blob([translated], { type: 'text/plain;charset=utf-8' }), `translated-${file.name.replace(/\.[^.]+$/, '')}.txt`);
        toast.success('Translation complete');
      } else if (activeTool === 'id_photo') {
        const dataUrl = await readFileAsDataUrl(files[0]);
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = dataUrl;
        });
        const targetRatio = 35 / 45;
        const srcRatio = img.width / img.height;
        let cropWidth = img.width;
        let cropHeight = img.height;
        if (srcRatio > targetRatio) {
          cropWidth = img.height * targetRatio;
        } else {
          cropHeight = img.width / targetRatio;
        }
        const cropX = (img.width - cropWidth) / 2;
        const cropY = (img.height - cropHeight) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = 700;
        canvas.height = 900;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        const output = canvas.toDataURL('image/jpeg', 0.92);
        saveAs(new Blob([dataUrlToBytes(output)], { type: 'image/jpeg' }), 'id-photo.jpg');
        toast.success('ID photo created');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tool failed');
    } finally {
      setToolBusy(false);
      setActiveTool(null);
      if (event.target) event.target.value = '';
    }
  };

  const handleToolSecondaryFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    const pdfFile = pendingPdfRef.current;
    if (!pdfFile || files.length === 0) return;
    try {
      const pdfDoc = await PDFDocument.load(await readFileAsArrayBuffer(pdfFile));
      const imageFile = files[0];
      const imageBytes = await readFileAsArrayBuffer(imageFile);
      const image = imageFile.type.includes('png')
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);
      pdfDoc.getPages().forEach((page) => {
        const { width, height } = page.getSize();
        const imgWidth = Math.min(150, width * 0.3);
        const scale = imgWidth / image.width;
        const imgHeight = image.height * scale;
        page.drawImage(image, { x: width - imgWidth - 30, y: 30, width: imgWidth, height: imgHeight });
      });
      saveAs(new Blob([await pdfDoc.save()], { type: 'application/pdf' }), 'signed.pdf');
      toast.success('Signature applied');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signature failed');
    } finally {
      pendingPdfRef.current = null;
      if (event.target) event.target.value = '';
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (selectedDoc?.id === id) setSelectedDoc(null);
  };

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  };

  const getDocLabel = (doc: ScannedDocument) => {
    if (!doc.extractedData) return 'Scanned';
    const data = doc.extractedData;
    if (isFinancialDoc(data) && data.total_amount !== undefined) {
      return formatCurrency(data.total_amount, data.currency);
    }
    return data.document_type ? data.document_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Scanned';
  };

  // ---- Export Functions ----

  const exportToPDF = (doc: ScannedDocument) => {
    const pdf = new jsPDF();
    const data = doc.extractedData;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    // Page 1: Embed original scanned image to preserve layout
    try {
      const imgFormat = doc.image.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(doc.image, imgFormat, margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, undefined, 'FAST');
    } catch (e) {
      console.warn('Could not embed image in PDF:', e);
    }

    // Page 2: Editable extracted text with formatting
    pdf.addPage();
    let y = 20;
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Extracted Text (Editable)', margin, y);
    y += 10;
    pdf.setTextColor(0, 0, 0);

    if (data?.formatted_blocks && data.formatted_blocks.length > 0) {
      data.formatted_blocks.forEach(block => {
        if (y > pageHeight - 20) { pdf.addPage(); y = 20; }
        switch (block.style) {
          case 'heading1':
            y += 4;
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            break;
          case 'heading2':
            y += 3;
            pdf.setFontSize(13);
            pdf.setFont('helvetica', 'bold');
            break;
          case 'heading3':
            y += 2;
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            break;
          case 'subtitle':
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'italic');
            break;
          case 'label':
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            break;
          case 'list_item':
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            break;
          default:
            pdf.setFontSize(10);
            pdf.setFont('helvetica', block.bold ? 'bold' : block.italic ? 'italic' : 'normal');
        }
        const text = block.style === 'list_item' && !block.text.startsWith('•') ? `• ${block.text}` : block.text;
        const wrapped = pdf.splitTextToSize(text, pageWidth - 2 * margin);
        wrapped.forEach((wl: string) => {
          if (y > pageHeight - 20) { pdf.addPage(); y = 20; }
          pdf.text(wl, block.style === 'list_item' ? margin + 5 : margin, y);
          y += block.style.startsWith('heading') ? 7 : 5;
        });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
      });
    } else if (data?.raw_text) {
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(data.raw_text, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (y > pageHeight - 20) { pdf.addPage(); y = 20; }
        pdf.text(line, margin, y);
        y += 5;
      });
    }

    pdf.save(`scan-${doc.fileName.replace(/\.[^.]+$/, '')}.pdf`);
    toast.success('PDF exported with original layout + editable text!');
  };

  const exportToWord = async (doc: ScannedDocument) => {
    const data = doc.extractedData;
    const children: Paragraph[] = [];

    // Add original image at top
    try {
      const base64Data = doc.image.split(',')[1];
      if (base64Data) {
        const { ImageRun } = await import('docx');
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        
        children.push(new Paragraph({
          children: [new ImageRun({ data: bytes, transformation: { width: 500, height: 700 }, type: 'jpg' })],
          spacing: { after: 400 },
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: '— Original Scan Above | Editable Text Below —', italics: true, size: 18, color: '888888' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }));
      }
    } catch (e) {
      console.warn('Could not embed image in Word:', e);
    }

    // Build formatted content from blocks
    if (data?.formatted_blocks && data.formatted_blocks.length > 0) {
      data.formatted_blocks.forEach(block => {
        switch (block.style) {
          case 'heading1':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, bold: true, size: 32 })],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            }));
            break;
          case 'heading2':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, bold: true, size: 26 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }));
            break;
          case 'heading3':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, bold: true, size: 24 })],
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 160, after: 80 },
            }));
            break;
          case 'subtitle':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, italics: true, size: 24, color: '555555' })],
              spacing: { after: 100 },
            }));
            break;
          case 'label':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, bold: true, size: 22 })],
              spacing: { after: 40 },
            }));
            break;
          case 'list_item':
            children.push(new Paragraph({
              children: [new TextRun({ text: block.text, size: 22 })],
              bullet: { level: 0 },
              spacing: { after: 40 },
            }));
            break;
          default:
            children.push(new Paragraph({
              children: [new TextRun({
                text: block.text,
                bold: block.bold || false,
                italics: block.italic || false,
                size: 22,
              })],
              spacing: { after: 60 },
            }));
        }
      });
    } else if (data?.raw_text) {
      data.raw_text.split('\n').forEach(line => {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 40 },
        }));
      });
    }

    const wordDoc = new Document({
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(wordDoc);
    saveAs(blob, `scan-${doc.fileName.replace(/\.[^.]+$/, '')}.docx`);
    toast.success('Word document exported with original image + formatted text!');
  };

  const exportToExcel = (doc: ScannedDocument) => {
    const data = doc.extractedData;
    let csvContent = '';

    // Key details as rows
    if (data?.key_details && Object.keys(data.key_details).length > 0) {
      csvContent += 'Field,Value\n';
      Object.entries(data.key_details).forEach(([key, val]) => {
        csvContent += `"${key.replace(/"/g, '""')}","${String(val).replace(/"/g, '""')}"\n`;
      });
      csvContent += '\n';
    }

    // Financial items
    if (isFinancialDoc(data) && data?.items?.length) {
      csvContent += 'Description,Quantity,Unit Price,Amount\n';
      data.items.forEach(item => {
        csvContent += `"${item.description}",${item.quantity || 1},${item.unit_price || item.amount},${item.amount}\n`;
      });
      if (data.subtotal !== undefined) csvContent += `\nSubtotal,,,"${data.subtotal}"\n`;
      if (data.tax_amount !== undefined) csvContent += `Tax,,,"${data.tax_amount}"\n`;
      if (data.total_amount !== undefined) csvContent += `Total,,,"${data.total_amount}"\n`;
      csvContent += '\n';
    }

    // Formatted blocks as structured data
    if (data?.formatted_blocks && data.formatted_blocks.length > 0) {
      csvContent += 'Style,Text\n';
      data.formatted_blocks.forEach(block => {
        csvContent += `"${block.style}","${block.text.replace(/"/g, '""')}"\n`;
      });
    } else if (data?.raw_text) {
      csvContent += 'Extracted Text\n';
      data.raw_text.split('\n').forEach(line => {
        csvContent += `"${line.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `scan-${doc.fileName.replace(/\.[^.]+$/, '')}.csv`);
    toast.success('Excel-compatible file (.csv) exported!');
  };

  const exportToPowerPoint = (doc: ScannedDocument) => {
    const data = doc.extractedData;
    const title = data?.title || doc.fileName;
    const docType = data?.document_type?.replace('_', ' ') || 'Document';

    let slides = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:p="urn:schemas-microsoft-com:office:powerpoint" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  body { font-family: Calibri, Arial, sans-serif; }
  .slide { page-break-after: always; padding: 40px; }
  h1 { font-size: 28pt; color: #1a1a2e; margin-bottom: 8px; }
  h2 { font-size: 20pt; color: #16213e; margin-top: 16px; margin-bottom: 4px; }
  h3 { font-size: 16pt; color: #333; margin-top: 12px; }
  p { font-size: 12pt; line-height: 1.5; margin: 4px 0; }
  .subtitle { font-size: 14pt; color: #666; font-style: italic; }
  .label { font-weight: bold; font-size: 12pt; }
  .list-item { font-size: 12pt; margin-left: 20px; }
  img { max-width: 100%; height: auto; }
</style></head><body>`;

    // Slide 1: Original image
    slides += `<div class="slide"><h1>${title}</h1><p class="subtitle">Type: ${docType} | Scanned: ${new Date().toLocaleDateString()}</p>`;
    slides += `<img src="${doc.image}" style="max-height: 500px; margin-top: 10px;" />`;
    slides += '</div>';

    // Content slides with formatted blocks
    if (data?.formatted_blocks && data.formatted_blocks.length > 0) {
      const chunkSize = 12;
      for (let i = 0; i < data.formatted_blocks.length; i += chunkSize) {
        const chunk = data.formatted_blocks.slice(i, i + chunkSize);
        slides += '<div class="slide">';
        chunk.forEach(block => {
          const text = block.text || '';
          switch (block.style) {
            case 'heading1': slides += `<h1>${text}</h1>`; break;
            case 'heading2': slides += `<h2>${text}</h2>`; break;
            case 'heading3': slides += `<h3>${text}</h3>`; break;
            case 'subtitle': slides += `<p class="subtitle">${text}</p>`; break;
            case 'label': slides += `<p class="label">${text}</p>`; break;
            case 'list_item': slides += `<p class="list-item">• ${text}</p>`; break;
            default: {
              const style = (block.bold ? 'font-weight:bold;' : '') + (block.italic ? 'font-style:italic;' : '');
              slides += `<p style="${style}">${text}</p>`;
            }
          }
        });
        slides += '</div>';
      }
    } else if (data?.raw_text) {
      const lines = data.raw_text.split('\n');
      const chunkSize = 15;
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize);
        slides += '<div class="slide">';
        chunk.forEach(line => { slides += `<p>${line || '&nbsp;'}</p>`; });
        slides += '</div>';
      }
    }

    slides += '</body></html>';

    const blob = new Blob([slides], { type: 'application/vnd.ms-powerpoint' });
    saveAs(blob, `scan-${doc.fileName.replace(/\.[^.]+$/, '')}.ppt`);
    toast.success('PowerPoint presentation exported!');
  };

  const exportBatchToPDF = () => {
    const doneDocs = documents.filter(d => d.status === 'done');
    if (doneDocs.length === 0) { toast.error('No scanned documents to export'); return; }

    const pdf = new jsPDF();
    doneDocs.forEach((doc, index) => {
      if (index > 0) pdf.addPage();
      const data = doc.extractedData;
      const margin = 20;
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFontSize(14);
      pdf.text(`${index + 1}. ${doc.fileName}`, margin, 20);
      pdf.setFontSize(9);
      pdf.text(`Type: ${data?.document_type || 'Unknown'}`, margin, 27);

      let y = 35;

      if (data?.raw_text) {
        const lines = pdf.splitTextToSize(data.raw_text, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.text(line, margin, y);
          y += 5;
        });
      }
    });
    pdf.save('batch-scan-report.pdf');
    toast.success(`Exported ${doneDocs.length} documents to PDF!`);
  };

  const doneDocs = documents.filter(d => d.status === 'done');
  const scanningDocs = documents.filter(d => d.status === 'scanning');

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="bg-gradient-to-b from-primary/5 to-background border-b border-border px-4 pt-12 pb-6 safe-top">
          <div className="max-w-lg mx-auto">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Document Scanner</h1>
                <p className="text-sm text-muted-foreground">Scan, extract & convert documents</p>
              </div>
            </motion.div>
          </div>
        </header>

        <div className="px-4 py-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <input ref={batchInputRef} type="file" accept="image/*" multiple onChange={handleBatchSelect} className="hidden" />
            <input ref={toolInputRef} type="file" accept={toolAccept} multiple={toolMultiple} onChange={handleToolFiles} className="hidden" />
            <input ref={toolSecondaryInputRef} type="file" accept="image/*" onChange={handleToolSecondaryFiles} className="hidden" />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="scan" className="flex-1 text-xs gap-1"><Camera className="w-3 h-3" /> Single Scan</TabsTrigger>
                <TabsTrigger value="batch" className="flex-1 text-xs gap-1"><Files className="w-3 h-3" /> Batch Scan</TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="mt-4 space-y-4">
                {!selectedDoc && (
                  <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <FileText className="w-10 h-10 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">Scan a Document</h3>
                      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                        Take a photo or upload an image to extract text and export to PDF or Word
                      </p>
                      <div className="flex gap-3">
                        <Button onClick={handleCameraCapture} className="gap-2"><Camera className="w-4 h-4" /> Camera</Button>
                        <Button variant="outline" onClick={handleGallerySelect} className="gap-2"><Upload className="w-4 h-4" /> Upload</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedDoc && (
                  <>
                    <Card className="overflow-hidden">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" /> {selectedDoc.fileName}
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedDoc(null)}><X className="w-4 h-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="relative">
                          <img src={selectedDoc.image} alt="Document" className="w-full max-h-64 object-contain bg-muted" />
                          {selectedDoc.status === 'scanning' && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <span className="text-sm font-medium">Scanning with AI OCR...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-foreground">Scan Enhancements</div>
                          <Badge variant="secondary" className="text-xs">{selectedDoc.adjustments.filter}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {scanFilters.map((filter) => (
                            <Button
                              key={filter.id}
                              size="sm"
                              variant={selectedDoc.adjustments.filter === filter.id ? 'default' : 'outline'}
                              onClick={() => applyAdjustmentsToDoc(selectedDoc, { ...selectedDoc.adjustments, filter: filter.id })}
                            >
                              {filter.label}
                            </Button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => applyAdjustmentsToDoc(selectedDoc, { ...selectedDoc.adjustments, rotation: selectedDoc.adjustments.rotation - 90 })}
                          >
                            <RotateCcw className="w-3 h-3" /> Rotate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => applyAdjustmentsToDoc(selectedDoc, { ...selectedDoc.adjustments, rotation: selectedDoc.adjustments.rotation + 90 })}
                          >
                            <RotateCw className="w-3 h-3" /> Rotate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => applyAdjustmentsToDoc(selectedDoc, { ...selectedDoc.adjustments, filter: 'enhanced' })}
                          >
                            <Sparkles className="w-3 h-3" /> Auto Enhance
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1"
                            disabled={selectedDoc.status === 'scanning'}
                            onClick={() => rescanDocument(selectedDoc)}
                          >
                            <Loader2 className={cn('w-3 h-3', selectedDoc.status === 'scanning' && 'animate-spin')} /> Re-scan
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {selectedDoc.status === 'done' && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToPDF(selectedDoc)}>
                          <Download className="w-3 h-3" /> PDF
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToWord(selectedDoc)}>
                          <FileType className="w-3 h-3" /> Word
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToExcel(selectedDoc)}>
                          <FileSpreadsheet className="w-3 h-3" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => exportToPowerPoint(selectedDoc)}>
                          <Sheet className="w-3 h-3" /> PPT
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedDoc(null)}>
                          <Plus className="w-3 h-3" /> New
                        </Button>
                      </div>
                    )}

                    <AnimatePresence>
                      {selectedDoc.extractedData && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Data extracted successfully</span>
                            {selectedDoc.extractedData.document_type && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {selectedDoc.extractedData.document_type.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>

                          {/* Auto Receipt Categorization */}
                          {isFinancialDoc(selectedDoc.extractedData) && (() => {
                            const category = categorizeReceipt(
                              selectedDoc.extractedData?.raw_text || '',
                              selectedDoc.extractedData?.vendor_name
                            );
                            return (
                              <Card className="border-primary/20 bg-primary/5">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">Expense Category:</span>
                                    <ReceiptCategoryBadge category={category} />
                                  </div>
                                  <p className="text-xs text-muted-foreground">{getTaxDeductionInfo(category)}</p>
                                </CardContent>
                              </Card>
                            );
                          })()}

                          {/* Key Details */}
                          {selectedDoc.extractedData.key_details && Object.keys(selectedDoc.extractedData.key_details).length > 0 && (
                            <Card>
                              <CardHeader className="pb-3"><CardTitle className="text-base">Key Details</CardTitle></CardHeader>
                              <CardContent className="space-y-2">
                                {Object.entries(selectedDoc.extractedData.key_details).map(([key, val]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">{key}</span>
                                    <span className="font-medium text-sm text-right max-w-[60%]">{val}</span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}

                          {/* Financial data - only for receipts/invoices */}
                          {isFinancialDoc(selectedDoc.extractedData) && selectedDoc.extractedData.items && selectedDoc.extractedData.items.length > 0 && (
                            <Card>
                              <CardHeader className="pb-3"><CardTitle className="text-base">Items</CardTitle></CardHeader>
                              <CardContent>
                                {selectedDoc.extractedData.items.map((item, index) => (
                                  <div key={index} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{item.description}</p>
                                      {item.quantity && item.unit_price && (
                                        <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unit_price, selectedDoc.extractedData?.currency)}</p>
                                      )}
                                    </div>
                                    <span className="font-semibold text-sm">{formatCurrency(item.amount, selectedDoc.extractedData?.currency)}</span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          )}

                          {isFinancialDoc(selectedDoc.extractedData) && selectedDoc.extractedData.total_amount !== undefined && (
                            <Card className="bg-primary/5 border-primary/20">
                              <CardContent className="p-4 space-y-2">
                                {selectedDoc.extractedData.subtotal !== undefined && (
                                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(selectedDoc.extractedData.subtotal, selectedDoc.extractedData.currency)}</span></div>
                                )}
                                {selectedDoc.extractedData.tax_amount !== undefined && (
                                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="text-primary">{formatCurrency(selectedDoc.extractedData.tax_amount, selectedDoc.extractedData.currency)}</span></div>
                                )}
                                <div className="flex justify-between pt-2 border-t border-border">
                                  <span className="font-semibold">Total</span>
                                  <span className="font-bold text-lg">{formatCurrency(selectedDoc.extractedData.total_amount, selectedDoc.extractedData.currency)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Raw extracted text */}
                          {selectedDoc.extractedData.raw_text && (
                            <Card>
                              <CardHeader className="pb-3"><CardTitle className="text-base">Extracted Text</CardTitle></CardHeader>
                              <CardContent>
                                <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
                                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">
                                    {selectedDoc.extractedData.raw_text}
                                  </pre>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Sections removed - raw text is sufficient */}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </TabsContent>

              <TabsContent value="batch" className="mt-4 space-y-4">
                <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Files className="w-10 h-10 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">Batch Scan</h3>
                    <p className="text-xs text-muted-foreground text-center mb-4">Select multiple documents to scan at once</p>
                    <Button onClick={() => batchInputRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" /> Select Files</Button>
                  </CardContent>
                </Card>

                {documents.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">{documents.length} total</Badge>
                      <Badge variant="default" className="text-xs">{doneDocs.length} done</Badge>
                      {scanningDocs.length > 0 && <Badge variant="outline" className="text-xs animate-pulse">{scanningDocs.length} scanning</Badge>}
                    </div>
                    {doneDocs.length > 1 && (
                      <Button size="sm" variant="outline" className="text-xs gap-1" onClick={exportBatchToPDF}>
                        <Download className="w-3 h-3" /> Export All PDF
                      </Button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => { setSelectedDoc(doc); setActiveTab('scan'); }}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <img src={doc.image} alt={doc.fileName} className="w-12 h-12 object-cover rounded-lg" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {doc.status === 'scanning' && <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Scanning...</span></>}
                            {doc.status === 'done' && <><CheckCircle2 className="w-3 h-3 text-green-500" /><span className="text-xs text-muted-foreground">{getDocLabel(doc)}</span></>}
                            {doc.status === 'pending' && <span className="text-xs text-muted-foreground">Ready to rescan</span>}
                            {doc.status === 'error' && <span className="text-xs text-destructive">Failed</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); removeDocument(doc.id); }}>
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Document Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {docTools.map((tool) => (
                    <Button
                      key={tool.id}
                      variant="outline"
                      className="h-24 flex-col gap-2 text-xs"
                      disabled={toolBusy}
                      onClick={() => handleToolClick(tool.id)}
                    >
                      <tool.icon className="w-6 h-6 text-primary" />
                      <span className="text-center leading-tight">{tool.title}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ReceiptScanner;
