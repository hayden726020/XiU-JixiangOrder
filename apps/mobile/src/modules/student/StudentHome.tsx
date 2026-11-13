import { useState } from 'react';
import { createDefaultStudentSource } from './data/sampleSource';
import { createOrderDraft } from './state/orderDraft';
import MenuPage from './pages/MenuPage';
import SlotDiningPage from './pages/SlotDiningPage';
import type { StudentSource } from './types';
import './student.css';

type StudentView = 'menu' | 'slot';

export default function StudentHome() {
  const [source] = useState<StudentSource>(() => createDefaultStudentSource());
  const [draft] = useState(() => createOrderDraft({ source }));
  const [view, setView] = useState<StudentView>('menu');

  function goTo(next: StudentView): void {
    setView(next);
    window.scrollTo(0, 0);
  }

  if (view === 'slot') {
    return <SlotDiningPage source={source} draft={draft} onBack={() => goTo('menu')} />;
  }

  return <MenuPage source={source} draft={draft} onProceed={() => goTo('slot')} />;
}