import nodemailer from 'nodemailer';

type EmailPayload = {
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return cachedTransporter;
};

const getAdminRecipient = () => {
  return process.env.ADMIN_ALERT_EMAIL;
};

const getFromAddress = () => {
  return process.env.SMTP_FROM || 'Family Tree <no-reply@family-tree.local>';
};

export const sendAdminAlert = async (payload: EmailPayload): Promise<void> => {
  const to = getAdminRecipient();
  const transporter = getTransporter();

  if (!to || !transporter) {
    return;
  }

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
};
