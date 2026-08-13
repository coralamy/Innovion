import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const supabase = createClient();

async function invokeEmailFunction(type: string, to: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data },
    });
    if (error) {
      logger.error('emailService', `Failed to send ${type} email`, { type, to: to.replace(/(.{2}).+(@.+)/, '$1***$2') }, error);
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
   * Send a password reset confirmation email
   */
  sendPasswordReset: (to: string, name: string, resetLink: string) =>
    invokeEmailFunction('password_reset', to, { name, resetLink }),

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
  ) => invokeEmailFunction('job_assignment', to, { contractorName, jobTitle, client: site, site, scheduledDate, notes }),

  /**
   * Forward a contact form submission to the support inbox
   */
  sendContactForm: (
    to: string,
    senderName: string,
    senderEmail: string,
    company: string,
    industry: string,
    message: string
  ) => invokeEmailFunction('contact_form', to, { senderName, senderEmail, company, industry, message }),
};
