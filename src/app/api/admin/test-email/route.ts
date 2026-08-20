import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyEmailTransport } from '@/lib/email';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await verifyEmailTransport();

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        hint: 'Check that EMAIL_USER and EMAIL_PASS in .env are valid. For Gmail, you need an App Password (not your regular password).',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? String(err) }, { status: 500 });
  }
}
