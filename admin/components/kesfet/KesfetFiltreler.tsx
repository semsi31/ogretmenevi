"use client";
import * as React from 'react';

export type KesfetFiltrelerProps = {
	category: string;
	setCategory: (v: string) => void;
	published: 'all' | 'true' | 'false';
	setPublished: (v: 'all' | 'true' | 'false') => void;
	query: string;
	setQuery: (v: string) => void;
	onClear: () => void;
};

export default function KesfetFiltreler({ category, setCategory, published, setPublished, query, setQuery, onClear }: KesfetFiltrelerProps) {
	return (
		<div className="flex gap-2 items-center">
			<input className="border p-1" placeholder="Ara" value={query} onChange={(e)=>setQuery(e.target.value)} aria-label="Genel arama" />
			<input className="border p-1" placeholder="Kategori" value={category} onChange={(e)=>setCategory(e.target.value)} aria-label="Kategori" />
			<select className="border p-1" value={published} onChange={(e)=>setPublished(e.target.value as any)} aria-label="Yayın durumu">
				<option value="all">Yayın (hepsi)</option>
				<option value="true">Yayında</option>
				<option value="false">Yayında değil</option>
			</select>
			<button className="ml-auto px-3 py-1 border" onClick={onClear} aria-label="Filtreleri temizle">Temizle</button>
		</div>
	);
}


