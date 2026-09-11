# Admin design language

What every admin screen — Phase 2 onward included — is built on.

- **Colour.** Navy (`primary`) for structure and text; green (`accent`) for
  life: CTAs, active nav, focus rings, stat accents. Warm off-white background,
  white cards. One accent per surface, never two competing.
- **Shape.** `rounded-2xl` cards, `rounded-xl` controls and buttons, `h-11`
  inputs. Pills (`rounded-full`) only for badges and avatars.
- **Depth.** `shadow-sm` at rest; `shadow-md` plus a 2px lift on hover for
  anything clickable. Borders are hairlines (`border-border`), never heavy.
- **Type.** Playfair Display for page and section headings (tight tracking);
  Inter for everything else. Eyebrow labels: 11–12px, uppercase, wide tracking,
  accent-coloured.
- **Motion.** Page content enters with `animate-fade-up`; grids of cards
  stagger by ~70ms via `animationDelay`. `animate-float` is for decorative
  orbs only. Nothing bounces.
- **Loading.** Every async surface renders a `Bone` skeleton (`animate-pulse`)
  matching its final shape — never a spinner, never "Loading…" text.
- **Theme.** The admin defaults to light and owns its own toggle
  (`AdminTheme.jsx`); it never inherits the public site's dark mode.
- **Empty states.** One line of plain language plus the primary action.
- **Auth screens** use `AuthShell`: brand panel left (photo under the
  navy→green gradient), form right.
- **Dialogs** use `Modal` from `ui.jsx`: navy scrim with blur, a card that is
  a bottom sheet on phones and centred on desktop, Escape and backdrop close.
- **Tabs** (`Tabs` in `ui.jsx`) are underline tabs with the accent bar; the
  active tab lives in the URL (`?tab=`) so links can deep-link into a record.
- **Uploads** are dashed `rounded-2xl` drop zones that accept click and drag;
  in-flight files show as pulsing rows, never a progress spinner.
- **Money** is always formatted with the record's own currency (`fmtMoney`),
  tabular figures, totals in navy and bold.
- **Inbox rows**: a round direction chip (accent arrow-in for received, navy
  arrow-out for sent), bold subject plus an accent dot while unread.
- **Email previews** render in a `sandbox=""` iframe (no scripts, no
  navigation) — inbound HTML is untrusted.
