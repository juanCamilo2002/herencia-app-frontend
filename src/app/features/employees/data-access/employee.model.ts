export type EmployeeSummary = {
    totalEmployees: number;
    employeesWithEmail: number;
    employeesWithPhone: number;
    employeesWithoutContact: number;
};

export type Employee = {
    id: string;
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    position: string | null;
    hireDate: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
};

export type CreateEmployeeRequest = {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    position: string | null;
    hireDate: string | null;
};

export type UpdateEmployeeRequest = CreateEmployeeRequest;