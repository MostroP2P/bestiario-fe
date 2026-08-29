import { useEffect, useState } from 'preact/hooks'
import { DEFAULT_RELAYS, PUBLISHER_PUBKEY } from '~/config'
import { useNumberLocale } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { useStore } from '~/store/useStore'
import { TrustRail } from '~/components/TrustRail'
import { LanguagePicker } from '~/components/LanguagePicker'
import { WindowPicker } from '~/components/WindowPicker'
import { LoadingAnnouncement } from '~/components/Skeleton'
import { printHash, ROUTES, useLocation, type Route } from '~/router'
import { Overview } from './Overview'
import { Orders } from './Orders'
import { Volume } from './Volume'

/**
 * The shell every route is read inside: who published these figures, which
 * section the reader is in, and which window they are looking at.
 *
 * The shell knows nothing about figures. It holds the boot state — the one
 * fatal condition is a missing or unverifiable index — and each route asks
 * the store for exactly the documents it needs, so a reader who lands on one
 * downloads that and nothing else (SPEC 8).
 */
export function Dashboard() {
  const strings = useStrings()
  useNumberLocale(strings.locale, strings.units)
  const { location, go } = useLocation()

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // The shell asks for nothing of its own: the index carries everything it
  // renders, and the routes ask for the rest.
  const { boot, relays } = useStore([])

  const label: Readonly<Record<Route, string>> = {
    overview: strings.nav.overview,
    orders: strings.nav.orders,
    volume: strings.nav.volume,
  }

  return (
    <div class="b-page">
      {boot.status === 'loading' && (
        <LoadingAnnouncement
          what={strings.loading.announcement(strings.loading.figures)}
        />
      )}

      {boot.status === 'failed' && (
        <p class="b-fatal" role="alert">
          <strong>{strings.fatal.heading}</strong>{' '}
          {boot.reason === 'timeout'
            ? strings.fatal.timeout
            : strings.fatal.unverified(boot.reason)}{' '}
          {strings.fatal.note}
        </p>
      )}

      <div class="b-shell">
        <TrustRail
          boot={boot}
          relays={relays}
          publisher={PUBLISHER_PUBKEY}
          nowMs={nowMs}
        />

        <div class="b-main">
          <div class="b-header">
            {/* Links, not buttons: a section is a place, and a reader is
                entitled to open one in a new tab or send it to someone. */}
            <nav class="b-tabs" aria-label={strings.nav.label}>
              {ROUTES.map((route) => (
                <a
                  key={route}
                  class="b-tab"
                  href={printHash({ route, window: location.window })}
                  aria-current={route === location.route ? 'page' : undefined}
                >
                  {label[route]}
                </a>
              ))}
            </nav>
            <div class="b-header-meta">
              <WindowPicker
                window={location.window}
                onChange={(window) => go({ route: location.route, window })}
              />
              <LanguagePicker />
              <span>{strings.header.network}</span>
              <span class="b-stream">
                <i aria-hidden="true" />
                {boot.status === 'ready'
                  ? strings.header.verified
                  : strings.header.connecting}
              </span>
            </div>
          </div>

          {location.route === 'overview' && <Overview window={location.window} />}
          {location.route === 'orders' && <Orders window={location.window} />}
          {location.route === 'volume' && <Volume window={location.window} />}
        </div>
      </div>

      <p class="b-footnote">{strings.footnote(DEFAULT_RELAYS.length)}</p>
    </div>
  )
}
