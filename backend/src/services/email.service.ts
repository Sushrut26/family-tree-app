import { Resend } from 'resend';

type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
};

let resendClient: Resend | null = null;

const getResendClient = () => {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
};

const getAdminRecipient = () => {
  return process.env.ADMIN_ALERT_EMAIL;
};

const getFromAddress = () => {
  // Resend requires a verified domain or use their default for testing
  // Default: 'onboarding@resend.dev' works for testing
  return process.env.EMAIL_FROM || 'Family Tree <onboarding@resend.dev>';
};

export const sendAdminAlert = async (payload: EmailPayload): Promise<void> => {
  const to = getAdminRecipient();
  const client = getResendClient();

  if (!to || !client) {
    return;
  }

  await client.emails.send({
    from: getFromAddress(),
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
};
