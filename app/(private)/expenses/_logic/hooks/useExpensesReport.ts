"use client";

import { useState, useEffect, useCallback } from "react";
import { getExpensesReport, downloadExpensesReportPdf, downloadExpensesReportXlsx } from "../services/getExpensesReport";
import type { ExpensesReportDto } from "../types/api";
import type { ExpenseFilters } from "../types/domain";

interface UseExpensesReportResult {
  report: ExpensesReportDto | null;
  isLoading: boolean;
  error: Error | null;
  isExporting: boolean;
  exportError: Error | null;
  refresh: () => void;
  exportPdf: () => Promise<void>;
  exportXlsx: () => Promise<void>;
}

export function useExpensesReport(
  filters: ExpenseFilters & { page?: number; pageSize?: number }
): UseExpensesReportResult {
  const [report, setReport] = useState<ExpensesReportDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const { page = 1, pageSize = 50, branchId, concept, from, to, includeInactive } = filters;

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getExpensesReport({ page, pageSize, branchId, concept, from, to, includeInactive, signal: controller.signal })
      .then((data) => {
        setReport(data);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err);
        setIsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, branchId, concept, from, to, includeInactive, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await downloadExpensesReportPdf({ branchId, concept, from, to, includeInactive });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `expenses-report-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err as Error);
    } finally {
      setIsExporting(false);
    }
  }, [branchId, concept, from, to, includeInactive]);

  const exportXlsx = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await downloadExpensesReportXlsx({ branchId, concept, from, to, includeInactive });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `expenses-report-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err as Error);
    } finally {
      setIsExporting(false);
    }
  }, [branchId, concept, from, to, includeInactive]);

  return { report, isLoading, error, isExporting, exportError, refresh, exportPdf, exportXlsx };
}
