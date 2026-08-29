import QRCode from "qrcode";
import { displayOrderCode } from "./orderCode";
import { formatTime, formatVnd } from "./format";
import type { Order } from "../types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function printOrderBill(order: Order, shop: { name: string; logo?: string }): Promise<void> {
  const code = displayOrderCode(order);
  const qr = await QRCode.toDataURL(code, { width: 240, margin: 1, errorCorrectionLevel: "M" });
  const rows = order.items
    .map((item) => {
      const note = item.note ? `<div class="note">${escapeHtml(item.note)}</div>` : "";
      return `<tr>
        <td>${item.quantity}× ${escapeHtml(item.name)}${note}</td>
        <td class="right">${escapeHtml(formatVnd(item.price * item.quantity))}</td>
      </tr>`;
    })
    .join("");

  const logo = shop.logo
    ? `<img class="logo" src="${escapeHtml(shop.logo)}" alt="" />`
    : "";

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(code)}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 72mm;
      font-family: "Noto Sans Lao", "Noto Sans", ui-sans-serif, system-ui, sans-serif;
      font-size: 12px;
      color: #111;
    }
    .bill { width: 72mm; padding: 2mm; }
    .center { text-align: center; }
    .logo { width: 18mm; height: 18mm; object-fit: cover; border-radius: 50%; }
    h1 { font-size: 16px; margin: 4px 0 2px; }
    .muted { color: #444; font-size: 11px; }
    hr { border: 0; border-top: 1px dashed #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    .right { text-align: right; white-space: nowrap; }
    .note { font-size: 10px; color: #333; }
    .total { font-size: 14px; font-weight: 700; }
    .qr { width: 28mm; height: 28mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="bill">
    <div class="center">
      ${logo}
      <h1>${escapeHtml(shop.name)}</h1>
      <div class="muted">ໃບບິນ / BILL</div>
    </div>
    <hr />
    <div><strong>ລະຫັດອໍເດີ:</strong> ${escapeHtml(code)}</div>
    <div><strong>ໂຕະ:</strong> ${order.tableNumber}</div>
    <div><strong>ເວລາ:</strong> ${escapeHtml(formatTime(order.createdAt))}</div>
    <hr />
    <table>${rows}</table>
    <hr />
    <table>
      <tr class="total">
        <td>ລວມທັງໝົດ</td>
        <td class="right">${escapeHtml(formatVnd(order.total))}</td>
      </tr>
    </table>
    <hr />
    <div class="center">
      <img class="qr" src="${qr}" alt="${escapeHtml(code)}" />
      <div class="muted">${escapeHtml(code)}</div>
      <div class="muted">ຂອບໃຈທີ່ອຸດໜູນ</div>
    </div>
  </div>
</body>
</html>`;

  await printHtmlDocument(html);
}

function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "print-bill");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
    });

    const cleanup = () => {
      iframe.remove();
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error("ພິມບິນບໍ່ສຳເລັດ."));
      } finally {
        window.setTimeout(cleanup, 800);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("ບໍ່ສາມາດເປີດໜ້າພິມໄດ້."));
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
}
