'use client';

import { createContext, useContext } from 'react';

import type { DashboardSession } from '../lib/operator-session';

interface OperatorContextValue {
  session: DashboardSession;
  canOperate: boolean;
  isAdmin: boolean;
}

const OperatorContext = createContext<OperatorContextValue | null>(null);

export function OperatorProvider(
  { children, session }: { children: React.ReactNode; session: DashboardSession },
): JSX.Element {
  return (
    <OperatorContext.Provider
      value={{
        session,
        canOperate: session.operator.role === 'operator' || session.operator.role === 'admin',
        isAdmin: session.operator.role === 'admin',
      }}
    >
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

export function useOptionalOperator(): OperatorContextValue | null {
  return useContext(OperatorContext);
}
