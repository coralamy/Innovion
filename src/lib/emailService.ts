import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const supabase = createClient();

async function invokeEmailFunction(
  type: string,
  to: string,
  data: Record<string, unknown>
): Promise<boolean> {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data },
    });
    if (error) {
      logger.error(
        'emailService',
        `Failed to send ${type} email`,
        { type, to: to.replace(/(.{2}).+(@.+)/, '$1***$2') },
        error
      );
      return false;
    }
    logger.info('emailService', `Email sent: ${type}`, { type });
    return result?.success ?? false;
  } catch (err) {
    logger.error('emailService', `Unexpected error sending ${type} email`, { type }, err);
    return false;
  }
}

export const emailService = {
  /**
   * Send a welcome email after signup
   */
  sendWelcome: (to: string, name: string, companyName: string, plan: string) =>
    invokeEmailFunction('welcome', to, { name, companyName, plan }),

  /**
   * REMOVED — `sendPasswordReset(to, name, resetLink)`
   *
   * The link was supplied by the caller and interpolated straight into the
   * `href` of a "Reset Password" button in mail sent from Innovion's own
   * sender. That is a phishing primitive, not a feature, and nothing in the
   * application called it: password recovery is issued by Supabase Auth itself
   * through `AuthContext.resetPassword()` →
   * `supabase.auth.resetPasswordForEmail()`, which mints its own single-use
   * link. The corresponding `password_reset` case has been removed from the
   * Edge Function.
   */

  /**
   * Send compliance expiry alert to a manager
   */
  sendComplianceAlert: (
    to: string,
    recipientName: string,
    items: Array<{ title: string; assignedTo: string; expiryDate: string; status: string }>
  ) => invokeEmailFunction('compliance_expiry', to, { recipientName, items }),

  /**
   * Send job assignment notification to a contractor
   */
  sendJobAssignment: (
    to: string,
    contractorName: string,
    jobTitle: string,
    site: string,
    scheduledDate: string,
    notes?: string
  ) =>
    invokeEmailFunction('job_assignment', to, {
      contractorName,
      jobTitle,
      client: site,
      site,
      scheduledDate,
      notes,
    }),

  /**
   * Forward a contact form submission to the support inbox
   */
  /**
   * The recipient parameter has been REMOVED. It was previously supplied by the
   * caller (the public marketing page passed a hard-coded
   * 'support@innovion.com.au', which did not even match the
   * 'support@innovion.app' used everywhere else in the product). The Edge
   * Function now pins this type's recipient to the configured SUPPORT_INBOX,
   * which is what stops the unauthenticated contact form from being usable as
   * a mail relay.
   */
  sendContactForm: (
    senderName: string,
    senderEmail: string,
    company: string,
    industry: string,
    message: string
  ) =>
    invokeEmailFunction('contact_form', '', {
      senderName,
      senderEmail,
      company,
      industry,
      message,
    }),
};
