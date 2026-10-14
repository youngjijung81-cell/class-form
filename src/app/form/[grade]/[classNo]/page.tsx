import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import FormEditor from '@/components/FormEditor';
import { parseGradeClass } from '@/lib/questions';

type Props = { params: Promise<{ grade: string; classNo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { grade, classNo } = await params;
  return { title: `${grade}학년 ${classNo}반 · 교지 학급 프로필` };
}

export default async function FormPage({ params }: Props) {
  const { grade, classNo } = await params;
  const p = parseGradeClass(grade, classNo);
  if (!p) notFound();
  return <FormEditor grade={p.grade} classNo={p.classNo} />;
}
