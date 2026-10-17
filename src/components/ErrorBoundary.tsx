import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { report } from '../lib/monitoring';
import { colors, fonts, tx } from '../theme';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Dernier filet : un plantage d'affichage montre cet écran (brandé) au lieu d'un écran blanc. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    report(error);
    if (__DEV__) console.warn(info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Crash onRetry={() => this.setState({ failed: false })} />;
  }
}

function Crash({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{t('crash.title')}</Text>
      <Pressable accessibilityRole="button" style={s.btn} onPress={onRetry}>
        <Text style={s.btnText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, textAlign: 'center' },
  btn: { marginTop: 24, backgroundColor: colors.cerise, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  btnText: { ...tx.black, fontSize: 16, color: colors.onBrand },
});
