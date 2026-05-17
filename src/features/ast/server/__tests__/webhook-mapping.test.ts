import { describe, expect, it } from 'vitest';
import type { DocuSealSubmission } from '@/lib/docuseal/types';
import {
  extractDeclineReason,
  mapDocuSealEventToStatus,
  mapDocuSealSubmissionStatus,
  signedDocumentUrl,
  signUrlFor,
} from '../webhook-mapping';

const baseSubmission: DocuSealSubmission = {
  id: 'sub_123',
  status: 'pending',
  template_id: 'tmpl_1',
  submitters: [
    {
      id: 1,
      email: 'landlord@example.com',
      role: 'landlord',
      status: 'pending',
      url: 'https://ds.example/landlord',
    },
    {
      id: 2,
      email: 'tenant@example.com',
      role: 'tenant',
      status: 'pending',
      embed_src: 'https://ds.example/tenant-embed',
    },
  ],
  audit_log_url: null,
  created_at: '2026-04-29T00:00:00Z',
};

describe('mapDocuSealEventToStatus', () => {
  it('maps event types to envelope statuses', () => {
    expect(mapDocuSealEventToStatus('submission.created')).toBe('sent');
    expect(mapDocuSealEventToStatus('submission.opened')).toBe('opened');
    expect(mapDocuSealEventToStatus('submission.completed')).toBe('completed');
    expect(mapDocuSealEventToStatus('submission.declined')).toBe('declined');
    expect(mapDocuSealEventToStatus('submission.expired')).toBe('expired');
  });
});

describe('mapDocuSealSubmissionStatus', () => {
  it('maps submission statuses to envelope statuses', () => {
    expect(mapDocuSealSubmissionStatus('pending')).toBe('sent');
    expect(mapDocuSealSubmissionStatus('opened')).toBe('opened');
    expect(mapDocuSealSubmissionStatus('completed')).toBe('completed');
    expect(mapDocuSealSubmissionStatus('declined')).toBe('declined');
    expect(mapDocuSealSubmissionStatus('expired')).toBe('expired');
  });
});

describe('signUrlFor', () => {
  it('prefers embed_src over url', () => {
    expect(signUrlFor(baseSubmission, 'tenant')).toBe('https://ds.example/tenant-embed');
  });

  it('falls back to url when embed_src is missing', () => {
    expect(signUrlFor(baseSubmission, 'landlord')).toBe('https://ds.example/landlord');
  });

  it('returns null when role missing', () => {
    expect(signUrlFor({ ...baseSubmission, submitters: [] }, 'landlord')).toBeNull();
  });
});

describe('extractDeclineReason', () => {
  it('returns null when no submitter declined', () => {
    expect(extractDeclineReason(baseSubmission)).toBeNull();
  });

  it('extracts reason from declining submitter', () => {
    const declined: DocuSealSubmission = {
      ...baseSubmission,
      submitters: [
        ...baseSubmission.submitters.slice(0, 1),
        {
          ...baseSubmission.submitters[1]!,
          status: 'declined',
          decline_reason: 'Wrong rent amount',
        },
      ],
    };
    expect(extractDeclineReason(declined)).toBe('Wrong rent amount');
  });
});

describe('signedDocumentUrl', () => {
  it('prefers audit_log_url', () => {
    expect(
      signedDocumentUrl({ ...baseSubmission, audit_log_url: 'https://ds.example/audit.pdf' }),
    ).toBe('https://ds.example/audit.pdf');
  });

  it('falls back to first document url', () => {
    expect(
      signedDocumentUrl({
        ...baseSubmission,
        documents: [{ name: 'AST.pdf', url: 'https://ds.example/doc.pdf' }],
      }),
    ).toBe('https://ds.example/doc.pdf');
  });

  it('returns null when no document is available', () => {
    expect(signedDocumentUrl(baseSubmission)).toBeNull();
  });
});
