export type DashboardSummary = {
    todaySalesTotal:number;
    monthSalesTotal: number;
    todaySalesCount: number;
    lowStockProducts: LowStockProduct[];
    topSellingProducts: TopSellingProduct[];
    recentSales: RecentSale[];
}

export type LowStockProduct = {
    productId: string;
    name: string;
    stock: number;
    minimumStock: number;
}

export type TopSellingProduct = {
    productId: string;
    productName: string;
    quantitySold: number;
    totalSold: number;
}

export type RecentSale = {
    saleId: string;
    customerName: string;
    total: number;
    saleDateTime: string;
}