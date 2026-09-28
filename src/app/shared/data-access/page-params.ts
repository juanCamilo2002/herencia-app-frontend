import { HttpParams } from '@angular/common/http';
import { PageRequest } from './page.model';

export function pageParams(request: PageRequest) {
  let params = new HttpParams()
    .set('page', String(request.page))
    .set('size', String(request.size));

  if (request.sort) {
    params = params.set('sort', request.sort);
  }

  return params;
}