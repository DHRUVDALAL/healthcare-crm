'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Dynamically render report data table grid to PDF format.
 * @param {Array<Object>} data - Report database records.
 * @param {string} title - Report title description.
 */
async function generatePDF(data, title = 'HealthCRM System Report') {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let y = height - 50;

  // Title
  page.drawText(title, { x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.34, 0.86) });
  y -= 20;
  page.drawText(`Exported on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 30;

  if (!data || !data.length) {
    page.drawText('No records found matching filters.', { x: 50, y, size: 11, font, color: rgb(0.5, 0.5, 0.5) });
    return Buffer.from(await pdfDoc.save());
  }

  // Extract columns keys
  const keys = Object.keys(data[0]);

  // Determine column widths
  const margin = 40;
  const tableWidth = width - 2 * margin;
  const colWidth = tableWidth / keys.length;

  // Draw table header
  page.drawRectangle({
    x: margin,
    y: y - 5,
    width: tableWidth,
    height: 18,
    color: rgb(0.9, 0.92, 0.96)
  });

  keys.forEach((k, i) => {
    const label = String(k).replace(/_/g, ' ').toUpperCase();
    page.drawText(label.slice(0, Math.floor(colWidth / 5.5)), {
      x: margin + i * colWidth + 4,
      y: y,
      size: 8,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.2)
    });
  });

  y -= 22;

  // Draw table rows
  for (const row of data) {
    if (y < 40) {
      page = pdfDoc.addPage([600, 800]);
      y = height - 50;

      // Draw table header again
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: tableWidth,
        height: 18,
        color: rgb(0.9, 0.92, 0.96)
      });

      keys.forEach((k, i) => {
        const label = String(k).replace(/_/g, ' ').toUpperCase();
        page.drawText(label.slice(0, Math.floor(colWidth / 5.5)), {
          x: margin + i * colWidth + 4,
          y: y,
          size: 8,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.2)
        });
      });

      y -= 22;
    }

    // Draw zebra rows background
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: tableWidth,
      height: 14,
      color: rgb(0.98, 0.98, 0.99)
    });

    keys.forEach((k, i) => {
      let val = row[k];
      if (val instanceof Date) {
        val = val.toLocaleDateString('en-IN');
      } else if (val == null) {
        val = '';
      } else {
        val = String(val);
      }
      
      page.drawText(val.slice(0, Math.floor(colWidth / 5.2)), {
        x: margin + i * colWidth + 4,
        y: y,
        size: 7.5,
        font,
        color: rgb(0.2, 0.2, 0.2)
      });
    });

    y -= 16;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generatePDF
};
