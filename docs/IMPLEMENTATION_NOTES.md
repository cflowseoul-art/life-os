# Implementation Notes — MVP flow

UX problems revealed while implementing the approved design. **Recorded, not fixed.** The
implementation follows the documents; nothing here was redesigned around.

---

**1. 제목 is doing hidden work.**
The Career capability requires a company and a role. The approved composition surface has 제목 ·
요청 · 첨부 and no fields for either, so the bridge splits 제목 on a separator (`·`, `,`, `-`) to
get them. A founder who writes 제목 the way the introduction's examples speak — "이력서 좀 맞춰
줘" — gets the engine's refusal ("회사가 비어 있습니다"), which is honest but reads as a form
error on a surface designed to have no form. Real fix is inference at the capability boundary
(Art. 7: a model proposing a typed command), not a field.

**2. The refusal appears after 보내기, not before.**
Nothing on the composition surface hints at what will be refused. Correct per the design — no
validation theater, no disabled-until-valid — but the first failure is a surprise.

**3. Only Career exists, so every request lands there.**
Routing is invisible as designed, but there is nothing to route to. The invisibility is currently
indistinguishable from there being no routing at all.

**4. The company reply is client-side copy, not a recorded event.**
"김리서치 · 맡았습니다" is rendered by the component after a successful handover. It is not in the
log, so it cannot be re-read, and the name is not the name that appears on the report later
(담당 서junior). Two different names for the same piece of work in the first two minutes.

**5. 수정 요청 is inert.**
No revision event exists in the engine. The button is rendered disabled rather than pretending to
act. Unchanged from V1.

**6. First run is a global state, not a per-representative one.**
The introduction shows when the log has no holds. Withdrawing every hold would bring it back,
which contradicts "a second introduction, ever."

**7. 첨부 is a textarea, not an attachment.**
The design says 첨부 (a posting, a photo, a document). The engine takes text, so the field takes
pasted text.

**8. Approve-and-release copy competes with the completed row.**
After 승인 the released state and the newly-completed row are both on screen. Correct per the
documents, slightly redundant in practice.

**9. Still open from V1, unchanged:** 완료 appears in both 업무 보고 and 보고서 with no fading
rule; 프로젝트 is one row per hold; 일정 is permanently empty; 판단 근거 copy is career-shaped
fixed text in the component rather than coming from the record.
