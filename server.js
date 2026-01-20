import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Load logo as base64 at startup
let logoBase64 = '';
try {
    const logoPath = join(__dirname, 'logo.png');
    const logoBuffer = readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
} catch (e) {
    console.error('Could not load logo.png:', e.message);
}

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
    });

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
 * Generates thermal label HTML for 4x6 inch labels - AD-Bits branded
 */
function generateThermalLabelHtml(order) {
    const shippingAddress = order.shippingAddress || {};

    // Get first name from shipping address
    const firstName = shippingAddress.firstName ||
        (shippingAddress.name ? shippingAddress.name.split(' ')[0] : 'Customer');

    // Format the current date
    const formattedDate = new Date().toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

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
      background: #fff;
    }

    .label {
      width: 4in;
      height: 6in;
      padding: 0.3in 0.25in;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* Top line decoration */
    .top-line {
      width: 60px;
      height: 4px;
      background: #000;
      margin-bottom: 0.2in;
    }

    /* Thank you section */
    .thank-you {
      text-align: center;
      margin-bottom: 0.35in;
    }

    .thank-you-text {
      font-size: 16px;
      letter-spacing: 4px;
      font-weight: 400;
      margin-bottom: 2px;
    }

    .customer-name {
      font-size: 22px;
      letter-spacing: 4px;
      font-weight: 400;
    }

    /* Logo section */
    .logo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      justify-content: center;
    }

    .logo {
      width: 120px;
      height: 120px;
      margin-bottom: 0.15in;
    }

    .brand-name {
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 1px;
    }

    /* Order info */
    .order-info {
      display: flex;
      justify-content: space-between;
      width: 100%;
      margin-top: auto;
      margin-bottom: 0.25in;
      font-size: 14px;
    }

    .date {
      font-weight: 400;
    }

    .order-number {
      font-weight: 400;
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: center;
      gap: 0.25in;
      width: 100%;
      padding-top: 0.15in;
      border-top: 1px solid #eee;
    }

    .social-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }

    .social-icon {
      width: 16px;
      height: 16px;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="label">
    <!-- Top line decoration -->
    <div class="top-line"></div>
    
    <!-- Thank you message -->
    <div class="thank-you">
      <div class="thank-you-text">THANK YOU,</div>
      <div class="customer-name">${escapeHtml(firstName.toUpperCase())}</div>
    </div>

    <!-- Logo -->
    <div class="logo-section">
      <img class="logo" src="data:image/png;base64,${logoBase64}" alt="AD-Bits Logo" />
      <div class="brand-name">AD-Bits</div>
    </div>

    <!-- Order info -->
    <div class="order-info">
      <div class="date">${formattedDate}</div>
      <div class="order-number">Order ${escapeHtml(order.name)}</div>
    </div>

    <!-- Footer with social -->
    <div class="footer">
      <div class="social-item">
        <svg class="social-icon" viewBox="0 0 24 24" fill="black">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
        <span>@adbits3d</span>
      </div>
      <div class="social-item">
        <svg class="social-icon" viewBox="0 0 24 24" fill="black">
          <circle cx="12" cy="12" r="10" stroke="black" stroke-width="2" fill="none"/>
          <path d="M2 12h20M12 2c-2.5 2.5-4 5.5-4 10s1.5 7.5 4 10c2.5-2.5 4-5.5 4-10s-1.5-7.5-4-10z" stroke="black" stroke-width="1.5" fill="none"/>
        </svg>
        <span>adbits.ca</span>
      </div>
      <div class="social-item">
        <svg class="social-icon" viewBox="0 0 24 24" fill="black">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        <span>AD-Bits</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.listen(PORT, () => {
    console.log(`Thermal Label Printer server running on port ${PORT}`);
});
