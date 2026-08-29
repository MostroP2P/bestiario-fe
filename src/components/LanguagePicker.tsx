import { LOCALES } from '~/i18n'
import { useSetLocale, useStrings } from '~/i18n/context'

/**
 * The reader's way out of a wrong guess.
 *
 * A native `<select>`: it is one tab stop, it is the control every reader's
 * platform already taught them, and on a phone it opens the picker their OS
 * draws rather than one this site would have to reinvent badly. Each
 * language is named in itself — a reader who landed on Italian by accident
 * cannot be asked to find "Spanish" in a list they do not read.
 */
export function LanguagePicker() {
  const strings = useStrings()
  const setLocale = useSetLocale()

  return (
    <div class="b-lang">
      <select
        class="b-lang-select"
        aria-label={strings.header.language}
        value={strings.locale}
        onChange={(event) => {
          const chosen = event.currentTarget.value
          if (chosen !== strings.locale) setLocale(chosen)
        }}
      >
        {Object.values(LOCALES).map((locale) => (
          <option key={locale.locale} value={locale.locale} lang={locale.locale}>
            {locale.name}
          </option>
        ))}
      </select>
    </div>
  )
}
