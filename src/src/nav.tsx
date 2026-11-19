import { createContext, useContext } from 'react';
export interface Nav { page: string; arg: any; go: (k: string, arg?: any) => void; quickAdd: (kind: string) => void; openPalette: () => void; openHelp: () => void; openTour: () => void; }
export const NavC = createContext<Nav>(null as any);
export const useNav = () => useContext(NavC);
