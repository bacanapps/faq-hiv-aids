/* global React, ReactDOM, Howl */
(function () {
  const { useMemo, useState, useRef, useEffect, useCallback } = React;
  const h = React.createElement;

  // ---- ROUTER (very light) ----
  const Routes = {
    HOME: 'home',
    FAQ: 'faq',
    ABOUT: 'apresentacao',
    BOT: 'bot',
  };

function readThemeFromLocation() {
  // location.hash looks like "#home?theme=exhibit"
  // We'll split at "?" and parse the query part.
  const rawHash = window.location.hash || ""; // e.g. "#home?theme=exhibit"
  const [, query = ""] = rawHash.split("?");  // ["#home", "theme=exhibit"]

  const params = new URLSearchParams(query);
  const t = params.get("theme");

  if (t === "exhibit" || t === "default") {
    return t;
  }

  // fallback if no valid theme param
  return "default";
}

function writeThemeToLocation(newTheme) {
  // keep the current route (#home, #faq, etc.)
  const rawHash = window.location.hash || "#home"; // e.g. "#home?theme=exhibit"
  const [routePart] = rawHash.split("?");          // "#home"

  const params = new URLSearchParams();
  params.set("theme", newTheme);

  // This will become "#home?theme=exhibit"
  const nextHash = `${routePart}?${params.toString()}`;

  // update without reloading
  window.location.hash = nextHash;
}



  // Ensure asset paths work on GitHub Pages subpaths and locally
  function toRelative(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url; // keep absolute urls
    if (url.startsWith('/')) return `.${url}`; // turn "/x" into "./x"
    return url; // already relative
  }

  function stripHtml(value = '') {
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function formatDuration(seconds) {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return '';
    const mins = Math.floor(total / 60);
    const secs = Math.round(total % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }

  function normalizeFaqEntries(data) {
    if (!Array.isArray(data)) return [];
    return data
      .map((item, idx) => {
        const question = item.question || item.q || item.title || '';
        const rawHtml = item.answerHtml || '';
        const fallbackText = item.answer || item.a || '';
        const baseHtml = rawHtml || (fallbackText ? `<p>${fallbackText}</p>` : '');
        const answerText = stripHtml(rawHtml || fallbackText || baseHtml);
        if (!question || (!baseHtml && !answerText)) return null;
        const tags = Array.isArray(item.tags) ? item.tags : [];

        const audioDescription = item.audioDescription || {};
        const audioSrc = toRelative(
          audioDescription.src ||
            item.audioSrc ||
            item.audio ||
            `./assets/audio/faq${idx + 1}.mp3`
        );

        const durationSec =
          audioDescription.durationSec ??
          audioDescription.durationSeconds ??
          audioDescription.duration ??
          null;

        return {
          id: item.id || item.slug || question,
          question,
          answerHtml: baseHtml || `<p>${answerText}</p>`,
          answerText,
          tags,
          audioSrc,
          audioDurationLabel: formatDuration(durationSec),
          searchText: `${question} ${answerText} ${tags.join(' ')}`.toLowerCase(),
        };
      })
      .filter(Boolean);
  }

  function fetchFaqData(signal) {
    return fetch('./data/faq.json', { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar FAQs (${res.status})`);
        return res.json();
      })
      .then((data) => normalizeFaqEntries(data));
  }

  // ---- AUDIO HOOK (Howler wrapper) ----
  function useHowlerAudio() {
    const [playingId, setPlayingId] = useState(null);
    const audioRef = useRef({ id: null, howl: null });

    const teardown = useCallback((options = {}) => {
      const { stop = true, updateState = true } = options;
      const current = audioRef.current;
      if (current && current.howl) {
        if (stop) {
          try {
            current.howl.stop();
          } catch (_) {}
        }
        try {
          current.howl.unload();
        } catch (_) {}
      }
      audioRef.current = { id: null, howl: null };
      if (updateState) setPlayingId(null);
    }, []);

    const toggle = useCallback(
      (id, src) => {
        if (!id || !src) return;

        // Howler global should exist
        const HowlCtor = window.Howl || (window.Howler && window.Howler.Howl);
        if (!HowlCtor) {
          console.warn('Biblioteca de áudio não carregada.');
          return;
        }

        const current = audioRef.current;

        // If tapping the same item -> pause/unpause
        if (current.id === id && current.howl) {
          if (current.howl.playing()) {
            current.howl.pause();
            setPlayingId(null);
          } else {
            current.howl.play();
            setPlayingId(id);
          }
          return;
        }

        // Otherwise, stop/unload previous
        if (current.howl) {
          teardown();
        }

        const nextHowl = new HowlCtor({
          src: [toRelative(src)],
          html5: true,
          preload: true,
          format: ['mp3'],
          onplayerror: (howlId, err) => {
            console.error('Howler play error:', err);
            try {
              nextHowl.once('unlock', () => nextHowl.play());
            } catch (_) {}
          },
          onloaderror: (howlId, err) => {
            console.error('Howler load error for', src, err);
          },
          onend: () => {
            if (audioRef.current.id === id) {
              teardown({ stop: false });
            }
          },
          onstop: () => {
            if (audioRef.current.id === id) {
              teardown({ stop: false });
            }
          },
        });

        audioRef.current = { id, howl: nextHowl };
        nextHowl.play();
        setPlayingId(id);
      },
      [teardown]
    );

    // Cleanup on unmount
    useEffect(
      () => () => {
        teardown({ updateState: false });
      },
      [teardown]
    );

    return {
      playingId,
      toggle,
      stop: () => teardown(),
      teardown,
    };
  }

  // ---- FAQ DATA HOOK ----
  function useFaqData(teardownAudio) {
    const [faqItems, setFaqItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const controllerRef = useRef(null);

    const load = useCallback(() => {
      // abort old request
      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      // stop any playing audio when reloading
      if (teardownAudio) {
        teardownAudio();
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(null);

      fetchFaqData(controller.signal)
        .then((normalized) => {
          if (controller.signal.aborted) return;
          setFaqItems(normalized);
          setLoading(false);
          if (controllerRef.current === controller) controllerRef.current = null;
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setError(err.message || 'Erro desconhecido ao carregar FAQs');
          setFaqItems([]);
          setLoading(false);
          if (controllerRef.current === controller) controllerRef.current = null;
        });

      return controller;
    }, [teardownAudio]);

    // initial load
    useEffect(() => {
      const controller = load();
      return () => {
        // cleanup fetch if component unmounts
        if (controllerRef.current) {
          controllerRef.current.abort();
          controllerRef.current = null;
        } else if (controller) {
          controller.abort();
        }
      };
    }, [load]);

    return { faqItems, loading, error, reload: load };
  }

  // ---- ROUTING HOOK ----
  function useRoute() {
    const [route, setRoute] = useState(() => {
      const hash = (location.hash || '').replace('#', '');
      return Object.values(Routes).includes(hash) ? hash : Routes.HOME;
    });

    useEffect(() => {
      function onHash() {
        const hVal = (location.hash || '').replace('#', '');
        setRoute(Object.values(Routes).includes(hVal) ? hVal : Routes.HOME);
      }
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    function navigate(r) {
      location.hash = r;
    }

    return [route, navigate];
  }

  // ---- REUSABLE HEADER HERO (used on FAQ / Placeholder, not Home anymore) ----
  const HeaderHero = ({ title, subtitle }) =>
    h(
      'header',
      { className: 'hero-blue' },
      h(
        'div',
        { className: 'hero-container' },
        h('h1', { className: 'hero-title text-gradient' }, title),
        subtitle
          ? h('p', { className: 'hero-subtitle muted' }, subtitle)
          : null,
        h(
          'div',
          { className: 'badges muted' },
          h(
            'span',
            { className: 'badge' },
            h('span', {
              className: 'badge-dot dot-green',
              'aria-hidden': 'true',
            })
          ),
          h(
            'span',
            { className: 'badge' },
            h('span', {
              className: 'badge-dot dot-blue',
              'aria-hidden': 'true',
            })
          ),
          h(
            'span',
            { className: 'badge' },
            h('span', {
              className: 'badge-dot dot-purple',
              'aria-hidden': 'true',
            })
          )
        )
      )
    );

  // ---- CARD COMPONENT (HOME feature cards) ----
  function Card({ icon, title, desc, cta, color, onClick }) {
    return h(
      'article',
      {
        className: 'card-neo theme-transition',
        style: { cursor: 'pointer' },
        onClick,
      },
      h('div', { className: 'card-icon', 'aria-hidden': 'true' }, icon),
      h('h2', { className: 'card-title' }, title),
      h('p', { className: 'card-desc muted body-copy' }, desc),
      h(
        'button',
        {
          className: `btn ${color} theme-transition`,
          type: 'button',
          style: { width: '100%' },
        },
        cta
      )
    );
  }

  // ---- PAGE: HOME ----
  function Home({ onNavigate, onToggleTheme, currentTheme }) {
    return h(
      'div',
      { className: 'fade-in theme-transition' },

      // HEADER / HERO (custom for Home with toggle)
      h(
        'header',
        { className: 'hero-blue theme-transition' },
        h(
          'div',
          { className: 'hero-container' },
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                alignItems: 'flex-start',
              },
            },

            // LEFT BLOCK: title/subtitle/dots
            h(
              'div',
              { style: { minWidth: 0, flex: '1 1 auto' } },
              h(
                'h1',
                {
                  className: 'hero-title heading-hero text-primary',
                  style: {
                    margin: 0,
                    textTransform: 'uppercase',
                  },
                },
                'FAQ SOBRE HIV E AIDS'
              ),
              h(
                'p',
                {
                  className:
                    'hero-subtitle muted text-secondary body-copy',
                  style: { marginTop: '0.5rem', maxWidth: '40rem' },
                },
                'Tire suas dúvidas sobre HIV e aids de forma interativa e acessível'
              ),
              h(
                'div',
                { className: 'badges text-secondary body-copy' },
                h(
                  'span',
                  { className: 'badge' },
                  h('span', {
                    className: 'badge-dot dot-green',
                    'aria-hidden': 'true',
                  })
                ),
                h(
                  'span',
                  { className: 'badge' },
                  h('span', {
                    className: 'badge-dot dot-blue',
                    'aria-hidden': 'true',
                  })
                ),
                h(
                  'span',
                  { className: 'badge' },
                  h('span', {
                    className: 'badge-dot dot-purple',
                    'aria-hidden': 'true',
                  })
                )
              )
            ),

            // RIGHT BLOCK: theme toggle button
            h(
              'button',
              {
                type: 'button',
                onClick: onToggleTheme,
                className:
                  'theme-transition card-flat pill-capsule body-copy',
                style: {
                  fontSize: '0.7rem',
                  lineHeight: '1.2',
                  minWidth: '7rem',
                  textAlign: 'center',
                  fontWeight: '500',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                },
                'aria-label':
                  'Alternar tema visual / contraste para modo de exposição',
              },
              currentTheme === 'default' ? 'Exposição' : 'Padrão'
            )
          )
        )
      ),

      // FEATURE CARDS
      h(
        'section',
        { className: 'feature-strip theme-transition' },
        h(
          'div',
          { className: 'feature-grid' },

          // Card 1
          h(Card, {
            icon: '📂',
            title: 'Apresentação',
            desc:
              'Conheça mais sobre HIV e aids, sua história e cuidados de prevenção',
            cta: 'Explorar',
            color: 'btn-primary',
            onClick: () => onNavigate(Routes.ABOUT),
          }),

          // Card 2
          h(Card, {
            icon: '❓',
            title: 'Perguntas Frequentes',
            desc:
              'Mais de 30 perguntas e respostas sobre HIV e aids com busca inteligente',
            cta: 'Explorar',
            color: 'btn-green',
            onClick: () => onNavigate(Routes.FAQ),
          }),

          // Card 3
          h(Card, {
            icon: '🤖',
            title: 'Pergunte ao Bot',
            desc:
              'Faça perguntas específicas e encontre respostas personalizadas sobre HIV e aids',
            cta: 'Explorar',
            color: 'btn-purple',
            onClick: () => onNavigate(Routes.BOT),
          })
        )
      ),

      // FOOTER
      h(
        'footer',
        { className: 'footer theme-transition text-secondary body-copy' },
        'Informações baseadas em evidências científicas • Ministério da Saúde • OPAS'
      )
    );
  }

  // ---- PAGE: FAQ ----
  function Faq({ onBack }) {
    const [term, setTerm] = useState('');
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } =
      useHowlerAudio();
    const { faqItems, loading, error, reload } = useFaqData(teardownAudio);

    const list = useMemo(() => {
      const source = faqItems;
      const t = term.trim().toLowerCase();
      if (!t) return source;
      return source.filter(({ searchText = '' }) => searchText.includes(t));
    }, [faqItems, term]);

    // stop audio if the currently-playing item is filtered out
    useEffect(() => {
      if (!playingId) return;
      const stillVisible = list.some(({ id }) => id === playingId);
      if (!stillVisible) {
        teardownAudio();
      }
    }, [list, playingId, teardownAudio]);

    const handleAudioToggle = useCallback(
      (faq) => {
        toggleAudio(faq.id, faq.audioSrc);
      },
      [toggleAudio]
    );

    const handleBack = useCallback(() => {
      teardownAudio();
      onBack();
    }, [teardownAudio, onBack]);

    const listContent = (() => {
      if (loading) {
        return h(
          'div',
          { className: 'state-message muted' },
          'Carregando perguntas…'
        );
      }
      if (error) {
        return h(
          'div',
          { className: 'state-message state-error' },
          h('span', null, error),
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-primary btn-retry',
              onClick: () => {
                setTerm('');
                reload();
              },
            },
            'Tentar novamente'
          )
        );
      }
      if (list.length === 0) {
        return h(
          'div',
          { className: 'state-message muted' },
          'Nenhuma pergunta encontrada para esse termo.'
        );
      }
      return list.map((faq) => {
        const isPlaying = playingId === faq.id;
        const audioLabel = isPlaying
          ? 'Pausar audiodescrição'
          : 'Ouvir audiodescrição';

        return h(
          'details',
          { key: faq.id || faq.question, className: 'faq-item' },
          h(
            'summary',
            { className: 'faq-question' },
            h(
              'span',
              { className: 'faq-question-text' },
              faq.question || ''
            ),
            faq.audioSrc
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: `faq-audio-btn${
                      isPlaying ? ' is-playing' : ''
                    }`,
                    onClick: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleAudioToggle(faq);
                    },
                    'aria-pressed': isPlaying ? 'true' : 'false',
                    'aria-label': audioLabel,
                  },
                  h(
                    'span',
                    {
                      className: 'faq-audio-icon',
                      'aria-hidden': 'true',
                    },
                    '🔊'
                  ),
                  h(
                    'span',
                    { className: 'faq-audio-label' },
                    isPlaying ? 'Pausar' : 'Audiodescrição'
                  ),
                  faq.audioDurationLabel
                    ? h(
                        'span',
                        { className: 'faq-audio-duration' },
                        faq.audioDurationLabel
                      )
                    : null
                )
              : null
          ),
          h('div', {
            className: 'faq-answer muted',
            dangerouslySetInnerHTML: { __html: faq.answerHtml },
          })
        );
      });
    })();

    return h(
      'div',
      { className: 'fade-in' },
      h(HeaderHero, { title: 'Perguntas Frequentes', subtitle: '' }),
      h(
        'section',
        { className: 'faq-section' },
        h(
          'div',
          { className: 'faq-controls' },
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-green',
              onClick: handleBack,
            },
            'Voltar'
          ),
          h('input', {
            className: 'faq-search',
            placeholder: 'Buscar por palavra-chave…',
            value: term,
            onChange: (e) => setTerm(e.target.value),
          })
        ),
        h('div', { className: 'faq-list' }, listContent)
      )
    );
  }

  // ---- PAGE: BOT ----
  function Bot({ onBack }) {
    const [term, setTerm] = useState('');
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } =
      useHowlerAudio();
    const { faqItems, loading, error, reload } = useFaqData(teardownAudio);

    const list = useMemo(() => {
      const source = faqItems;
      const t = term.trim().toLowerCase();
      if (!t) return source;
      return source.filter(({ searchText = '' }) => searchText.includes(t));
    }, [faqItems, term]);

    // auto-stop audio if filtered
    useEffect(() => {
      if (!playingId) return;
      const stillVisible = list.some(({ id }) => id === playingId);
      if (!stillVisible) {
        teardownAudio();
      }
    }, [list, playingId, teardownAudio]);

    const handleAudioToggle = useCallback(
      (faq) => {
        toggleAudio(faq.id, faq.audioSrc);
      },
      [toggleAudio]
    );

    const handleBack = useCallback(() => {
      teardownAudio();
      onBack();
    }, [teardownAudio, onBack]);

    const hasQuery = term.trim().length > 0;
    const hasResults = list.length > 0;

    let resultContent;
    if (loading) {
      resultContent = h(
        'div',
        { className: 'state-message muted' },
        'Carregando sugestões…'
      );
    } else if (error) {
      resultContent = h(
        'div',
        { className: 'state-message state-error' },
        h('span', null, error),
        h(
          'button',
          {
            type: 'button',
            className: 'btn btn-primary btn-retry',
            onClick: () => {
              setTerm('');
              reload();
            },
          },
          'Tentar novamente'
        )
      );
    } else {
      const sections = [];

      if (!hasQuery && hasResults) {
        sections.push(
          h(
            'div',
            { key: 'info', className: 'bot-info-card' },
            h('span', { className: 'bot-info-icon', 'aria-hidden': 'true' }, '💡'),
            h(
              'div',
              { className: 'bot-info-copy' },
              h(
                'p',
                { className: 'bot-info-title' },
                'Sugestão: explore todas as perguntas'
              ),
              h(
                'p',
                { className: 'bot-info-text' },
                'Use palavras-chave como “prevenção”, “tratamento” ou “testes” para encontrar respostas mais rápidas.'
              )
            )
          )
        );
      }

      if (!hasResults) {
        sections.push(
          h(
            'div',
            { key: 'empty', className: 'bot-empty-card' },
            h(
              'span',
              { className: 'bot-empty-icon', 'aria-hidden': 'true' },
              '🔍'
            ),
            h(
              'div',
              null,
              h(
                'p',
                { className: 'bot-empty-title' },
                'Nenhuma resposta encontrada'
              ),
              h(
                'p',
                { className: 'bot-empty-text' },
                'Tente termos diferentes ou mais gerais para ampliar a busca.'
              )
            )
          )
        );
      }

      if (hasResults) {
        sections.push(
          ...list.map((faq) => {
            const isPlaying = playingId === faq.id;
            const audioLabel = isPlaying
              ? 'Pausar audiodescrição'
              : 'Ouvir audiodescrição';
            return h(
              'article',
              { key: faq.id || faq.question, className: 'bot-result' },
              h(
                'div',
                { className: 'bot-result-header' },
                h(
                  'h3',
                  { className: 'bot-result-title' },
                  faq.question || ''
                ),
                faq.audioSrc
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: `bot-audio-btn${
                          isPlaying ? ' is-playing' : ''
                        }`,
                        onClick: () => handleAudioToggle(faq),
                        'aria-pressed': isPlaying ? 'true' : 'false',
                        'aria-label': audioLabel,
                      },
                      h(
                        'span',
                        {
                          className: 'bot-audio-icon',
                          'aria-hidden': 'true',
                        },
                        isPlaying ? '⏸️' : '🎧'
                      ),
                      h(
                        'span',
                        { className: 'bot-audio-label' },
                        isPlaying
                          ? 'Pausar'
                          : 'Audiodescrição'
                      ),
                      faq.audioDurationLabel
                        ? h(
                            'span',
                            { className: 'bot-audio-duration' },
                            faq.audioDurationLabel
                          )
                        : null
                    )
                  : null
              ),
              faq.tags && faq.tags.length
                ? h(
                    'div',
                    {
                      className: 'bot-tags',
                      'aria-label': 'Palavras-chave relacionadas',
                    },
                    ...faq.tags.map((tag, idx) =>
                      h(
                        'span',
                        {
                          key: `${faq.id}-tag-${idx}`,
                          className: 'bot-tag',
                        },
                        tag
                      )
                    )
                  )
                : null,
              h('div', {
                className: 'bot-result-body muted',
                dangerouslySetInnerHTML: { __html: faq.answerHtml },
              })
            );
          })
        );
      }

      resultContent = h('div', { className: 'bot-results' }, ...sections);
    }

    return h(
      'div',
      { className: 'bot-page fade-in' },
      h(
        'section',
        { className: 'bot-hero' },
        h(
          'div',
          { className: 'bot-hero-inner' },
          h(
            'div',
            { className: 'bot-hero-copy' },
            h(
              'button',
              { type: 'button', className: 'bot-back', onClick: handleBack },
              h('span', { 'aria-hidden': 'true' }, '←'),
              h('span', null, 'Voltar')
            ),
            h('span', { className: 'bot-hero-eyebrow' }, 'Pergunte ao Bot'),
            h(
              'h2',
              { className: 'bot-hero-title' },
              'Encontre respostas instantâneas sobre HIV e aids'
            ),
            h(
              'p',
              { className: 'bot-hero-description' },
              'Digite a sua dúvida ou explore o acervo completo de perguntas verificadas. As respostas são baseadas em evidências e atualizadas pelo Ministério da Saúde.'
            ),
            h(
              'div',
              { className: 'bot-hero-highlights' },
              h('span', null, 'Busca inteligente'),
              h('span', null, 'Audiodescrição em todas as respostas'),
              h('span', null, 'Conteúdo sem estigmas')
            )
          ),
          h(
            'div',
            { className: 'bot-hero-figure', 'aria-hidden': 'true' },
            h('img', { src: './assets/img/hero.png', alt: '' })
          )
        )
      ),
      h(
        'section',
        { className: 'bot-content' },
        h(
          'div',
          { className: 'bot-search-card' },
          h(
            'h3',
            { className: 'bot-search-title' },
            'Faça sua pergunta'
          ),
          h(
            'p',
            { className: 'bot-search-description' },
            'Use palavras-chave para filtrar as perguntas. Você pode buscar por termos como “profilaxia”, “transmissão” ou “tratamento”.'
          ),
          h(
            'div',
            { className: 'bot-search-bar' },
            h(
              'span',
              { className: 'bot-search-icon', 'aria-hidden': 'true' },
              '🔍'
            ),
            h('input', {
              className: 'bot-search-input',
              type: 'search',
              value: term,
              placeholder: 'Ex: Quais são as formas de prevenção?',
              onChange: (e) => setTerm(e.target.value),
            }),
            term.trim()
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'bot-search-clear',
                    onClick: () => setTerm(''),
                  },
                  h('span', { 'aria-hidden': 'true' }, '✕'),
                  h(
                    'span',
                    { className: 'bot-search-clear-label' },
                    'Limpar'
                  )
                )
              : null
          )
        ),
        resultContent
      )
    );
  }

  // ---- PAGE: PRESENTATION ----
  function Presentation({ onBack }) {
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } =
      useHowlerAudio();

    // stop audio if we leave the page
    useEffect(
      () => () => teardownAudio({ updateState: false }),
      [teardownAudio]
    );

    const audioId = 'presentation-intro';
    const isPlaying = playingId === audioId;

    const handleAudio = useCallback(() => {
      toggleAudio(audioId, './assets/audio/presentation.mp3');
    }, [toggleAudio]);

    const handleBack = useCallback(() => {
      teardownAudio();
      onBack();
    }, [teardownAudio, onBack]);

    return h(
      'div',
      { className: 'fade-in' },
      h(
        'section',
        { className: 'presentation-hero' },
        h(
          'div',
          { className: 'presentation-hero-inner' },
          h(
            'div',
            { className: 'presentation-hero-copy' },
            h('span', { className: 'presentation-badge' }, 'Apresentação'),
            h(
              'h2',
              { className: 'presentation-title' },
              'Um espaço seguro para tirar dúvidas sobre HIV e aids'
            ),
            h(
              'p',
              { className: 'presentation-lede' },
              'Conhecimento confiável, linguagem acolhedora e audiodescrição inclusiva para você.'
            )
          ),
          h(
            'div',
            { className: 'presentation-hero-figure', 'aria-hidden': 'true' },
            h('img', { src: './assets/img/hero.png', alt: '' })
          )
        )
      ),
      h(
        'section',
        { className: 'presentation-content' },
        h(
          'div',
          { className: 'presentation-audio' },
          h(
            'button',
            {
              type: 'button',
              className: `presentation-audio-btn${
                isPlaying ? ' is-playing' : ''
              }`,
              onClick: handleAudio,
              'aria-pressed': isPlaying ? 'true' : 'false',
              'aria-label': isPlaying
                ? 'Pausar audiodescrição da apresentação'
                : 'Ouvir audiodescrição da apresentação',
            },
            h(
              'span',
              {
                className: 'presentation-audio-icon',
                'aria-hidden': 'true',
              },
              isPlaying ? '⏸️' : '🎧'
            ),
            h(
              'span',
              { className: 'presentation-audio-label' },
              isPlaying
                ? 'Pausar audiodescrição'
                : 'Ouvir audiodescrição'
            )
          )
        ),
        h(
          'div',
          { className: 'presentation-text muted' },
          h(
            'p',
            null,
            'Em um mundo onde a informação sobre HIV e aids muitas vezes se perde em mitos e contradições, apresentamos o nosso tira-dúvidas interativo sobre HIV e aids, uma ferramenta de conhecimento pensada para você.'
          ),
          h(
            'p',
            null,
            'Nossa missão é simples: garantir que você tenha acesso a dados atualizados e cientificamente validados. Aqui, você pode fazer perguntas e receber respostas instantâneas e confiáveis sobre HIV e aids. O medo do julgamento e a vergonha frequentemente impedem as pessoas de fazer perguntas essenciais sobre sua saúde. Por aqui, você encontra um ambiente de neutralidade, total discrição e sigilo.'
          ),
          h(
            'p',
            null,
            'Essa democratização do conhecimento é um passo fundamental para que você possa tomar decisões informadas sobre sua saúde e desmistificar o HIV e a aids. Ao facilitar o acesso à informação correta e sem preconceitos, ajudamos a construir uma sociedade mais empática e livre de estigmas.'
          ),
          h('p', null, 'Pergunte. O conhecimento transforma e salva vidas.')
        ),
        h(
          'div',
          { className: 'presentation-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'btn btn-green',
              onClick: handleBack,
            },
            'Voltar'
          )
        )
      )
    );
  }

  // ---- FALLBACK PAGE ----
  function Placeholder({ title, onBack }) {
    return h(
      'div',
      { className: 'fade-in' },
      h(HeaderHero, { title, subtitle: '' }),
      h(
        'section',
        { className: 'placeholder-section' },
        h(
          'p',
          { className: 'muted placeholder-copy' },
          'Conteúdo desta seção será adicionado.'
        ),
        h(
          'button',
          { type: 'button', className: 'btn btn-primary', onClick: onBack },
          'Voltar'
        )
      )
    );
  }

  // ---- TOP-LEVEL APP (router switch + theme) ----
  function App() {
  const [route, navigate] = useRoute();

  // INITIAL THEME comes from URL (?theme=exhibit or ?theme=default)
  const [theme, setTheme] = React.useState(() => readThemeFromLocation());

  // Sync React state -> <html data-theme="..."> AND -> URL hash param
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    writeThemeToLocation(theme);
  }, [theme]);

  // Also react if user manually edits the URL hash
  React.useEffect(() => {
    function onHashChange() {
      const urlTheme = readThemeFromLocation();
      setTheme((current) => {
        // avoid useless state updates
        return current === urlTheme ? current : urlTheme;
      });
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Toggle from button
  function toggleTheme() {
    setTheme((t) => (t === "default" ? "exhibit" : "default"));
  }

  let screen;
  if (route === Routes.FAQ) {
    screen = h(Faq, { onBack: () => navigate(Routes.HOME) });
  } else if (route === Routes.BOT) {
    screen = h(Bot, { onBack: () => navigate(Routes.HOME) });
  } else if (route === Routes.ABOUT) {
    screen = h(Presentation, { onBack: () => navigate(Routes.HOME) });
  } else if (route === Routes.HOME) {
    screen = h(Home, {
      onNavigate: (nextRoute) => navigate(nextRoute),
      onToggleTheme: toggleTheme,
      currentTheme: theme,
    });
  } else {
    screen = h(Placeholder, {
      title: "Conteúdo não encontrado",
      onBack: () => navigate(Routes.HOME),
    });
  }

  return h(
    "main",
    {
      className:
        "app-shell app-root theme-transition bg-page text-textPrimary",
    },
    screen
  );
}


  // ---- MOUNT REACT 18 ROOT ----
  const container = document.getElementById('root');
  const root = ReactDOM.createRoot(container);
  root.render(h(App));
})();
