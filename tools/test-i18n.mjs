/**
 * The dictionaries in src/locales against the strings the interface shows:
 * no stale keys, the same placeholders as the English text, a form for every
 * plural category of the language — and the lookup itself in src/i18n.ts.
 * A string a dictionary lacks is only reported: it is shown in English.
 */
import { checker, load } from './load.mjs';
import { compare, dictionaries, extract } from './i18n.mjs';

const { check, done } = checker();
const I = await load('i18n');
const strings = await extract();
const all = await dictionaries();
const placeholders = (text) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

check('a dictionary per language', Object.keys(all).sort(), Object.keys(I.LANGUAGES).filter((code) => code !== 'en').sort());

for (const [language, dictionary] of Object.entries(all)) {
  const { missing, unused } = compare(strings, dictionary);
  check(`${language}: no unused strings`, unused, []);
  const lacking = Object.entries(missing).flatMap(([context, texts]) => Object.keys(texts).map((text) => `${context} / ${text}`));
  if (lacking.length) console.log(`  ${language}: ${lacking.length} strings not translated (shown in English)`);

  const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories.slice().sort();
  const problems = [];
  for (const [context, texts] of Object.entries(dictionary)) {
    for (const [text, value] of Object.entries(texts)) {
      const forms = strings[context]?.[text];
      if (forms === undefined) continue;
      const expected = placeholders(text);
      if (forms === null || typeof value === 'string') {
        if (typeof value !== 'string' || !value.trim()) problems.push(`${context} / ${text}: not a text`);
        else if (JSON.stringify(placeholders(value)) !== JSON.stringify(expected)) problems.push(`${context} / ${text}: placeholders ${placeholders(value)}`);
        continue;
      }
      if (!value || typeof value !== 'object') {
        problems.push(`${context} / ${text}: neither a text nor plural forms`);
        continue;
      }
      if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(categories)) {
        problems.push(`${context} / ${text}: forms ${Object.keys(value)}, the language has ${categories}`);
      }
      for (const [category, form] of Object.entries(value)) {
        // A form may leave the number out ("one entry"), never anything else.
        const needed = expected.filter((name) => name !== '{count}');
        const got = placeholders(form);
        if (!got.every((name) => expected.includes(name)) || !needed.every((name) => got.includes(name))) {
          problems.push(`${context} / ${text} [${category}]: placeholders ${got}`);
        }
      }
    }
  }
  check(`${language}: well-formed translations`, problems, []);
}

// The lookup
check('english by default', I.t('menu', 'Delete'), 'Delete');
check('placeholders filled', I.t('toast', '{what} copied', { what: 'Password' }), 'Password copied');
check('english plural: one', I.tn('status', '{count} entry', '{count} entries', 1), '1 entry');
check('english plural: other', I.tn('status', '{count} entry', '{count} entries', 3), '3 entries');
I.setLanguage('ru');
check('translated', I.t('menu', 'Delete'), all.ru.menu.Delete);
check('unknown text stays english', I.t('menu', 'No such thing'), 'No such thing');
check('unknown context stays english', I.t('nowhere', 'Delete'), 'Delete');
const entries = all.ru.status['{count} entries'];
check('russian plural: one', I.tn('status', '{count} entry', '{count} entries', 21), entries.one.replace('{count}', '21'));
check('russian plural: few', I.tn('status', '{count} entry', '{count} entries', 3), entries.few.replace('{count}', '3'));
check('russian plural: many', I.tn('status', '{count} entry', '{count} entries', 11), entries.many.replace('{count}', '11'));
check('left to right', I.isRightToLeft(), false);
I.setLanguage('ar');
check('arabic is right to left', I.isRightToLeft(), true);
I.setLanguage('en');
check('browser language', I.detectLanguage(['de-DE', 'pt-BR', 'en']), 'pt');
check('browser language: none known', I.detectLanguage(['de', 'ja']), 'en');
check('language names', Object.keys(I.LANGUAGES).length, 10);

done('i18n');
