const nodemailer = require('nodemailer');

// ── Create transporter (returns null when credentials not configured) ────────
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  // Treat placeholder / missing values as "not configured"
  if (!user || !pass ||
      user.includes('your_gmail') ||
      pass.includes('your_16_char')) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass   // Gmail App Password (16 chars, no spaces)
    }
  });
}

// ── Mask email for display: vivek@gmail.com → v***k@gmail.com ───────────────
function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked =
    local.length <= 2
      ? local[0] + '*'
      : local[0] + '•••' + local.slice(-1);
  return `${masked}@${domain}`;
}

// ── Send a 6-digit verification code email ───────────────────────────────────
async function sendVerificationEmail(toEmail, code, firstName) {
  const transporter = createTransporter();

  // ─ Dev mode: no credentials configured — print code to console ─
  if (!transporter) {
    console.log('\n📧  ─────────────────────────────────────────────────────────');
    console.log(`    Email Verification  →  ${toEmail}`);
    console.log(`    Recipient : ${firstName}`);
    console.log(`    Code      : \x1b[33m${code}\x1b[0m  (expires in 15 min)`);
    console.log('    (Add EMAIL_USER + EMAIL_PASS to .env to send real emails)');
    console.log('─────────────────────────────────────────────────────────\n');
    return { messageId: 'dev-console' };
  }

  // ─ Production: send real email ─
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">

      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 32px rgba(15,23,42,0.10);">

        <!-- ── Header ── -->
        <tr>
          <td style="background:#2563EB;padding:28px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.18);border-radius:10px;
                            width:42px;height:42px;text-align:center;vertical-align:middle;">
                  <span style="color:#ffffff;font-size:22px;font-weight:800;line-height:1;">N</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-0.3px;">NexaFlow</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Body ── -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <h1 style="color:#0f172a;font-size:22px;font-weight:700;margin:0 0 8px;
                        letter-spacing:-0.4px;">Verify your email address</h1>
            <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 28px;">
              Hi <strong style="color:#0f172a;">${firstName}</strong>,
              welcome to NexaFlow! Enter the code below to confirm your email and
              activate your account.
            </p>

            <!-- Code box -->
            <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;
                         padding:28px 24px;text-align:center;margin-bottom:28px;">
              <p style="color:#94a3b8;font-size:11px;font-weight:700;
                          text-transform:uppercase;letter-spacing:1.5px;margin:0 0 14px;">
                Verification Code
              </p>
              <p style="color:#0f172a;font-size:44px;font-weight:800;
                          letter-spacing:14px;margin:0;
                          font-family:'Courier New',Courier,monospace;">
                ${code}
              </p>
            </div>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="color:#64748b;font-size:13px;padding:3px 0;">
                  ⏱&nbsp; Expires in <strong style="color:#0f172a;">15 minutes</strong>
                </td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;padding:3px 0;">
                  🔒&nbsp; Never share this code with anyone
                </td>
              </tr>
            </table>

            <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;
                        border-top:1px solid #f1f5f9;padding-top:20px;">
              Didn't create a NexaFlow account?
              You can safely ignore this email — no account will be created
              without entering this code.
            </p>
          </td>
        </tr>

        <!-- ── Footer ── -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;
                      padding:18px 32px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              © 2026 NexaFlow &nbsp;·&nbsp; This is an automated message — please do not reply.
            </p>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>
</body>
</html>`;

  return transporter.sendMail({
    from: `"NexaFlow" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${code} – Your NexaFlow verification code`,
    html
  });
}

module.exports = { sendVerificationEmail, maskEmail };
