# Editorial Constitution of the Brazilian Credit Observatory

Version 2, of 24/09/2026. It applies to every agent, to the mechanical validator and to the reviewers. In case of conflict with any other document, this one prevails. Only the project owner amends this text, through a dedicated pull request.

By decision of the project owner, no stage of this project has human review. The role that an editor would play is filled by a set of independent reviewers, all of them agents, combined with rules that code can verify. Where version 1 called for human judgment, this version either forbids the topic or requires mechanical verification.

## Art. 1. Numbers

1. Every published number comes from the deterministic gold layer (including a field computed by the pipeline and published in the gold layer with its declared formula, such as the real change deflated by the IPCA consumer price index) or from a fact package derived from it by a declared formula (difference or percentage change between two gold values). There is no other path.
2. Agents do not calculate, estimate, round, convert or type numbers. The text refers to facts by identifier; the value is inserted afterwards, mechanically, from the package.
3. Existing exception: a value transcribed from a primary document (Phase 2) is valid only if code confirms that the quoted literal passage contains the value. Transcription is not calculation.
4. A later revision by the source does not make an earlier note wrong: the note is valid for the gold layer that generated it, identified by hash. The revision is recorded, not erased.

## Art. 2. Three classes of statement

Every paragraph declares a class. A paragraph without a class is sent back.

- **Evidence**: states what the data show. It contains only facts from the package, each with its source and reference date, or declares a gap.
- **Inference**: a reading of the evidence. It states which evidence it starts from and what would refute it.
- **Recommendation**: does not exist in the notes of the Observatory.

## Art. 3. Absence

Data that were not measured, not collected or not accessed are declared as a gap, with the reason. They are never estimated, interpolated or filled in by analogy. A gap in the package appears in the note.

## Art. 4. Traceability

Every note carries its reproducibility package: hash of the gold files, hash of the facts, commit, verification command, the validator log and the opinion of each reviewer. Any reader can recompute every number and obtain the same result.

## Art. 5. Off-limits topics

No note deals with the topics below. The mechanical validator blocks them; there is no exception or approval that reverses this.

1. A named financial institution.
2. Deposit insurance, resolution, liquidation or intervention regimes.
3. Open Finance and its participants.
4. A new thesis or an interpretation that goes beyond reading the facts in the package.

The reason is governance: the project owner holds board and executive positions at entities in the financial system, and without human review nobody is in a position to recuse themselves. The topic is left out rather than left without a safeguard.

## Art. 6. Independent review

1. Each note goes through three reviews by agents, after the mechanical validator: the constitutional validator, the independent reviewer and the third reviewer.
2. The reviewers do not see the drafts, the authors' reasoning, the critic's objections or one another's opinions.
3. The three reviews differ in at least three of these characteristics: model, vendor, evidence received, mandate and the way the data are presented. The characteristics of each review are recorded in the note's manifest.
4. No reviewer approves numbers; numbers are checked mechanically.
5. A note is approved only unanimously. A reviewer sends a note back if and only if it points to a serious item (the reader would come away with a false belief about a fact, or this constitution is violated); the decision is derived from the items by code. Moderate and minor items are recorded suggestions and do not block. Any note sent back returns to review; once the limit of rounds is reached, the note is rejected and not published.
6. A block by the mechanical validator is not reversed by anyone.

## Art. 7. Language

Brazilian Portuguese with correct accents. No hyphens or dashes in prose; negative numbers use the minus sign. No value-laden adjective about a number ("strong", "worrying", "record") without a yardstick declared in the package. No vocabulary of ratings, recommendations or forecasts.

## Art. 8. Mechanical validator

Code, with no language model. It decides to approve, send back or block, with a written reason for each item. It blocks a typed number, a nonexistent fact, a tampered package, a direction contrary to the sign, a number in the wrong cut and an off-limits topic.

## Art. 9. Autonomy levels

1. **Level 1**: an approved note stays only in the repository (`notas/`).
2. **Level 2**: an approved note is published on the site when its type of note meets, in a measured and recorded way: at least three consecutive cycles with no factual error found by the auditor; the reviewers, together, catching at least 90% of the planted semantic errors; and no undue rejection in the clean controls.
3. A relevant published error automatically returns that type of note to level 1 and resets the count.

## Art. 10. Error

1. **Factual error**: a number, reference date, source, sign, unit, definition or attribution that differs from the package.
2. **Relevant error**: a published factual error, or a published note on an off-limits topic.
3. Every month the auditor checks each approved note against the gold layer and the primary source. An error found by the auditor, by a reviewer or by a reader generates a dated erratum at the same address, without erasing the original text, and goes into the public error log.

## Art. 11. Boundary

Agents read the published gold layer and write only in `notas/`. They do not write to the pipeline, to the gold layer, to `public/` or to the main branch. Nothing an agent produces changes a number of the Observatory.
