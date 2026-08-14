// utils/emailTemplates.js

const crystalPurchaseTemplate = (userName, crystalAmount) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #4CAF50;">Crystals Added Successfully! 🎉</h2>
        </div>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>We have successfully added your new Crystals to your Digroz Learning wallet.</p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 5px 0; color: #333;">+${crystalAmount} Crystals 💎</h3>
        </div>

        <p>You can now use these crystals to unlock premium tests and accelerate your preparation.</p>
        <p style="font-size: 12px; color: #666;"><em>Note: Your official payment receipt has been sent separately by Google Play.</em></p>
        <br/>
        <p>Happy Learning,<br/><strong>The Digroz Learning Team</strong></p>
    </div>
    `;
};

const adBlockerTemplate = (userName) => {
    // (Keep the adBlockerTemplate exactly as we made it previously)
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #FF9800;">Welcome to an Ad-Free Experience! 🚀</h2>
        </div>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Thank you for upgrading! Your account has been successfully updated, and all advertisements have been removed from your Digroz Learning app.</p>
        
        <p><strong>What this means for you:</strong></p>
        <ul>
            <li>Uninterrupted mock tests and studying</li>
            <li>Faster app performance</li>
            <li>A distraction-free learning environment</li>
        </ul>

        <p>Please restart your app if you still see any ads. Thank you for supporting our development!</p>
        <br/>
        <p>Best regards,<br/><strong>The Digroz Learning Team</strong></p>
    </div>
    `;
};

module.exports = { crystalPurchaseTemplate, adBlockerTemplate };