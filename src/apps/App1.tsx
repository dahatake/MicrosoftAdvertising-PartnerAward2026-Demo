import { Body1, Title2 } from '@fluentui/react-components';
import { useT } from '../i18n/useT';

export function App1() {
  const t = useT();
  return (
    <section data-testid="app-root-app1" aria-labelledby="app1-heading">
      <Title2 as="h2" id="app1-heading">
        {t('app1.heading')}
      </Title2>
      <p>
        <Body1>{t('app1.lead')}</Body1>
      </p>
    </section>
  );
}
