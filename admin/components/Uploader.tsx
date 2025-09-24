"use client";
import { useState } from 'react';
import { apiFetchAuth } from '@/lib/api';

type Props = {
	folder: 'transport' | 'explore' | 'home' | 'food';
	accept: string;
	maxSizeMB: number;
	label?: string;
	value?: string;
	onChange: (url: string) => void;
};

export default function Uploader({ folder, accept, maxSizeMB, label, value, onChange }: Props) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [progress, setProgress] = useState<number>(0);

	async function handleFile(file: File) {
		setBusy(true); setError(null); setProgress(0);
		try {
			const type: 'image' | 'pdf' = file.type === 'application/pdf' ? 'pdf' : 'image';
			const endpoint = folder === 'transport' ? '/api/routes/upload-sas' : folder === 'explore' ? '/api/explore/upload-sas' : folder === 'food' ? '/api/restaurants/upload-sas' : '/api/sliders/upload-sas';
			const sas = await apiFetchAuth<{ uploadUrl: string; blobUrl: string; expiresOn: string }>(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, size: file.size })
			});
			await putWithProgress(sas.uploadUrl, file, (p)=>setProgress(p));
			onChange(sas.blobUrl);
		} catch (e: any) {
			setError(e.message || 'Yükleme hatası');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-1">
			<label className="block text-sm font-medium">{label || 'Dosya'}</label>
			<input
				type="file"
				accept={accept}
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (!f) return;
					if (f.size > maxSizeMB * 1024 * 1024) { setError(`Dosya en fazla ${maxSizeMB}MB`); return; }
					handleFile(f);
				}}
				disabled={busy}
				className="block"
			/>
			{value && (
				<div className="text-xs break-all">
					<a href={value} target="_blank" rel="noreferrer" className="text-blue-600 underline">Yüklendi: {value}</a>
				</div>
			)}
			{busy && <div className="text-xs text-gray-500">Yükleniyor… {progress}%</div>}
			{error && <div className="text-xs text-red-600">{error}</div>}
		</div>
	);
}

async function putWithProgress(uploadUrl: string, file: File, onProgress: (p: number) => void) {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', uploadUrl, true);
		xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
		xhr.setRequestHeader('Content-Type', file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(`Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error('Network error'));
		xhr.send(file);
	});
}


