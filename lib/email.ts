import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL ?? "PromptGallery <noreply@promptgallery.ai>";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

async function sendEmail({ to, subject, html }: SendEmailInput) {
  if (!resend) return { sent: false, reason: "RESEND_API_KEY not configured" };

  try {
    await resend.emails.send({
      from: resendFromEmail,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendWelcomeEmail(to: string, fullName?: string | null) {
  const name = fullName?.trim() ? escapeHtml(fullName.trim()) : "there";
  return sendEmail({
    to,
    subject: "Welcome to PromptGallery",
    html: `<p>Hi ${name},</p><p>Welcome to PromptGallery. Your account is ready and you can start creating right away.</p>`,
  });
}

export async function sendGenerationReadyEmail(to: string, promptTitle: string, generatedImageUrl: string) {
  return sendEmail({
    to,
    subject: "Your PromptGallery generation is ready",
    html: `<p>Your generation for <strong>${escapeHtml(promptTitle)}</strong> is complete.</p><p><a href="${escapeHtml(generatedImageUrl)}">Open generated image</a></p>`,
  });
}

export async function sendCreatorReviewEmail(
  to: string,
  options: {
    creatorName?: string | null;
    promptTitle: string;
    status: "approved" | "rejected";
    reason?: string | null;
  },
) {
  const creatorName = options.creatorName?.trim() ? escapeHtml(options.creatorName.trim()) : "Creator";
  const promptTitle = escapeHtml(options.promptTitle);

  if (options.status === "approved") {
    return sendEmail({
      to,
      subject: "Your marketplace prompt was approved",
      html: `<p>Hi ${creatorName},</p><p>Your prompt <strong>${promptTitle}</strong> has been approved and is now live in the marketplace.</p>`,
    });
  }

  return sendEmail({
    to,
    subject: "Your marketplace prompt was rejected",
    html: `<p>Hi ${creatorName},</p><p>Your prompt <strong>${promptTitle}</strong> was rejected.</p><p>Reason: ${escapeHtml(
      options.reason?.trim() || "No reason provided.",
    )}</p>`,
  });
}

export async function sendWeeklyCreatorDigestEmail(
  to: string,
  options: {
    creatorName?: string | null;
    highlights: Array<{ title: string; sales: number }>;
  },
) {
  const creatorName = options.creatorName?.trim() ? escapeHtml(options.creatorName.trim()) : "Creator";
  const items = options.highlights
    .slice(0, 5)
    .map((item) => `<li>${escapeHtml(item.title)}: ${item.sales} sales</li>`)
    .join("");

  return sendEmail({
    to,
    subject: "Your top prompts this week",
    html: `<p>Hi ${creatorName},</p><p>Here are your top prompts this week:</p><ul>${items || "<li>No sales yet this week.</li>"}</ul>`,
  });
}

export async function sendAdminPromptSubmittedEmail(
  to: string,
  options: {
    creatorName: string;
    promptTitle: string;
    category: string;
  },
) {
  return sendEmail({
    to,
    subject: "New marketplace prompt pending review",
    html: `<p><strong>${escapeHtml(options.creatorName)}</strong> submitted <strong>${escapeHtml(
      options.promptTitle,
    )}</strong> in ${escapeHtml(options.category)}.</p>`,
  });
}
