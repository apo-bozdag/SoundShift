import { useI18n } from '../i18n/index.jsx';

export default function LangSwitch() {
  const { lang, setLang } = useI18n();

  return (
    <div className="lang-switch">
      <button
        className={`lang-btn ${lang === 'tr' ? 'active' : ''}`}
        onClick={() => setLang('tr')}
      >
        TR
      </button>
      <button
        className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
