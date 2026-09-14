-- 006: the quote builder is now labelled "Invoice" for staff and clients.
-- Routes, API, tables and VQ- numbers keep the word quote. This migration
-- reword the seeded email templates and adds the letterhead settings the
-- invoice PDF prints (RC number, TIN, footer tagline, letterhead logo,
-- signature image, signatory). Safe to run more than once.

update email_templates set
  name        = regexp_replace(regexp_replace(name,        '\mQuotation\M', 'Invoice', 'g'), '\mQuote\M', 'Invoice', 'g'),
  description = regexp_replace(regexp_replace(description, '\mquotation\M', 'invoice', 'g'), '\mquote\M', 'invoice', 'g'),
  subject     = regexp_replace(regexp_replace(subject,     '\mQuotation\M', 'Invoice', 'g'), '\mquotation\M', 'invoice', 'g'),
  body        = regexp_replace(regexp_replace(body,        '\mquotation\M', 'invoice', 'g'), '\mQuotation\M', 'Invoice', 'g'),
  cta_label   = regexp_replace(cta_label, '\mquote\M', 'invoice', 'g')
where key in ('quote', 'quote_response');

-- Letterhead values (all editable under Settings → Company / Invoices).
update settings set value = value || jsonb_build_object(
  'email',     'finance@vertocagro.com',
  'website',   'https://www.vertocagro.com',
  'address',   'No 3 Soares Adekunle Temitayo, Zionist Estate, Off Akala Expressway, Ajinde, Ibadan, Oyo State, Nigeria',
  'rc_number', '8464264',
  'tin',       coalesce(value->>'tin', ''),
  'tagline',   'Growing the Future, One Harvest at a Time.'
) where key = 'company';

update settings set value = value || jsonb_build_object(
  'logo',      coalesce(nullif(value->>'logo', ''), '/assets/img/logo-print.png'),
  'signature', coalesce(value->>'signature', ''),
  'signatory', coalesce(value->>'signatory', '')
) where key = 'quotes';
