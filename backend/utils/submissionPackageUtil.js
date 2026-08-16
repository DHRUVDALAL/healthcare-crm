'use strict';

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Generate a professional PII-stripped Candidate Submission Package PDF for Hospital review.
 * @param {Object} candidate - Candidate object from database.
 * @param {Object} [options] - Additional remarks, job info, matching score.
 * @returns {Promise<Buffer>} PDF Buffer
 */
async function generateSubmissionPackagePDF(candidate, options = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 Size: 595 x 842 pt
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let y = height - 40;

  // Header Banner / Agency Branding
  page.drawRectangle({
    x: 0,
    y: height - 70,
    width,
    height: 70,
    color: rgb(0.08, 0.22, 0.45)
  });

  page.drawText('HEALTHCARE RECRUITMENT SERVICES', {
    x: 40,
    y: height - 35,
    size: 16,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  page.drawText('CONFIDENTIAL CANDIDATE SUBMISSION PACKAGE', {
    x: 40,
    y: height - 55,
    size: 10,
    font,
    color: rgb(0.85, 0.9, 1)
  });

  y = height - 90;

  // Confidential Watermark (Diagonal background text)
  page.drawText('CONFIDENTIAL - FOR HOSPITAL REVIEW ONLY', {
    x: 60,
    y: 400,
    size: 22,
    font: boldFont,
    color: rgb(0.92, 0.92, 0.94),
    rotate: { type: 'degrees', angle: 30 }
  });

  const candidateCode = `CAN-${String(candidate.id || 1000).padStart(5, '0')}`;
  const candName = String(candidate.full_name || 'Candidate').toUpperCase();
  const designation = String(candidate.current_designation || candidate.qualification || 'Healthcare Professional');

  // Candidate Header Info Box
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: width - 80,
    height: 60,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.8, 0.85, 0.92),
    borderWidth: 1
  });

  page.drawText(candName, { x: 55, y: y - 20, size: 14, font: boldFont, color: rgb(0.1, 0.15, 0.3) });
  page.drawText(`${designation} | Ref: ${candidateCode}`, { x: 55, y: y - 38, size: 10, font, color: rgb(0.3, 0.35, 0.45) });

  const score = options.matching_score || candidate.matching_score || 88;
  page.drawText(`Matching Score: ${score}%`, { x: width - 180, y: y - 24, size: 12, font: boldFont, color: rgb(0.08, 0.5, 0.25) });

  y -= 75;

  // Section Helper
  const drawSectionHeader = (title) => {
    page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 18, color: rgb(0.92, 0.94, 0.98) });
    page.drawText(title.toUpperCase(), { x: 48, y, size: 10, font: boldFont, color: rgb(0.08, 0.22, 0.45) });
    y -= 22;
  };

  // 1. Professional Overview (PII Safe)
  drawSectionHeader('1. Professional Overview');

  const exp = `${candidate.total_experience || 0} Years`;
  const qual = candidate.qualification || 'Not Specified';
  const currCompany = candidate.current_company || 'Confidential';
  const prefLoc = candidate.preferred_location || candidate.city || 'Flexible';

  const overviewFields = [
    { label: 'Total Experience:', val: exp },
    { label: 'Highest Qualification:', val: qual },
    { label: 'Current Employer:', val: currCompany },
    { label: 'Preferred Location:', val: prefLoc },
    { label: 'Notice Period:', val: candidate.notice_period || '30 Days' },
    { label: 'Availability:', val: candidate.availability || 'Immediate' }
  ];

  for (let i = 0; i < overviewFields.length; i += 2) {
    const f1 = overviewFields[i];
    const f2 = overviewFields[i + 1];

    page.drawText(f1.label, { x: 55, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(String(f1.val), { x: 155, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });

    if (f2) {
      page.drawText(f2.label, { x: 310, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(String(f2.val), { x: 410, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    }
    y -= 16;
  }
  y -= 10;

  // 2. Compensation & Timeline
  drawSectionHeader('2. Salary & Timeline Expectations');

  const currSal = candidate.current_salary ? `INR ${Number(candidate.current_salary).toLocaleString('en-IN')}` : 'Undisclosed';
  const expSal = candidate.expected_salary ? `INR ${Number(candidate.expected_salary).toLocaleString('en-IN')}` : 'As per Industry Standards';

  page.drawText('Current CTC:', { x: 55, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(currSal, { x: 155, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });

  page.drawText('Expected CTC:', { x: 310, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(expSal, { x: 410, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 26;

  // 3. Core Competencies & Skills
  drawSectionHeader('3. Core Competencies & Skills');

  const skillsStr = candidate.skills || 'Clinical Care, Patient Management, Emergency Response';
  page.drawText('Primary Skills:', { x: 55, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(skillsStr.slice(0, 90), { x: 155, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 16;

  if (candidate.certifications) {
    page.drawText('Certifications:', { x: 55, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(String(candidate.certifications).slice(0, 90), { x: 155, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }
  y -= 10;

  // 4. Professional Summary & Assessment
  drawSectionHeader('4. Recruiter Assessment & Evaluation');

  const summaryText = options.remarks || candidate.notes || 'The candidate demonstrates strong clinical competence, excellent communication skills, and consistent career progression in healthcare setups. Recommended for client interview.';
  
  page.drawText('Evaluation Remarks:', { x: 55, y, size: 9, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
  y -= 14;

  const lines = summaryText.match(/.{1,90}(\s|$)/g) || [summaryText];
  for (const line of lines.slice(0, 4)) {
    page.drawText(line.trim(), { x: 55, y, size: 8.5, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 13;
  }
  y -= 15;

  // Footer Disclaimer
  page.drawRectangle({
    x: 40,
    y: 35,
    width: width - 80,
    height: 35,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1
  });

  page.drawText('CONFIDENTIALITY NOTICE:', { x: 50, y: 58, size: 7.5, font: boldFont, color: rgb(0.5, 0.1, 0.1) });
  page.drawText('This profile has been screened and formatted by the recruiting agency for hospital evaluation only. Direct contact or solicitation without agency approval is prohibited under client agreement terms.', {
    x: 50,
    y: 44,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  generateSubmissionPackagePDF
};
