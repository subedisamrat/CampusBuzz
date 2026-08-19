import { redirect } from 'next/navigation';

// Redirect legacy /payment/success to the verify page
// which handles all payment completion states.
export default function PaymentSuccessRedirect() {
  redirect('/payment/verify');
}
