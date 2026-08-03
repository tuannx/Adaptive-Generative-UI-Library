import React from 'react';
import type { AgulFieldPlugin } from './types.js';

const PluginContext = React.createContext<AgulFieldPlugin[]>([]);

export function PluginProvider({
  plugins,
  children,
}: {
  plugins: AgulFieldPlugin[];
  children: React.ReactNode;
}) {
  return <PluginContext.Provider value={plugins}>{children}</PluginContext.Provider>;
}

export function useAgulPlugins(): AgulFieldPlugin[] {
  return React.useContext(PluginContext);
}
