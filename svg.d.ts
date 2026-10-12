// Static typing for SVG modules transformed by react-native-svg-transformer
// (see metro.config.js): each .svg import becomes a react-native-svg component.
declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const component: ComponentType<SvgProps>;
  export default component;
}
