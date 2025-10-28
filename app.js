/* global React, ReactDOM */
(function () {
  const { useMemo, useState } = React;
  const h = React.createElement;

  // ---- ROUTER (very light) ----
  const Routes = {
    HOME: 'home',
    FAQ: 'faq',
    ABOUT: 'apresentacao',
    BOT: 'bot'
  };

  const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const formatDuration = (seconds) => {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total <= 0) return '';
    const mins = Math.floor(total / 60);
    const secs = Math.round(total % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const normalizeFaqEntries = (data) => {
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
        const audioSrc =
          audioDescription.src ||
          item.audioSrc ||
          item.audio ||
          `/assets/audio/faq${idx + 1}.mp3`;
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
          searchText: `${question} ${answerText} ${tags.join(' ')}`.toLowerCase()
        };
      })
      .filter(Boolean);
  };

  const fetchFaqData = (signal) =>
    fetch('./data/faq.json', { signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Falha ao carregar FAQs (${res.status})`);
        return res.json();
      })
      .then((data) => normalizeFaqEntries(data));

  function useHowlerAudio() {
    const [playingId, setPlayingId] = useState(null);
    const audioRef = React.useRef({ id: null, howl: null });

    const teardown = React.useCallback((options = {}) => {
      const { stop = true, updateState = true } = options;
      const current = audioRef.current;
      if (current && current.howl) {
        if (stop) {
          try { current.howl.stop(); } catch (_) {}
        }
        try { current.howl.unload(); } catch (_) {}
      }
      audioRef.current = { id: null, howl: null };
      if (updateState) setPlayingId(null);
    }, []);

    const toggle = React.useCallback((id, src) => {
      if (!id || !src) return;

      const HowlCtor = window.Howl || (window.Howler && window.Howler.Howl);
      if (!HowlCtor) {
        console.warn('Biblioteca de áudio não carregada.');
        return;
      }

      const current = audioRef.current;
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

      if (current.howl) {
        teardown();
      }

      const nextHowl = new HowlCtor({
        src: [src],
        html5: true,
        onend: () => {
          if (audioRef.current.id === id) {
            teardown({ stop: false });
          }
        },
        onstop: () => {
          if (audioRef.current.id === id) {
            teardown({ stop: false });
          }
        }
      });

      audioRef.current = { id, howl: nextHowl };
      nextHowl.play();
      setPlayingId(id);
    }, [teardown]);

    React.useEffect(() => () => teardown({ updateState: false }), [teardown]);

    return {
      playingId,
      toggle,
      stop: () => teardown(),
      teardown
    };
  }

  function useFaqData(teardownAudio) {
    const [faqItems, setFaqItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const controllerRef = React.useRef(null);

    const load = React.useCallback(() => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
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

    React.useEffect(() => {
      const controller = load();
      return () => {
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

  function useRoute() {
    const [route, setRoute] = useState(() => {
      const hash = (location.hash || '').replace('#', '');
      return Object.values(Routes).includes(hash) ? hash : Routes.HOME;
    });

    React.useEffect(() => {
      const onHash = () => {
        const h = (location.hash || '').replace('#', '');
        setRoute(Object.values(Routes).includes(h) ? h : Routes.HOME);
      };
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const navigate = (r) => { location.hash = r; };
    return [route, navigate];
  }

  // ---- UI PARTS ----
  const HeaderHero = ({ title, subtitle }) => h(
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
          h('span', { className: 'badge-dot dot-green', 'aria-hidden': 'true' }),
 //         h('span', { className: 'badge-text' }, 'Informações atualizadas')
        ),
        h(
          'span',
          { className: 'badge' },
          h('span', { className: 'badge-dot dot-blue', 'aria-hidden': 'true' }),
 //         h('span', { className: 'badge-text' }, 'Audiodescrição inclusa')
        ),
        h(
          'span',
          { className: 'badge' },
          h('span', { className: 'badge-dot dot-purple', 'aria-hidden': 'true' }),
 //         h('span', { className: 'badge-text' }, 'Busca inteligente')
        )
      )
    )
  );

  const Card = ({ icon, title, desc, cta, onClick, color }) => h(
    'div',
    { className: 'card-neo fade-in' },
    h('div', { className: 'card-icon', 'aria-hidden': 'true' }, icon),
    h('h3', { className: 'card-title' }, title),
    h('p', { className: 'card-desc muted' }, desc),
    h(
      'button',
      {
        className: `btn ${color}`,
        onClick,
        type: 'button',
        'aria-label': cta
      },
      cta
    )
  );

  // ---- PAGES ----
  function Home({ onNavigate }) {
    return h(
      'div',
      { className: 'fade-in' },
      h(HeaderHero, {
        title: 'FAQ sobre HIV e Aids',
        subtitle: 'Tire suas dúvidas sobre HIV e aids de forma interativa e acessível'
      }),
      h(
        'section',
        { className: 'feature-strip' },
        h(
          'div',
          { className: 'feature-grid' },
          h(Card, {
            icon: '🗂️',
            title: 'Apresentação',
            desc: 'Conheça mais sobre HIV e aids, sua história e cuidados de prevenção',
            cta: 'Explorar',
            color: 'btn-primary',
            onClick: () => onNavigate(Routes.ABOUT)
          }),
          h(Card, {
            icon: '❓',
            title: 'Perguntas Frequentes',
            desc: 'Mais de 30 perguntas e respostas sobre HIV e aids com busca inteligente',
            cta: 'Explorar',
            color: 'btn-green',
            onClick: () => onNavigate(Routes.FAQ)
          }),
          h(Card, {
            icon: '🤖',
            title: 'Pergunte ao Bot',
            desc: 'Faça perguntas específicas e encontre respostas personalizadas sobre HIV e aids',
            cta: 'Explorar',
            color: 'btn-purple',
            onClick: () => onNavigate(Routes.BOT)
          })
        )
      ),
      h(
        'footer',
        { className: 'footer' },
        'Informações baseadas em evidências científicas • Ministério da Saúde • OPAS'
      )
    );
  }

  function Faq({ onBack }) {
    const [term, setTerm] = useState('');
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } = useHowlerAudio();
    const { faqItems, loading, error, reload } = useFaqData(teardownAudio);

    const list = useMemo(() => {
      const source = faqItems;
      const t = term.trim().toLowerCase();
      if (!t) return source;
      return source.filter(({ searchText = '' }) => searchText.includes(t));
    }, [faqItems, term]);

    React.useEffect(() => {
      if (!playingId) return;
      const stillVisible = list.some(({ id }) => id === playingId);
      if (!stillVisible) {
        teardownAudio();
      }
    }, [list, playingId, teardownAudio]);

    const handleAudioToggle = React.useCallback((faq) => {
      toggleAudio(faq.id, faq.audioSrc);
    }, [toggleAudio]);

    const handleBack = React.useCallback(() => {
      teardownAudio();
      onBack();
    }, [teardownAudio, onBack]);

    const listContent = (() => {
      if (loading) {
        return h('div', { className: 'state-message muted' }, 'Carregando perguntas…');
      }
      if (error) {
        return h(
          'div',
          { className: 'state-message state-error' },
          h('span', null, error),
          h('button', {
            type: 'button',
            className: 'btn btn-primary btn-retry',
            onClick: () => {
              setTerm('');
              reload();
            }
          }, 'Tentar novamente')
        );
      }
      if (list.length === 0) {
        return h('div', { className: 'state-message muted' }, 'Nenhuma pergunta encontrada para esse termo.');
      }
      return list.map((faq) => {
        const isPlaying = playingId === faq.id;
        const audioLabel = isPlaying ? 'Pausar audiodescrição' : 'Ouvir audiodescrição';
        return h(
          'details',
          { key: faq.id || faq.question, className: 'faq-item' },
          h(
            'summary',
            { className: 'faq-question' },
            h('span', { className: 'faq-question-text' }, faq.question),
            faq.audioSrc
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: `faq-audio-btn${isPlaying ? ' is-playing' : ''}`,
                    onClick: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleAudioToggle(faq);
                    },
                    'aria-pressed': isPlaying ? 'true' : 'false',
                    'aria-label': audioLabel
                  },
                  h('span', { className: 'faq-audio-icon', 'aria-hidden': 'true' }, '🔊'),
                  h('span', { className: 'faq-audio-label' }, isPlaying ? 'Pausar' : 'Audiodescrição'),
                  faq.audioDurationLabel
                    ? h('span', { className: 'faq-audio-duration' }, faq.audioDurationLabel)
                    : null
                )
              : null
          ),
          h('div', {
            className: 'faq-answer muted',
            dangerouslySetInnerHTML: { __html: faq.answerHtml }
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
            { type: 'button', className: 'btn btn-green', onClick: handleBack },
            'Voltar'
          ),
          h('input', {
            className: 'faq-search',
            placeholder: 'Buscar por palavra-chave…',
            value: term,
            onChange: (e) => setTerm(e.target.value)
          })
        ),
        h('div', { className: 'faq-list' }, listContent)
      )
    );
  }

  function Bot({ onBack }) {
    const [term, setTerm] = useState('');
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } = useHowlerAudio();
    const { faqItems, loading, error, reload } = useFaqData(teardownAudio);

    const list = useMemo(() => {
      const source = faqItems;
      const t = term.trim().toLowerCase();
      if (!t) return source;
      return source.filter(({ searchText = '' }) => searchText.includes(t));
    }, [faqItems, term]);

    React.useEffect(() => {
      if (!playingId) return;
      const stillVisible = list.some(({ id }) => id === playingId);
      if (!stillVisible) {
        teardownAudio();
      }
    }, [list, playingId, teardownAudio]);

    const handleAudioToggle = React.useCallback((faq) => {
      toggleAudio(faq.id, faq.audioSrc);
    }, [toggleAudio]);

    const handleBack = React.useCallback(() => {
      teardownAudio();
      onBack();
    }, [teardownAudio, onBack]);

    const hasQuery = term.trim().length > 0;
    const hasResults = list.length > 0;

    let resultContent;
    if (loading) {
      resultContent = h('div', { className: 'state-message muted' }, 'Carregando sugestões…');
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
            }
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
              h('p', { className: 'bot-info-title' }, 'Sugestão: explore todas as perguntas'),
              h('p', { className: 'bot-info-text' }, 'Use palavras-chave como “prevenção”, “tratamento” ou “testes” para encontrar respostas mais rápidas.')
            )
          )
        );
      }

      if (!hasResults) {
        sections.push(
          h(
            'div',
            { key: 'empty', className: 'bot-empty-card' },
            h('span', { className: 'bot-empty-icon', 'aria-hidden': 'true' }, '🔍'),
            h(
              'div',
              null,
              h('p', { className: 'bot-empty-title' }, 'Nenhuma resposta encontrada'),
              h('p', { className: 'bot-empty-text' }, 'Tente termos diferentes ou mais gerais para ampliar a busca.')
            )
          )
        );
      }

      if (hasResults) {
        sections.push(
          ...list.map((faq) => {
            const isPlaying = playingId === faq.id;
            const audioLabel = isPlaying ? 'Pausar audiodescrição' : 'Ouvir audiodescrição';
            return h(
              'article',
              { key: faq.id || faq.question, className: 'bot-result' },
              h(
                'div',
                { className: 'bot-result-header' },
                h('h3', { className: 'bot-result-title' }, faq.question),
                faq.audioSrc
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: `bot-audio-btn${isPlaying ? ' is-playing' : ''}`,
                        onClick: () => handleAudioToggle(faq),
                        'aria-pressed': isPlaying ? 'true' : 'false',
                        'aria-label': audioLabel
                      },
                      h('span', { className: 'bot-audio-icon', 'aria-hidden': 'true' }, isPlaying ? '⏸️' : '🎧'),
                      h('span', { className: 'bot-audio-label' }, isPlaying ? 'Pausar' : 'Audiodescrição'),
                      faq.audioDurationLabel
                        ? h('span', { className: 'bot-audio-duration' }, faq.audioDurationLabel)
                        : null
                    )
                  : null
              ),
              faq.tags && faq.tags.length
                ? h(
                    'div',
                    { className: 'bot-tags', 'aria-label': 'Palavras-chave relacionadas' },
                    ...faq.tags.map((tag, idx) =>
                      h('span', { key: `${faq.id}-tag-${idx}`, className: 'bot-tag' }, tag)
                    )
                  )
                : null,
              h('div', {
                className: 'bot-result-body muted',
                dangerouslySetInnerHTML: { __html: faq.answerHtml }
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
            h('h2', { className: 'bot-hero-title' }, 'Encontre respostas instantâneas sobre HIV e aids'),
            h('p', { className: 'bot-hero-description' }, 'Digite a sua dúvida ou explore o acervo completo de perguntas verificadas. As respostas são baseadas em evidências e atualizadas pelo Ministério da Saúde.'),
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
            h('img', { src: '/assets/img/hero.png', alt: '' })
          )
        )
      ),
      h(
        'section',
        { className: 'bot-content' },
        h(
          'div',
          { className: 'bot-search-card' },
          h('h3', { className: 'bot-search-title' }, 'Faça sua pergunta'),
          h('p', { className: 'bot-search-description' }, 'Use palavras-chave para filtrar as perguntas. Você pode buscar por termos como “profilaxia”, “transmissão” ou “tratamento”.'),
          h(
            'div',
            { className: 'bot-search-bar' },
            h('span', { className: 'bot-search-icon', 'aria-hidden': 'true' }, '🔍'),
            h('input', {
              className: 'bot-search-input',
              type: 'search',
              value: term,
              placeholder: 'Ex: Quais são as formas de prevenção?',
              onChange: (e) => setTerm(e.target.value)
            }),
            term.trim()
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'bot-search-clear',
                    onClick: () => setTerm('')
                  },
                  h('span', { 'aria-hidden': 'true' }, '✕'),
                  h('span', { className: 'bot-search-clear-label' }, 'Limpar')
                )
              : null
          )
        ),
        resultContent
      )
    );
  }

  function Presentation({ onBack }) {
    const { playingId, toggle: toggleAudio, teardown: teardownAudio } = useHowlerAudio();
    React.useEffect(() => () => teardownAudio({ updateState: false }), [teardownAudio]);

    const audioId = 'presentation-intro';
    const isPlaying = playingId === audioId;
    const handleAudio = React.useCallback(() => {
      toggleAudio(audioId, '/assets/audio/presentation.mp3');
    }, [toggleAudio]);

    const handleBack = React.useCallback(() => {
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
            h('h2', { className: 'presentation-title' }, 'Um espaço seguro para tirar dúvidas sobre HIV e aids'),
            h('p', { className: 'presentation-lede' }, 'Conhecimento confiável, linguagem acolhedora e audiodescrição inclusiva para você.')
          ),
          h(
            'div',
            { className: 'presentation-hero-figure', 'aria-hidden': 'true' },
            h('img', { src: '/assets/img/hero.png', alt: '' })
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
              className: `presentation-audio-btn${isPlaying ? ' is-playing' : ''}`,
              onClick: handleAudio,
              'aria-pressed': isPlaying ? 'true' : 'false',
              'aria-label': isPlaying ? 'Pausar audiodescrição da apresentação' : 'Ouvir audiodescrição da apresentação'
            },
            h('span', { className: 'presentation-audio-icon', 'aria-hidden': 'true' }, isPlaying ? '⏸️' : '🎧'),
            h('span', { className: 'presentation-audio-label' }, isPlaying ? 'Pausar audiodescrição' : 'Ouvir audiodescrição')
          )
        ),
        h(
          'div',
          { className: 'presentation-text muted' },
          h('p', null, 'Em um mundo onde a informação sobre HIV e aids muitas vezes se perde em mitos e contradições, apresentamos o nosso tira-dúvidas interativo sobre HIV e aids, uma ferramenta de conhecimento pensada para você.'),
          h('p', null, 'Nossa missão é simples: garantir que você tenha acesso a dados atualizados e cientificamente validados. Aqui, você pode fazer perguntas e receber respostas instantâneas e confiáveis sobre HIV e aids. O medo do julgamento e a vergonha frequentemente impedem as pessoas de fazer perguntas essenciais sobre sua saúde. Por aqui, você encontra um ambiente de neutralidade, total discrição e sigilo.'),
          h('p', null, 'Essa democratização do conhecimento é um passo fundamental para que você possa tomar decisões informadas sobre sua saúde e desmistificar o HIV e a aids. Ao facilitar o acesso à informação correta e sem preconceitos, ajudamos a construir uma sociedade mais empática e livre de estigmas.'),
          h('p', null, 'Pergunte. O conhecimento transforma e salva vidas.')
        ),
        h(
          'div',
          { className: 'presentation-actions' },
          h(
            'button',
            { type: 'button', className: 'btn btn-green', onClick: handleBack },
            'Voltar'
          )
        )
      )
    );
  }

  const Placeholder = ({ title, onBack }) => h(
    'div',
    { className: 'fade-in' },
    h(HeaderHero, { title, subtitle: '' }),
    h(
      'section',
      { className: 'placeholder-section' },
      h('p', { className: 'muted placeholder-copy' }, 'Conteúdo desta seção será adicionado.'),
      h(
        'button',
        { type: 'button', className: 'btn btn-primary', onClick: onBack },
        'Voltar'
      )
    )
  );

  // ---- APP ----
  function App() {
    const [route, navigate] = useRoute();

    React.useEffect(() => { document.documentElement.classList.add('dark'); }, []);

    const go = (r) => navigate(r);

    if (route === Routes.FAQ) {
      return h(Faq, { onBack: () => go(Routes.HOME) });
    }
  if (route === Routes.ABOUT) {
    return h(Presentation, { onBack: () => go(Routes.HOME) });
  }
  if (route === Routes.BOT) {
    return h(Bot, { onBack: () => go(Routes.HOME) });
  }
    return h(Home, { onNavigate: go });
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();
