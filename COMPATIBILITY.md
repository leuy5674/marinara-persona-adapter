# 최신 소스 호환성 조사

확인일: 2026-09-08. 공식 저장소 `https://github.com/Pasta-Devs/Marinara-Engine`, main HEAD `1a299369ac7025028c3ce1b80cc59f47b7b0691b` (2026-08-25, v2.4.4). `/tmp/marinara-persona-reference`에 조사용 복사본을 받았으며 본체 파일을 수정하지 않았습니다.

`INSTRUCTIONS.md`와 `persona-adapter-spec.md`는 수정하지 않았습니다. 두 문서의 직접 충돌은 발견되지 않았습니다.

## 사용자 승인으로 조정한 사항

명세의 활성 채팅 자동 감지 대신 확장 안에서 채팅을 수동 선택합니다. Full Page API에는 context/get/subscribe가 없고 sandbox context만 호스트 store 변경을 구독합니다. 내부 `marinara-active-chat-id` localStorage 키, private React state, DOM scraping을 사용하지 않습니다. 이 차이를 사용자에게 먼저 알렸고 사용자가 채팅 선택 UI로의 변경에 동의했습니다.

## 근거

아래 경로는 모두 위 커밋의 Marinara 저장소 상대 경로입니다.

| 항목 | 확인한 실제 소스 / 적용 |
|---|---|
| 패키지 형식 | `docs/extending/writing-personal-extensions.md`, `packages/client/src/lib/personal-extension-import.ts`, `personal-extension-transfer.ts`: `kind: marinara.personal-extension`, `version: 1`, `config`, `runtime: client`, `capabilities: [full_page_access]`, inline `js` / 폴더 `jsPath` |
| Full Page runtime | `packages/client/src/components/layout/PersonalExtensionInjector.tsx`: `marinara.fetch`, `onCleanup`, managed timer. 공식 contribution API는 sandbox용이므로 자체 Shadow DOM 패널을 body에 추가하고 cleanup에서 제거 |
| 채팅 목록·상세 | `packages/server/src/routes/chats.routes.ts`: `GET /api/chats`, `GET /api/chats/:id`, `characterIds` 정규화, `personaId`, `connectionId`. 채팅 메시지나 transcript를 조회하지 않음 |
| Character 상세 | `packages/server/src/routes/characters.routes.ts`, `packages/shared/src/types/character.ts`: `GET /api/characters/:id`, `record.data.{name,description,personality,scenario,first_mes}`, `record.data.extensions.{backstory,appearance}` |
| Lorebook 제외 | 상세 API 응답에는 카드의 다른 속성도 포함될 수 있으나 필요한 일곱 속성만 즉시 투영. `character_book` 속성 접근, Lorebook API 요청, 전체 카드의 prompt 직렬화를 하지 않음 |
| Persona | `packages/shared/src/types/persona.ts`, `packages/server/src/routes/characters.routes.ts`: `GET /api/characters/personas/list`, `/personas/:id`, `/personas/active`. 여섯 필드는 최상위 문자열 |
| LLM 연결 | `packages/server/src/routes/connections.routes.ts`: `GET /api/connections`. 기존 연결 ID와 모델을 선택하며 키를 읽거나 저장하지 않음 |
| Generation | `packages/server/src/routes/generate/raw-route.ts` 및 `routes/index.ts`: `POST /api/generate/raw`, `{connectionId,messages,streaming:false,parameters:{maxTokens:8192}}`, 응답 `{content,runId}`. 본체 provider/fallback 경로를 사용. 별도의 외부 LLM 직접 호출 없음 |
| JSON schema | raw body schema는 strict이고 범용 `responseFormat`을 허용하지 않음. provider 내부의 특정 format 옵션을 raw 요청에 추측해 추가하지 않음. 프롬프트 schema + JSON.parse + 필수 키/타입/추가 키 검증 사용 |
| 세션/CSRF | `packages/client/src/lib/api-client.ts`, `packages/shared/src/constants/security.ts`, `packages/server/src/middleware/csrf-protection.ts`: same-origin session, POST의 `x-marinara-csrf: 1`, JSON content-type 사용. 관리자 비밀키 localStorage에는 접근하지 않음. 401/403은 사용자에게 표시 |
| Persona JSON import | `packages/client/src/components/modals/ImportPersonaModal.tsx`: 일반 JSON을 `/api/characters/personas`에 전달. `packages/shared/src/schemas/persona.schema.ts`의 `personaCreateInputSchema` 및 `characters.routes.ts`의 create 처리에서 여섯 필드를 수용. 따라서 plain JSON export를 Personas Import에서 사용 가능 |
| Save as New Persona | create route 자체는 확인. 확장 전용 공개 API 안정성 약속을 확인할 수 없어 선택 기능인 직접 저장은 생략. Character import 포맷과 혼동하지 않음 |

공식 소스 링크: https://github.com/Pasta-Devs/Marinara-Engine/tree/1a299369ac7025028c3ce1b80cc59f47b7b0691b

## 검증 범위

- Node 단위 테스트: 13개. 빈/긴/특수문자 데이터, 실제 Character 매핑과 Lorebook 미접근, 구조 오류, 모드 지침, placeholder 검사, field Undo, 빈 Personality, 성격 검증 실패, 번역 Name 유지, raw route/CSRF/세션, 권한 오류.
- Headless Chrome: 설치 산출물 실행, source 선택, trait 추가/수정/삭제, 생성, 수동 편집, 전체/필드 Reroll/Undo, 영어와 원본 분리, clipboard, JSON 다운로드, malformed/HTTP 오류 시 기존 결과 보존, 작업 중 편집 보존, source 변경 시 결과/traits 초기화, 모바일 배치, cleanup, 호스트 버튼 유지.
- API 응답은 소스 구조에 맞춘 테스트 fixture입니다. 실제 Marinara 인스턴스에서의 import 승인/로드 및 실제 LLM 품질은 아직 미검증입니다. mock 기반 검증을 실서버 end-to-end 완료로 표현하지 않습니다.

## 1.0.1 수정 (2026-09-08)

로컬 Marinara Engine v2.4.4의 `characters.routes.ts`와 `characters.storage.ts#getById`를 다시 추적하여 Character detail 응답의 `data`가 **JSON 문자열**임을 확인했습니다. 최초 구현과 브라우저 fixture가 이를 객체라고 잘못 가정했습니다. 문자열을 JSON.parse로 변환한 후 필요한 필드를 투영하도록 수정했습니다. 이미 객체인 입력도 그대로 처리합니다. 잘못된 JSON, null, 배열 등은 이해하기 쉬운 오류로 처리합니다. 실제 문자열 응답 회귀 테스트가 수정 전 실패하는 것을 확인했고, 브라우저 fixture도 실제 wire 형식으로 고쳤습니다.

## 1.1.0 직접 선택 (2026-09-08)

사용자 요청으로 채팅 선택 UI와 `/api/chats` 요청을 완전히 제거했습니다. 기존 명세 파일 자체는 수정하지 않았으며, 위의 채팅 수동 선택 항목은 이전 버전의 기록입니다. 최신 공식 HEAD는 여전히 `1a299369ac7025028c3ce1b80cc59f47b7b0691b`입니다.

- `GET /api/characters?includeBuiltIn=false`: 저장된 Character 목록. `characters.routes.ts`의 목록 route 및 `characters.storage.ts#list`에서 DB row 배열 반환을 확인. `data` JSON 문자열을 정상 파싱합니다.
- 선택 시 `GET /api/characters/:id`로 최신 상세 필드를 읽습니다.
- `GET /api/characters/personas/list`에서 Base Persona를 직접 고릅니다. 전역 활성 Persona를 기본값으로 사용하며, 선택 변경 시 `/api/characters/personas/:id`로 최신 상세를 읽습니다.
- source 읽기 작업 중 두 선택기를 잠시 비활성화해 서로의 요청을 취소하지 않게 합니다. generation 중 source 변경 시 이전 결과 응답을 버리는 동작은 유지합니다.
- 브라우저 fixture에서 모든 채팅 route를 제거하고, 채팅 없이 Persona/Character를 선택해 전체 흐름을 실행합니다. 빈 Character 목록, source 변경, 생성 결과 초기화 및 `/chats` 요청이 전혀 없음을 검사합니다.
- 직접 저장은 별도 `SAVE-REVIEW.md`에서 검토했습니다. 이번 버전은 저장 mutation을 추가하지 않았습니다.

## 1.2.0 사용자 승인 명세 변경

이번에는 사용자가 기존 명세 자체의 수정도 명시적으로 요청했습니다. `persona-adapter-spec.md`의 Undo 요구/완료 기준을 제거하고 §15를 Persona Length 전략으로 교체했습니다. 원본 Personality 문장 유지라는 전제를 사용자 확정 Core Personality 유지로 바로잡았으며, Creative 외형 강화와 UI 배치를 반영했습니다. 이전 절의 “명세 미수정” 및 Undo 검증 기록은 당시 버전의 기록입니다.

변경 파일: `src/ui.js`(Undo 상태·버튼 제거, Length 상태/선택 및 generation 전달, 배너 제거/요소 이동), `src/model.js`(복원 helper 제거), `src/prompts.js`(독립 Length 전략, Core 의미 정정, Creative 외형, 번역 분리), 테스트 2개 파일(Undo 테스트 제거 및 새 정책 검증), build/package 메타데이터와 dist(1.2.0), README와 본 기록. API endpoint 및 Marinara 본체 소스 변경은 없습니다.

단위 테스트 14개와 fixture 기반 Chrome 검증을 통과했습니다. 실제 LLM의 외형 다양성·분량·비사칭 성향·Example Lines 품질 검증은 수행하지 않았습니다. Persona Length는 별도의 확장 generation 입력이며 Marinara raw API에 지원하지 않는 새 body parameter를 추가하지 않습니다.

## 1.4.0 선택형 로어북 참조

공식 main `12a0acd5b7823abeaf3e05ad39a3a07d957e9ffc`에서 확인했습니다. `GET /api/lorebooks?characterId=...`는 캐릭터 연결 목록을, `GET /api/lorebooks/:id/entries`와 `/folders`는 항목과 폴더를 반환합니다. 명세의 v1 로어북 제외 제한은 사용자의 선택형 참조 확장 요청으로 변경하며, 명세 파일은 수정하지 않았습니다. 본체 변경 없이 기존 full_page_access와 동일 출처 API를 사용합니다.

## 1.5.0 추가 지침

공식 main `e5ead06ac2fe1cb3e039f8cab7e4d266b01dac44`의 `routes/generate/raw-route.ts`에서 기존 messages 기반 비스트리밍 요청 구조를 확인했습니다. 추가 지침은 기존 user 메시지의 선택 필드로 전달하며 본체 API 변경은 없습니다.
