'use client';

/**
 * Jarre - BYOK Context Provider
 *
 * Loads encrypted API keys from localStorage on mount (managed mode only).
 * In self-hosted mode, this is a passthrough that renders children directly.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { IS_MANAGED } from '@/lib/config';
import { loadKeys, storeKeys, clearKeys, hasStoredKeys, type ByokKeys } from '@/lib/byok/key-store';

interface ByokContextValue {
  keys: ByokKeys;
  hasKeys: boolean;
  loading: boolean;
  saveKeys: (keys: ByokKeys, sessionToken: string) => Promise<void>;
  removeKeys: () => void;
}

const ByokContext = createContext<ByokContextValue>({
  keys: {},
  hasKeys: false,
  loading: false,
  saveKeys: async () => {},
  removeKeys: () => {},
});

export function useByok() {
  return useContext(ByokContext);
}

export function ByokProvider({
  children,
  sessionToken,
}: {
  children: React.ReactNode;
  sessionToken?: string;
}) {
  const [keys, setKeys] = useState<ByokKeys>({});
  const [loading, setLoading] = useState(IS_MANAGED);

  useEffect(() => {
    if (!IS_MANAGED || !sessionToken) {
      setLoading(false);
      return;
    }

    loadKeys(sessionToken).then((loaded) => {
      if (loaded) setKeys(loaded);
      setLoading(false);
    });
  }, [sessionToken]);

  const saveKeysHandler = useCallback(async (newKeys: ByokKeys, token: string) => {
    await storeKeys(newKeys, token);
    setKeys(newKeys);
  }, []);

  const removeKeysHandler = useCallback(() => {
    clearKeys();
    setKeys({});
  }, []);

  return (
    <ByokContext.Provider
      value={{
        keys,
        hasKeys: hasStoredKeys(),
        loading,
        saveKeys: saveKeysHandler,
        removeKeys: removeKeysHandler,
      }}
    >
      {children}
    </ByokContext.Provider>
  );
}
