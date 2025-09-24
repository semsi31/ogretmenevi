"use client";
import * as React from 'react';
import BaseChart from '@/components/charts/BaseChart';

export type Metric = { label: string; value: number };

export default function KesfetGrafikler({ metrics, isLoading, error, onRetry }: { metrics: Metric[]; isLoading?: boolean; error?: string | null; onRetry?: () => void }) {
	const total = React.useMemo(() => metrics?.reduce((a, b) => a + (b?.value || 0), 0), [metrics]);
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			<BaseChart title="Kategori Dağılımı" description="Kayıt sayısına göre" isLoading={!!isLoading} errorMessage={error || null} onRetry={onRetry} ariaLabel="Kategori dağılım grafiği">
				{metrics && metrics.length > 0 && (
					<ul className="absolute inset-0 p-3 overflow-auto">
						{metrics.map((m) => (
							<li key={m.label} className="flex items-center justify-between border-b py-1 text-sm">
								<span>{m.label}</span>
								<span aria-label={`${m.label} değeri`}>{m.value.toLocaleString('tr-TR')}</span>
							</li>
						))}
					</ul>
				)}
			</BaseChart>
			<BaseChart title="Toplam" description="Özet" isLoading={!!isLoading} errorMessage={error || null} onRetry={onRetry} ariaLabel="Toplam özet kutusu">
				<div className="grid place-items-center h-full text-3xl font-semibold">{(total || 0).toLocaleString('tr-TR')}</div>
			</BaseChart>
		</div>
	);
}


