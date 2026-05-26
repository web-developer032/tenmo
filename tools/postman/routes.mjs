// Single source of truth for the Postman collection and the api-smoke
// script. Each route lists method, path, who should call it, an example
// body where applicable, and the expected baseline outcome.
//
// `persona` selects which seeded user the request runs as in smoke mode.
// Login emails are scenario-based — each persona keyword maps to a
// fixed account in `personas` (see bottom of this file):
//   sara     — landlord@example.com           Solo HMO landlord (Starter)
//   marcus   — landlord.pro@example.com        Portfolio landlord (Pro)
//   priya    — landlord.free@example.com       Live-in landlord (Free)
//   jordan   — tenant@example.com              Pure tenant
//   alex     — landlord.dual@example.com       Dual-role
//   nina     — landlord.new@example.com        Brand-new landlord
//   admin    — admin@example.com               Platform super admin
//   riley    — applicant@example.com           Applicant (pending on Sara R3)
//   public   — no auth at all
//   webhook  — HMAC-signed by integration provider
//   cron     — Bearer CRON_SECRET
//
// Variables in URLs match the environment file. `expect` is an array of
// acceptable status codes for the smoke run (most are [200]; create returns
// 201; some are [200, 204] for not-strictly-asserting cases).

export const routes = [
  // ============================================================
  // Account / profile
  // ============================================================
  {
    group: 'profile',
    persona: 'sara',
    method: 'GET',
    path: '/api/profile',
    expect: [200],
    summary: "Read the caller's profile",
  },
  {
    group: 'profile',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/profile',
    expect: [200],
    body: { full_name: 'Sara Khan (updated)', preferred_name: 'Sara' },
    summary: "Update the caller's profile",
  },
  {
    group: 'profile',
    persona: 'jordan',
    method: 'PATCH',
    path: '/api/profile',
    expect: [200],
    body: {
      emergency_contact: { name: 'Layla Lee', relationship: 'Sister', phone: '+44 7700 900220' },
    },
    summary: "Update the caller's emergency contact (tenant JSONB field)",
  },
  {
    group: 'profile',
    persona: 'sara',
    method: 'POST',
    path: '/api/profiles/lookup-by-email',
    expect: [200],
    body: { email: 'tenant@example.com' },
    summary: 'Soft-warn check: does this email exist?',
  },

  // ============================================================
  // Orgs
  // ============================================================
  {
    group: 'orgs',
    persona: 'nina',
    method: 'POST',
    path: '/api/orgs',
    expect: [201],
    body: {
      name: 'Smoke Test Lets',
      slug: 'smoke-test-lets',
      business_address: {
        line1: '1 Smoke St',
        city: 'Birmingham',
        postcode: 'B1 1AA',
        country: 'GB',
      },
      contact_email: 'landlord.new@example.com',
    },
    summary: 'Create a new landlord org',
    notes: 'Nina is a brand-new landlord with no orgs yet.',
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'GET',
    path: '/api/orgs/{{saraOrgId}}/properties',
    expect: [200],
    summary: "List the org's properties",
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'POST',
    path: '/api/orgs/{{saraOrgId}}/properties',
    expect: [201],
    body: {
      name: 'Smoke Test Property',
      type: 'hmo_small',
      address: { line1: '99 Cherry Mews', city: 'Birmingham', postcode: 'B5 5AA', country: 'GB' },
      is_hmo: true,
    },
    summary: 'Create a property in the org',
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'GET',
    path: '/api/orgs/{{saraOrgId}}/tenancies',
    expect: [200],
    summary: "List the org's tenancies",
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'POST',
    path: '/api/orgs/{{saraOrgId}}/tenancies',
    expect: [201],
    body: {
      property_id: '{{saraPropertyId}}',
      room_id: '{{saraRoom4Id}}',
      invite_email: 'newtenant@example.com',
      start_date: '2030-01-01',
      rent_pence: 75000,
      rent_frequency: 'monthly',
      rent_due_day: 1,
      deposit_pence: 300000,
      deposit_scheme: 'dps',
    },
    summary: 'Invite a tenant to a room (creates a tenancy in pending_invite)',
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'GET',
    path: '/api/orgs/{{saraOrgId}}/compliance',
    expect: [200],
    summary: 'List org compliance items',
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'POST',
    path: '/api/orgs/{{saraOrgId}}/compliance',
    expect: [201],
    body: { type: 'pat_test', property_id: '{{saraPropertyId}}', expires_at: '2030-06-01' },
    summary: 'Create a compliance item',
  },
  {
    group: 'orgs',
    persona: 'sara',
    method: 'POST',
    path: '/api/orgs/{{saraOrgId}}/compliance/seed',
    expect: [200, 201],
    body: { property_id: '{{saraPropertyId}}' },
    summary: 'Seed the standard required compliance set for a property',
  },

  // ============================================================
  // Properties / rooms
  // ============================================================
  {
    group: 'properties',
    persona: 'sara',
    method: 'GET',
    path: '/api/properties/{{saraPropertyId}}/rooms',
    expect: [200],
    summary: 'List rooms in a property',
  },
  {
    group: 'properties',
    persona: 'sara',
    method: 'POST',
    path: '/api/properties/{{saraPropertyId}}/rooms',
    expect: [201],
    body: {
      name: 'Smoke Test Room',
      has_ensuite: true,
      has_double_bed: true,
      furnishing: 'furnished',
      default_rent_pence: 80000,
      default_rent_frequency: 'monthly',
      bills_included: false,
    },
    summary: 'Add a room to a property',
  },

  // ============================================================
  // Tenancies (tenant or landlord, via RLS)
  // ============================================================
  {
    group: 'tenancies',
    persona: 'jordan',
    method: 'GET',
    path: '/api/tenancies/{{jordanTenancyId}}',
    expect: [200],
    summary: 'Get a single tenancy (tenant viewing their own)',
  },
  {
    group: 'tenancies',
    persona: 'jordan',
    method: 'GET',
    path: '/api/tenancies/{{jordanTenancyId}}/charges',
    expect: [200],
    summary: 'List rent charges for a tenancy',
  },
  {
    group: 'tenancies',
    persona: 'jordan',
    method: 'GET',
    path: '/api/tenancies/{{jordanTenancyId}}/payments',
    expect: [200],
    summary: 'List rent payments for a tenancy',
  },
  {
    group: 'tenancies',
    persona: 'sara',
    method: 'POST',
    path: '/api/tenancies/{{jordanTenancyId}}/payments',
    expect: [201],
    body: {
      amount_pence: 1000,
      charge_id: '{{jordanChargeId}}',
      method: 'manual_bank_transfer',
      paid_on: '2026-05-23',
    },
    summary: 'Record a manual rent payment',
    notes: 'Smoke uses tiny amount; cleanup deletes the row.',
  },
  {
    group: 'tenancies',
    persona: 'sara',
    method: 'POST',
    path: '/api/tenancies/{{taylorInviteTenancyId}}/cancel',
    expect: [200, 422],
    summary: 'Cancel a pending tenancy invite',
    notes: '422 on rerun: the invite is already cancelled.',
  },
  {
    group: 'tenancies',
    persona: 'sara',
    method: 'POST',
    path: '/api/tenancies/{{jordanTenancyId}}/end',
    expect: [200],
    body: { reason: 'mutual_break', end_date: '2030-12-31' },
    summary: 'End an active tenancy (Renters Rights Bill notice rules apply)',
    skipInSmoke: true,
    notes: 'Mutating end of seeded active tenancy disrupts other smokes.',
  },

  // ============================================================
  // Invites (token-based)
  // ============================================================
  {
    group: 'invites',
    persona: 'public',
    method: 'GET',
    path: '/api/invites/{{marcusInviteToken}}',
    expect: [200],
    summary: 'Public invite preview (redacted)',
  },
  {
    group: 'invites',
    persona: 'public',
    method: 'POST',
    path: '/api/invites/{{marcusInviteToken}}/accept',
    expect: [401, 403, 404, 200],
    summary: 'Accept invite — requires auth as the invited email',
    skipInSmoke: true,
    notes: 'Requires a user matching the invite email; not idempotent.',
  },

  // ============================================================
  // Listings (public discovery)
  // ============================================================
  {
    group: 'listings',
    persona: 'public',
    method: 'GET',
    path: '/api/listings',
    expect: [200],
    summary: 'Search published listings (anon — redacted address)',
  },
  {
    group: 'listings',
    persona: 'public',
    method: 'GET',
    path: '/api/listings/{{publishedRoomId}}',
    expect: [200],
    summary: 'Single published listing detail',
  },
  {
    group: 'listings',
    persona: 'jordan',
    method: 'POST',
    path: '/api/listings/{{publishedRoomId}}/apply',
    expect: [201, 409],
    body: { message: 'Smoke test application from Jordan.' },
    summary: 'Submit a room application (tenant only)',
    notes: 'Returns 409 if the persona already applied to this room.',
  },

  // ============================================================
  // Landlord — listings + applications (slug-scoped)
  // ============================================================
  {
    group: 'landlord-listings',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/listings/{{saraRoom4Id}}/publish',
    expect: [200, 422],
    body: {
      description: 'Smoke test publish — please ignore.',
      available_from: '2030-01-01',
      min_term_months: 6,
    },
    summary: 'Publish a room listing',
    notes: '422 on rerun: listing already closed by the previous close call.',
  },
  {
    group: 'landlord-listings',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/listings/{{saraRoom4Id}}/pause',
    expect: [200, 422],
    body: { resume: false },
    summary: 'Pause a published listing',
    notes: '422 on rerun: listing already closed.',
  },
  {
    group: 'landlord-listings',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/listings/{{saraRoom4Id}}/close',
    expect: [200, 422],
    body: { reopen: false },
    summary: 'Close a listing',
    notes: '422 on rerun: listing already closed.',
  },
  {
    group: 'landlord-listings',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/listings/{{publishedRoomId}}/applications',
    expect: [200],
    summary: 'List applications for a room',
  },
  {
    group: 'landlord-applications',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/applications/{{rileyApplicationId}}/reject',
    expect: [200, 422],
    body: { decline_reason: 'Smoke test reject — not real.' },
    summary: 'Reject an application',
    notes: '422 on rerun: application is already rejected. supabase db reset restores.',
  },
  {
    group: 'landlord-applications',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/applications/{{rileyApplicationId}}/accept',
    expect: [200, 409],
    body: { start_date: '2030-01-01', rent_pence: 80000 },
    summary: 'Accept an application (creates a tenancy in pending_invite)',
    skipInSmoke: true,
    notes: 'Multi-step side effect; left for manual Postman drive.',
  },

  // ============================================================
  // Landlord — Financials (expenses, MTD, CSV exports)
  // ============================================================
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/expenses',
    expect: [200],
    summary: "List the org's expenses ledger",
  },
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/expenses',
    expect: [201],
    body: {
      property_id: '{{saraPropertyId}}',
      occurred_on: '2026-05-15',
      description: 'Smoke test — bathroom sealant repair',
      category: 'repairs',
      amount_pence: 4500,
      mtd_eligible: true,
    },
    summary: 'Add an expense to the ledger',
  },
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/mtd-submissions',
    expect: [200],
    summary: 'List quarterly MTD submissions',
  },
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/mtd-submissions',
    expect: [201],
    body: { quarter: '2025Q1', submission_method: 'csv_export', notes: 'Smoke test MTD draft.' },
    summary: 'Record / regenerate a quarterly MTD figure',
    notes: 'POST is upsert keyed on (org_id, quarter), so reruns return 201 with the same row.',
  },
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/financials/export',
    expect: [200],
    summary: 'Export full-year income + expenses as CSV',
  },
  {
    group: 'landlord-financials',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/rent/export?month=2026-05',
    expect: [200],
    summary: "Export the selected month's rent ledger as CSV",
  },

  // ============================================================
  // Landlord — Deposits + Right-to-Rent (tenancy-scoped patches)
  // ============================================================
  {
    group: 'landlord-deposits',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/tenancies/{{jordanTenancyId}}/deposit',
    expect: [200],
    body: { deposit_pence: 95000, deposit_scheme: 'dps', deposit_reference: 'DPS-SMOKE-1' },
    summary: 'Record / update a tenancy deposit',
  },
  {
    group: 'landlord-rtr',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/tenancies/{{jordanTenancyId}}/rtr-check',
    expect: [200],
    body: { document_type: 'british_passport', share_code: null, expires_at: null },
    summary: 'Log / re-record a Right-to-Rent check',
  },

  // ============================================================
  // Landlord — Inspections + Contractors directory
  // ============================================================
  {
    group: 'landlord-inspections',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/inspections',
    expect: [201],
    body: {
      property_id: '{{saraPropertyId}}',
      type: 'routine_quarterly',
      scheduled_for: '2030-09-15',
      inspector_name: 'Smoke Inspector',
      notes: 'Smoke test inspection — please ignore.',
    },
    summary: 'Schedule a new inspection',
  },
  {
    group: 'landlord-contractors',
    persona: 'sara',
    method: 'GET',
    path: '/api/landlord/{{saraOrgSlug}}/contractors',
    expect: [200],
    summary: 'List active contractors for the org',
  },
  {
    group: 'landlord-contractors',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/{{saraOrgSlug}}/contractors',
    expect: [201],
    body: {
      name: 'Smoke Test Contractor',
      contact_name: 'Smoke Person',
      phone: '+44 7700 900000',
      email: 'smoke@example.com',
      trades: ['general'],
      coverage_areas: ['Birmingham'],
      day_rate_pence: 20000,
      rating: 4,
      notes: 'Created by smoke runner — please ignore.',
    },
    summary: 'Add a contractor to the directory',
  },

  // ============================================================
  // Landlord — Profile (org business details)
  // ============================================================
  {
    group: 'landlord-profile',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/landlord/{{saraOrgSlug}}/org',
    expect: [200],
    body: { contact_phone: '+44 7700 900100' },
    summary: 'Update business-level org fields (owner only)',
  },

  // ============================================================
  // Tenant — applications
  // ============================================================
  {
    group: 'tenant-applications',
    persona: 'jordan',
    method: 'GET',
    path: '/api/tenant/applications',
    expect: [200],
    summary: "List the tenant's applications",
  },
  {
    group: 'tenant-applications',
    persona: 'riley',
    method: 'POST',
    path: '/api/tenant/applications/{{rileyApplicationId}}/withdraw',
    expect: [200],
    summary: 'Withdraw an application',
    skipInSmoke: true,
    notes: 'Mutates the seeded pending application that other smokes rely on.',
  },

  // ============================================================
  // Compliance
  // ============================================================
  {
    group: 'compliance',
    persona: 'sara',
    method: 'GET',
    path: '/api/compliance/{{saraComplianceItemId}}',
    expect: [200],
    summary: 'Get a compliance item',
  },
  {
    group: 'compliance',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/compliance/{{saraComplianceItemId}}',
    expect: [200],
    body: { notes: 'Smoke test note.' },
    summary: 'Update a compliance item',
  },
  {
    group: 'compliance',
    persona: 'sara',
    method: 'DELETE',
    path: '/api/compliance/{{saraComplianceItemId}}',
    expect: [200, 204],
    summary: 'Delete a compliance item',
    skipInSmoke: true,
    notes: 'Mutates seeded compliance set; left for manual Postman drive.',
  },

  // ============================================================
  // AST envelopes
  // ============================================================
  {
    group: 'ast',
    persona: 'marcus',
    method: 'POST',
    path: '/api/ast/envelopes',
    expect: [201, 409, 422, 503],
    body: { tenancy_id: '{{marcusCamden2TenancyId}}' },
    summary: 'Start an AST signing run',
    notes:
      'Hits DocuSeal; requires DOCUSEAL_API_URL + DOCUSEAL_API_TOKEN. 503 expected if not configured.',
  },
  {
    group: 'ast',
    persona: 'marcus',
    method: 'GET',
    path: '/api/ast/envelopes/{{marcusCamden2AstId}}',
    expect: [200],
    summary: 'Get an envelope',
  },
  {
    group: 'ast',
    persona: 'marcus',
    method: 'DELETE',
    path: '/api/ast/envelopes/{{marcusCamden2AstId}}',
    expect: [200, 204],
    summary: 'Cancel an open envelope',
    skipInSmoke: true,
    notes: 'Mutates the only open envelope; left for manual Postman drive.',
  },

  // ============================================================
  // Documents
  // ============================================================
  {
    group: 'documents',
    persona: 'sara',
    method: 'GET',
    path: '/api/documents?property_id={{saraPropertyId}}',
    expect: [200],
    summary: 'List documents filtered by parent',
  },
  {
    group: 'documents',
    persona: 'sara',
    method: 'POST',
    path: '/api/documents/upload-url',
    expect: [200, 201],
    body: {
      parent: { kind: 'property', property_id: '{{saraPropertyId}}' },
      category: 'other',
      filename: 'smoke.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
    },
    summary: 'Mint a signed Storage upload URL',
  },
  {
    group: 'documents',
    persona: 'sara',
    method: 'POST',
    path: '/api/documents',
    expect: [201],
    body: {
      parent: { kind: 'property', property_id: '{{saraPropertyId}}' },
      category: 'other',
      storage_path: '{{saraOrgId}}/property/{{saraPropertyId}}/smoke-record.pdf',
      filename: 'smoke-record.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2048,
      title: 'Smoke record',
      description: 'Inserted by smoke runner.',
    },
    summary: 'Record an uploaded document',
    skipInSmoke: true,
    notes: 'Storage path uniqueness — script-side flag avoids the collision on rerun.',
  },
  {
    group: 'documents',
    persona: 'sara',
    method: 'GET',
    path: '/api/documents/{{saraDocumentId}}/url',
    expect: [200, 404],
    summary: 'Mint a signed download URL',
    notes:
      'Storage object is not actually uploaded in the seed, so signing may 404 — acceptable for smoke.',
  },
  {
    group: 'documents',
    persona: 'sara',
    method: 'DELETE',
    path: '/api/documents/{{saraDocumentId}}',
    expect: [200, 204],
    summary: 'Delete a document',
    skipInSmoke: true,
    notes: 'Mutates seed; left for manual Postman drive.',
  },

  // ============================================================
  // Notifications
  // ============================================================
  {
    group: 'notifications',
    persona: 'jordan',
    method: 'GET',
    path: '/api/notifications',
    expect: [200],
    summary: "List the caller's notifications",
  },
  {
    group: 'notifications',
    persona: 'jordan',
    method: 'PATCH',
    path: '/api/notifications',
    expect: [200],
    summary: 'Mark all notifications read',
  },
  {
    group: 'notifications',
    persona: 'jordan',
    method: 'PATCH',
    path: '/api/notifications/mark-read',
    expect: [200],
    body: { ids: ['{{jordanNotificationId}}'] },
    summary: 'Mark specific notifications read',
    notes: 'Smoke does not assert the body — endpoint accepts unknown ids as a no-op.',
  },
  {
    group: 'notifications',
    persona: 'jordan',
    method: 'GET',
    path: '/api/notifications/preferences',
    expect: [200],
    summary: 'Get notification preferences',
  },
  {
    group: 'notifications',
    persona: 'jordan',
    method: 'PATCH',
    path: '/api/notifications/preferences',
    expect: [200],
    body: { channels: { email: false } },
    summary: 'Update notification preferences',
  },

  // ============================================================
  // Conversations / messaging
  // ============================================================
  {
    group: 'conversations',
    persona: 'jordan',
    method: 'GET',
    path: '/api/conversations',
    expect: [200],
    summary: 'Inbox list',
  },
  {
    group: 'conversations',
    persona: 'sara',
    method: 'POST',
    path: '/api/conversations',
    expect: [200, 201],
    body: { org_id: '{{saraOrgId}}', other_user_id: '{{jordanId}}' },
    summary: 'Find or create a direct conversation',
    notes: 'Caller must be a member of the org; the other user can be a member or current tenant.',
  },
  {
    group: 'conversations',
    persona: 'jordan',
    method: 'GET',
    path: '/api/conversations/{{jordanConversationId}}/messages',
    expect: [200],
    summary: 'List messages in a conversation',
  },
  {
    group: 'conversations',
    persona: 'jordan',
    method: 'POST',
    path: '/api/conversations/{{jordanConversationId}}/messages',
    expect: [201],
    body: { body: 'Smoke test message — please ignore.' },
    summary: 'Send a message',
  },
  {
    group: 'conversations',
    persona: 'jordan',
    method: 'GET',
    path: '/api/conversations/{{jordanConversationId}}/participants',
    expect: [200],
    summary: 'List participants',
  },
  {
    group: 'conversations',
    persona: 'jordan',
    method: 'PATCH',
    path: '/api/conversations/{{jordanConversationId}}/read',
    expect: [200],
    summary: 'Mark conversation read',
  },

  // ============================================================
  // Tickets
  // ============================================================
  {
    group: 'tickets',
    persona: 'jordan',
    method: 'POST',
    path: '/api/tickets',
    expect: [201],
    body: {
      property_id: '{{saraPropertyId}}',
      room_id: '{{saraRoom1Id}}',
      tenancy_id: '{{jordanTenancyId}}',
      title: 'Smoke ticket',
      description: 'Created by smoke runner — please ignore.',
      category: 'other',
      severity: 'low',
    },
    summary: 'Create a maintenance ticket',
  },
  {
    group: 'tickets',
    persona: 'jordan',
    method: 'GET',
    path: '/api/tickets/{{jordanTicketId}}',
    expect: [200],
    summary: 'Get a ticket detail',
  },
  {
    group: 'tickets',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/tickets/{{jordanTicketId}}/status',
    expect: [200, 422],
    body: { status: 'in_progress' },
    summary: 'Change a ticket status',
    notes: '422 on rerun: status transitions are validated and a no-op transition is rejected.',
  },
  {
    group: 'tickets',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/tickets/{{jordanTicketId}}/assign',
    expect: [200],
    body: { assigned_to_user_id: '{{saraId}}' },
    summary: 'Assign a ticket',
  },
  {
    group: 'tickets',
    persona: 'jordan',
    method: 'POST',
    path: '/api/tickets/{{jordanTicketId}}/messages',
    expect: [201],
    body: { body: 'Smoke comment from tenant.' },
    summary: 'Add a comment to a ticket',
  },
  {
    group: 'tickets',
    persona: 'jordan',
    method: 'POST',
    path: '/api/tickets/{{jordanTicketId}}/attachments/upload-url',
    expect: [200, 201],
    body: { filename: 'smoke.jpg', mime_type: 'image/jpeg', size_bytes: 2048 },
    summary: 'Mint signed attachment upload URL',
  },
  {
    group: 'tickets',
    persona: 'jordan',
    method: 'POST',
    path: '/api/tickets/{{jordanTicketId}}/attachments/sign',
    expect: [200, 201, 404],
    body: { path: '{{saraOrgId}}/{{jordanTicketId}}/smoke.jpg' },
    summary: 'Mint a signed attachment download URL (404 expected for nonexistent path)',
  },

  // ============================================================
  // Bills
  // ============================================================
  {
    group: 'bills',
    persona: 'sara',
    method: 'GET',
    path: '/api/bills?property_id={{saraPropertyId}}',
    expect: [200],
    summary: 'List bills for a property',
  },
  {
    group: 'bills',
    persona: 'sara',
    method: 'POST',
    path: '/api/bills',
    expect: [201],
    body: {
      property_id: '{{saraPropertyId}}',
      type: 'electricity',
      provider: 'Smoke Utility',
      period_start: '2026-05-01',
      period_end: '2026-05-31',
      total_pence: 12500,
      allocation_method: 'equal_per_room',
      notes: 'Smoke test bill.',
    },
    summary: 'Create a bill with allocations',
  },
  {
    group: 'bills',
    persona: 'sara',
    method: 'GET',
    path: '/api/bills/{{saraBillId}}',
    expect: [200],
    summary: 'Get a bill detail',
  },
  {
    group: 'bills',
    persona: 'sara',
    method: 'PATCH',
    path: '/api/bills/{{saraBillId}}',
    expect: [200],
    body: { notes: 'Smoke updated.' },
    summary: 'Update a bill',
  },
  {
    group: 'bills',
    persona: 'sara',
    method: 'DELETE',
    path: '/api/bills/{{saraBillId}}',
    expect: [200, 204],
    summary: 'Delete a bill',
    skipInSmoke: true,
    notes: 'Mutates seed; left for manual Postman drive.',
  },

  // ============================================================
  // Billing (Stripe — landlord subscription)
  // ============================================================
  {
    group: 'billing',
    persona: 'sara',
    method: 'POST',
    path: '/api/billing/checkout',
    expect: [200, 201, 400, 500, 502, 503],
    body: { org_id: '{{saraOrgId}}', tier: 'pro' },
    summary: 'Create a Stripe Checkout session',
    notes:
      'Requires STRIPE_SECRET_KEY + STRIPE_PRICE_PRO_MONTHLY. 4xx/5xx expected if Stripe not configured.',
  },
  {
    group: 'billing',
    persona: 'sara',
    method: 'POST',
    path: '/api/billing/portal',
    expect: [200, 201, 400, 500, 502, 503],
    body: { org_id: '{{saraOrgId}}' },
    summary: 'Create a Stripe Customer Portal session',
    notes:
      'Requires STRIPE_SECRET_KEY + an existing Stripe customer (400 expected on a fresh org).',
  },

  // ============================================================
  // Payments (GoCardless rent collection)
  // ============================================================
  {
    group: 'payments',
    persona: 'jordan',
    method: 'POST',
    path: '/api/payments/mandates',
    expect: [200, 201, 500, 502, 503],
    body: {
      tenancy_id: '{{jordanTenancyId}}',
      success_redirect_url: 'http://localhost:3000/tenant/rent/{{jordanTenancyId}}/dd-callback',
    },
    summary: 'Start a Direct Debit mandate setup',
    notes: 'Hits GoCardless. 5xx expected if GOCARDLESS_ACCESS_TOKEN not set.',
  },
  {
    group: 'payments',
    persona: 'jordan',
    method: 'POST',
    path: '/api/payments/mandates/{{jordanMandateId}}/complete',
    expect: [200, 201, 404, 500],
    body: { redirect_flow_id: 'demo-flow-id', session_token: 'demo-session' },
    summary: 'Complete a DD mandate after GoCardless redirect',
    notes: 'Requires a real GoCardless redirect flow id; otherwise 4xx/5xx.',
  },
  {
    group: 'payments',
    persona: 'jordan',
    method: 'DELETE',
    path: '/api/payments/mandates/{{jordanMandateId}}',
    expect: [200, 204],
    summary: 'Cancel a mandate',
    skipInSmoke: true,
    notes: 'Mutates seeded mandate; left for manual Postman drive.',
  },
  {
    group: 'payments',
    persona: 'sara',
    method: 'POST',
    path: '/api/payments/charges/{{jordanChargeId}}/collect',
    expect: [200, 201, 202, 403, 422, 500],
    body: { amount_pence: 1000 },
    summary: 'Trigger a one-off Direct Debit collection',
    notes:
      'Tier-gated (rent_collection_dd). 202 expected if no active mandate (Stripe/GC unconfigured).',
  },

  // ============================================================
  // Passport (tenant)
  // ============================================================
  {
    group: 'passport',
    persona: 'jordan',
    method: 'GET',
    path: '/api/passport',
    expect: [200],
    summary: 'Assemble the Rental Passport JSON',
  },
  {
    group: 'passport',
    persona: 'jordan',
    method: 'POST',
    path: '/api/passport/pdf',
    expect: [200, 201, 500],
    body: {},
    summary: 'Generate a PDF and store it',
    notes: 'PDF render + Storage upload. 5xx OK if PDF worker not configured.',
  },

  // ============================================================
  // Admin
  // ============================================================
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/audit?page=1&per_page=10',
    expect: [200],
    summary: 'Audit log',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/orgs?page=1&per_page=10',
    expect: [200],
    summary: 'List orgs',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/orgs/{{saraOrgId}}',
    expect: [200],
    summary: 'Org detail',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/orgs/{{saraOrgId}}/subscription-override',
    expect: [200],
    body: { tier: 'pro', reason: 'Smoke test override.' },
    summary: 'Set or clear a manual tier override',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/orgs/{{saraOrgId}}/suspend',
    expect: [200],
    body: { action: 'reinstate', reason: 'Smoke test reinstate (was never suspended).' },
    summary: 'Suspend / reinstate an org',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/orgs/invite',
    expect: [200, 201],
    body: {
      org_name: 'Smoke Org',
      email: 'landlord.invited@example.com',
      tier: 'starter',
    },
    summary: 'Invite a landlord org (sends email via Resend when configured)',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/users?page=1&per_page=10',
    expect: [200],
    summary: 'List users',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/users/{{jordanId}}',
    expect: [200],
    summary: 'User profile detail',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/profiles/search?q=sara',
    expect: [200],
    summary: 'Search profiles by email/name',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/settings',
    expect: [200],
    body: { trial_days: 14 },
    summary: 'Update platform settings (super only)',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/team/invite',
    expect: [200, 201, 409],
    body: { email: 'admin.invitee.smoke@example.com', role: 'support' },
    summary: 'Invite a platform admin (sends email via Resend when configured)',
    notes: '409 on rerun: the invitee email is already an admin row.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'PATCH',
    path: '/api/admin/team/{{supportAdminId}}',
    expect: [200],
    body: { role: 'support' },
    summary: 'Update an admin role (super only)',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'DELETE',
    path: '/api/admin/team/{{supportAdminId}}',
    expect: [200, 204],
    summary: 'Revoke a platform admin',
    skipInSmoke: true,
    notes: 'Mutates the seeded support admin.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/support/{{platformSupportTicketId}}/assign-me',
    expect: [200],
    summary: 'Self-assign a platform support ticket',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/support/{{platformSupportTicketId}}/resolve',
    expect: [200, 422],
    body: { resolution: 'Smoke test resolve.' },
    summary: 'Resolve a platform support ticket',
    notes: '422 on rerun: ticket already resolved.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/compliance/notify',
    expect: [200, 201],
    body: {
      org_id: '{{saraOrgId}}',
      violation_id: '00000000-0000-0000-0000-000000000000',
      kind: 'reminder',
      note: 'Smoke test.',
    },
    summary: 'Notify a landlord of a compliance violation',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/billing/{{saraOrgId}}/retry',
    expect: [200, 422],
    summary: 'Retry a failed Stripe invoice (real call when configured)',
    notes:
      '200 + status=not_configured when STRIPE_SECRET_KEY is absent (dev). ' +
      '200 + status=no_subscription when the org has no Stripe IDs yet. ' +
      '422 when Stripe rejects (e.g. no open invoice).',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/billing/{{saraOrgId}}/remind',
    expect: [200, 201],
    body: { reason: 'card_failed' },
    summary: 'Send a card-update reminder (Resend or console transport)',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/impersonate/start',
    expect: [200, 422],
    body: { target_user_id: '{{saraId}}', reason: 'Smoke test impersonation' },
    summary: 'Start impersonating a landlord (super only)',
    skipInSmoke: true,
    notes: 'Mutates the admin auth cookies — drive from a dedicated browser session.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/impersonate/stop',
    expect: [200, 422],
    summary: 'Stop the active impersonation (no-op if none)',
    skipInSmoke: true,
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/orgs/{{rajOrgId}}/delete',
    expect: [200, 422],
    body: { reason: 'Smoke test soft-delete (Raj is canceled)' },
    summary: 'Soft-delete a landlord org',
    skipInSmoke: true,
    notes: 'Hides the org from the default list view — pair with undelete to re-run.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/orgs/{{rajOrgId}}/undelete',
    expect: [200, 422, 404],
    summary: 'Reinstate a soft-deleted landlord org',
    skipInSmoke: true,
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'DELETE',
    path: '/api/admin/team/invites/{{pendingInviteId}}',
    expect: [200, 204, 404],
    summary: 'Revoke a pending admin invite',
    skipInSmoke: true,
    notes: 'Single-use: 404 once the seeded invite has been revoked.',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'POST',
    path: '/api/admin/settings/send-test-email',
    expect: [200, 422],
    body: {},
    summary: 'Send a Resend test email (falls back to console in dev)',
  },
  // CSV exports — HEAD/GET against each route confirms wiring + RLS without
  // pulling the full payload through the smoke runner.
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/audit/export.csv?per_page=1',
    expect: [200],
    summary: 'Export admin audit log CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/orgs/export.csv?per_page=1',
    expect: [200],
    summary: 'Export landlords list CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/tenants/export.csv?per_page=1',
    expect: [200],
    summary: 'Export tenants list CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/billing/export.csv?per_page=1',
    expect: [200],
    summary: 'Export billing summary CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/support/export.csv?per_page=1',
    expect: [200],
    summary: 'Export support tickets CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/compliance/export.csv?per_page=1',
    expect: [200],
    summary: 'Export compliance violations CSV',
  },
  {
    group: 'admin',
    persona: 'admin',
    method: 'GET',
    path: '/api/admin/dashboard/export.csv',
    expect: [200],
    summary: 'Export dashboard KPI snapshot CSV',
  },

  // ============================================================
  // Landlord support
  // ============================================================
  {
    group: 'support',
    persona: 'sara',
    method: 'POST',
    path: '/api/landlord/support/{{landlordResolvedTicketId}}/csat',
    expect: [200, 422, 404],
    body: { rating: 5, comment: 'Smoke test CSAT.' },
    summary: 'Rate a resolved platform support ticket',
    notes:
      'Seeded ticket reporter is Oluwaseun (not in personas); test asserts the 422 reporter-mismatch path.',
  },

  // ============================================================
  // Cron (Bearer CRON_SECRET; localhost dev bypass when unset)
  // ============================================================
  {
    group: 'cron',
    persona: 'cron',
    method: 'GET',
    path: '/api/cron/rent-charges',
    expect: [200],
    summary: 'Generate rent charges (dry-run on GET)',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'POST',
    path: '/api/cron/rent-charges',
    expect: [200, 201],
    summary: 'Generate rent charges + optionally collect via DD',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'GET',
    path: '/api/cron/compliance-reminders',
    expect: [200],
    summary: 'Compliance reminders cron (dry-run on GET)',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'POST',
    path: '/api/cron/compliance-reminders',
    expect: [200, 201],
    summary: 'Send compliance reminder emails',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'GET',
    path: '/api/cron/mrr-snapshot',
    expect: [200],
    summary: 'Write the current month MRR snapshot',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'POST',
    path: '/api/cron/mrr-snapshot?backfill=12',
    expect: [200],
    summary: 'Backfill 12 months of MRR snapshots',
  },
  {
    group: 'cron',
    persona: 'cron',
    method: 'GET',
    path: '/api/cron/webhook-replay',
    expect: [200],
    summary: 'Replay unprocessed webhook_events (≤25 per run)',
  },

  // ============================================================
  // Profile avatar (signed upload + persistence)
  // ============================================================
  {
    group: 'profile',
    persona: 'sara',
    method: 'POST',
    path: '/api/profile/avatar',
    expect: [200, 201],
    body: { content_type: 'image/png', size_bytes: 4096 },
    summary: 'Request a signed avatar upload URL',
  },
  {
    group: 'profile',
    persona: 'sara',
    method: 'DELETE',
    path: '/api/profile/avatar',
    expect: [200, 204],
    summary: 'Clear the caller’s avatar',
    skipInSmoke: true,
    notes: 'Destructive — clears the persisted avatar URL.',
  },

  // ============================================================
  // TrueLayer Open Banking (one-off bank payment)
  // ============================================================
  {
    group: 'payments',
    persona: 'sara',
    method: 'POST',
    path: '/api/payments/charges/{{jordanChargeId}}/truelayer',
    expect: [201, 202, 400, 422, 502, 503],
    body: {
      amount_pence: 72000,
      return_uri: 'http://localhost:3000/tenant/rent',
      beneficiary_name: 'Tenantly Holding',
      beneficiary_sort_code: '040004',
      beneficiary_account_number: '12345678',
    },
    summary: 'Initiate a TrueLayer Open Banking payment for a rent charge',
    notes:
      [
        '503 when TRUELAYER_CLIENT_ID / SECRET unset.',
        '422 when the charge already has a pending payment (smoke runs leave a DD row).',
        '400 / 502 when creds are set but TrueLayer rejects the synthetic beneficiary',
        '(sandbox is picky about account-holder names + sort codes — this is fine for smoke).',
      ].join(' '),
  },
  {
    group: 'payments',
    persona: 'sara',
    method: 'GET',
    path: '/api/payments/truelayer/return?payment_id=tl_demo',
    expect: [200, 503],
    summary: 'Poll a TrueLayer payment after the bank redirect',
    notes: '503 acceptable when not configured; demo id will 404 on real call.',
  },

  // ============================================================
  // Webhooks (HMAC-signed; manual via Postman, opt-in for smoke)
  // ============================================================
  {
    group: 'webhooks',
    persona: 'webhook',
    method: 'POST',
    path: '/api/webhooks/stripe',
    expect: [200, 400],
    headers: { 'stripe-signature': 't=demo,v1=demo' },
    body: {
      id: 'evt_demo',
      type: 'invoice.payment_succeeded',
      data: { object: { id: 'in_demo' } },
    },
    summary: 'Stripe webhook (signed)',
    skipInSmoke: true,
    notes: 'Use `stripe trigger` for real events.',
  },
  {
    group: 'webhooks',
    persona: 'webhook',
    method: 'POST',
    path: '/api/webhooks/gocardless',
    expect: [200, 400],
    headers: { 'webhook-signature': 'demo' },
    body: { events: [{ id: 'EV_demo', action: 'created', resource_type: 'mandates', links: {} }] },
    summary: 'GoCardless webhook (signed)',
    skipInSmoke: true,
    notes: 'Sign with GOCARDLESS_WEBHOOK_SECRET to test.',
  },
  {
    group: 'webhooks',
    persona: 'webhook',
    method: 'POST',
    path: '/api/webhooks/truelayer',
    expect: [200, 400, 503],
    headers: { 'tl-signature': 'demo' },
    body: {
      event_id: 'evt_demo_tl',
      type: 'payment_executed',
      payment_id: 'tl_demo_payment',
      status: 'executed',
    },
    summary: 'TrueLayer webhook (signed)',
    skipInSmoke: true,
    notes: 'Sign with TRUELAYER_WEBHOOK_SECRET to test.',
  },
  {
    group: 'webhooks',
    persona: 'webhook',
    method: 'POST',
    path: '/api/webhooks/docuseal',
    expect: [200, 400],
    headers: { 'x-docuseal-signature': 'demo' },
    body: { event_type: 'submission.completed', data: { id: 'sub_demo' } },
    summary: 'DocuSeal webhook (signed)',
    skipInSmoke: true,
    notes: 'Sign with DOCUSEAL_WEBHOOK_SECRET to test.',
  },
];

export const personas = {
  sara: { email: 'landlord@example.com', password: 'tenantly-dev' },
  marcus: { email: 'landlord.pro@example.com', password: 'tenantly-dev' },
  priya: { email: 'landlord.free@example.com', password: 'tenantly-dev' },
  jordan: { email: 'tenant@example.com', password: 'tenantly-dev' },
  alex: { email: 'landlord.dual@example.com', password: 'tenantly-dev' },
  nina: { email: 'landlord.new@example.com', password: 'tenantly-dev' },
  admin: { email: 'admin@example.com', password: 'tenantly-dev' },
  riley: { email: 'applicant@example.com', password: 'tenantly-dev' },
};

// Seeded UUIDs / slugs used by routes. Keep aligned with backend/supabase/seed.sql.
export const seededIds = {
  // Users
  saraId: '11111111-1111-1111-1111-111111111111',
  marcusId: '22222222-2222-2222-2222-222222222222',
  jordanId: '44444444-4444-4444-4444-444444444444',
  adminId: '66666666-6666-6666-6666-666666666666',

  // Orgs
  saraOrgId: 'a1111111-aaaa-aaaa-aaaa-111111111111',
  saraOrgSlug: 'sara-lets',
  marcusOrgId: 'a2222222-aaaa-aaaa-aaaa-222222222222',
  marcusOrgSlug: 'reid-properties',

  // Property + rooms
  saraPropertyId: 'b1111111-bbbb-bbbb-bbbb-111111111111',
  saraRoom1Id: 'c1111111-cccc-cccc-cccc-110000000001',
  saraRoom3Id: 'c1111111-cccc-cccc-cccc-110000000003',
  saraRoom4Id: 'c1111111-cccc-cccc-cccc-110000000004',
  publishedRoomId: 'c1111111-cccc-cccc-cccc-110000000003', // Sara Room 3 — promoted in seed.

  // Tenancies
  jordanTenancyId: 'd1111111-dddd-dddd-dddd-440000000001',
  taylorInviteTenancyId: 'd1111111-dddd-dddd-dddd-440000000002',
  taylorInviteToken: 'demo-invite-taylor-sara-room2',
  marcusCamden2TenancyId: 'd3333333-dddd-dddd-dddd-220000000002',
  marcusInviteToken: 'demo-invite-marcus-camden-r2',

  // Compliance items
  saraComplianceItemId: 'e1111111-eeee-eeee-eeee-110000000001',

  // Rent
  jordanChargeId: 'fa111111-ffff-ffff-ffff-440000000003',

  // Tickets / bills / AST / GC / docs / notifications
  jordanTicketId: 'fc111111-1111-1111-1111-000000000001',
  saraBillId: 'fd111111-1111-1111-1111-000000000001',
  marcusCamden2AstId: 'fe333333-3333-3333-3333-000000000001',
  jordanMandateId: 'fcfc9999-1111-1111-1111-000000000001',
  saraDocumentId: 'fefe1111-1111-1111-1111-000000000001',
  jordanNotificationId: '00000000-0000-0000-0000-000000000000', // resolved at smoke time

  // Riley application + Platform support ticket
  rileyApplicationId: 'fafa1111-1111-1111-1111-000000000001',
  platformSupportTicketId: 'bb000001-bbbb-bbbb-bbbb-000000000001',
  // Raj's org (canceled) drives the soft-delete affordance + Sophia's org
  // is already soft-deleted in seed.
  rajOrgId: 'aa000001-aaaa-aaaa-aaaa-000000000007',
  sophiaOrgId: 'aa000001-aaaa-aaaa-aaaa-000000000006',
  // Pending admin invite (alex.turner@) for the revoke endpoint.
  pendingInviteId: 'cc000001-cccc-cccc-cccc-000000000001',
  // The first resolved platform support ticket that does not yet have a
  // CSAT rating — owned by Sara. Resolved by seed migrations.
  landlordResolvedTicketId: 'bb000001-bbbb-bbbb-bbbb-000000000001',

  // Seeded "support" platform admin (the smoke runner can safely demote /
  // re-promote this row without touching the super admin used for auth).
  supportAdminId: '88888888-8888-8888-8888-000000000001',

  // The Jordan↔Sara tenancy conversation id is created by trigger; smoke
  // script resolves it at runtime. Postman users: hit GET /api/conversations
  // first to grab one.
  jordanConversationId: '00000000-0000-0000-0000-000000000000',
};
