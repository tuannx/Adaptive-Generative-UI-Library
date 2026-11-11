import React from 'react';
import { mergeDrivers, type AgulEffectPlugin, type AgulMotionDriver } from './plugin.js';

const pluginKey = (plugins: readonly AgulEffectPlugin[] | undefined) => plugins?.map((plugin) => plugin.id).join('|') ?? '';

/**
 * Loads effect plugins once motion is on and returns the merged driver.
 * `undefined` while loading, when nothing is passed, or when every load failed: the CSS driver
 * covers those cases, so a plugin that fails to load never breaks the page.
 * Plugins are tracked by id, so an inline `effects={[motionEffects()]}` doesn't reload each render.
 */
export function useEffectDriver(plugins: readonly AgulEffectPlugin[] | undefined, active: boolean): AgulMotionDriver | undefined {
  const [loaded, setLoaded] = React.useState<{ key: string; driver?: AgulMotionDriver }>({ key: '' });
  const key = pluginKey(plugins);
  const [tracked, setTracked] = React.useState({ key, plugins });
  if (tracked.key !== key) setTracked({ key, plugins });

  React.useEffect(() => {
    const list = tracked.plugins;
    if (!active || !list || list.length === 0) return;
    const controller = new AbortController();
    void Promise.allSettled(list.map((plugin) => plugin.load())).then((results) => {
      if (controller.signal.aborted) return;
      const drivers = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      setLoaded({ key: tracked.key, driver: mergeDrivers(drivers) });
    });
    return () => controller.abort();
  }, [tracked, active]);

  // a driver loaded for other plugins, or while motion is off, doesn't apply
  return active && loaded.key === key ? loaded.driver : undefined;
}
