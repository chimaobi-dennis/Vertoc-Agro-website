-- Vertoc Agro Phase 4: editable email templates, inbound email.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to re-run.

-- ---------------------------------------------------- email templates ---
-- Subject and body are plain text with {{placeholders}} and optional
-- {{#if var}}...{{/if}} blocks. Each key is used by one part of the system;
-- the panel edits them, the code only renders them.
create table if not exists email_templates (
  key         text primary key,
  name        text not null,
  description text not null default '',
  subject     text not null default '',
  body        text not null default '',
  cta_label   text not null default '',            -- button text; the link comes from the context
  variables   jsonb not null default '[]'::jsonb,  -- placeholders this template may use
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);
drop trigger if exists email_templates_touch on email_templates;
create trigger email_templates_touch before update on email_templates
  for each row execute function touch_updated_at();
alter table email_templates enable row level security;

insert into email_templates (key, name, description, subject, body, cta_label, variables) values
  ('quote', 'Quotation to client',
   'Sent with the PDF and the unique online link when a quote goes out.',
   'Quotation {{quote_number}} from {{company_name}}',
   E'Dear {{client_name}},\n\nThank you for your interest in {{company_name}}. Please find attached our quotation {{quote_number}}{{#if quote_title}} for {{quote_title}}{{/if}}.{{#if valid_until}} It is valid until {{valid_until}}.{{/if}}\n\nYou can review it and accept or decline online using the button below. If you have any questions, simply reply to this email.\n\nKind regards,\n{{sender_name}}',
   'View and respond online',
   '["client_name","client_email","quote_number","quote_title","total","currency","valid_until","link","company_name","sender_name"]'),
  ('enquiry_reply', 'Reply to a website enquiry',
   'Pre-filled when you reply to a quote request or contact message from the inbox. Edit before sending.',
   'Re: your {{enquiry_type}} to {{company_name}}',
   E'Dear {{name}},\n\nThank you for your {{enquiry_type}}{{#if commodity}} about {{commodity}}{{/if}}.\n\n\n\nKind regards,\n{{sender_name}}',
   '',
   '["name","email","enquiry_type","commodity","quantity","destination","subject","message","company_name","sender_name"]'),
  ('blank', 'Email to a client',
   'Pre-filled when you email a client from their record.',
   '',
   E'Dear {{name}},\n\n\n\nKind regards,\n{{sender_name}}',
   '',
   '["name","email","company_name","sender_name"]'),
  ('user_invite', 'Staff invitation',
   'Sent to a new team member with their set-password link. Replaces the plain Supabase mail.',
   'You''re invited to the {{site_name}} staff panel',
   E'Hello {{name}},\n\n{{inviter_name}} has invited you to join the {{site_name}} staff panel as {{role}}. Use the button below to set your password and sign in.\n\nThe link expires in 24 hours. If you were not expecting this, you can ignore this email.',
   'Set your password',
   '["name","email","role","inviter_name","site_name","link"]'),
  ('quote_response', 'Quote answered (to the team)',
   'Sent to your notification address when a client accepts or declines a quote online.',
   '{{client_name}} {{response}} quotation {{quote_number}}',
   E'{{client_name}} has {{response}} quotation {{quote_number}}{{#if quote_title}} ({{quote_title}}){{/if}} — total {{total}}.{{#if note}}\n\nTheir note:\n{{note}}{{/if}}',
   'Open the quote',
   '["client_name","response","quote_number","quote_title","total","note","link"]'),
  ('inbound_notice', 'New email received (to the team)',
   'Sent to your notification address when a client emails you and the message lands in the inbox.',
   'New email from {{from_name}}: {{subject}}',
   E'{{from_name}} <{{from}}> wrote:\n\n{{excerpt}}',
   'Open in the inbox',
   '["from","from_name","subject","excerpt","link"]')
on conflict (key) do nothing;

-- --------------------------------------------------- inbound messages ---
-- direction = 'in' rows are written by the Resend webhook handler.
alter table messages add column if not exists from_name           text not null default '';
alter table messages add column if not exists read_at             timestamptz;
alter table messages add column if not exists headers             jsonb not null default '{}'::jsonb;
alter table messages add column if not exists provider_message_id text;   -- RFC Message-ID, for threading
alter table messages add column if not exists in_reply_to         text;
create index if not exists idx_messages_inbox on messages(direction, read_at, created_at desc);
-- Resend retries webhooks; the same received email must never be stored twice.
create unique index if not exists uq_messages_inbound_provider on messages(provider_id) where direction = 'in';
