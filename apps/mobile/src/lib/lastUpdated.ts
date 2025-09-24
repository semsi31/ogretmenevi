import { useQueryClient } from '@tanstack/react-query';

export function useLastUpdatedLabel(queryKeys: Array<readonly unknown[]>): string | null {
  const qc = useQueryClient();
  const times: number[] = [];
  for (const key of queryKeys) {
    const q = qc.getQueryCache().find({ queryKey: key });
    if (q?.state.dataUpdatedAt) times.push(q.state.dataUpdatedAt);
  }
  if (!times.length) return null;
  const last = new Date(Math.max(...times));
  return `Son güncelleme: ${formatDateTime(last)}`;
}

function pad(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

function formatDateTime(d: Date): string {
  // DD.MM.YYYY HH:mm
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}


