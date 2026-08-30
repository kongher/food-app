import QRCode from "qrcode";
import { displayOrderCode } from "./orderCode";
import { formatTime, formatVnd } from "./format";
import { tableBillCode } from "./tableBill";
import type { Order, OrderItem } from "../types";

const THERMAL_BILL_ID = "thermal-bill-root";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function printOrderBill(order: Order, shop: { name: string; logo?: string }): Promise<void> {
  await printBillHtml({
    shop,
    code: displayOrderCode(order),
    tableNumber: order.tableNumber,
    timeLabel: formatTime(order.createdAt),
    codeLabel: "ລະຫັດອໍເດີ",
    items: order.items,
    total: order.total,
  });
}

export async function printTableBill({
  shop,
  tableNumber,
  items,
  total,
  startedAt,
}: {
  shop: { name: string; logo?: string };
  tableNumber: number;
  items: OrderItem[];
  total: number;
  startedAt: string;
}): Promise<void> {
  const code = tableBillCode(tableNumber, startedAt);
  await printBillHtml({
    shop,
    code,
    tableNumber,
    timeLabel: formatTime(startedAt),
    codeLabel: "ລະຫັດບິນ",
    items,
    total,
  });
}

async function printBillHtml({
  shop,
  code,
  tableNumber,
  timeLabel,
  codeLabel,
  items,
  total,
}: {
  shop: { name: string; logo?: string };
  code: string;
  tableNumber: number;
  timeLabel: string;
  codeLabel: string;
  items: OrderItem[];
  total: number;
}): Promise<void> {
  const qr = await QRCode.toDataURL(code, { width: 240, margin: 1, errorCorrectionLevel: "M" });
  const rows = items
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

  const markup = `
    <style>
      #thermal-bill-root .bill {
        width: 100%;
        padding: 2mm;
        font-family: "Noto Sans Lao", "Noto Sans", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #111;
        background: #fff;
      }
      #thermal-bill-root .center { text-align: center; }
      #thermal-bill-root .logo {
        width: 18mm;
        height: 18mm;
        object-fit: cover;
        border-radius: 50%;
      }
      #thermal-bill-root h1 { font-size: 16px; margin: 4px 0 2px; }
      #thermal-bill-root .muted { color: #444; font-size: 11px; }
      #thermal-bill-root hr {
        border: 0;
        border-top: 1px dashed #111;
        margin: 8px 0;
      }
      #thermal-bill-root table { width: 100%; border-collapse: collapse; }
      #thermal-bill-root td { vertical-align: top; padding: 2px 0; }
      #thermal-bill-root .right { text-align: right; white-space: nowrap; }
      #thermal-bill-root .note { font-size: 10px; color: #333; }
      #thermal-bill-root .total { font-size: 14px; font-weight: 700; }
      #thermal-bill-root .qr { width: 28mm; height: 28mm; }
      #thermal-bill-root.thermal-bill--58 .bill { font-size: 11px; }
      #thermal-bill-root.thermal-bill--58 .logo { width: 14mm; height: 14mm; }
      #thermal-bill-root.thermal-bill--58 .qr { width: 22mm; height: 22mm; }
    </style>
    <div class="bill">
      <div class="center">
        ${logo}
        <h1>${escapeHtml(shop.name)}</h1>
        <div class="muted">ໃບບິນ / BILL</div>
      </div>
      <hr />
      <div><strong>${escapeHtml(codeLabel)}:</strong> ${escapeHtml(code)}</div>
      <div><strong>ໂຕະ:</strong> ${tableNumber}</div>
      <div><strong>ເວລາ:</strong> ${escapeHtml(timeLabel)}</div>
      <hr />
      <table>${rows}</table>
      <hr />
      <table>
        <tr class="total">
          <td>ລວມທັງໝົດ</td>
          <td class="right">${escapeHtml(formatVnd(total))}</td>
        </tr>
      </table>
      <hr />
      <div class="center">
        <img class="qr" src="${qr}" alt="${escapeHtml(code)}" />
        <div class="muted">${escapeHtml(code)}</div>
        <div class="muted">ຂອບໃຈທີ່ອຸດໜູນ</div>
      </div>
    </div>
  `;

  await printThermalBill(markup, `${shop.name} · ${code}`);
}

function printThermalBill(markup: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.getElementById(THERMAL_BILL_ID)?.remove();

    const root = document.createElement("div");
    root.id = THERMAL_BILL_ID;
    root.className = "thermal-bill thermal-bill--80";
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = markup;
    document.body.appendChild(root);

    const previousTitle = document.title;
    document.title = title;

    const cleanup = () => {
      document.title = previousTitle;
      root.remove();
    };

    const finish = (error?: Error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    void waitForImages(root)
      .then(() => waitForPrintDialog())
      .then(() => finish())
      .catch((err) => finish(err instanceof Error ? err : new Error("ພິມບິນບໍ່ສຳເລັດ.")));
  });
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll("img")];
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function waitForPrintDialog(): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const media = window.matchMedia("print");

    const settle = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("afterprint", onAfterPrint);
      media.removeEventListener("change", onMedia);
      window.clearTimeout(safety);
      resolve();
    };

    const onAfterPrint = () => settle();
    const onMedia = (event: MediaQueryListEvent) => {
      if (!event.matches) settle();
    };

    window.addEventListener("afterprint", onAfterPrint);
    media.addEventListener("change", onMedia);

    const safety = window.setTimeout(settle, 120_000);

    window.requestAnimationFrame(() => {
      try {
        window.print();
      } catch (err) {
        window.removeEventListener("afterprint", onAfterPrint);
        media.removeEventListener("change", onMedia);
        window.clearTimeout(safety);
        reject(err instanceof Error ? err : new Error("ພິມບິນບໍ່ສຳເລັດ."));
      }
    });
  });
}
