import { FIELDS, LABELS, personaFields, characterFields, copyAll, exportName, lorebookContext } from './model.js';
import { createApi } from './api.js';
import { createGeneration } from './generation.js';

export function mount(marinara, css) {
  if (!marinara?.fetch || !marinara?.onCleanup) throw new Error('Persona Adapter requires Full Page access.');
  const host = document.createElement('div');
  host.id = 'persona-adapter-extension';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css; root.append(style);
  const view = document.createElement('div'); root.append(view); document.body.append(host);
  const api = createApi(marinara), generation = createGeneration(api);
  const state = { open: false, personas: [], connections: [], characters: [], characterId: '', personaId: '',
    lorebooks: [], selectedLorebooks: [], lorebookError: '', character: null, persona: null, connectionId: '', mode: 'Preserve', traits: [], analyzed: false,
    original: null, english: null, tab: 'original', length: 'Normal', language: '', busy: null, error: '', notice: '', initialized: false, englishStale: false };
  let revision = 0, controller = null, alive = true, lastFocus = null;
  function edited() { revision++; }
  function invalidate() {
    edited(); controller?.abort(); controller = null; state.busy = null;
    state.original = state.english = null; state.englishStale = false; state.tab = 'original'; state.error = ''; state.notice = '';
  }
  function resetTraits() { state.traits = []; state.analyzed = false; }
  async function task(label, work, apply) {
    controller?.abort(); const own = new AbortController(); controller = own;
    const start = revision; state.busy = label; state.error = ''; state.notice = ''; render();
    try {
      const result = await work(own.signal);
      if (!alive || controller !== own || own.signal.aborted) return;
      if (start !== revision) state.notice = '작업 중 입력이 변경되어 응답을 적용하지 않았습니다. 편집 내용은 유지됩니다. 다시 실행해주세요.';
      else { apply(result); edited(); }
    } catch (error) {
      if (alive && controller === own && error.name !== 'AbortError') state.error = error.message || '작업에 실패했습니다. 다시 시도해주세요.';
    } finally {
      if (alive && controller === own) { controller = null; state.busy = null; render(); }
    }
  }
  async function initialize() {
    invalidate(); state.character = state.persona = null; state.characterId = state.personaId = ''; state.characters = []; resetTraits();
    state.initialized = false; state.lorebooks = []; state.selectedLorebooks = []; state.lorebookError = '';
    await task('목록 불러오는 중', async signal => {
      const data = await Promise.all(['/characters?includeBuiltIn=false', '/characters/personas/list', '/connections'].map(p => api.get(p, signal)));
      if (data.some(d => !Array.isArray(d))) throw new Error('목록 형식이 현재 확장과 호환되지 않습니다. Marinara 버전을 확인해주세요.');
      return data;
    }, ([characters, personas, connections]) => {
      state.characters = characters.map(record => ({ id: record.id, name: characterFields(record).name || '이름 없는 Character' }));
      state.personas = personas.map(p => {
        const comment = typeof p.comment === 'string' ? p.comment.trim().replace(/\s+/g, ' ') : '';
        return { ...p, label: comment ? `${p.name || '이름 없는 페르소나'} (${comment})` : p.name || '이름 없는 페르소나' };
      }); state.connections = connections.filter(c => c.model);
      const active = personas.find(p => p.isActive === true || p.isActive === 'true');
      state.personaId = active?.id || ''; state.persona = active ? personaFields(active) : null;
      state.connectionId = state.connections.find(c => c.isDefault === true || c.isDefault === 'true')?.id || state.connections[0]?.id || '';
      state.initialized = true;

    });
  }
  async function selectCharacter(id) {
    invalidate(); state.characterId = id; state.character = null; state.lorebooks = []; state.selectedLorebooks = []; state.lorebookError = '';
    if (!id) { render(); return; }
    await task('캐릭터 불러오는 중', async signal => {
      const record = await api.get(`/characters/${encodeURIComponent(id)}`, signal);
      try {
        const books = await api.get(`/lorebooks?characterId=${encodeURIComponent(id)}`, signal);
        if (!Array.isArray(books)) throw new Error('로어북 목록 형식을 읽을 수 없습니다.');
        return { record, books, error: '' };
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return { record, books: [], error: '로어북 목록을 읽지 못했습니다. 캐릭터를 다시 선택해 재시도하세요. ' + error.message };
      }
    }, ({ record, books, error }) => {
      state.character = { id: record.id, ...characterFields(record) };
      state.lorebooks = books.map(b => ({ id: b.id, name: b.name, enabled: b.enabled !== false && b.enabled !== 'false' }));
      state.lorebookError = error;
    });
  }
  async function selectPersona(id) {
    invalidate(); resetTraits(); state.personaId = id; state.persona = null;
    if (!id) { render(); return; }
    await task('페르소나 불러오는 중', signal => api.get(`/characters/personas/${encodeURIComponent(id)}`, signal), p => { state.persona = personaFields(p); });
  }
  function dataFor(tab, field) {
    return { character: personaCharacter(), original: { ...state.persona }, traits: state.traits.map(t => t.trim()).filter(Boolean),
      mode: state.mode, length: state.length, language: tab === 'english' ? 'English' : state.language.trim() || 'Use the original Persona language; if empty, use the Character language.',
      ...(field ? { targetField: field, current: { ...state[tab] } } : {}) };
  }
  // Only the seven specified Character fields leave this boundary; never include card books or messages.
  function personaCharacter() { const { id, ...context } = state.character; return context; }
  function adapt(reroll = false, field = null) {
    const tab = reroll ? state.tab : 'original';
    const data = dataFor(tab, field); const connection = state.connectionId;
    const books = state.lorebooks.filter(b => b.enabled && state.selectedLorebooks.includes(b.id));
    task(field ? `${LABELS[field]} 다시 생성 중` : reroll ? '전체 다시 생성 중' : '페르소나 생성 중',
      async signal => {
        if (books.length) {
          data.lorebooks = await Promise.all(books.map(async book => {
            const [entries, folders] = await Promise.all([
              api.get(`/lorebooks/${encodeURIComponent(book.id)}/entries`, signal),
              api.get(`/lorebooks/${encodeURIComponent(book.id)}/folders`, signal)
            ]);
            return lorebookContext(book, entries, folders);
          }));
        }
        return generation.adapt(data, connection, signal, field);
      }, result => {
        if (!reroll) { state.english = null; state.englishStale = false; state.tab = 'original'; }
        state[tab] = field ? { ...state[tab], ...result } : result;
        if (tab === 'original' && state.english) { state.englishStale = true; state.notice = '원본이 변경되었습니다. 영어는 이전 번역이며 다시 번역할 수 있습니다.'; }
      });
  }
  function translate() {
    const original = { ...state.original }, character = personaCharacter(), connection = state.connectionId;
    task('영어 번역 중', signal => generation.translate(original, character, connection, signal), result => {
      state.english = result; state.englishStale = false; state.tab = 'english';
    });
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); state.notice = '복사했습니다.'; }
    catch { state.error = '클립보드에 접근할 수 없습니다. 필드의 텍스트를 직접 선택해 복사하거나 JSON을 내보내주세요.'; }
    render();
  }
  function download() {
    const value = state[state.tab];
    if (!value.name.trim()) { state.error = 'Marinara로 가져오려면 Name을 입력해주세요.'; render(); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = exportName(value); root.append(a); a.click(); a.remove();
    marinara.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function el(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
  function button(text, action, disabled = false, className = '') {
    const b = el('button', text, className); b.type = 'button'; b.disabled = disabled; b.onclick = action; return b;
  }
  function select(label, values, selected, action, disabled = false) {
    const wrapper = el('label', label), input = el('select'); input.setAttribute('aria-label', label);
    input.append(new Option('선택해주세요', ''));
    for (const item of values) input.append(new Option(item.label || item.name || item.title || item.id, item.id));
    input.value = selected; input.disabled = disabled; input.onchange = () => action(input.value); wrapper.append(input); return wrapper;
  }
  function render() {
    const scrollTop = root.querySelector('.body')?.scrollTop || 0;
    const focused = root.activeElement, focusKey = focused?.dataset.focus;
    const selection = focused && 'selectionStart' in focused ? [focused.selectionStart, focused.selectionEnd] : null;
    view.replaceChildren();
    const launcher = button('Persona Adapter', () => { lastFocus = document.activeElement; state.open = !state.open; render(); if (state.open && !state.initialized && !state.busy) initialize(); }, false, 'launcher');
    launcher.setAttribute('aria-expanded', String(state.open)); view.append(launcher);
    if (!state.open) return;
    const panel = el('section', undefined, 'panel'); panel.setAttribute('aria-label', 'Persona Adapter');
    const header = el('header'); const close = button('×', () => { state.open = false; render(); lastFocus?.focus?.(); }, false, 'close'); close.setAttribute('aria-label', '닫기'); header.append(el('h1', 'Persona Adapter'), close); panel.append(header);
    const body = el('div', undefined, 'body'); panel.append(body); view.append(panel);
    panel.setAttribute('aria-description', '원본의 핵심 성격을 지키며, 새로운 세계에 어울리는 페르소나를 만듭니다.');
    if (state.busy) { const status = el('p', state.busy + '…', 'status'); status.setAttribute('role', 'status'); body.append(status); }
    if (state.error) { const error = el('p', state.error, 'error'); error.setAttribute('role', 'alert'); body.append(error); }
    if (state.notice) { const note = el('p', state.notice, 'notice'); note.setAttribute('role', 'status'); body.append(note); }
    const sourceLoading = ['목록 불러오는 중', '캐릭터 불러오는 중', '페르소나 불러오는 중'].includes(state.busy);
    body.append(select('캐릭터', state.characters, state.characterId, selectCharacter, !state.initialized || sourceLoading || !state.characters.length));
    if (state.characterId) {
      const section = el('div', undefined, 'lorebooks');
      section.append(el('span', '참고할 로어북', 'lorebook-heading'));
      if (sourceLoading) section.append(el('span', '불러오는 중…', 'muted'));
      else if (state.lorebookError) section.append(el('p', state.lorebookError, 'error'));
      else if (!state.lorebooks.length) section.append(el('span', '연결된 로어북 없음', 'muted'));
      else {
        const list = el('div', undefined, 'lorebook-list');
        for (const book of state.lorebooks) {
          const label = el('label', undefined, 'lorebook-option'); const check = el('input'); check.type = 'checkbox';
          check.checked = state.selectedLorebooks.includes(book.id); check.disabled = !book.enabled;
          check.onchange = () => {
            invalidate();
            state.selectedLorebooks = check.checked ? [...state.selectedLorebooks, book.id] : state.selectedLorebooks.filter(id => id !== book.id);
            render();
          };
          label.append(check, el('span', (book.name || '이름 없는 로어북') + (book.enabled ? '' : ' (비활성)'))); list.append(label);
        }
        section.append(list, el('small', '선택한 책의 활성 항목만 참조합니다. 변경하면 결과가 초기화됩니다.'));
      }
      body.append(section);
    }
    body.append(select('원본 페르소나', state.personas, state.personaId, selectPersona, !state.initialized || sourceLoading || !state.personas.length));
    if (state.initialized && !state.characters.length) body.append(el('p', '현재 사용할 수 있는 캐릭터가 없습니다.', 'error'));
    if (state.initialized && !state.personas.length) body.append(el('p', '원본 페르소나를 선택해주세요. Marinara의 Personas에서 먼저 만들어주세요.', 'error'));
    body.append(select('Marinara 모델 연결', state.connections.map(c => ({ id: c.id, label: `${c.name} · ${c.model}` })), state.connectionId, id => { edited(); state.connectionId = id; }));
    if (state.initialized && !state.connections.length) body.append(el('p', 'Marinara에서 모델이 설정된 연결을 먼저 추가해주세요.', 'error'));
    const refreshRow = el('div', undefined, 'refresh-row');
    refreshRow.append(el('p', '선택을 바꾸면 생성 결과가 초기화됩니다.', 'muted'), button('목록 새로고침 · 결과 초기화', initialize, !!state.busy, 'subtle refresh')); body.append(refreshRow);
    body.append(el('h2', '핵심 성격'));
    body.append(el('p', '생성 전에 핵심 성격을 확인하고 수정하세요. 모든 모드에서 유지합니다.', 'muted'));
    if (state.persona && !state.persona.personality.trim()) body.append(el('p', 'Personality가 비어 있습니다. 직접 특성을 추가하거나 빈 목록으로 생성할 수 있습니다.', 'muted'));
    const traits = el('div', undefined, 'traits');
    state.traits.forEach((trait, i) => {
      const row = el('div', undefined, 'trait'); const input = el('input'); input.value = trait; input.setAttribute('aria-label', `특성 ${i + 1}`); input.dataset.focus = `trait-${i}`;
      input.oninput = () => { state.traits[i] = input.value; edited(); };
      row.append(input, button('×', () => { state.traits.splice(i, 1); edited(); render(); }, false)); row.lastChild.setAttribute('aria-label', `특성 ${i + 1} 삭제`); traits.append(row);
    }); body.append(traits);
    const ready = !!(state.character && state.persona && state.connectionId);
    const row = el('div', undefined, 'actions');
    row.append(button('+ 특성 추가', () => { state.traits.push(''); edited(); render(); root.querySelector(`[data-focus="trait-${state.traits.length - 1}"]`)?.focus(); }),
      button(state.analyzed ? '성격 다시 분석' : '성격 분석', () => {
        const persona = { ...state.persona }, connection = state.connectionId;
        task('핵심 성격 분석 중', signal => generation.analyze(persona, connection, signal), traits => { state.traits = traits; state.analyzed = true; });
      }, !state.persona || !state.connectionId || !!state.busy || !state.persona.personality.trim())); body.append(row);
    body.append(el('h2', '변형 방식'));
    const modes = el('div', undefined, 'modes');
    for (const [mode, description] of [['Preserve', '원본 설정 유지'], ['Expand', '정체성을 살려 확장'], ['Creative', '핵심 성격을 살려 재창작']]) {
      const b = button({ Preserve: '보존', Expand: '확장', Creative: '창작' }[mode], () => { edited(); state.mode = mode; render(); }, false, state.mode === mode ? 'selected' : '');
      b.setAttribute('aria-pressed', String(state.mode === mode)); b.append(el('small', description)); modes.append(b);
    } body.append(modes);
    body.append(el('h2', '분량'));
    const lengths = el('div', undefined, 'actions lengths'); lengths.setAttribute('role', 'group'); lengths.setAttribute('aria-label', '분량');
    for (const length of ['Short', 'Normal', 'Long']) {
      const b = button({ Short: '짧게', Normal: '보통', Long: '길게' }[length], () => { edited(); state.length = length; render(); }, false, state.length === length ? 'selected' : '');
      b.setAttribute('aria-pressed', String(state.length === length)); lengths.append(b);
    }
    body.append(lengths);
    const language = el('label', '생성 언어 (선택)'); const input = el('input'); input.value = state.language; input.placeholder = '비워두면 원본 페르소나 언어'; input.dataset.focus = 'language'; input.oninput = () => { state.language = input.value; edited(); }; language.append(input); body.append(language);
    body.append(button('페르소나 생성', () => adapt(), !ready || !!state.busy, 'primary'));
    if (!state.traits.some(t => t.trim())) body.append(el('p', '현재 핵심 성격 목록이 비어 있습니다. 보존할 성격이 있다면 분석하거나 직접 추가해주세요.', 'muted'));
    if (!state.original) { body.scrollTop = scrollTop; return; }
    const resultHeader = el('div', undefined, 'result-header'); resultHeader.append(el('h2', '생성 결과'));
    const tabs = el('div', undefined, 'actions tabs');
    for (const tab of ['original', 'english']) tabs.append(button(tab === 'original' ? '원본' : '영어', () => { state.tab = tab; render(); }, !state[tab], state.tab === tab ? 'selected' : ''));
    resultHeader.append(tabs); body.append(resultHeader);
    const stale = el('p', '원본이 변경되었습니다. 영어는 이전 번역입니다. 필요하면 다시 번역해주세요.', 'muted'); stale.id = 'english-stale'; stale.hidden = !state.englishStale; body.append(stale);
    const current = state[state.tab];
    for (const field of FIELDS) {
      const wrapper = el('div', undefined, 'field'); const bar = el('div', undefined, 'fieldbar');
      const label = el('label', LABELS[field]); label.htmlFor = `pa-${field}`; bar.append(label);
      if (field !== 'name') { const reroll = button('↻', () => adapt(true, field), !!state.busy || !ready, 'subtle reroll'); reroll.setAttribute('aria-label', `${LABELS[field]} 다시 생성`); reroll.title = `${LABELS[field]} 다시 생성`; bar.append(reroll); }
      const copyButton = button('복사', () => copy(state[state.tab][field]), false, 'subtle'); copyButton.setAttribute('aria-label', `${LABELS[field]} 복사`); bar.append(copyButton); wrapper.append(bar);
      const editor = el(field === 'name' ? 'input' : 'textarea'); editor.id = `pa-${field}`; editor.value = current[field]; editor.dataset.focus = field;
      if (field !== 'name') editor.rows = 3;
      const tab = state.tab;
      editor.oninput = () => { state[tab][field] = editor.value; edited(); if (tab === 'original' && state.english) { state.englishStale = true; root.querySelector('#english-stale').hidden = false; state.notice = '원본이 변경되었습니다. 영어를 갱신하려면 다시 번역해주세요.'; } };
      wrapper.append(editor); body.append(wrapper);
    }
    const actions = el('div', undefined, 'actions result-actions');
    actions.append(button('전체 다시 생성', () => adapt(true), !!state.busy || !ready), button('영어로 번역', translate, !!state.busy || !ready), button('전체 복사', () => copy(copyAll(state[state.tab]))), button('JSON 저장', download));
    body.append(actions, el('p', 'JSON은 Marinara의 Personas → Import에서 가져올 수 있습니다. 자동 저장은 하지 않습니다. 결과는 이 페이지 메모리에만 보관됩니다.', 'muted'));
    body.scrollTop = scrollTop;
    if (focusKey) {
      const next = root.querySelector(`[data-focus="${focusKey}"]`); next?.focus();
      if (next && selection && selection[0] !== null) next.setSelectionRange(...selection);
    }
  }
  const onKey = event => { if (event.key === 'Escape' && state.open) { state.open = false; render(); lastFocus?.focus?.(); } };
  root.addEventListener('keydown', onKey);
  marinara.onCleanup(() => { alive = false; controller?.abort(); root.removeEventListener('keydown', onKey); host.remove(); });
  render();
}
