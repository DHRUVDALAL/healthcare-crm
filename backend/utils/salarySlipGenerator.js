'use strict';

function generatePayslip(record) {
  return `
    <html>
      <head>
        <title>Payslip - ${record.salary_month}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
          .title { font-size: 24px; font-weight: bold; }
          .details { margin-bottom: 30px; }
          .details table { width: 100%; border-collapse: collapse; }
          .details td { padding: 8px; border: 1px solid #ddd; }
          .breakdown { margin-bottom: 30px; }
          .breakdown table { width: 100%; border-collapse: collapse; }
          .breakdown th, .breakdown td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .breakdown th { background-color: #f5f5f5; }
          .total { font-weight: bold; font-size: 18px; margin-top: 20px; text-align: right; }
          .footer { margin-top: 50px; font-size: 12px; color: #777; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">PAYSLIP</div>
          <div>Healthcare Recruitment CRM</div>
          <div>For the month of ${record.salary_month}</div>
        </div>
        
        <div class="details">
          <table>
            <tr>
              <td><strong>Employee Name:</strong> ${record.employee_name}</td>
              <td><strong>Designation:</strong> ${record.designation || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Department:</strong> ${record.department || 'N/A'}</td>
              <td><strong>Email:</strong> ${record.employee_email}</td>
            </tr>
          </table>
        </div>
        
        <div class="breakdown">
          <table>
            <thead>
              <tr>
                <th>Earnings & Deductions</th>
                <th>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base Salary</td>
                <td>${record.base_salary}</td>
              </tr>
              <tr>
                <td>Bonus / Allowances</td>
                <td>+ ${record.bonus}</td>
              </tr>
              <tr>
                <td>Deductions</td>
                <td>- ${record.deductions}</td>
              </tr>
              <tr style="font-weight: bold; background-color: #f5f5f5;">
                <td>Net Salary Payable</td>
                <td>${record.final_salary}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="total">
          Status: <span style="color: ${record.payment_status === 'paid' ? 'green' : 'red'}; text-transform: uppercase;">${record.payment_status}</span>
        </div>
        
        <div class="footer">
          <p>This is a system generated document and does not require a signature.</p>
        </div>
      </body>
    </html>
  `;
}

module.exports = { generatePayslip };
