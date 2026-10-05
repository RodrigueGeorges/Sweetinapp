import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { readWidgetState } from '../lib/widget';
import { SweetinWidget } from './SweetinWidget';

/** Appelé par Android (même app fermée) pour dessiner le widget. */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(<SweetinWidget {...await readWidgetState()} />);
}
