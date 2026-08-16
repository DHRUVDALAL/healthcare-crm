'use strict';

const { getPool } = require('../config/db');

/**
 * Standard candidate bulk import template headers (PII-stripped)
 */
const TEMPLATE_HEADERS = [
  'Candidate Name',
  'Designation',
  'Experience (Years)',
  'Current Company',
  'Qualification',
  'Specialization',
  'Skills',
  'Current City',
  'Preferred Location',
  'Current Salary',
  'Expected Salary',
  'Notice Period',
  'Availability',
  'Referral Name',
  'Referral Contact',
  'Remarks'
];

/**
 * Generate CSV template content for candidate bulk import.
 * @returns {string} CSV template content
 */
function generateTemplateCSV() {
  const ts = Date.now().toString().slice(-4);
  const headerLine = TEMPLATE_HEADERS.map(h => `"${h}"`).join(',');
  const sampleRow1 = `"Dr. Rajesh Sharma ${ts}","Senior Cardiologist","12","Apollo Hospital ${ts}","MD Cardiology","Cardiology","Echocardiography, Angioplasty","Mumbai","Mumbai / Pune","2200000","2600000","30 Days","Immediate","Dr. Mehta","9876543210","Strong clinical background"`;
  const sampleRow2 = `"Priya Nair ${ts}","ICU Staff Nurse","5","Fortis Healthcare ${ts}","B.Sc Nursing","Critical Care","Ventilator Management, Patient Care","Bengaluru","Bengaluru","600000","750000","15 Days","Immediate","","","Available for rotative shifts"`;
  return `${headerLine}\n${sampleRow1}\n${sampleRow2}\n`;
}

/**
 * Parse raw tabular file content (CSV / TSV) into array of objects.
 * @param {string} rawContent 
 * @returns {Array<Object>}
 */
function parseRawContent(rawContent) {
  const lines = String(rawContent || '').split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t') && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (!values.some(v => v.length > 0)) continue;

    const rowObj = {};
    headers.forEach((h, index) => {
      rowObj[h] = values[index] || '';
    });
    rows.push(rowObj);
  }

  return rows;
}

/**
 * Validate preview records before importing.
 * @param {Array<Object>} rows 
 * @returns {Promise<Object>} Preview validation summary
 */
async function validateImportRows(rows) {
  const pool = getPool();

  const [existingApplicants] = await pool.query('SELECT full_name, current_company FROM applicants');
  const existingSet = new Set(
    existingApplicants.map(a => `${String(a.full_name).toLowerCase().trim()}_${String(a.current_company).toLowerCase().trim()}`)
  );

  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // Line 1 is header
    const name = String(r['Candidate Name'] || r['name'] || '').trim();
    const designation = String(r['Designation'] || r['designation'] || '').trim();
    const experience = parseFloat(r['Experience (Years)'] || r['experience'] || 0);
    const company = String(r['Current Company'] || r['company'] || 'Confidential').trim();
    const qualification = String(r['Qualification'] || r['qualification'] || '').trim();
    const skills = String(r['Skills'] || r['skills'] || '').trim();
    const city = String(r['Current City'] || r['city'] || 'India').trim();
    const prefLoc = String(r['Preferred Location'] || r['preferred_location'] || city).trim();
    const currSal = parseFloat(r['Current Salary'] || r['current_salary'] || 0);
    const expSal = parseFloat(r['Expected Salary'] || r['expected_salary'] || 0);

    const errors = [];
    if (!name) errors.push('Candidate Name is required');
    if (!designation) errors.push('Designation is required');
    if (!qualification) errors.push('Qualification is required');
    if (!skills) errors.push('Skills are required');
    if (isNaN(experience) || experience < 0) errors.push('Valid experience in years is required');

    const key = `${name.toLowerCase()}_${company.toLowerCase()}`;
    const isDuplicate = existingSet.has(key);

    const formattedRecord = {
      rowNumber: rowNum,
      full_name: name,
      current_designation: designation,
      total_experience: isNaN(experience) ? 0 : experience,
      current_company: company,
      qualification: qualification,
      skills: skills,
      city: city,
      preferred_location: prefLoc,
      current_salary: isNaN(currSal) ? 0 : currSal,
      expected_salary: isNaN(expSal) ? 0 : expSal,
      notice_period: String(r['Notice Period'] || '30 Days').trim(),
      availability: String(r['Availability'] || 'Immediate').trim(),
      source: r['Referral Name'] ? 'referral' : 'portal',
      referred_by: String(r['Referral Name'] || '').trim() || null,
      referral_contact: String(r['Referral Contact'] || '').trim() || null,
      notes: String(r['Remarks'] || '').trim()
    };

    if (errors.length) {
      invalidRows.push({ ...formattedRecord, errors });
    } else if (isDuplicate) {
      duplicateRows.push({ ...formattedRecord, warning: 'Candidate already exists under employer' });
    } else {
      validRows.push(formattedRecord);
    }
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    duplicateCount: duplicateRows.length,
    validRows,
    invalidRows,
    duplicateRows
  };
}

/**
 * Execute bulk candidate database insertion.
 * @param {Array<Object>} records 
 * @param {number} userId 
 * @returns {Promise<Object>} Import execution report
 */
async function processBulkImport(records, userId) {
  const pool = getPool();
  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const rec of records) {
    try {
      const dummyPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
      const dummyEmail = `candidate_${Date.now()}_${Math.floor(Math.random() * 1000)}@imported.crm`;
      const dummyResume = `uploads/resumes/imported_bulk_${Date.now()}.pdf`;

      await pool.query(
        `INSERT INTO applicants (
          full_name, phone, email, dob, gender, city, state, address,
          total_experience, current_company, current_designation,
          current_salary, expected_salary, notice_period, qualification,
          skills, preferred_location, source, referred_by, referral_contact,
          notes, candidate_status, original_resume_path, pool_status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          rec.full_name, dummyPhone, dummyEmail, '1992-01-01', 'male',
          rec.city, 'State', 'City Address', rec.total_experience,
          rec.current_company, rec.current_designation, rec.current_salary,
          rec.expected_salary, rec.notice_period, rec.qualification,
          rec.skills, rec.preferred_location, rec.source, rec.referred_by,
          rec.referral_contact, rec.notes || 'Imported via Excel Bulk Sourcing Engine',
          'active', dummyResume, Number(userId)
        ]
      );
      importedCount += 1;
    } catch (err) {
      skippedCount += 1;
      errors.push({ rowNumber: rec.rowNumber, name: rec.full_name, error: err.message });
    }
  }

  return {
    importedCount,
    skippedCount,
    errorCount: errors.length,
    errors
  };
}

module.exports = {
  TEMPLATE_HEADERS,
  generateTemplateCSV,
  parseRawContent,
  validateImportRows,
  processBulkImport
};
