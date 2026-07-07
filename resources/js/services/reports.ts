import type {
    StockLevelsReport,
    StockLevelsFilters,
    MovementHistoryReport,
    MovementHistoryFilters,
    FinancialReport,
    IncomeStatementReport,
    FinancialPositionReport,
    CustomerReferenceReport,
    SalesByClientFilters,
    SalesByClientReport,
    DailyFinancialSummary,
    BalanceSheetReport,
    FinancialAdjustment,
    FinancialAdjustmentType,
    CapitalMovement,
    FinancialDrilldownReport,
    FinancialAdvancedStatusReport,
    AccountingAccountsReport,
    AccountingJournalEntry,
    AccountingLedgerReport,
    AccountingPaginatedReport,
} from '@/types/report';
import apiClient from './api/client';

export const ReportsApiService = {
    /**
     * Get stock levels report
     */
    async getStockLevels(
        filters?: StockLevelsFilters,
    ): Promise<StockLevelsReport> {
        const response = await apiClient.get('/reports/stock-levels', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Get movement history report
     */
    async getMovementHistory(
        filters: MovementHistoryFilters,
    ): Promise<MovementHistoryReport> {
        const response = await apiClient.get('/reports/movement-history', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Export stock levels report
     */
    async exportStockLevels(
        format: 'pdf' | 'excel',
        filters?: StockLevelsFilters,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/stock-levels/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    async exportInventoryItems(
        format: 'csv' | 'excel' | 'xlsx',
        filters?: Record<string, any>,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/inventory-items/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    /**
     * Export movement history report
     */
    async exportMovementHistory(
        format: 'pdf' | 'excel',
        filters: MovementHistoryFilters,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/movement-history/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    /**
     * Get financial report
     */
    async getFinancialReport(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<FinancialReport> {
        const response = await apiClient.get('/reports/financial', {
            params: filters,
        });
        return response.data;
    },

    async getIncomeStatement(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        basis?: 'cash' | 'accrual_operational';
        compare?: 'previous_period' | 'none';
    }): Promise<IncomeStatementReport> {
        const response = await apiClient.get('/reports/income-statement', {
            params: filters,
        });
        return response.data;
    },

    async getFinancialPosition(filters: {
        warehouse_id?: number | null;
        date_to?: string | null;
        mode?: 'current_snapshot' | 'as_of';
    }): Promise<FinancialPositionReport> {
        const response = await apiClient.get('/reports/financial-position', {
            params: filters,
        });
        return response.data;
    },

    async getCustomerReferences(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        customer_id?: number | null;
    }): Promise<CustomerReferenceReport> {
        const response = await apiClient.get('/reports/customer-references', {
            params: filters,
        });
        return response.data;
    },

    async getSalesByClient(
        filters: SalesByClientFilters,
    ): Promise<SalesByClientReport> {
        const response = await apiClient.get('/reports/sales-by-client', {
            params: filters,
        });
        return response.data;
    },

    async exportSalesByClient(
        format: 'pdf' | 'excel',
        filters: SalesByClientFilters,
    ): Promise<Blob> {
        const response = await apiClient.get(
            `/reports/sales-by-client/export/${format}`,
            {
                params: filters,
                responseType: 'blob',
            },
        );
        return response.data;
    },

    /**
     * Get brand profitability report
     */
    async getBrandProfitability(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<any> {
        const response = await apiClient.get('/reports/brand-profitability', {
            params: filters,
        });
        return response.data;
    },

    /**
     * Get category profitability report
     */
    async getCategoryProfitability(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
    }): Promise<any> {
        const response = await apiClient.get(
            '/reports/category-profitability',
            {
                params: filters,
            },
        );
        return response.data;
    },

    /**
     * Get Z-Report
     */
    async getZReport(
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ): Promise<any> {
        const response = await apiClient.get('/reports/z-report', {
            params: { date, warehouse_id, user_id },
        });
        return response.data;
    },

    /**
     * Export Z-Report
     */
    async exportZReport(
        date: string,
        warehouse_id?: number,
        user_id?: number,
    ): Promise<Blob> {
        const response = await apiClient.get(`/reports/z-report/export`, {
            params: { date, warehouse_id, user_id },
            responseType: 'blob',
        });
        return response.data;
    },

    async getDailySummary(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        rebuild?: boolean;
    }): Promise<DailyFinancialSummary> {
        const response = await apiClient.get('/reports/daily-summary', {
            params: filters,
        });
        return response.data;
    },

    async getFinancialSnapshots(filters: {
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        rebuild?: boolean;
    }): Promise<DailyFinancialSummary> {
        const response = await apiClient.get('/reports/financial-snapshots', {
            params: filters,
        });
        return response.data;
    },

    async getFinancialWeekly(filters: {
        date?: string | null;
        week_start?: string | null;
        warehouse_id?: number | null;
        rebuild?: boolean;
    }): Promise<DailyFinancialSummary> {
        const response = await apiClient.get('/reports/financial-weekly', {
            params: filters,
        });
        return response.data;
    },

    async getBalanceSheet(filters: {
        date_from?: string | null;
        date_to?: string | null;
        warehouse_id?: number | null;
    }): Promise<BalanceSheetReport> {
        const response = await apiClient.get('/reports/balance-sheet', {
            params: filters,
        });
        return response.data;
    },

    async getFinancialDrilldown(filters: {
        metric: string;
        date_from: string;
        date_to: string;
        warehouse_id?: number | null;
        expense_category?: string | null;
        expense_group?: string | null;
        page?: number;
        per_page?: number;
    }): Promise<FinancialDrilldownReport> {
        const response = await apiClient.get('/reports/financial-drilldown', {
            params: filters,
        });
        return response.data;
    },

    async getFinancialAdvancedStatus(): Promise<FinancialAdvancedStatusReport> {
        const response = await apiClient.get(
            '/reports/financial-advanced-status',
        );
        return response.data;
    },

    async getAccountingJournal(filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
        page?: number;
        per_page?: number;
    }): Promise<AccountingPaginatedReport<AccountingJournalEntry>> {
        const response = await apiClient.get('/reports/accounting/journal', {
            params: filters,
        });
        return response.data;
    },

    async getAccountingAccounts(filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }): Promise<AccountingAccountsReport> {
        const response = await apiClient.get('/reports/accounting/accounts', {
            params: filters,
        });
        return response.data;
    },

    async getAccountingAccountLedger(
        accountId: number,
        filters?: {
            date_from?: string;
            date_to?: string;
            warehouse_id?: number | null;
            page?: number;
            per_page?: number;
        },
    ): Promise<AccountingLedgerReport> {
        const response = await apiClient.get(
            `/reports/accounting/accounts/${accountId}/ledger`,
            { params: filters },
        );
        return response.data;
    },

    async getAccountingTAccount(
        accountId: number,
        filters?: {
            date_from?: string;
            date_to?: string;
            warehouse_id?: number | null;
            page?: number;
            per_page?: number;
        },
    ): Promise<AccountingLedgerReport> {
        const response = await apiClient.get(
            `/reports/accounting/accounts/${accountId}/t-account`,
            { params: filters },
        );
        return response.data;
    },

    async getAccountingTrialBalance(filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }): Promise<AccountingAccountsReport> {
        const response = await apiClient.get(
            '/reports/accounting/trial-balance',
            { params: filters },
        );
        return response.data;
    },

    async createAdjustment(payload: {
        type: FinancialAdjustmentType;
        amount: number;
        reason: string;
        adjustment_date: string;
        warehouse_id?: number | null;
        notes?: string | null;
    }): Promise<FinancialAdjustment> {
        const response = await apiClient.post('/reports/adjustments', payload);
        return response.data.data;
    },

    async getAdjustments(filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }): Promise<FinancialAdjustment[]> {
        const response = await apiClient.get('/reports/adjustments', {
            params: filters,
        });
        return response.data.data ?? [];
    },

    async createCapitalMovement(payload: {
        movement_type: 'in' | 'out';
        amount: number;
        reason: string;
        movement_date: string;
        warehouse_id?: number | null;
        notes?: string | null;
    }): Promise<CapitalMovement> {
        const response = await apiClient.post(
            '/reports/capital-movements',
            payload,
        );
        return response.data.data;
    },

    async getCapitalMovements(filters?: {
        date_from?: string;
        date_to?: string;
        warehouse_id?: number | null;
    }): Promise<CapitalMovement[]> {
        const response = await apiClient.get('/reports/capital-movements', {
            params: filters,
        });
        return response.data.data ?? [];
    },
};
