// Matches src/data/content.js without depending on unshipped frontend sources.
const secretariat = {
  name: 'Susanne Egloff',
  email: 'susanne.egloff@kirche-wm.ch',
  phone: '052 319 12 73',
  address: {
    org: 'Evangelisch-reformierte Kirchgemeinde Weinland Mitte',
    line1: 'Sekretariat Rheinau',
    street: 'Poststrasse 6',
    zipCity: '8462 Rheinau',
  },
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

// All arguments are plain text; HTML escaping happens only at the output boundary.
export function renderMail({ title, preheader, greeting, paragraphs, details, action, closing = [], replyTo, logoUrl }) {
  const wrap = 'overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;';
  const linkStyle = `color:#a9425f;text-decoration:underline;${wrap}`;
  const paragraphStyle = 'margin:0 0 20px;';
  const contact = 'Bei Fragen, Änderungen deiner Reservation oder Anmeldungen von Schulklassen hilft dir unser Sekretariat:';
  const replyNotice = replyTo
    ? `Du kannst dich auch per Antwort auf diese E-Mail an die hinterlegte Kontaktadresse wenden: ${replyTo}`
    : 'Bitte antworte nicht auf diese automatisch versendete E-Mail. Nutze für dein Anliegen die oben angegebenen Kontaktdaten von Susanne Egloff.';
  const address = [secretariat.address.org, secretariat.address.line1, secretariat.address.street, secretariat.address.zipCity];
  const fallback = 'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:';
  const text = [
    'Osterweg Wyland', title, greeting, ...paragraphs,
    details.map(([label, value]) => `${label}: ${value}`).join('\n'),
    `${action.label}:\n${action.url}`, ...closing,
    contact, `${secretariat.name}\nE-Mail: ${secretariat.email}\nTelefon: ${secretariat.phone}`,
    replyNotice, address.join('\n'), 'https://www.kirche-wm.ch/',
  ].join('\n\n');

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#fdedcf;color:#29211f;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fdedcf" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fff8eb" style="width:100%;max-width:600px;table-layout:fixed;border-collapse:collapse;">
        <tr><td height="6" bgcolor="#a9425f" style="height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:24px;border-bottom:1px solid #f4c880;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:24px;font-weight:bold;letter-spacing:1px;color:#a9425f;">OSTERWEG WYLAND</td></tr>
        <tr><td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#29211f;${wrap}">
          <h1 style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;font-weight:bold;color:#a9425f;">${escapeHtml(title)}</h1>
          <p style="${paragraphStyle}">${escapeHtml(greeting)}</p>
          ${paragraphs.map((paragraph) => `<p style="${paragraphStyle}">${escapeHtml(paragraph)}</p>`).join('\n')}
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 24px;">
            ${details.map(([label, value]) => `<tr>
              <th scope="row" width="32%" align="left" valign="top" style="width:32%;padding:12px 8px;border-bottom:1px solid #f4c880;font-size:14px;line-height:22px;font-weight:bold;${wrap}">${escapeHtml(label)}</th>
              <td valign="top" style="padding:12px 8px;border-bottom:1px solid #f4c880;font-size:16px;line-height:24px;white-space:pre-line;${wrap}">${escapeHtml(value)}</td>
            </tr>`).join('\n')}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0 0 20px;">
            <tr><td align="center" bgcolor="#a9425f" style="background-color:#a9425f;">
              <a href="${escapeHtml(action.url)}" style="display:block;border:16px solid #a9425f;background-color:#a9425f;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:bold;text-align:center;text-decoration:none;${wrap}">${escapeHtml(action.label)}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 24px;font-size:13px;line-height:20px;">${fallback}<br><a href="${escapeHtml(action.url)}" style="${linkStyle}">${escapeHtml(action.url)}</a></p>
          ${closing.map((paragraph) => `<p style="${paragraphStyle}">${escapeHtml(paragraph)}</p>`).join('\n')}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fdedcf" style="width:100%;table-layout:fixed;border-collapse:collapse;">
            <tr><td style="padding:20px;font-size:14px;line-height:23px;${wrap}">
              <p style="margin:0 0 12px;">${contact}</p>
              <strong>${escapeHtml(secretariat.name)}</strong><br>
              <a href="${escapeHtml(`mailto:${secretariat.email}`)}" style="${linkStyle}">${escapeHtml(secretariat.email)}</a><br>
              <a href="${escapeHtml(`tel:${secretariat.phone.replace(/\s/g, '')}`)}" style="${linkStyle}">${escapeHtml(secretariat.phone)}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px;border-top:1px solid #f4c880;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#29211f;${wrap}">
          <p style="margin:0 0 20px;">${escapeHtml(replyNotice)}</p>
          <p style="margin:0;">${address.map(escapeHtml).join('<br>')}</p>
        </td></tr>
        <tr><td align="right" style="padding:0 24px 24px;">
          <a href="https://www.kirche-wm.ch/" style="${linkStyle}"><img src="${escapeHtml(logoUrl)}" alt="Reformierte Kirche Weinland Mitte" width="190" border="0" style="display:block;width:100%;max-width:190px;height:auto;border:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#29211f;"></a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
  return { html, text };
}
