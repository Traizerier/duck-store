import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { Duck } from "../models/Duck";
import { useTranslation } from "../i18n/locale";

const columnHelper = createColumnHelper<Duck>();

interface DuckTableProps {
  ducks: Duck[];
  onEdit: (duck: Duck) => void;
  onDelete: (duck: Duck) => void;
}

export function DuckTable({ ducks, onEdit, onDelete }: DuckTableProps) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "quantity", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", { header: () => t("col.id") }),
      columnHelper.accessor("color", {
        header: () => t("col.color"),
        cell: ({ getValue }) => t(`color.${getValue()}`),
      }),
      columnHelper.accessor("size", {
        header: () => t("col.size"),
        cell: ({ getValue }) => t(`size.${getValue()}`),
      }),
      columnHelper.accessor("price", {
        header: () => t("col.price"),
        cell: ({ getValue }) => t("price.format", { value: getValue() }),
      }),
      columnHelper.accessor("quantity", {
        header: () => t("col.quantity"),
      }),
      columnHelper.display({
        id: "actions",
        enableSorting: false,
        header: () => t("col.actions"),
        cell: ({ row }) => (
          <>
            <button type="button" onClick={() => onEdit(row.original)}>
              {t("action.edit")}
            </button>
            <button type="button" onClick={() => onDelete(row.original)}>
              {t("action.delete")}
            </button>
          </>
        ),
      }),
    ],
    [onEdit, onDelete, t],
  );

  const table = useReactTable({
    data: ducks,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    sortDescFirst: false,
    initialState: { pagination: { pageSize: 10 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (ducks.length === 0) {
    return <p className="duck-table-empty">{t("table.empty")}</p>;
  }

  const pageCount = table.getPageCount();
  const { pageIndex } = table.getState().pagination;

  return (
    <div className="duck-table-container">
      <input
        type="search"
        placeholder={t("table.search")}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="duck-table-search"
      />

      <table className="duck-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                const content = (
                  <>
                    <span>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                    {sortDir === "asc" && <span aria-hidden="true"> ▲</span>}
                    {sortDir === "desc" && <span aria-hidden="true"> ▼</span>}
                  </>
                );
                return (
                  <th
                    key={header.id}
                    aria-sort={
                      sortDir === "asc"
                        ? "ascending"
                        : sortDir === "desc"
                          ? "descending"
                          : undefined
                    }
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="sort-button"
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pageCount > 1 && (
        <div className="duck-table-pagination">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t("table.prev")}
          </button>
          <span>
            {t("table.pageOf", { current: pageIndex + 1, total: pageCount })}
          </span>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t("table.next")}
          </button>
        </div>
      )}
    </div>
  );
}
