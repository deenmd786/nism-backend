const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS  // Your Gmail App Password (not your real password)
    }
});

const sendEmailNotification = async (toEmail, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: '"Digroz NISM Prep" <digroz59@gmail.com>',
            to: toEmail,
            subject: subject,
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent successfully to ${toEmail}`);
    } catch (error) {
        console.error("❌ Email sending failed:", error.message);
    }
};

module.exports = { sendEmailNotification };