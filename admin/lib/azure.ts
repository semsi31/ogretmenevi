// lib/azure.ts
'use server'

import { API_BASE, apiFetchServer } from './api';

export async function getSasForPath(folder: 'transport' | 'explore' | 'home', contentType: 'image' | 'pdf', sizeBytes?: number) {
	const map: Record<typeof folder, string> = {
		transport: '/api/routes/upload-sas',
		explore: '/api/explore/upload-sas',
		home: '/api/sliders/upload-sas'
	};
	// server-side call ensures JWT cookie is attached
	return await apiFetchServer<{ uploadUrl: string; blobUrl: string; expiresOn: string }>(map[folder], {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type: contentType, size: sizeBytes })
	});
}
