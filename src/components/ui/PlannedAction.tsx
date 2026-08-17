'use client';

import React from 'react';

/**
 * A control for a capability that is not yet built.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * An audit of the interface found 28 `<button>` elements with no `onClick`, no
 * `type="submit"` and no `disabled` attribute: "Add Contractor", "Assign Job",
 * "Edit Client", "Edit Site", "Reorder", "Change Password", "Upgrade to
 * Enterprise", "View Jobs", "Manual Entry", "View all" and others. Each was
 * fully styled as a primary or secondary action, showed a pointer cursor,
 * responded to hover and press — and did nothing at all when clicked.
 *
 * A control that looks live and is inert is worse than a missing one. The user
 * cannot tell it apart from a control that failed: they retry, they assume the
 * record saved, and they report the product as broken rather than incomplete.
 *
 * Where the underlying capability existed, the control has been wired to it.
 * Where it genuinely does not exist yet, the control is rendered through this
 * component: visually de-emphasised, `disabled`, `aria-disabled`, and carrying
 * a title that says so. The interface then tells the truth about itself.
 *
 * `supabase/tests/dead-controls.mjs` fails if a new silently-inert control is
 * introduced, so this cannot regress unnoticed.
 * ---------------------------------------------------------------------------
 */
export default function PlannedAction({
  children,
  className = '',
  title = 'This action is not available yet.',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={title}
      className={`cursor-not-allowed opacity-50 ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
