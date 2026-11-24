/**
 * HTML for the compose window: the Namotech signature, quoted replies, forwards and clean pasted text.
 * Everything that comes from outside (a received mail, the clipboard) goes through cleanHtml() before it is
 * put in the page. Pictures are kept as data: addresses; the server puts them into the mail when sending.
 */
import DOMPurify from 'dompurify'
import addressIcon from '../assets/mail-sign/address.png?inline'
import emailIcon from '../assets/mail-sign/email.png?inline'
import instagramIcon from '../assets/mail-sign/instagram.png?inline'
import linkIcon from '../assets/mail-sign/link.png?inline'
import linkedinIcon from '../assets/mail-sign/linkedin.png?inline'
import logo from '../assets/mail-sign/logo.png?inline'
import phoneIcon from '../assets/mail-sign/phone.png?inline'
import whatsappIcon from '../assets/mail-sign/whatsapp.png?inline'
import { formatAddress, type MailMessage } from './mail'

const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

/** Same signature as in Thunderbird. Tables and inline styles only: Outlook ignores the rest. */
function buildSignature(): string {
  const font = 'font-family:Arial,Helvetica,sans-serif'
  const link = `color:#002060;text-decoration:none;font-size:14px;${font}`
  const social = (href: string, icon: string, alt: string) =>
    `<a href="${esc(href)}" target="_blank" style="text-decoration:none"><img src="${icon}" alt="${alt}" width="24" height="24" border="0" style="width:24px;height:24px;border:0;margin:0 2px"></a>`
  const row = (icon: string, alt: string, html: string) => `
    <tr>
      <td width="26" height="28" valign="middle" style="padding:0"><img src="${icon}" alt="${alt}" width="18" height="18" border="0" style="display:block;width:18px;height:18px;border:0"></td>
      <td height="28" valign="middle" style="padding:0;${font};font-size:14px;color:#002060">${html}</td>
    </tr>`
  return `<div class="ncrc-signature" style="${font};color:#002060">--
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${font}">
      <tr>
        <td valign="top" align="center" style="padding:0 46px 0 0">
          <img src="${logo}" alt="Namotech Consultancy" width="130" height="97" border="0" style="display:block;width:130px;height:97px;border:0">
          <div style="padding-top:22px;text-align:center">${[
    social('https://www.linkedin.com/company/namotech-consultancy-services-llp/', linkedinIcon, 'LinkedIn'),
    social('https://www.instagram.com/namotechconsultancy/', instagramIcon, 'Instagram'),
    social('https://api.whatsapp.com/send/?phone=919549519222&text&type=phone_number&app_absent=0', whatsappIcon, 'WhatsApp'),
  ].join('')}</div>
        </td>
        <td valign="top" style="padding:0">
          <div style="font-size:18px;font-weight:bold;line-height:28px;color:#002060">Namotech Consultancy Services LLP</div>
          <div style="font-size:14px;line-height:22px;color:#002060">Consultancy | Audits | Lab Testing | Field Investigation</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
            <tr><td height="22" style="padding:0;font-size:1px;line-height:22px;border-bottom:1px solid #ee0000">&nbsp;</td></tr>
            <tr><td height="22" style="padding:0;font-size:1px;line-height:22px">&nbsp;</td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
            ${row(phoneIcon, 'Phone', `<a href="tel:+918824311122" style="${link}">+91 8824311122</a> | <a href="tel:+918114428016" style="${link}">+91 8114428016</a>`)}
            ${row(emailIcon, 'Email', `<a href="mailto:info@namotech.in" style="${link}">info@namotech.in</a>`)}
            ${row(linkIcon, 'Website', `<a href="https://www.namotech.in" target="_blank" style="${link}">www.namotech.in</a>`)}
            ${row(addressIcon, 'Address', '57, Chandra Nagar, Gopalpura, 302018 Jaipur, Raj. India')}
          </table>
        </td>
      </tr>
    </table>
  </div>`.replace(/>\s+</g, '><').trim()
}

export const SIGNATURE = buildSignature()

// Word and Outlook keep their paragraph spacing in a style sheet, which does not survive: without it every line gets a gap
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!(node instanceof Element)) return
  const el = node as HTMLElement
  if (/\bMso(Normal|NoSpacing|ListParagraph)/.test(el.getAttribute('class') ?? '') && el.style && !el.style.margin && !el.style.marginTop) {
    el.style.marginTop = '0'
    el.style.marginBottom = '0'
  }
  // Nothing in a mail may lie over the app
  if (el.style && /^(fixed|sticky)$/.test(el.style.position)) el.style.position = ''
})

/** Safe to put in the page: no scripts, forms, frames or style sheets; formatting, tables, links and pictures stay. */
export function cleanHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe', 'object', 'embed', 'base', 'link', 'meta', 'title', 'video', 'audio', 'svg', 'math'],
    FORBID_ATTR: ['contenteditable', 'autofocus', 'tabindex', 'id', 'name'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|cid):|data:image\/(?:png|jpe?g|gif|webp);|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
}

/** The mail's own text as HTML; plain-text mails keep their line breaks. */
function messageHtml(message: MailMessage): string {
  if (message.html) return cleanHtml(message.html)
  return `<div>${esc(message.text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '&emsp;').replace(/ {2}/g, '&nbsp; ').replace(/\n/g, '<br>')}</div>`
}

/** Two empty lines to type in, then the signature */
export const newMailHtml = () => `<div><br></div><div><br></div>${SIGNATURE}`

export function replyHtml(message: MailMessage): string {
  const when = message.date ? new Date(message.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  return `${newMailHtml()}<div><br></div><div class="ncrc-quote"><div>On ${esc(when)}, ${esc(formatAddress(message.from))} wrote:</div>`
    + `<blockquote type="cite" style="margin:8px 0 0 0;padding:0 0 0 12px;border-left:2px solid #c5ccd6">${messageHtml(message)}</blockquote></div>`
}

export function forwardHtml(message: MailMessage): string {
  const rows: [string, string][] = [
    ['Subject', message.subject],
    ['Date', message.date ? new Date(message.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''],
    ['From', formatAddress(message.from)],
    ['To', message.to.map(formatAddress).join(', ')],
    ['Cc', message.cc.map(formatAddress).join(', ')],
  ]
  return `${newMailHtml()}<div><br></div><div class="ncrc-quote"><div>-------- Forwarded Message --------</div>`
    + `<div>${rows.filter(([, v]) => v).map(([k, v]) => `<b>${k}:</b> ${esc(v)}`).join('<br>')}</div><div><br></div>${messageHtml(message)}</div>`
}

/** A saved draft opened again: its text as it was saved (it already has its signature) */
export const draftHtml = (message: MailMessage) => messageHtml(message) || '<div><br></div>'
