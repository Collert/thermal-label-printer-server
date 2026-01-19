import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Shopify admin
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Thermal Label Printer App is running');
});

// Print label endpoint - serves the HTML for printing
app.get('/print', (req, res) => {
    const { orderId, orderName, labelCount = 1 } = req.query;

    // Get shipping address from query params (URL encoded JSON)
    let shippingAddress = {};
    let lineItems = [];

    try {
        if (req.query.shippingAddress) {
            shippingAddress = JSON.parse(decodeURIComponent(req.query.shippingAddress));
        }
        if (req.query.lineItems) {
            lineItems = JSON.parse(decodeURIComponent(req.query.lineItems));
        }
    } catch (e) {
        console.error('Error parsing query params:', e);
    }

    const html = generateThermalLabelHtml({
        id: orderId,
        name: orderName || 'Order',
        shippingAddress,
        lineItems
    }, parseInt(labelCount) || 1);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(html);
});

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Generate simple barcode lines SVG
 */
function generateBarcodeLines(text) {
    if (!text) return '';
    const lines = [];
    const chars = text.replace(/[^a-zA-Z0-9]/g, '').split('');
    let x = 10;

    chars.forEach((char, i) => {
        const width = (char.charCodeAt(0) % 3) + 1;
        lines.push(`<rect x="${x}" y="5" width="${width}" height="30" fill="black"/>`);
        x += width + 2;
    });

    return lines.join('');
}

/**
 * Generates thermal label HTML for 4x6 inch labels
 */
function generateThermalLabelHtml(order, copies = 1) {
    const shippingAddress = order.shippingAddress || {};
    const lineItems = order.lineItems || [];

    // Format the current date
    const formattedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    // Generate item list (limited to fit on label)
    const itemsHtml = lineItems.slice(0, 5).map(item => `
    <div class="item-row">
      <span class="item-qty">${item.quantity || 1}x</span>
      <span class="item-name">${escapeHtml(item.title || item.name || 'Item')}</span>
    </div>
  `).join('');

    const moreItemsCount = lineItems.length - 5;
    const moreItemsHtml = moreItemsCount > 0 ? `<div class="more-items">+ ${moreItemsCount} more items</div>` : '';

    // Generate multiple copies
    const labelsHtml = Array(copies).fill(null).map(() => `
    <div class="label">
      <!-- Header with Logo/Company -->
      <div class="header">
        <div class="company-name">SHIP TO</div>
        <div class="order-info">
          <div class="order-number">${escapeHtml(order.name)}</div>
          <div class="order-date">${formattedDate}</div>
        </div>
      </div>

      <!-- Main Shipping Address -->
      <div class="address-block">
        <div class="recipient-name">${escapeHtml(shippingAddress.name || 'N/A')}</div>
        ${shippingAddress.company ? `<div class="company">${escapeHtml(shippingAddress.company)}</div>` : ''}
        <div class="street">${escapeHtml(shippingAddress.address1 || '')}</div>
        ${shippingAddress.address2 ? `<div class="street">${escapeHtml(shippingAddress.address2)}</div>` : ''}
        <div class="city-state-zip">
          ${escapeHtml(shippingAddress.city || '')}, ${escapeHtml(shippingAddress.provinceCode || shippingAddress.province || '')} ${escapeHtml(shippingAddress.zip || '')}
        </div>
        <div class="country">${escapeHtml(shippingAddress.country || '')}</div>
        ${shippingAddress.phone ? `<div class="phone">Tel: ${escapeHtml(shippingAddress.phone)}</div>` : ''}
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Package Contents Summary -->
      <div class="contents-section">
        <div class="contents-title">PACKAGE CONTENTS</div>
        <div class="items-list">
          ${itemsHtml}
          ${moreItemsHtml}
        </div>
      </div>

      <!-- Footer with Barcode placeholder -->
      <div class="footer">
        <div class="barcode-area">
          <svg class="barcode-placeholder" viewBox="0 0 200 40">
            ${generateBarcodeLines(order.name)}
          </svg>
          <div class="barcode-text">${escapeHtml(order.name)}</div>
        </div>
      </div>
    </div>
  `).join('<div class="page-break"></div>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Label - ${escapeHtml(order.name)}</title>
  <style>
    @page {
      size: 4in 6in;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 12px;
      line-height: 1.3;
      color: #000;
      background: #fff;
    }

    .label {
      width: 4in;
      height: 6in;
      padding: 0.2in;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      background: #fff;
    }

    .page-break {
      page-break-after: always;
      height: 0;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 0.15in;
      border-bottom: 2px solid #000;
      margin-bottom: 0.15in;
    }

    .company-name {
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
    }

    .order-info {
      text-align: right;
    }

    .order-number {
      font-size: 16px;
      font-weight: bold;
    }

    .order-date {
      font-size: 10px;
      color: #333;
    }

    /* Address Block */
    .address-block {
      flex: 1;
      padding: 0.1in 0;
    }

    .recipient-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    .company {
      font-size: 14px;
      margin-bottom: 2px;
    }

    .street {
      font-size: 14px;
      margin-bottom: 2px;
    }

    .city-state-zip {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 2px;
    }

    .country {
      font-size: 12px;
      margin-bottom: 4px;
    }

    .phone {
      font-size: 11px;
      color: #333;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: #ccc;
      margin: 0.1in 0;
    }

    /* Contents Section */
    .contents-section {
      padding: 0.1in 0;
      max-height: 1.5in;
      overflow: hidden;
    }

    .contents-title {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      color: #666;
    }

    .items-list {
      font-size: 10px;
    }

    .item-row {
      display: flex;
      gap: 4px;
      margin-bottom: 2px;
    }

    .item-qty {
      font-weight: bold;
      min-width: 25px;
    }

    .item-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .more-items {
      font-style: italic;
      color: #666;
      margin-top: 4px;
    }

    /* Footer */
    .footer {
      margin-top: auto;
      padding-top: 0.1in;
      border-top: 1px solid #ccc;
    }

    .barcode-area {
      text-align: center;
    }

    .barcode-placeholder {
      width: 100%;
      max-width: 200px;
      height: 40px;
    }

    .barcode-text {
      font-size: 10px;
      font-family: monospace;
      margin-top: 2px;
    }

    /* Print-specific styles */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .label {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${labelsHtml}
</body>
</html>`;
}

app.listen(PORT, () => {
    console.log(`Thermal Label Printer server running on port ${PORT}`);
});
