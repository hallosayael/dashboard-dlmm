import { NextResponse } from 'next/server';
import { getWalletData } from '../../../lib/meteora';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet') || '';
  try {
    const data = await getWalletData(wallet);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || 'Gagal mengambil data' },
      { status: 400 }
    );
  }
}
