import { Body1, Title2, Title3 } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { Narration } from '../narration/Narration';
import { getScript } from '../narration/scripts';
import { useSettings } from '../settings/store';

export function App1() {
  const t = useT();
  const { lang } = useSettings();
  return (
    <section data-testid="app-root-app1" aria-labelledby="app1-heading">
      <Title2 as="h2" id="app1-heading">
        {t('app1.heading')}
      </Title2>
      <p>
        <Body1>{t('app1.lead')}</Body1>
      </p>
      <section aria-labelledby="narration-heading">
        <Title3 as="h3" id="narration-heading">
          {t('narration.heading')}
        </Title3>
        <Narration script={getScript('valueIntro', lang)} lang={lang} />
      </section>
    </section>
  );
}