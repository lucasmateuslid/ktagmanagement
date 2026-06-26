"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Search, Filter } from "lucide-react";
import { cn } from "../../lib/utils";

export type DataTableColumn<T> = {
  key: keyof T;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
};

export type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  showPagination?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  className,
  searchable = true,
  searchPlaceholder = "Search...",
  itemsPerPage = 10,
  showPagination = true,
  striped = false,
  hoverable = true,
  bordered = true,
  compact = false,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: "asc" | "desc";
  }>({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {},
  );

  // Filter data based on search and column filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Global search
    if (search) {
      filtered = filtered.filter((row) =>
        columns.some((column) => {
          const value = row[column.key];
          return value?.toString().toLowerCase().includes(search.toLowerCase());
        }),
      );
    }

    // Column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        filtered = filtered.filter((row) => {
          const rowValue = row[key as keyof T];
          return rowValue
            ?.toString()
            .toLowerCase()
            .includes(value.toLowerCase());
        });
      }
    });

    return filtered;
  }, [data, search, columnFilters, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;

    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, showPagination]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleColumnFilter = (key: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  };

  const clearColumnFilter = (key: string) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };
  if (loading) {
    return (
      <div className={cn("w-full bg-card rounded-2xl ", className)}>
        <div className="animate-pulse p-6">
          {/* Search skeleton */}
          {searchable && <div className="mb-6 h-11 bg-muted rounded-2xl"></div>}
          {/* Table skeleton */}
          <div className="border border-border  overflow-hidden">
            <div className="bg-muted/30 h-14"></div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 border-t border-border bg-card"
              ></div>
            ))}
          </div>
          {/* Pagination skeleton */}
          <div className="mt-6 flex justify-between items-center">
            <div className="h-4 bg-muted rounded w-48"></div>
            <div className="flex gap-2">
              <div className="h-9 w-20 bg-muted rounded-2xl"></div>
              <div className="h-9 w-9 bg-muted rounded-2xl"></div>
              <div className="h-9 w-9 bg-muted rounded-2xl"></div>
              <div className="h-9 w-16 bg-muted rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden shadow-sm",
        bordered && "border border-zinc-200 dark:border-zinc-800",
        className,
      )}
    >
      {/* Search and Filters */}
      {searchable && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 lg:px-8 lg:py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-zinc-300 dark:focus:border-zinc-700 transition-all font-medium placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}
      {/* Table */}
      <div
        className={cn(
          "overflow-hidden overflow-x-auto",
        )}
      >
        <div className="min-w-full inline-block align-middle">
          <table className="w-full min-w-full">
            <thead className="">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "text-left font-black tracking-widest uppercase text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30",
                      compact ? "px-4 py-3" : "px-8 py-5",
                      column.sortable &&
                        "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                      column.width && `w-[${column.width}]`,
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{column.header}</span>
                        {column.sortable && (
                          <div className="flex flex-col">
                            <ChevronUp
                              className={cn(
                                "h-3 w-3",
                                sortConfig.key === column.key &&
                                  sortConfig.direction === "asc"
                                  ? "text-primary-500"
                                  : "text-zinc-400 dark:text-zinc-600",
                              )}
                            />
                            <ChevronDown
                              className={cn(
                                "h-3 w-3 -mt-1",
                                sortConfig.key === column.key &&
                                  sortConfig.direction === "desc"
                                  ? "text-primary-500"
                                  : "text-zinc-400 dark:text-zinc-600",
                              )}
                            />
                          </div>
                        )}
                      </div>
                      {column.filterable && (
                        <div className="relative">
                          <Filter className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
                        </div>
                      )}
                    </div>
                    {/* Column Filter */}
                    {column.filterable && (
                      <div className="mt-3">
                        <input
                          type="text"
                          placeholder="Filtro..."
                          value={columnFilters[String(column.key)] || ""}
                          onChange={(e) =>
                            handleColumnFilter(
                              String(column.key),
                              e.target.value,
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-3 py-1.5 text-xs text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary-500/20 transition-all font-medium"
                        />
                        {columnFilters[String(column.key)] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearColumnFilter(String(column.key));
                            }}
                            className="absolute right-2 top-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className={cn(
                      "text-center text-zinc-500",
                      compact ? "px-4 py-12" : "px-6 py-16",
                    )}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="text-4xl">📊</div>
                      <div className="font-medium">{emptyMessage}</div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "transition-colors group",
                      striped && index % 2 === 0 && "bg-zinc-50 dark:bg-zinc-950/20",
                      hoverable && "hover:bg-zinc-50 dark:hover:bg-white/5",
                      onRowClick && "cursor-pointer",
                    )}
                    onClick={() => onRowClick?.(row, index)}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={cn(
                          "text-sm text-zinc-700 dark:text-zinc-300",
                          compact ? "px-4 py-3" : "px-8 py-5",
                        )}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : String(row[column.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 lg:px-8 lg:py-5 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 order-2 sm:order-1">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, sortedData.length)} de{" "}
            {sortedData.length} resultados
          </div>
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const pageNumber =
                  currentPage <= 3
                    ? i + 1
                    : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i;

                if (pageNumber < 1 || pageNumber > totalPages) return null;

                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-xl font-bold text-xs transition-all",
                      currentPage === pageNumber
                        ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20"
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                    )}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
