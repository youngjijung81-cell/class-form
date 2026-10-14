import type { Metadata } from 'next';
import AdminDashboard from '@/components/AdminDashboard';

export const metadata: Metadata = { title: '관리 · 교지 학급 프로필' };

export default function AdminPage() {
  return <AdminDashboard />;
}
