import type { AgulFieldPlugin } from '@aikitstudio/agul-react';
import { imageUploadPlugin } from './imageUploadPlugin.js';
import { colorPickerPlugin } from './colorPickerPlugin.js';

export const demoFieldPlugins: AgulFieldPlugin[] = [
  imageUploadPlugin,
  colorPickerPlugin,
];
