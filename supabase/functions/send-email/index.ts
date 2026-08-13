import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    declare const Deno: { env: { get(key: string): string | undefined } };
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const body = await req.json();
    const { type, to, data } = body;

    let emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    };

    const from = "Innovion <onboarding@resend.dev>";

    switch (type) {
      case "welcome": {
        const { name, companyName, plan } = data;
        emailPayload = {
          from,
          to: [to],
          subject: `Welcome to Innovion, ${name}!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">Welcome to Innovion</h1>
                <p style="color: #94a3b8; margin: 8px 0 0;">Your workforce management platform</p>
              </div>
              <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                <p style="color: #1e293b; font-size: 16px; margin: 0 0 16px;">Hi ${name},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  Welcome to Innovion! Your workspace for <strong>${companyName}</strong> is ready. You're on the <strong>${plan}</strong> plan.
                </p>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 0 0 24px;">
                  <h3 style="color: #0F1C2E; font-size: 15px; font-weight: 600; margin: 0 0 12px;">Get started in 3 steps:</h3>
                  <ol style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>Complete your company profile in Settings</li>
                    <li>Add your contractors and employees</li>
                    <li>Create your first job or schedule</li>
                  </ol>
                </div>
                <div style="text-align: center;">
                  <a href="https://innovion.app/dashboard" style="display: inline-block; background: #2563EB; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">Go to Dashboard →</a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0;">Questions? Reply to this email or contact support@innovion.app</p>
              </div>
            </div>
          `,
        };
        break;
      }

      case "password_reset": {
        const { name, resetLink } = data;
        emailPayload = {
          from,
          to: [to],
          subject: "Reset your Innovion password",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">Password Reset</h1>
              </div>
              <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                <p style="color: #1e293b; font-size: 16px; margin: 0 0 16px;">Hi ${name || "there"},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  We received a request to reset your Innovion password. Click the button below to choose a new password.
                </p>
                <div style="text-align: center; margin: 0 0 24px;">
                  <a href="${resetLink}" style="display: inline-block; background: #2563EB; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">Reset Password →</a>
                </div>
                <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 0 0 16px;">
                  <p style="color: #92400e; font-size: 13px; margin: 0;">⚠️ This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">Innovion · support@innovion.app</p>
              </div>
            </div>
          `,
        };
        break;
      }

      case "compliance_expiry": {
        const { recipientName, items } = data;
        const itemRows = (items as Array<{ title: string; assignedTo: string; expiryDate: string; status: string }>)
          .map(
            (item) => `
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">${item.title}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">${item.assignedTo}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">${item.expiryDate}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <span style="background: ${item.status === "expired" ? "#fee2e2" : "#fef3c7"}; color: ${item.status === "expired" ? "#dc2626" : "#d97706"}; padding: 2px 8px; border-radius: 20px; font-weight: 600;">${item.status === "expired" ? "Expired" : "Expiring Soon"}</span>
            </td>
          </tr>
        `
          )
          .join("");

        emailPayload = {
          from,
          to: [to],
          subject: `⚠️ Compliance Alert: ${items.length} item${items.length > 1 ? "s" : ""} require attention`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">⚠️ Compliance Alert</h1>
                <p style="color: #94a3b8; margin: 8px 0 0;">Action required on your compliance items</p>
              </div>
              <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                <p style="color: #1e293b; font-size: 16px; margin: 0 0 16px;">Hi ${recipientName || "there"},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  The following compliance items require your immediate attention:
                </p>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin: 0 0 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #f1f5f9;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Item</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Assigned To</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Expiry</th>
                        <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
                      </tr>
                    </thead>
                    <tbody>${itemRows}</tbody>
                  </table>
                </div>
                <div style="text-align: center;">
                  <a href="https://innovion.app/compliance" style="display: inline-block; background: #2563EB; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">View Compliance →</a>
                </div>
              </div>
            </div>
          `,
        };
        break;
      }

      case "job_assignment": {
        const { contractorName, jobTitle, client, site, scheduledDate, scheduledTime, notes } = data;
        emailPayload = {
          from,
          to: [to],
          subject: `New job assigned: ${jobTitle}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">New Job Assigned</h1>
              </div>
              <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                <p style="color: #1e293b; font-size: 16px; margin: 0 0 16px;">Hi ${contractorName},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  You have been assigned a new job. Here are the details:
                </p>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 0 0 24px;">
                  <h2 style="color: #0F1C2E; font-size: 18px; font-weight: 700; margin: 0 0 16px;">${jobTitle}</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 120px;">Client</td>
                      <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${client}</td>
                    </tr>
                    ${site ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Site</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${site}</td></tr>` : ""}
                    ${scheduledDate ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${scheduledDate}</td></tr>` : ""}
                    ${scheduledTime ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Time</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${scheduledTime}</td></tr>` : ""}
                    ${notes ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Notes</td><td style="padding: 8px 0; color: #475569; font-size: 14px;">${notes}</td></tr>` : ""}
                  </table>
                </div>
                <div style="text-align: center;">
                  <a href="https://innovion.app/jobs" style="display: inline-block; background: #2563EB; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; text-decoration: none;">View Job Details →</a>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0;">Innovion · support@innovion.app</p>
              </div>
            </div>
          `,
        };
        break;
      }

      case "contact_form": {
        const { senderName, senderEmail, company, industry, message } = data;
        emailPayload = {
          from,
          to: [to],
          subject: `New contact form submission from ${senderName}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: #0F1C2E; padding: 40px 32px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">New Contact Form Submission</h1>
              </div>
              <div style="padding: 40px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; margin: 0 0 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px; vertical-align: top;">Name</td>
                      <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${senderName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Email</td>
                      <td style="padding: 8px 0; font-size: 14px;"><a href="mailto:${senderEmail}" style="color: #2563EB;">${senderEmail}</a></td>
                    </tr>
                    ${company ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Company</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${company}</td></tr>` : ""}
                    ${industry ? `<tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Industry</td><td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${industry}</td></tr>` : ""}
                    <tr>
                      <td style="padding: 8px 0; color: #64748b; font-size: 14px; vertical-align: top;">Message</td>
                      <td style="padding: 8px 0; color: #475569; font-size: 14px; line-height: 1.6;">${message.replace(/\n/g, "<br>")}</td>
                    </tr>
                  </table>
                </div>
                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">Reply directly to <a href="mailto:${senderEmail}" style="color: #2563EB;">${senderEmail}</a> to respond.</p>
              </div>
            </div>
          `,
        };
        break;
      }

      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-email] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
