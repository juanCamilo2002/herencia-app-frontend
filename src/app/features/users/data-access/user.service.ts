import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { CreateUserRequest, UpdateUserRequest, User, UserRoleOption, UserSummary } from "./user.model";
import { PageRequest, PageResponse } from "../../../shared/data-access/page.model";
import { pageParams } from "../../../shared/data-access/page-params";

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private readonly http = inject(HttpClient);

    getUsers(request: PageRequest) {
        return this.http.get<PageResponse<User>>('/users', {
            params: pageParams(request),
        });
    }

    getSummary() {
        return this.http.get<UserSummary>('/users/summary');
    }


    getRoles() {
        return this.http.get<UserRoleOption[]>('/users/roles');
    }

    createUser(request: CreateUserRequest) {
        return this.http.post<User>('/users', request);
    }

    updateUser(id: string, request: UpdateUserRequest) {
        return this.http.put<User>(`/users/${id}`, request);
    }

    disableUser(id: string) {
        return this.http.delete<void>(`/users/${id}`);
    }
}