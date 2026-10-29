# Persona Adapter 1.5.0

직접 선택한 Character 세계관에 맞춰 Base Persona를 재작성하는 Marinara Engine External Extension입니다. 별도 API key 없이 Marinara에 설정된 LLM 연결을 사용합니다.

## 설치

1. Marinara 서버의 `.env`에 `ENABLE_EXTERNAL_EXTENSIONS=true`를 설정하고 서버를 재시작합니다.
2. **Settings → Advanced → Danger Zone → Allow third-party extension imports**를 켭니다.
3. [최신 Release](https://github.com/leuy5674/marinara-persona-adapter/releases/latest)에서 `persona-adapter-v1.6.0.personal-extension.zip`을 다운로드하고, 압축을 풀지 않고 **Settings → Addons → External Extensions**에서 가져옵니다. `Source code` 압축파일은 개발용입니다. 소스에서 직접 설치할 때는 `dist/persona-adapter.marinara-extension.json` 한 파일로도 설치할 수 있습니다.
4. 가져온 코드와 **Full page access** 권한을 확인하고 해당 버전의 hash를 승인·활성화합니다. 전체 페이지 권한은 기존 Marinara API 호출과 별도 편집 패널에 필요합니다.
5. 페이지 왼쪽 아래 **Persona Adapter** 버튼을 누릅니다.

LAN/원격 접속에서 확장 설치 메뉴를 사용하려면 Marinara가 요구하는 Admin Access 설정을 먼저 완료해야 합니다. 이미 설정되어 있다면 변경할 필요가 없습니다. 설치된 확장을 끄면 패널과 등록된 이벤트가 제거됩니다.

## 사용

1. 확장 안에서 **Character**를 직접 선택합니다. 채팅을 만들거나 선택할 필요가 없습니다.
2. **Base Persona**를 직접 선택합니다. 전역 활성 Persona가 있으면 기본값으로 표시합니다.
3. 기존 **Marinara LLM 연결**을 확인합니다. 기본 연결이 우선 선택되며 다른 연결도 고를 수 있습니다.
4. **Analyze Personality**로 핵심 성격을 추출하고 trait를 추가·수정·삭제합니다. 빈 Personality는 직접 trait를 입력할 수 있습니다.
5. **Preserve / Expand / Creative**와 **Persona Length: Short / Normal / Long**을 각각 선택하고 **Generate Adapted Persona**를 누릅니다. Length 기본값은 Normal입니다. 생성 언어는 기본적으로 원본 언어를 따릅니다. 원하면 생성 언어를 직접 입력합니다.
6. 여섯 필드를 편집하거나 **Reroll All / 필드 ↻**을 사용합니다. Reroll에는 현재 Length가 적용됩니다. 부분 Reroll은 해당 필드만 바꾸며, 전체 분량을 새 Length에 맞추려면 Reroll All을 사용합니다.
7. **Translate to English**는 Original을 보존하고 English 결과만 새로 만듭니다. English 탭의 Reroll은 영어로 생성합니다. Original 수정 후 기존 English는 이전 번역으로 표시됩니다.
8. 현재 언어 탭에서 **Copy Field / Copy All / Export JSON**을 사용합니다. 내보낸 `persona-adapted-이름.json`은 **Marinara Personas → Import**에서 가져올 수 있습니다. Name은 비워둘 수 없습니다.

Character·Base Persona 변경 및 목록 새로고침은 결과를 초기화합니다. 새로고침/페이지 종료 후에는 결과가 남지 않으므로 필요한 결과를 먼저 내보내세요. 작업 중 편집한 경우 늦은 응답을 적용하지 않고 편집을 보존합니다. 실패하면 해당 작업 버튼을 다시 누를 수 있습니다.

## 포함 기능과 제한

- Character의 Description, Personality, Backstory, Appearance, Scenario, First Message를 모두 사용합니다. 캐릭터에 연결된 로어북 중 사용자가 선택한 책의 활성 항목을 생성·리롤에 참고합니다. 캐릭터 카드 내장 로어북을 자동으로 추가하지 않습니다.
- Core Personality 추출, 세 모드, 전체/필드 Reroll, Length 선택, 영어 번역, 필드 편집, 복사, JSON 내보내기를 제공합니다.
- 생성/Reroll은 trait가 있으면 추가 LLM 검사를 수행합니다. 따라서 보통 생성 1회와 검증 1회의 요청이 발생하며 기존 연결의 사용량이 소모됩니다. 모델에 의한 의미 검증은 완벽하지 않으므로 결과를 검토해주세요.
- raw API가 범용 `responseFormat` 인자를 제공하지 않아 JSON schema를 프롬프트로 요청하고 엄격한 JSON 타입 검사를 적용합니다. Markdown/설명문을 섞은 응답은 임의 파싱하지 않고 오류로 처리합니다.
- 번역 시 Name을 코드에서 유지하고 `{{user}}`·`{{char}}`의 필드별 개수가 줄지 않는지 검사합니다. 의미와 고유명사 품질은 모델 성능에 따라 달라집니다.
- 작업별 상태를 구분해 표시하되 LLM 작업은 한 번에 하나만 실행합니다. 작업 중에도 필드를 편집하거나 source를 바꿀 수 있습니다.
- **Save as New Persona**는 이번 버전에 포함하지 않습니다. 검토 결과 현재 본체가 사용하는 create API로 신규 저장은 구현 가능합니다. 이번 요청은 저장 기능의 적용 가능성 검토까지였으며, 장기 호환성 보장은 확인되지 않았습니다. 자세한 결과는 `SAVE-REVIEW.md`에 있습니다.
- v2.4.4의 최신 main 커밋 `1a299369ac7025028c3ce1b80cc59f47b7b0691b` 소스를 기준으로 작성했습니다. 미래 API 변경에 대한 보장은 없습니다.
- v1.0.1의 생성·JSON 저장은 사용자가 정상 동작을 확인했습니다. v1.1.0의 직접 선택도 사용자가 정상 동작을 확인했습니다. v1.2.0의 Length별 실제 생성 품질은 아직 실제 LLM으로 검증하지 않았습니다. 로컬 브라우저 테스트는 최신 API 형태를 재현한 응답으로 검증했습니다.

## 파일 구성

- `dist/persona-adapter.marinara-extension.json`: 바로 가져오는 단일 설치 파일
- `src/ui.js`, `src/style.css`: Shadow DOM 안의 독립 패널과 스타일
- `src/api.js`: 확인된 Marinara API와 CSRF 처리
- `src/prompts.js`, `src/generation.js`: 프롬프트, 생성, 성격 검증, 번역
- `src/model.js`: 필드 매핑, JSON 검증, 내보내기
- `COMPATIBILITY.md`: 소스 근거와 명세 조정 기록

## 개발 및 테스트

Node.js 22 이상을 권장합니다. 런타임 외부 dependency나 CDN은 사용하지 않습니다. Playwright는 개발 테스트에만 사용합니다.

```sh
npm ci
npm run build
npm test
npm run test:browser
```

브라우저 테스트는 macOS Google Chrome을 기본 사용합니다. 다른 환경에서는 `CHROME_PATH`에 Chrome/Chromium 실행 파일 경로를 지정합니다. `test-results`에 데스크톱·모바일 화면을 저장합니다.

## 라이선스

MIT License로 공개합니다. 누구나 라이선스 고지를 유지하는 조건으로 사용, 수정, 재배포할 수 있습니다.

빌드하면 단일 설치 JSON과 폴더 패키지용 `manifest.json`, `extension.js`가 생성됩니다. 폴더 패키지가 필요하면 **manifest.json과 extension.js만 담은 별도 폴더**를 가져오세요. 단일 설치 JSON과 폴더 패키지를 함께 가져오면 중복 설치될 수 있습니다.

실사용 확인: 채팅 생성 없이 Character·Base Persona를 고르고 분석 → trait 수정 → 세 모드 생성 → 필드 Reroll → 번역 → Original 유지 확인 → JSON 내보내기 → Personas Import 순으로 확인하세요. 모델의 성격 보존, 세계관 적합성, 번역 품질도 함께 검토합니다.

## 1.2.0 변경

- Undo Reroll과 복원 상태/코드를 제거했습니다.
- 보존 대상은 모든 모드에서 사용자 확정 Core Personality이며, 원본 Personality 문장이나 분량이 아닙니다.
- Creative의 외형은 세계관에 맞게 적극적으로 재설계하도록 요청합니다. Character 외형을 그대로 복제하지 않습니다.
- Short는 약 500 English tokens 상당, Normal은 약 800 상당의 정보량을 목표로 합니다. Appearance에 가장 큰 비중을 두고 Personality는 비사칭 RP에 맞춰 간결하게 작성하며 Example Lines를 넣지 않습니다.
- Long은 약 1000–1200+ English tokens 상당으로 Personality의 행동·반응·화법 정보를 우선 확장합니다. Personality 끝에 스타일 참고용 Example Lines 3–5개를 요청합니다.
- 분량은 상대적 목표이며 정확한 토큰 제한이 아닙니다. Long 선택이 Marinara의 자율주행 설정을 켜지는 않습니다.
- 번역은 현재 결과의 의미와 Example Lines를 보존하며 Length에 따라 재생성하지 않습니다.
- 초기 선택 안내 배너를 없애고 새로고침 버튼과 초기화 안내를 LLM 연결 아래로 옮겼습니다.

검증: 단위 테스트 14개, Chrome 브라우저 테스트 통과. 모든 모드·Length 조합의 프롬프트 구성, Reroll 전달, UI 기본값/배치, 번역·복사·JSON 및 비동기 편집 보존을 확인했습니다. 외형 변화 정도, 정보 비중, Example Lines 품질은 실제 모델의 결과를 추가 검토해야 합니다.

## 1.3.0 변경

일반 필드 내용은 문단을 허용하는 자연어 산문으로 작성하도록 생성·필드 재생성·번역에 공통 지침을 추가했습니다. 마크다운 제목/표/번호/목록/항목 나열은 사용하지 않으며 Long의 Personality 끝 `Example Lines`만 빈 줄과 별도 제목, 대사 목록으로 구분합니다. 번역은 기존 Example Lines 목록을 보존합니다. 실제 모델의 형식 준수는 프롬프트 지침에 의존하며, 목록 기호를 사후 삭제해 내용을 손상시키는 처리는 하지 않습니다.

UI: 출력 필드명을 제외한 주요 선택기·섹션·버튼을 한글화했습니다. 모드와 분량 표시명은 `보존/확장/창작`, `짧게/보통/길게`이며 내부 모드 값은 그대로입니다. 새로고침 버튼 위 간격, 섹션 구분, 버튼 크기와 색상, 입력 필드 및 결과 카드 배치를 다듬었습니다. 모드 카드 제목·설명은 중앙 정렬하고 한국어 단어 중간 줄바꿈을 방지합니다.

수정: `src/prompts.js`, `src/ui.js`, `src/style.css`, 테스트, 버전 메타데이터, 설치 파일. Marinara 본체는 수정하지 않았습니다.

## 1.3.1 변경

본문에서 선택한 캐릭터와 페르소나의 이름 대신 각각 `{{char}}`, `{{user}}`를 사용하도록 생성·필드 재생성·번역 지침을 추가했습니다. Name 필드의 실제 이름과 무관한 인명·지명은 유지합니다. 대사의 자연스러운 나/너 표현은 유지하되 이름으로 특정하는 경우 placeholder를 사용합니다.

번역 시 사용자가 직접 넣은 참여자 이름을 placeholder로 정규화할 수 있도록 추가 발생을 허용하며, 기존 placeholder 개수가 줄어드는 것은 계속 거부합니다. 이는 모델 지침과 개수 검사이며 모든 이름 치환의 의미 정확성을 보장하는 검사는 아닙니다.

## 1.3.2 변경

- 밝은 회민트 배경과 짙은 녹색 입력·출력 칸으로 UI를 변경했습니다.
- 패널 너비, 간격, 버튼 높이와 모서리를 줄이고 닫기 버튼을 작은 ×로 바꿨습니다.
- 안내문과 새로고침을 같은 줄로 배치하고 결과 필드 작업 버튼을 간결하게 정리했습니다.
- 생성 로직, 상태 관리와 API 동작은 유지했습니다.
- 단위 테스트 17개와 브라우저 통합 테스트가 통과했으며, 사용자가 설치 ZIP의 UI와 실제 동작을 확인했습니다.

## 1.4.0 변경

캐릭터 선택 아래에 연결된 로어북 체크 목록을 추가했습니다. 기본값은 모두 제외이며, 선택을 바꾸면 생성 결과가 초기화됩니다. 비활성 책·항목·폴더는 제외합니다. 선택한 책의 항목은 생성 및 리롤 직전에 읽으며, 읽기 실패 시 로어북을 몰래 생략하지 않고 오류를 표시합니다. 모두 해제하면 기존 방식으로 생성합니다.

로어북은 세계관 참고 자료로만 사용하며 핵심 성격 규칙을 덮어쓰지 않습니다. 채팅의 키워드 트리거, 검색·임베딩, 조건부 활성화나 매크로 실행을 재현하지 않습니다. 입력이 너무 크면 기존 요청 길이 제한 오류를 표시하므로 선택한 책 수를 줄여주세요. 기존 UI 색상과 조밀한 배치는 유지했습니다.

페르소나 선택 목록은 `이름 (제목/설명)`으로 표시합니다. 제목/설명이 비어 있으면 이름만 표시하며, 생성용 이름과 본문은 변경하지 않습니다.

## 1.5.0 변경

생성 언어 아래에 추가 지침(선택) 입력칸을 추가했습니다. 비우거나 공백만 입력하면 기존처럼 동작합니다. 입력한 지침은 전체 생성·전체 리롤·필드별 리롤에 적용되며, 핵심 성격과 기존 모드·출력 규칙을 유지합니다. 번역·성격 분석에는 전달하지 않습니다. 입력은 페이지 메모리에만 보관되며, 입력 변경 전에 시작한 생성 응답은 적용하지 않습니다.

## 첫 메시지 선택 (1.6.0)

캐릭터 선택 후 **참고할 첫 메시지**에서 기본/추가 첫 메시지 중 하나를 선택합니다. 기본값은 기본 첫 메시지이며, **선택한 첫 메시지 보기**로 전문을 확인할 수 있습니다. 생성·전체/항목 리롤에는 선택한 메시지만 전달하며 다른 시작 상황을 합치지 않습니다. 선택을 변경하면 이전 결과와 번역은 초기화되지만 핵심 성격은 유지됩니다. 캐릭터를 변경하거나 목록을 새로고침하면 기본 첫 메시지로 돌아갑니다. 채팅에서 선택한 시작 상황을 자동으로 따라가지 않습니다.
