/**
 * Wraps a plain-text message in a branded HTML email.
 *
 * Email clients are a decade behind browsers, so this deliberately uses table
 * layout, inline styles and web-safe fonts — flexbox, grid and <style> blocks
 * are unreliable in Outlook and several webmail clients. Every message is also
 * sent with the original plain text as the alternative part, so a client that
 * refuses HTML still shows something readable.
 */

const NAVY = '#1b3a6b';
const RED = '#d22b2b';
const INK = '#16233a';
const MUTED = '#5d6b82';
const LINE = '#e3e1dc';
const PAPER = '#f6f7f9';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the message body.
 *
 * Templates emit `Label:   value` lines for appointment details; those are
 * turned into a two-column table so they line up in the email the way they do
 * in the terminal. Everything else becomes a paragraph.
 */
function renderBody(text: string): string {
  const blocks = text.split('\n\n').filter((block) => block.trim());

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((line) => line.trim());

      // A run of "Label: value" lines renders as a detail table.
      const detailLines = lines.filter((line) => /^[A-Z][A-Za-z ]{2,20}:\s{2,}/.test(line));
      if (detailLines.length >= 2 && detailLines.length === lines.length) {
        const rows = lines
          .map((line) => {
            const [, label, value] = line.match(/^([A-Za-z ]+):\s+(.*)$/) ?? [];
            if (!label) return '';
            return `<tr>
              <td style="padding:6px 16px 6px 0;color:${MUTED};font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td>
              <td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
            </tr>`;
          })
          .join('');

        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
                       style="margin:18px 0;background:${PAPER};border-radius:8px;padding:14px 18px;width:100%;">
          ${rows}
        </table>`;
      }

      return `<p style="margin:0 0 16px;color:${INK};font-size:15px;line-height:1.6;">${escapeHtml(
        block,
      ).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

export interface EmailLayoutOptions {
  subject: string;
  body: string;
  organisationName?: string;
  /** Rendered as a prominent button under the message. */
  action?: { label: string; url: string };
  footerNote?: string;
}

export function renderEmailHtml({
  subject,
  body,
  organisationName = 'NurseOnCall',
  action,
  footerNote,
}: EmailLayoutOptions): string {
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
         <tr><td style="border-radius:8px;background:${NAVY};">
           <a href="${escapeHtml(action.url)}"
              style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                     font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
             ${escapeHtml(action.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 20px;color:${MUTED};font-size:13px;line-height:1.5;">
         If the button does not work, copy this link into your browser:<br>
         <span style="color:${NAVY};word-break:break-all;">${escapeHtml(action.url)}</span>
       </p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
  <!-- Preview text shown in the inbox list, hidden in the message itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(subject)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:22px 28px;border-bottom:1px solid ${LINE};">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;letter-spacing:-0.3px;">
                <span style="color:${NAVY};">NURSE</span><span style="color:${RED};">ONCALL</span>
              </span>
              <div style="margin-top:3px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};">
                Your Health, Our Priority
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
              ${renderBody(body)}
              ${button}
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px;background:${PAPER};border-top:1px solid ${LINE};
                       font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};line-height:1.5;">
              ${footerNote ? `${escapeHtml(footerNote)}<br><br>` : ''}
              This message was sent by ${escapeHtml(organisationName)}.
              If it reached you by mistake, please ignore it.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
