---
type: prd
tier: T0
status: DRAFT
last_reviewed: "2026-11-27"
---

# PRD — browser-ext-agent

> **Describe the product at the slice of the CURRENT LOOP.** Fill in upfront. After the scope is locked, this file is the source of truth for every agent decision.
> Delete every `_TO_FILL_` line once filled in — checks look for this marker.

---

## 1. Pain point

Debug một web app đang chạy trên browser thật của mình phải copy log, chụp màn hình, mô tả lại cho AI agent rồi tự dịch bug sang lời văn. Headless automation (Playwright) không dùng được vì cần session đăng nhập sẵn, extension, môi trường đã cấu hình của browser thật.

<!-- One paragraph. The SPECIFIC problem that makes someone annoyed, losing time, or losing money.
     Do not write "no good solution exists" — write the real pain, with evidence if any.
     Example: "The owner of a small auto shop books repair appointments in a paper notebook and Zalo. Double bookings 2-3 times/week,
     each costing about 1 hour of calling customers back and reshuffling mechanics." -->

## 2. Audience

Developer dùng AI agent (Claude Code) hàng ngày, muốn agent tự thao tác trực tiếp trên browser thật của họ để debug/test web đang phát triển. Bắt đầu với 1 user (project owner), dùng cá nhân.

<!-- SPECIFIC, not "users in general". Who? How many people of this kind? What are they coping with today?
     Example: "Auto-shop owners with 3-10 mechanics in a big city. Currently on paper + Zalo. No IT staff." -->

Detailed personas + per-role capabilities + permission matrix: `context/PERSONAS.md`.

## 3. Acceptance criteria (AC) — this loop

<!-- If these are done, the current loop counts as done. Write from the user's perspective,
     observable. Number them AC-1..AC-n — agents reference these numbers in DECISIONS and tests.

     COUNT: 3 to 7. More than 7 is too much scope for one week.
     Leave the "Capability" column empty unless you maintain a capability map. -->

| # | What can be done | Done when | Capability |
|---|---|---|---|
| AC-1 | Agent điều khiển browser thật qua MCP | Vòng agent→MCP→server→WS→extension→trang→response chạy trọn vẹn (đã pass smoke test E2E) | |
| AC-2 | Agent đọc console + snapshot trang để debug | browser_console_logs trả log/exception; snapshot outline ref sạch, secret đã mask | |
| AC-3 | User giữ quyền kiểm soát | Extension passive mặc định; agent chỉ điều khiển sau khi user click Enable; tắt = ngắt WS ngay, tool trả lỗi | |
| AC-4 | Secret không rò rỉ qua agent | Snapshot không bao giờ trả value input; sensitive field mask; screenshot che trước khi chụp; token-pattern redact | |

<!-- Empty AC rows don't count — fill the "What can be done" cell fully or delete the extra rows. -->

## 4. Priority — what this loop ships, where the rest lives

<!-- One line: "Loop 1 ships all ACs in §3; everything else sits in ROADMAP.md §3 backlog".
     Say why this slice comes first. Full map in CAPABILITIES-MAP.md,
     loop breakdown in ROADMAP.md §1.

     Prototype screen refs land here: `prototype/gallery/screens` s1, s2, ...
     referenced by id (one line per screen, e.g. "s2 - Dashboard serves AC-5, AC-6"). -->

Loop 1 ships AC-1..AC-4. Mọi thứ còn lại nằm ở §5 out-of-scope / DECISIONS D14 (scenario v2).

## 5. Out-of-scope — definitely NOT done in this loop

<!-- This is the most important part of scope-lock. List explicitly the things most likely to get pulled into the build.
     Anything here, if later deemed necessary, goes straight to ROADMAP.md — never into this loop. -->

- Scenario runner + tool `browser_run_scenario` (v2, schema đã sẵn — D14)
- Cookie/localStorage/network/history tools (D8 — cần decision + redact riêng)
- Firefox / Safari support
- Chrome Web Store listing (v1: load unpacked)
- eval_js, hover, select-option, file download
- Auth user, DB, i18n, UI dashboard

## 6. Hypothesis + success metric

Loop này không đo lường sản phẩm — done nghĩa là đạt AC-1..AC-4 (đã smoke test AC-1 end-to-end). Đo lường thật (số lần agent resolve bug không cần copy-paste log) để loop sau khi dùng hằng ngày.

<!-- ONE number, measurable, with a decision threshold. This is the basis for go/pivot/kill.
     Example: "≥10 shops create real appointments in the first 5 days. <5 → kill. 5-9 → pivot the approach."

     If this loop is not measured, write "this loop is not measured — done means the ACs in §3"
     and say which loop will measure it. -->

---

## 7. Decisions already locked

<!-- Lock them here so agents don't have to ask again. Missing an item, the agent decides + logs DECISIONS.md.
     This is what keeps rule #2 standing: after the scope lock there is no more asking, so the places
     that most often need a question must have their answer right here. -->

| Item | Locked |
|---|---|
| Login | Không có — dùng cá nhân, token shared secret khi server bind ngoài localhost (D13) |
| Charging money | Không (v1) |
| Core data model | Command/Response/SecretConfig/Scenario — ARCHITECTURE §6 |
| Edge cases | 2 connections, timeout 30s, mất nối giữa command, ref stale — ARCHITECTURE §6 bảng edge cases |
| Empty state | Extension tắt → mọi tool trả lỗi kèm hướng dẫn bật (D9) |
| Error state | Error codes tập trung (shared/errors.ts), tool trả isError + text rõ cho agent |
| Sample data | n/a — không DB |
| Name / domain / voice | browser-ext-agent; voice: kỹ thuật, terse |
| Deploy place | npm (`npx -y browser-ext-agent`); extension load unpacked (D12) |

## 8. Sources

<!-- `context/INTERVIEW.md` (items with evidence), plus any additional documents
     provided by the project owner. -->

- Không có nguồn ngoài — yêu cầu trực tiếp từ project owner (phiên 2026-11-27).

---

## 9. Change log

| Date | Change | Reason |
|---|---|---|
| 2026-11-27 | Created from template | — |
| 2026-11-27 | Điền PRD v1 sau lần dựng đầu | Code v1 tồn tại, AC-1 đã smoke test pass |
