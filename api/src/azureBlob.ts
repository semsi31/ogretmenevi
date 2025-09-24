import { BlobServiceClient } from '@azure/storage-blob';
import { config } from './config';
import { randomUUID } from 'crypto';

function getBlobServiceClient(): BlobServiceClient {
  if (config.azure.sasUrl) {
    return new BlobServiceClient(config.azure.sasUrl!);
  }
  if (config.azure.connectionString) {
    return BlobServiceClient.fromConnectionString(config.azure.connectionString);
  }
  // Fallback to Azurite default
  if (process.env.NODE_ENV !== 'production') {
    const conn =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
    return BlobServiceClient.fromConnectionString(conn);
  }
  throw new Error('Azure Blob credentials are not configured');
}

export async function uploadBuffer(buffer: Buffer, originalName: string, folder = ''): Promise<string> {
  const client = getBlobServiceClient();
  const container = client.getContainerClient(config.azure.container);
  await container.createIfNotExists({ access: 'container' });
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
  const fileName = `${folder ? folder.replace(/\/$/, '') + '/' : ''}${randomUUID()}.${ext}`;
  const block = container.getBlockBlobClient(fileName);
  await block.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: detectContentType(originalName) }
  });
  return block.url;
}

function detectContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}


