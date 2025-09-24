"use client";
import { useState } from 'react';
import Uploader from '@/components/Uploader';

export default function UploadTestPage() {
  const [pngUrl, setPngUrl] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');

  return (
    <div className="max-w-xl mx-auto space-y-6 p-4">
      <h1 className="text-xl font-semibold">SAS Upload Test</h1>
      <Uploader folder="transport" accept="image/png" maxSizeMB={5} label="PNG (≤5MB)" value={pngUrl} onChange={setPngUrl} />
      {pngUrl && <img src={pngUrl} alt="preview" className="border max-h-64" />}
      <Uploader folder="transport" accept="application/pdf" maxSizeMB={10} label="PDF (≤10MB)" value={pdfUrl} onChange={setPdfUrl} />
      {pdfUrl && <iframe src={pdfUrl} className="w-full h-96 border" />}
    </div>
  );
}