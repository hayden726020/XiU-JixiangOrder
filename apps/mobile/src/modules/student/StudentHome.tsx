import { useState } from 'react';
import { createDefaultStudentSource } from './data/sampleSource';
import MenuPage from './pages/MenuPage';
import type { StudentSource } from './types';
import './student.css';

export default function StudentHome() {
  const [source] = useState<StudentSource>(() => createDefaultStudentSource());

  return <MenuPage source={source} />;
}