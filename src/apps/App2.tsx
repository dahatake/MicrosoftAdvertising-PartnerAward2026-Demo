import { Body1, Title2 } from '@fluentui/react-components';
import { useT } from '../i18n/useT';

export function App2() {
  const t = useT();
  return (
    <section data-testid="app-root-app2" aria-labelledby="app2-heading">
      <Title2 as="h2" id="app2-heading">
        {t('app2.heading')}
      </Title2>
      <p>
        <Body1>{t('app2.lead')}</Body1>
      </p>
    </section>
  );
}
