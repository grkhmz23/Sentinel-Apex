'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface OperatorContextValue {
  actorId: string;
  setActorId: (value: string) => void;
}

const OperatorContext = createContext<OperatorContextValue | null>(null);

const STORAGE_KEY = 'sentinel-apex.ops-dashboard.actor-id';

export function OperatorProvider(
  { children, defaultActorId }: { children: React.ReactNode; defaultActorId: string },
): JSX.Element {
  const [actorId, setActorIdState] = useState(defaultActorId);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null && stored.trim() !== '') {
      setActorIdState(stored);
    }
  }, []);

  const value = useMemo<OperatorContextValue>(() => ({
    actorId,
    setActorId: (nextValue: string) => {
      setActorIdState(nextValue);
      window.localStorage.setItem(STORAGE_KEY, nextValue);
    },
  }), [actorId]);

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator(): OperatorContextValue {
  const value = useContext(OperatorContext);
  if (value === null) {
    throw new Error('useOperator must be used within OperatorProvider');
  }

  return value;
}
