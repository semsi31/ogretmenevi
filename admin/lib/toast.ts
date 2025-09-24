"use client";

type Toast = { id: number; message: string; type?: 'success' | 'error' | 'info' };

const listeners = new Set<(t: Toast) => void>();
let counter = 1;

export function subscribe(listener: (t: Toast) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function toast(message: string, type: Toast['type'] = 'info') {
  const t: Toast = { id: counter++, message, type };
  listeners.forEach((l) => l(t));
}


