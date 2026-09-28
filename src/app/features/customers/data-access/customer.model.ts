export type CustomerSummary = {
    totalCustomers: number;
    customersWithEmail: number;
    customersWithPhone: number;
    customersWithoutContact: number;
}

export type Customer = {
    id: string;
    name: string;
    document: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CreateCustomerRequest = {
    name: string;
    document: string | null;
    phone: string | null;
    email: string |null;
    address: string | null;
};

export type UpdateCustomerRequest = CreateCustomerRequest & {
    active: boolean;
}
