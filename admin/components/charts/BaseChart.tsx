"use client";
import * as React from "react";

type BaseChartProps = {
	/** Başlık ve açıklama üstte gösterilir */
	title?: string;
	description?: string;
	/** Yükleniyor durumu için skeleton */
	isLoading?: boolean;
	/** Boş veri mesajı */
	emptyText?: string;
	/** Hata mesajı ve tekrar dene callback'i */
	errorMessage?: string | null;
	onRetry?: () => void;
	/** Erişilebilirlik etiketi */
	ariaLabel?: string;
	/** Grafik render alanı. Responsive container içerisine basılır */
	children?: React.ReactNode;
};

export default function BaseChart({
	title,
	description,
	isLoading,
	emptyText = "Veri bulunamadı",
	errorMessage,
	onRetry,
	ariaLabel,
	children
}: BaseChartProps) {
	return (
		<section className="border rounded-lg p-3 space-y-2" aria-label={ariaLabel}>
			{(title || description) && (
				<header className="space-y-1">
					{title && <h3 className="font-semibold">{title}</h3>}
					{description && <p className="text-xs text-gray-500">{description}</p>}
				</header>
			)}
			{isLoading ? (
				<div className="animate-pulse h-48 bg-gray-100 rounded" />
			) : errorMessage ? (
				<div className="flex items-center justify-between bg-red-50 text-red-700 text-sm p-3 rounded">
					<span>{errorMessage}</span>
					{onRetry && (
						<button className="px-2 py-1 border rounded" onClick={onRetry} aria-label="Tekrar dene">Tekrar dene</button>
					)}
				</div>
			) : children ? (
				<div className="relative w-full h-64 overflow-hidden">{children}</div>
			) : (
				<div className="text-sm text-gray-500">{emptyText}</div>
			)}
		</section>
	);
}


