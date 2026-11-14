import { useCallback, useEffect, useState } from 'react';
import { getSession, subscribeSession } from '../../../shared/session';
import { evaluateStudentSession, type StudentSessionGate } from './sessionGate';

export interface StudentSessionGateState {
  gate: StudentSessionGate;
  refresh: () => void;
}

export function useStudentSessionGate(): StudentSessionGateState {
  const [gate, setGate] = useState<StudentSessionGate>(() => evaluateStudentSession(getSession()));

  const refresh = useCallback(() => {
    setGate(evaluateStudentSession(getSession()));
  }, []);

  useEffect(() => subscribeSession(refresh), [refresh]);

  return { gate, refresh };
}