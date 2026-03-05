import QRCode from 'qrcode';

export async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    const url = await QRCode.toDataURL(data, {
      width: 150,
      margin: 1,
      color: {
        dark: '#228B22',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    return url;
  } catch (error) {
    console.error('Error generating QR code:', error);
    return '';
  }
}

export function generatePaymentQRData(paymentDetails: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  amount?: number;
}): string {
  // Create a structured payment string
  const lines = [
    `Bank: ${paymentDetails.bankName}`,
    `Account: ${paymentDetails.accountName}`,
    `Number: ${paymentDetails.accountNumber}`,
  ];
  
  if (paymentDetails.amount) {
    lines.push(`Amount: NGN ${paymentDetails.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`);
  }
  
  return lines.join('\n');
}
