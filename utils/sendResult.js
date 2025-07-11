const nodemailer = require('nodemailer');

exports.sendResultEmail = async (to, subject, resultData) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const htmlContent = `
      <h2>Test Result</h2>
      <p><strong>Test:</strong> ${resultData.testName}</p>
      <p><strong>Total Questions:</strong> ${resultData.totalQuestions}</p>
      <p><strong>Total Marks:</strong> ${resultData.totalMarks}</p>
      <p><strong>Marks Obtained:</strong> ${resultData.marksObtained}</p>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent
    });
  } catch (err) {
    console.error("Result email failed:", err);
  }
};
