"use client";
import * as React from 'react';
import { useMemo, useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';

export type DataTableProps<T extends object> = {
	columns: ColumnDef<T, any>[];
	data: T[];
	globalFilterPlaceholder?: string;
	showGlobalFilter?: boolean;
};

export default function DataTable<T extends object>({ columns, data, globalFilterPlaceholder, showGlobalFilter = true }: DataTableProps<T>) {
	const [globalFilter, setGlobalFilter] = useState('');
	const table = useReactTable({
		data,
		columns,
		state: { globalFilter },
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		globalFilterFn: 'auto'
	});

	return (
		<div className="space-y-3">
			{showGlobalFilter && (
				<div className="flex items-center justify-between">
					<input
						className="border rounded px-3 py-2 w-64"
						placeholder={globalFilterPlaceholder || 'Ara'}
						value={globalFilter}
						onChange={(e)=>setGlobalFilter(e.target.value)}
					/>
				</div>
			)}
			<div className="rounded-lg border border-gray-300 shadow-sm overflow-x-auto max-h-[70vh] overflow-y-auto">
				<table className="min-w-full text-sm border border-gray-300 border-collapse rounded-lg">
					<thead className="bg-gray-50 sticky top-0 z-[5] border-b border-gray-300">
						{table.getHeaderGroups().map(hg => (
							<tr key={hg.id}>
								{hg.headers.map(h => (
									<th key={h.id} className="text-left px-3 py-2 font-semibold text-gray-700 border border-gray-300 bg-gray-50">
										{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.length === 0 && (
							<tr>
								<td className="px-3 py-6 text-center text-gray-500 border border-gray-200" colSpan={table.getAllLeafColumns().length}>Kayıt bulunamadı</td>
							</tr>
						)}
						{table.getRowModel().rows.map(row => (
							<tr key={row.id} className="hover:bg-gray-50 odd:bg-gray-50/30 transition-colors">
								{row.getVisibleCells().map(cell => (
									<td key={cell.id} className="px-3 py-2 align-middle border border-gray-200">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="flex gap-2 items-center">
				<button className="px-3 py-1 border rounded" onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()}>Önceki</button>
				<button className="px-3 py-1 border rounded" onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()}>Sonraki</button>
				<div className="text-xs text-gray-500">Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</div>
			</div>
		</div>
	);
}
