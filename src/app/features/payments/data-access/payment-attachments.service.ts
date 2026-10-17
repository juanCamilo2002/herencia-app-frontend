import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface PaymentAttachment {
  id: string;
  paymentId: string;
  saleId: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
  removedByName: string | null;
  removedAt: string | null;
  removalReason: string | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentAttachmentsService {
  private readonly http = inject(HttpClient);

  list(saleId: string, paymentId: string) {
    return this.http.get<PaymentAttachment[]>(this.url(saleId, paymentId));
  }

  upload(saleId: string, paymentId: string, file: File, expectedId: string | null) {
    const body = new FormData();
    body.append('file', file);
    if (expectedId) body.append('expectedAttachmentId', expectedId);
    return this.http.post<PaymentAttachment>(this.url(saleId, paymentId), body);
  }

  remove(saleId: string, paymentId: string, attachmentId: string, reason: string) {
    return this.http.post<PaymentAttachment>(
      `${this.url(saleId, paymentId)}/${attachmentId}/remove`,
      { reason },
    );
  }

  download(saleId: string, paymentId: string, attachmentId: string) {
    return this.http.get(`${this.url(saleId, paymentId)}/${attachmentId}/download`, {
      responseType: 'blob',
    });
  }

  private url(saleId: string, paymentId: string) {
    return `/sales/${saleId}/payments/${paymentId}/attachments`;
  }
}
